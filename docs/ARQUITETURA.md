# Arquitetura do greencode

## Objetivo deste documento

Descrever as camadas do sistema, os padrões de projeto aplicados e as decisões técnicas relevantes, com sua justificativa, para que qualquer desenvolvedor (ou o professor avaliador) consiga entender rapidamente **por que** o código está organizado da forma como está — não apenas **o que** ele faz.

## Visão em camadas

```
┌───────────────────────────────────────────────────────────────────┐
│  CLI (src/cli, src/commands, src/index.ts)                        │
│  - CommandParser: tokeniza e interpreta a linha de comando         │
│  - MenuManager: catálogo de comandos + visibilidade por papel      │
│  - Dispatcher: roteia comando -> handler, aplica controle de acesso│
│  - Cli (REPL): loop interativo, histórico, autocompletar           │
│  - commands/*: um handler por caso de uso, traduz flags -> chamada │
│    para a camada de serviço e formata o ResultadoOperacao          │
└───────────────────────────────────────────────────────────────────┘
                              │ chama
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│  Serviços de negócio (src/services)                                │
│  - OrganizacaoService, LoteService, EquipamentoService              │
│  - Orquestram validação + repositório + regras de transição         │
│  - Não conhecem nada sobre CLI, readline ou formatação de saída     │
└───────────────────────────────────────────────────────────────────┘
          │ valida com          │ persiste via
          ▼                     ▼
┌──────────────────────────┐  ┌────────────────────────────────────┐
│ Validação (src/validation) │  Repositórios (src/repositories)    │
│ - Validator<T> abstrata     │  - BaseRepository<T extends Ativo> │
│   (Template Method)         │    genérico, abstrato               │
│ - CnpjUtils, LoteValidator,  │  - Um repositório concreto por     │
│   TransicaoStatusValidator,   │    entidade, define apenas        │
│   MudancaEstadoFisicoValidator │   (de)serialização                │
└──────────────────────────┘  └────────────────────────────────────┘
                              │ usa
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│  Persistência (src/persistence)                                    │
│  - AtomicFileStore: escrita atômica (tmp + rename + fsync)          │
│  - JournalManager: write-ahead log cifrado, rotação e retenção      │
└───────────────────────────────────────────────────────────────────┘
                              │ usa
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│  Criptografia (src/crypto)                                         │
│  - CryptoService: AES-256-GCM (cifra/decifra arquivos)              │
│  - HashService: PBKDF2-HMAC-SHA256 (hash de senhas)                 │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│  Domínio (src/domain, src/factories)                                │
│  - Ativo (classe abstrata base) -> Organizacao, Lote, Usuario,      │
│    Movimentacao, Equipamento                                        │
│  - Equipamento (abstrata) -> 6 subtipos concretos                   │
│  - Interfaces: IDepreciavel, IRastreavel,                           │
│    IClassificavelParaRecuperacao                                    │
│  - EquipamentoFactory (Factory Method)                               │
│  Usado por TODAS as camadas acima — é o núcleo estável do sistema.  │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│  Autenticação e Autorização (src/auth)                              │
│  - AuthService: login, logout, sessão com expiração, exigirPapel    │
│  Cruza todas as camadas (a CLI a invoca antes de qualquer comando   │
│  de negócio; os serviços não lidam diretamente com sessão).         │
└───────────────────────────────────────────────────────────────────┘
```

A regra de dependência é sempre "de fora para dentro": CLI depende de Serviços, Serviços dependem de Validação/Repositórios, Repositórios dependem de Persistência/Criptografia, e todos dependem do Domínio. O Domínio não depende de nada além de `src/types`. Isso significa que trocar a camada de persistência (por exemplo, para um banco de dados relacional, conforme mencionado no roadmap) não exigiria alterar uma única classe de domínio ou de validação.

## Por que essa separação em camadas?

O enunciado é explícito de que este é o "protótipo de um negócio real" que evoluirá para uma interface web e um banco de dados relacional nas próximas etapas. Uma CLI que misturasse `readline.question(...)` diretamente com `fs.writeFileSync(...)` e regras de negócio no mesmo arquivo funcionaria para esta entrega, mas se tornaria descartável na próxima. Separando em camadas com fronteiras claras, apenas a camada de CLI (`src/cli`, `src/commands`) precisará ser substituída por uma camada de API HTTP/GraphQL no futuro; e apenas a camada de persistência (`src/persistence`, `src/repositories`) precisará ser substituída por um ORM/driver de banco de dados. O domínio, a validação e a lógica de negócio permanecem intactos.

## Padrões de projeto aplicados

### 1. Template Method — `Validator<T>` (`src/validation/Validator.ts`)

A classe abstrata `Validator<T>` define o algoritmo de validação (`validar`: executa todas as regras, acumula erros, nunca para na primeira falha) e delega às subclasses apenas a lista de regras (`regras()`). Isso evita repetir a lógica de "rodar todas as regras e agregar os erros" em cada validador concreto (`OrganizacaoValidator`, `LoteValidator`, `TransicaoStatusValidator`, `MudancaEstadoFisicoValidator`) — cada um só declara *o quê* validar, não *como* validar.

### 2. Factory Method — `EquipamentoFactory` (`src/factories/EquipamentoFactory.ts`)

Nenhum ponto do sistema fora da fábrica instancia `new EquipamentoDesktop(...)`, `new EquipamentoNotebook(...)` etc. diretamente. Todo o restante do código (repositórios, serviços, comandos) pede à fábrica um equipamento do `TipoEquipamento` desejado. Consequência prática: adicionar um novo tipo de equipamento (por exemplo, `EquipamentoPainelSolar`, mencionado como expansão futura de negócio na proposta) exige alterar apenas dois arquivos (`domain/Equipamento.ts` para a nova subclasse, e `factories/EquipamentoFactory.ts` para registrá-la no `switch`) — nenhum comando de CLI, repositório ou serviço precisa mudar.

### 3. Repository — `BaseRepository<T extends Ativo>` (`src/repositories/BaseRepository.ts`)

Classe abstrata genérica que concentra toda a lógica comum de carregar/persistir uma lista de entidades de um arquivo cifrado, com **write-ahead logging obrigatório** antes de qualquer mutação. Cada repositório concreto (`OrganizacaoRepository`, `LoteRepository`, `EquipamentoRepository`, `MovimentacaoRepository`, `UsuarioRepository`) implementa apenas dois métodos triviais de (de)serialização (`paraObjeto`/`deObjeto`) e eventuais métodos de consulta específicos (ex.: `existeComCnpj`). Isso elimina a duplicação que existiria se cada entidade reimplementasse manualmente a leitura/escrita atômica cifrada.

### 4. Herança e polimorfismo — `Equipamento` (`src/domain/Equipamento.ts`)

`Equipamento` é uma classe abstrata que implementa três interfaces (`IDepreciavel`, `IRastreavel`, `IClassificavelParaRecuperacao`) e fornece uma implementação padrão de `calcularValorResidual` e `potencialRecuperacao`. Seis subclasses concretas (`EquipamentoDesktop`, `EquipamentoNotebook`, `EquipamentoServidor`, `EquipamentoMonitor`, `EquipamentoPeriferico`, `EquipamentoNobreak`) herdam esse comportamento, e algumas o **sobrescrevem** (`override`) para refletir regras de negócio específicas do tipo — por exemplo, `EquipamentoNotebook.potencialRecuperacao()` nunca classifica um notebook em estado ruim como "reutilização" (baterias degradadas de notebook não são reaproveitáveis com segurança), enquanto `EquipamentoServidor.potencialRecuperacao()` é mais permissivo (servidores têm componentes de alto valor mesmo degradados). Esse é um exemplo de polimorfismo com valor de negócio real, não apenas um exercício acadêmico de `Animal`/`Cachorro`/`Gato`.

## Fluxo de uma operação de escrita (exemplo: triagem de equipamento)

1. `commands/EquipamentoCommands.ts::triagemEquipamento` extrai e valida os parâmetros da linha de comando (`CommandParser`).
2. Chama `EquipamentoService.realizarTriagem(...)`.
3. O serviço busca o equipamento no `EquipamentoRepository`, valida a transição de status com `TransicaoStatusValidator` (Template Method).
4. Chama `EquipamentoRepository.atualizar(...)`, que:
   1. Serializa o estado "antes" da entidade.
   2. Aplica a função de mutação em memória.
   3. Serializa o estado "depois".
   4. **Registra uma entrada no `JournalManager` (write-ahead log) com antes/depois** — isso acontece **antes** de persistir o novo estado no arquivo de entidades.
   5. Persiste a lista inteira de equipamentos de volta no arquivo `equipamentos.enc`, de forma atômica (`AtomicFileStore`: escreve em `.tmp`, `fsync`, `rename`).
5. O serviço cria e persiste um registro de `Movimentacao` (consultável depois via `rastreio consultar`).
6. O handler de comando formata o `ResultadoOperacao` e a CLI o imprime com a cor correspondente à severidade.

Se o processo for interrompido entre os passos 4.4 e 4.5 (por exemplo, o computador desliga), o journal já contém o registro da tentativa de transação, mas o arquivo `equipamentos.enc` continua com o conteúdo anterior íntegro (a escrita atômica garante que nunca existe um estado parcialmente escrito em disco). Na próxima inicialização, um administrador pode inspecionar o journal para decidir se a operação deve ser refeita manualmente — a extensão natural para uma próxima etapa seria um comando de reprocessamento automático de transações órfãs.

## Estrutura de diretórios

```
greencode/
├── src/
│   ├── auth/          # Autenticação, sessão, controle de acesso
│   ├── cli/            # Parser de comandos, menu, REPL, dispatcher
│   ├── commands/         # Um handler por caso de uso da CLI
│   ├── config/            # Provisionamento e configuração mestre
│   ├── crypto/             # AES-256-GCM e PBKDF2-HMAC-SHA256
│   ├── domain/              # Entidades e interfaces de domínio
│   ├── factories/             # EquipamentoFactory
│   ├── persistence/             # Escrita atômica e journal
│   ├── repositories/              # Acesso a dados por entidade
│   ├── services/                    # Regras de negócio orquestradas
│   ├── types/                         # Enums, interfaces e erros
│   ├── utils/                           # Utilitários de terminal
│   ├── bootstrap.ts                       # Monta as dependências (DI manual)
│   └── index.ts                             # Ponto de entrada
├── tests/
│   └── journey.test.ts                        # Teste de ponta a ponta
├── docs/
│   ├── ARQUITETURA.md                           # Este documento
│   ├── SEGURANCA.md                               # Justificativa de segurança
│   ├── MODELO_UML.md                                # Diagrama de classes
│   └── TESTES.md                                      # Cobertura de testes
├── package.json
├── tsconfig.json
└── README.md
```

## Decisões que ficaram fora do escopo desta entrega (deliberadamente)

- **Concorrência multiusuário simultânea real** (múltiplos processos escrevendo ao mesmo tempo nos mesmos arquivos): o `BaseRepository` lê o arquivo inteiro, aplica a mutação em memória e regrava o arquivo inteiro. Isso é seguro contra corrupção (graças à escrita atômica), mas não é seguro contra condições de corrida entre dois processos concorrentes escrevendo ao mesmo tempo (o último a escrever vence, sobrescrevendo a mudança do outro). Para o escopo de uma CLI de uso predominantemente sequencial, essa limitação é aceitável e está documentada aqui deliberadamente. A evolução natural para a próxima etapa (banco de dados relacional) resolve isso via transações e locks nativos do SGBD.
- **Internacionalização**: mensagens de erro e nomes de campos estão em português, consistente com o domínio de negócio (mercado brasileiro, CNPJ, legislação brasileira).
