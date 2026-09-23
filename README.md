# greencode

Sistema de linha de comando (CLI) para gestão de logística reversa de resíduos eletroeletrônicos — núcleo operacional de uma plataforma que conecta organizações geradoras de e-lixo (varejo, hospitais, universidades, bancos, indústrias) a operadores logísticos e ao mercado de recuperação de materiais.

> Atividade de Avaliação Individual 1 — Prof. Eng. Dr. Gerson Penha.
> Desenvolvido em **Node.js + TypeScript**, sem dependências externas de runtime (apenas a biblioteca padrão do Node).

---

## Sumário

- [Visão geral](#visão-geral)
- [Principais características](#principais-características)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Primeiro uso (provisionamento)](#primeiro-uso-provisionamento)
- [Uso — modo interativo (REPL)](#uso--modo-interativo-repl)
- [Uso — modo script (um comando por invocação)](#uso--modo-script-um-comando-por-invocação)
- [Papéis e permissões](#papéis-e-permissões)
- [Catálogo de comandos](#catálogo-de-comandos)
- [Exemplo de jornada completa](#exemplo-de-jornada-completa)
- [Arquitetura](#arquitetura)
- [Segurança](#segurança)
- [Testes](#testes)
- [Compatibilidade de plataformas](#compatibilidade-de-plataformas)
- [Roadmap (próximas etapas)](#roadmap-próximas-etapas)
- [Licença](#licença)

---

## Visão geral

O `greencode` administra o ciclo de vida completo de um equipamento eletrônico dentro da operação de logística reversa:

```
Organização gera resíduo
        │
        ▼
   Lote é recebido  ──────────────►  RECEBIDO
        │
        ▼
Equipamento cadastrado  ─────────►  AGUARDANDO_TRIAGEM
        │
        ▼
      Triagem  ──────────────────►  TRIADO  (estado físico avaliado)
        │
        ▼
     Desmonte  ──────────────────►  EM_DESMONTE
        │
        ▼
 Reciclagem / Descarte  ─────────►  RECICLADO / DESCARTADO
```

Cada transição gera uma **movimentação** auditável e uma entrada no **journal** (log de transações), permitindo reconstruir o histórico completo de qualquer equipamento a qualquer momento (`rastreio consultar`).

## Principais características

- **Quatro papéis funcionais** com menu dinâmico e controle de acesso: `ADMINISTRADOR`, `OPERADOR_CADASTRO`, `GESTOR_ALMOXARIFADO`, `AUDITOR`.
- **Autenticação** com senhas em arquivo separado, hashing PBKDF2-HMAC-SHA256 (salt + 210k iterações) e **sessão com expiração após 30 min de inatividade**.
- **Persistência cifrada com AES-256-GCM** (autenticado) em todos os arquivos de dados (organizações, lotes, equipamentos, movimentações, credenciais).
- **Journal (write-ahead log)** cifrado, com **rotação automática a 10 MB** e **retenção mínima de 180 dias**.
- **Escrita atômica** (arquivo temporário + `rename`) em todas as operações de persistência, protegendo contra corrupção de dados em caso de queda do processo.
- **Validação de CNPJ** com cálculo real dos dígitos verificadores (algoritmo da Receita Federal).
- **Regras de negócio** aplicadas: janela de datas de lote (não futura, não superior a 90 dias retroativos), máquina de estados de status do equipamento (desmonte só após triagem), justificativa obrigatória em quedas de 2+ categorias no estado físico.
- **Orientação a objetos completa**: herança (`Ativo` → entidades; `Equipamento` → 6 subtipos concretos), interfaces (`IDepreciavel`, `IRastreavel`, `IClassificavelParaRecuperacao`), polimorfismo (cálculo de valor residual e potencial de recuperação variam por subtipo), classes abstratas de validação (Template Method) e fábricas (`EquipamentoFactory`).
- **CLI real**: autocompletar de comandos, histórico persistente entre sessões, mensagens de feedback categorizadas por severidade.
- **40 testes automatizados de ponta a ponta** (`tests/journey.test.ts`), cobrindo o caminho feliz e os principais cenários de falha.

## Requisitos

- **Node.js 18 ou superior** (testado com Node 22).
- Windows 10+, Linux Ubuntu 24.04+ ou distribuições derivadas do Ubuntu — ver [Compatibilidade de plataformas](#compatibilidade-de-plataformas).
- Nenhuma dependência de runtime além da biblioteca padrão do Node (apenas `typescript` como dependência de desenvolvimento, para compilar).

## Instalação

```bash
git clone <url-do-repositorio>
cd greencode
npm install
npm run build
```

Isso compila o TypeScript de `src/` para `dist/`. Para rodar sem compilar (desenvolvimento), use `npm run dev` (via `tsx`).

## Primeiro uso (provisionamento)

Na primeira execução, o sistema detecta que não existe arquivo de configuração mestre e entra em **modo de provisionamento inicial**: gera a chave criptográfica mestra AES-256 e solicita a criação da primeira conta `ADMINISTRADOR`.

```bash
node dist/index.js
```

```
======================================================================
 GREENCODE - Provisionamento inicial
======================================================================
Nenhum arquivo de configuracao mestre foi encontrado.
O sistema entrara em modo de provisionamento inicial...

Defina o username do administrador [admin]: admin
Defina a senha do administrador (min. 8 caracteres): ********

Administrador 'admin' criado com sucesso. Provisionamento concluido.

greencode> _
```

> Para scripts automatizados e pipelines de CI (sem terminal interativo), defina as variáveis de ambiente `GREENCODE_ADMIN_USER` e `GREENCODE_ADMIN_PASSWORD` antes da primeira execução — ver [docs/TESTES.md](docs/TESTES.md).

Os dados são gravados, por padrão, em `./data` (arquivos cifrados) e `./.greencode` (chave mestra, configuração e sessão), relativos ao diretório de onde o comando é executado. É possível apontar para outro local com a variável de ambiente `GREENCODE_HOME`.

## Uso — modo interativo (REPL)

```bash
node dist/index.js
greencode(admin@ADMINISTRADOR)> ajuda
greencode(admin@ADMINISTRADOR)> org criar --cnpj "11.222.333/0001-81" --razao "Hospital Central" --tipo HOSPITAL --contato "Maria Silva" --email maria@hospital.com
greencode(admin@ADMINISTRADOR)> sair
```

O prompt exibe o usuário e papel autenticados. Use **Tab** para autocompletar entidades e ações, e as setas ↑/↓ para navegar pelo histórico (persistido entre sessões).

## Uso — modo script (um comando por invocação)

Qualquer comando pode ser executado diretamente pela linha de comando do sistema operacional, útil para scripts e automação:

```bash
node dist/index.js login --user admin --senha "SenhaForte123"
node dist/index.js lote criar --org BR001 --nf 123456 --transp TransRapida
```

O processo encerra com código de saída `0` em caso de sucesso e `1` em caso de erro.

## Papéis e permissões

| Papel | Pode |
|---|---|
| `ADMINISTRADOR` | Tudo: gerenciar usuários, parâmetros globais, organizações, lotes, equipamentos, relatórios e journal. |
| `OPERADOR_CADASTRO` | Cadastrar organizações e consultar lotes/equipamentos/rastreio. |
| `GESTOR_ALMOXARIFADO` | Criar lotes, cadastrar equipamentos, realizar triagem, alterar estado/status. |
| `AUDITOR` | **Somente leitura**: listar, consultar rastreio e gerar relatórios. Nenhuma capacidade de alteração. |

## Catálogo de comandos

Execute `ajuda` dentro da CLI para ver os comandos disponíveis ao seu papel autenticado. Visão geral:

```
login --user <usuario> [--senha <senha>]
logout
whoami

usuario criar --username <nome> --senha <senha> --papel <PAPEL>
usuario listar

config definir --imposto <percentual> --depreciacao <percentual>
config ver

org criar --cnpj <cnpj> --razao <razao> --tipo <TIPO> --contato <nome> --email <email> [--prazo <dias>]
org listar

lote criar --org <organizacaoId> --nf <notaFiscal> --transp <transportadora> [--data <AAAA-MM-DD>]
lote listar [--org <organizacaoId>]

equipamento cadastrar --lote <loteId> --tipo <TIPO> --serie <numeroSerie> --codigo <codigoBarras>
equipamento triagem <equipamentoId> --estado <ESTADO>
equipamento estado <equipamentoId> --novo <ESTADO> [--justificativa "texto"]
equipamento status <equipamentoId> --novo <STATUS> [--obs "texto"]
equipamento listar [--lote <loteId>]

rastreio consultar <equipamentoId>
relatorio valor [--lote <loteId>]
journal expurgar

ajuda
sair
```

Valores aceitos: `--tipo` de organização: `VAREJO | HOSPITAL | UNIVERSIDADE | BANCO | INDUSTRIA | OUTRO`. `--tipo` de equipamento: `DESKTOP | NOTEBOOK | SERVIDOR | MONITOR | PERIFERICO | NOBREAK`. `--estado`: `NOVO | BOM | REGULAR | RUIM | INSERVIVEL`. `--novo` status: `TRIADO | EM_DESMONTE | RECICLADO | DESCARTADO`. `--papel`: `ADMINISTRADOR | OPERADOR_CADASTRO | GESTOR_ALMOXARIFADO | AUDITOR`.

## Exemplo de jornada completa

```bash
node dist/index.js login --user admin --senha "SenhaForte123"

node dist/index.js org criar --cnpj "11.222.333/0001-81" --razao "Hospital Central" \
  --tipo HOSPITAL --contato "Maria Silva" --email maria@hospital.com
# -> id da organizacao: ORG_ID

node dist/index.js lote criar --org ORG_ID --nf 123456 --transp TransRapida
# -> id do lote: LOTE_ID

node dist/index.js equipamento cadastrar --lote LOTE_ID --tipo NOTEBOOK \
  --serie SN-0001 --codigo BC-0001 --fabricante Dell --modelo Latitude
# -> id do equipamento: EQP_ID

node dist/index.js equipamento triagem EQP_ID --estado BOM
node dist/index.js equipamento status EQP_ID --novo EM_DESMONTE
node dist/index.js equipamento status EQP_ID --novo RECICLADO

node dist/index.js rastreio consultar EQP_ID
```

Uma versão executável e comentada desta jornada, incluindo os cenários de falha, está em [`tests/journey.test.ts`](tests/journey.test.ts).

## Arquitetura

Descrição completa das camadas, padrões de projeto (Factory Method, Template Method, Repository) e decisões de design em **[docs/ARQUITETURA.md](docs/ARQUITETURA.md)**, com diagrama de classes UML em **[docs/MODELO_UML.md](docs/MODELO_UML.md)**.

## Segurança

Justificativa detalhada de cada escolha (AES-256-GCM, PBKDF2-HMAC-SHA256, journaling, escrita atômica, expiração de sessão) e cenários de falha testados em **[docs/SEGURANCA.md](docs/SEGURANCA.md)**.

## Testes

```bash
npm test
```

Executa `tests/journey.test.ts`: 40 verificações automatizadas cobrindo provisionamento, autenticação, controle de acesso por papel, validação de CNPJ, janela de datas de lote, máquina de estados do equipamento, regra de justificativa, rastreabilidade, journal e criptografia em disco. Detalhes em **[docs/TESTES.md](docs/TESTES.md)**.

## Compatibilidade de plataformas

Testado e compatível com:

- Windows 10 ou superior (PowerShell ou CMD, Node.js 18+ instalado).
- Linux Ubuntu 24.04.03 LTS ou superior, e distribuições derivadas do Ubuntu.

O sistema não utiliza chamadas de sistema específicas de plataforma; toda a persistência é feita via API de arquivos padrão do Node.js (`fs`), portável entre os sistemas operacionais suportados.

## Roadmap (próximas etapas)

Conforme mencionado na proposta original do negócio, as próximas atividades do projeto incluem:

- Integração com uma interface web (dashboard de organizações, lotes e equipamentos).
- Migração da persistência em arquivo para um banco de dados relacional.
- Emissão de certificados de compensação ambiental e relatórios de consultoria a partir dos dados de rastreabilidade acumulados.
- Evolução do armazenamento da chave mestra para um cofre de segredos dedicado (ver [docs/SEGURANCA.md](docs/SEGURANCA.md)).

## Licença

MIT — uso livre para fins acadêmicos e educacionais.
