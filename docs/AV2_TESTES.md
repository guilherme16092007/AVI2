# AV2 — Testes e verificação

Este documento diz **exatamente** o que foi verificado, como, e o que ainda precisa ser confirmado no seu ambiente. A separação é deliberada: só afirmo como "verificado" o que foi realmente executado.

## 1. O que foi executado (ambiente de desenvolvimento, sem acesso à internet)

| Verificação | Comando | Resultado |
|---|---|---|
| Regras de negócio da AV2 (camada de serviços, repositórios em memória) | `npx tsx tests/server/servicos.test.ts` | **90/90** |
| Funções puras: ambiente, tradução de erros → HTTP, datas, paginação | `npx tsx tests/server/utilitarios.test.ts` | **33/33** |
| AV1 (regressão): compilação `strict` e jornada completa | `npx tsc -p tsconfig.json` + `npx tsx tests/journey.test.ts` | 0 erros · **40/40** |
| Compilação `strict` do servidor + testes + seed | `tsc` com *stubs* de tipos para Fastify/Prisma | 0 erros (ver limite abaixo) |
| JSON Schemas (aceitam/recusam os payloads certos) | Ajv local, mesmas opções do Fastify | **32/32** casos |
| Consistência `schema.prisma` ↔ migrações SQL (colunas, tipos, nulidade, defaults, índices, UNIQUEs, FKs, enums, colunas citadas nos CHECKs) | Script de conferência | Sem divergências |

O que os testes de serviços cobrem: autenticação (credencial errada e usuário inexistente com a mesma resposta; inativo), matriz de permissões por papel, CNPJ (dígitos, duplicidade), contrato (vigência, número único, atualização com versão), janela de datas do lote (futuro, > 90 dias, parâmetro global), criação de lote com equipamentos, **rollback** (falha no meio desfaz o lote e os equipamentos; falha ao gravar a movimentação não altera o status), triagem, máquina de estados, regra da justificativa, **conflito de versão**, rastreabilidade em ordem cronológica, relatório (valores exatos e polimorfismo por tipo) e paginação.

## 2. O que NÃO foi executado aqui (e por quê)

O ambiente em que o código foi desenvolvido **não tem acesso ao npm nem a um PostgreSQL**. Portanto **não foram executados**:

- `npm install` com Fastify, `@fastify/jwt` e Prisma, e a compilação contra as **tipagens reais** dessas bibliotecas (a checagem de tipos usou *stubs* que aproximam a API; valida sintaxe, *imports* e consistência interna, mas não a compatibilidade exata com as bibliotecas).
- `npx prisma generate`, `migrate deploy` e o **SQL das migrações em um PostgreSQL real** (a consistência com o schema foi conferida por script, e a sintaxe revisada, mas não executada).
- O **seed** contra o banco.
- O **servidor** subindo, o *graceful shutdown* e o `tests/server/http.test.ts` (app Fastify real). Esse teste foi escrito e passa na checagem de tipos, mas só pode rodar com as dependências instaladas.
- Comportamento transacional real do PostgreSQL (o *rollback* foi comprovado apenas no simulador em memória; o uso correto de `$transaction` foi revisado, não executado).

**Se algo falhar nesses pontos na sua máquina, é esperado que seja um ajuste pequeno (versão de biblioteca ou detalhe de tipagem); me envie a mensagem de erro completa.**

## 3. Roteiro de verificação no seu ambiente

Execute na ordem; cada passo indica o resultado esperado.

### 3.1 Instalação e build

```bash
npm install
npm run build:server        # gera o Prisma Client e compila (esperado: sem erros)
npm run build               # AV1 continua compilando (esperado: sem erros)
npm test                    # AV1 (40) + AV2 (90 + 33), sem banco
npm run test:http           # rotas HTTP com o Fastify real (esperado: todas OK)
```

### 3.2 Banco, migrações e seed

```bash
docker compose up -d        # ou PostgreSQL local; ajuste DATABASE_URL no .env
npx prisma migrate deploy   # esperado: 2 migrações aplicadas
npm run db:seed             # esperado: resumo com usuários e IDs de teste
```

### 3.3 Constraints no banco (via `psql`, ou `docker exec -it greencode-db psql -U greencode`)

Cada comando abaixo **deve falhar** com a mensagem indicada (comprova que o banco recusa estados inconsistentes mesmo sem passar pela API):

```sql
-- CNPJ fora do formato -> viola ck_organizacao_cnpj_formato
UPDATE "Organizacao" SET "cnpj" = '123' WHERE true;

-- Trilha de auditoria imutável -> "Movimentacao e imutavel (append-only)"
UPDATE "Movimentacao" SET "justificativa" = 'x' WHERE true;
DELETE FROM "Movimentacao";

-- Estado físico fora de 0..4 -> viola ck_equipamento_estado_fisico
UPDATE "Equipamento" SET "estadoFisico" = 9 WHERE true;

-- Código de barras duplicado -> viola Equipamento_codigoBarrasInterno_key
UPDATE "Equipamento" SET "codigoBarrasInterno" = 'BC-H-0001' WHERE "codigoBarrasInterno" = 'BC-H-0002';
```

### 3.4 API (com o servidor em execução)

| # | Chamada | Esperado |
|---|---|---|
| 1 | `GET /saude` | 200, `banco: "conectado"` |
| 2 | `GET /organizacoes` sem token | 401 |
| 3 | Login como `auditor` e `POST /organizacoes` | 403 |
| 4 | Login como `gestor` e `PATCH /equipamentos/<id AGUARDANDO_TRIAGEM do seed>/status` com `EM_DESMONTE` | 422 (desmonte sem triagem) |
| 5 | `POST /equipamentos/<id>/triagem` e, em seguida, `PATCH …/estado-fisico` `RUIM` sem justificativa | 200 e depois 422 |
| 6 | Repetir uma alteração enviando a `versao` antiga | 409 |
| 7 | `POST /lotes` com um `codigoBarrasInterno` já existente num dos itens | 409 e **nenhum** lote novo criado |
| 8 | `GET /equipamentos/<id>/rastreio` | Histórico em ordem cronológica |
| 9 | `GET /relatorios/valor-residual` como `auditor` | 200 com totais |
| 10 | Encerrar com Ctrl+C | Log "servidor encerrado com sucesso", processo termina |

## 4. Observações sobre a AV1 (encontradas durante o desenvolvimento)

Não alterei nenhum arquivo de código da AV1. Registro aqui o que observei, para decisão sua:

1. **`tsx` não estava em `devDependencies`**, apesar de `npm test` e `npm run dev` o usarem. Corrigido no `package.json` (necessário também para a AV2).
2. **Datas de criação não são restauradas ao carregar do arquivo** (`Ativo` sempre define `criadoEm = agora` e o `deJSON` não o restaura). Efeito: o `rastreio` do CLI mostra o horário da leitura, e a depreciação por idade do equipamento é sempre ~0. A AV2 não é afetada (lê `criadoEm` do banco). Correção sugerida: aceitar `criadoEm` opcional no construtor de `Ativo` e repassá-lo nos `deJSON`.
3. **`lote criar` sem `--data` usa a data em UTC**; à noite no Brasil (UTC−3) isso já é "amanhã" e a validação rejeita como data futura. A AV2 usa o calendário local do servidor.
