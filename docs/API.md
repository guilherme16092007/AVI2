# Documentação da API REST (AV2)

Base URL (desenvolvimento): `http://127.0.0.1:3000` · Formato: JSON (`Content-Type: application/json`).

## Convenções

- **Autenticação:** `POST /auth/login` devolve um JWT. Envie-o em todas as demais requisições: `Authorization: Bearer <token>`. O token expira em 30 min (configurável, `JWT_EXPIRES_IN`).
- **Autorização:** por papel. Cada rota lista abaixo quem pode chamá-la. Papel insuficiente → `403`.
- **Datas:** `AAAA-MM-DD` (campos de data) ou ISO 8601 (carimbos de data/hora).
- **Estado físico:** `NOVO`, `BOM`, `REGULAR`, `RUIM`, `INSERVIVEL` (do melhor para o pior).
- **Paginação:** listagens aceitam `?limite=` (1–200, padrão 50) e `?offset=` (≥ 0) e respondem `{ itens, total, limite, offset }`.
- **Controle de versão otimista:** todo recurso alterável traz o campo `versao`. Nas operações de alteração você pode enviar `"versao"` no corpo (a que leu); se outra requisição alterou o recurso antes, a resposta é `409`. Mesmo sem enviar `versao`, o servidor nunca sobrescreve uma alteração concorrente (o `UPDATE` é condicionado à versão lida).

### Papéis

| Papel | Resumo das permissões |
|---|---|
| `ADMINISTRADOR` | Tudo. |
| `OPERADOR_CADASTRO` | Cadastrar organizações e contratos; consultar. |
| `GESTOR_ALMOXARIFADO` | Criar lotes, cadastrar equipamentos, triagem, estado físico e status; consultar. |
| `AUDITOR` | Somente leitura, incluindo relatórios e parâmetros. |

### Formato de erro (todas as falhas)

```json
{
  "statusCode": 422,
  "erro": "VALIDACAO_NEGOCIO",
  "mensagem": "CNPJ '12345678000100' invalido (digitos verificadores nao conferem).",
  "detalhes": ["..."]
}
```

| Status | `erro` | Quando |
|---|---|---|
| 400 | `REQUISICAO_INVALIDA` | Corpo/parâmetros fora do JSON Schema (campo ausente, tipo errado, campo desconhecido, UUID malformado, JSON inválido). |
| 401 | `NAO_AUTENTICADO` | Token ausente/inválido/expirado, ou credenciais erradas no login. |
| 403 | `ACESSO_NEGADO` | Papel sem permissão para a operação. |
| 404 | `NAO_ENCONTRADO` | Recurso ou rota inexistente. |
| 409 | `CONFLITO` | Valor único repetido (CNPJ, código de barras, username, nº de contrato) ou versão desatualizada. |
| 422 | `VALIDACAO_NEGOCIO` / `REGRA_DE_NEGOCIO` / `RESTRICAO_BANCO` | Regra de negócio violada (CNPJ inválido, data fora da janela, transição de status inválida, justificativa ausente…). |
| 500 | `ERRO_INTERNO` | Falha inesperada (mensagem genérica; detalhes só no log do servidor). |
| 503 | — | `GET /saude` quando o banco está indisponível. |

## Endpoints

| Método e rota | Papéis | Descrição |
|---|---|---|
| `GET /saude` | público | Verifica o servidor e a conexão com o banco. |
| `POST /auth/login` | público | Autentica e devolve o JWT. |
| `GET /auth/me` | autenticado | Dados do usuário do token. |
| `POST /usuarios` | ADMINISTRADOR | Cria usuário. |
| `GET /usuarios` | ADMINISTRADOR, AUDITOR | Lista usuários (paginado). |
| `GET /parametros` | ADMINISTRADOR, AUDITOR | Parâmetros globais. |
| `PATCH /parametros` | ADMINISTRADOR | Altera alíquota, depreciação e janela de datas de lote. |
| `POST /organizacoes` | ADMINISTRADOR, OPERADOR_CADASTRO | Cadastra organização. |
| `GET /organizacoes` | autenticado | Lista organizações (paginado). |
| `GET /organizacoes/:id` | autenticado | Organização + contrato + lotes. |
| `GET /organizacoes/:id/contrato` | autenticado | Contrato da organização. |
| `PUT /organizacoes/:id/contrato` | ADMINISTRADOR, OPERADOR_CADASTRO | Cria (201) ou atualiza (200) o contrato. |
| `POST /lotes` | ADMINISTRADOR, GESTOR_ALMOXARIFADO | Cria lote (opcionalmente com equipamentos) numa transação. |
| `GET /lotes` | autenticado | Lista lotes (`?organizacaoId=`). |
| `GET /lotes/:id` | autenticado | Lote + equipamentos. |
| `POST /lotes/:id/equipamentos` | ADMINISTRADOR, GESTOR_ALMOXARIFADO | Adiciona um equipamento ao lote. |
| `GET /equipamentos` | autenticado | Lista (`?loteId=&status=`). |
| `GET /equipamentos/:id` | autenticado | Detalhe. |
| `POST /equipamentos/:id/triagem` | ADMINISTRADOR, GESTOR_ALMOXARIFADO | Triagem: `AGUARDANDO_TRIAGEM → TRIADO`. |
| `PATCH /equipamentos/:id/estado-fisico` | ADMINISTRADOR, GESTOR_ALMOXARIFADO | Altera o estado físico. |
| `PATCH /equipamentos/:id/status` | ADMINISTRADOR, GESTOR_ALMOXARIFADO | `EM_DESMONTE`, `RECICLADO` ou `DESCARTADO`. |
| `GET /equipamentos/:id/rastreio` | autenticado | Histórico completo de movimentações. |
| `GET /relatorios/valor-residual` | ADMINISTRADOR, AUDITOR | Valor residual, imposto e líquido (`?loteId=`). |

Equivalência com os comandos da AV1: `login` → `POST /auth/login`; `usuario criar/listar` → `/usuarios`; `config definir/ver` → `/parametros`; `org criar/listar` → `/organizacoes`; `lote criar/listar` → `/lotes`; `equipamento cadastrar` → `POST /lotes/:id/equipamentos`; `equipamento triagem/estado/status` → `/equipamentos/:id/{triagem,estado-fisico,status}`; `rastreio consultar` → `GET /equipamentos/:id/rastreio`; `relatorio valor` → `/relatorios/valor-residual`. (`journal expurgar` deixou de existir: a trilha de auditoria agora é a tabela `Movimentacao`, imutável.)

---

## Autenticação

### `POST /auth/login`

```json
{ "username": "admin", "senha": "Admin@12345" }
```

`200`:

```json
{
  "token": "eyJhbGciOi...",
  "tipo": "Bearer",
  "validade": "30m",
  "usuario": { "id": "…", "username": "admin", "papel": "ADMINISTRADOR", "ativo": true, "ultimoLoginEm": null, "criadoEm": "…", "versao": 1 }
}
```

O username não diferencia maiúsculas/minúsculas. Credenciais inválidas e usuário inexistente devolvem a **mesma** resposta `401` (não revela quais contas existem).

## Usuários e parâmetros

### `POST /usuarios` — `201`

```json
{ "username": "novo.usuario", "senha": "SenhaForte123", "papel": "AUDITOR" }
```

`username`: 3–50 caracteres (`a-z`, `0-9`, `.`, `_`, `-`); `senha`: mínimo 8. Duplicado → `409`.

### `PATCH /parametros` — `200`

```json
{ "aliquotaImpostoPercentual": 9.25, "coeficienteDepreciacaoAnual": 20, "limiteDiasRetroativosLote": 90, "versao": 1 }
```

Todos os campos são opcionais, mas ao menos um é obrigatório. Alíquota e depreciação: 0–100; janela: inteiro 1–3650.

## Organizações e contratos

### `POST /organizacoes` — `201`

```json
{
  "cnpj": "11.222.333/0001-81",
  "razaoSocial": "Hospital Central LTDA",
  "nomeFantasia": "Hospital Central",
  "tipo": "HOSPITAL",
  "contatoResponsavel": "Maria Silva",
  "emailContato": "maria@hospital.com",
  "diasPrazoArmazenamento": 45
}
```

`tipo`: `VAREJO | HOSPITAL | UNIVERSIDADE | BANCO | INDUSTRIA | OUTRO`. O CNPJ aceita pontuação e é guardado só com os 14 dígitos; os dígitos verificadores são conferidos (`422` se inválido; `409` se já cadastrado).

### `PUT /organizacoes/:id/contrato` — `201` (criado) ou `200` (atualizado)

```json
{
  "numero": "CT-2026-0001",
  "dataInicio": "2026-01-01",
  "dataFim": "2027-12-31",
  "clausulas": { "prazoColetaDias": 15, "descarteSeguroObrigatorio": true },
  "versao": 1
}
```

`dataFim` deve ser posterior a `dataInicio`. `clausulas` é um objeto livre (JSONB). `versao` só se aplica à atualização.

## Lotes e equipamentos

### `POST /lotes` — `201`

```json
{
  "organizacaoId": "<uuid>",
  "notaFiscal": "NF-123456",
  "transportadora": "TransRapida",
  "dataEntrada": "2026-10-15",
  "equipamentos": [
    { "tipo": "NOTEBOOK", "numeroSerie": "SN-1", "codigoBarrasInterno": "BC-0001", "fabricante": "Dell", "modelo": "Latitude" },
    { "tipo": "SERVIDOR", "numeroSerie": "SN-2", "codigoBarrasInterno": "BC-0002" }
  ]
}
```

- `dataEntrada` é opcional (padrão: hoje). Não pode ser futura nem anterior à janela configurada (padrão 90 dias) → `422`.
- `equipamentos` é opcional (até 500). O lote e **todos** os equipamentos (e suas movimentações de cadastro) são gravados **numa única transação**: se qualquer item falhar, nada é gravado.
- `tipo`: `DESKTOP | NOTEBOOK | SERVIDOR | MONITOR | PERIFERICO | NOBREAK`. `codigoBarrasInterno` é único → `409` se já existir (`422` se repetido dentro da própria requisição).
- Os equipamentos nascem `AGUARDANDO_TRIAGEM` com estado físico `BOM` (padrão da AV1 até a triagem).

### `POST /equipamentos/:id/triagem` — `200`

```json
{ "estadoFisico": "BOM", "versao": 1 }
```

### `PATCH /equipamentos/:id/estado-fisico` — `200`

```json
{ "novoEstado": "RUIM", "justificativa": "Placa-mae com sinais de queima", "versao": 2 }
```

Queda de **2 ou mais categorias** (ex.: `BOM → RUIM`) exige `justificativa` com no mínimo 10 caracteres (`422` caso contrário).

### `PATCH /equipamentos/:id/status` — `200`

```json
{ "novoStatus": "EM_DESMONTE", "observacao": "Bancada 3", "versao": 3 }
```

Transições permitidas: `TRIADO → EM_DESMONTE | RECICLADO`; `EM_DESMONTE → RECICLADO | DESCARTADO`. `RECICLADO` e `DESCARTADO` são finais. **Desmonte só após a triagem** (`422` caso contrário). O status `TRIADO` só é alcançado pela rota de triagem (que avalia o estado físico), por isso não é aceito aqui (`400`).

Cada uma dessas três operações grava, **na mesma transação**, a atualização do equipamento (com `versao + 1`) e uma linha em `Movimentacao`.

### `GET /equipamentos/:id/rastreio` — `200`

```json
{
  "equipamento": { "id": "…", "tipo": "NOTEBOOK", "estadoFisico": "REGULAR", "status": "RECICLADO", "versao": 6, "…": "…" },
  "historico": [
    { "tipo": "CADASTRO", "statusNovo": "AGUARDANDO_TRIAGEM", "usuario": "gestor", "criadoEm": "…" },
    { "tipo": "TRIAGEM", "statusAnterior": "AGUARDANDO_TRIAGEM", "statusNovo": "TRIADO", "estadoFisicoNovo": "BOM", "usuario": "gestor", "criadoEm": "…" },
    { "tipo": "MUDANCA_ESTADO", "estadoFisicoAnterior": "BOM", "estadoFisicoNovo": "RUIM", "justificativa": "…", "usuario": "gestor", "criadoEm": "…" }
  ]
}
```

## Relatório

### `GET /relatorios/valor-residual?loteId=<uuid>` — `200`

```json
{
  "geradoEm": "…",
  "parametros": { "aliquotaImpostoPercentual": 9.25, "coeficienteDepreciacaoAnual": 20 },
  "linhas": [
    { "equipamentoId": "…", "tipo": "NOTEBOOK", "estadoFisico": "REGULAR", "status": "TRIADO",
      "potencialRecuperacao": "REUTILIZACAO", "valorResidual": 675, "impostoEstimado": 62.44, "valorLiquido": 612.56 }
  ],
  "totais": { "quantidade": 1, "valorResidual": 675, "impostoEstimado": 62.44, "valorLiquido": 612.56 }
}
```

O valor residual é calculado pelo **polimorfismo do domínio da AV1** (cada tipo de equipamento é uma subclasse com sua regra de valorização e de potencial de recuperação), aplicando a depreciação anual; o imposto estimado usa a alíquota global. Sem `loteId`, considera todos os equipamentos.
