# Modelo de Classes (UML)

Este diagrama é renderizado automaticamente pelo GitHub (formato [Mermaid](https://mermaid.js.org/)). Ele cobre o núcleo de domínio do sistema — heranças, interfaces, polimorfismo e a fábrica de objetos compostos exigidos pelo enunciado. Para a visão de camadas completa (incluindo serviços, repositórios e CLI), ver [ARQUITETURA.md](ARQUITETURA.md).

## Domínio: herança, interfaces e fábrica

```mermaid
classDiagram
    class Ativo {
        <<abstract>>
        +string id
        +string criadoEm
        +string atualizadoEm
        #tocar() void
        +paraJSON()* Record
        +resumo()* string
    }

    class IDepreciavel {
        <<interface>>
        +calcularValorResidual(coefAnual) number
    }

    class IRastreavel {
        <<interface>>
        +obterIdentificadorRastreio() string
    }

    class IClassificavelParaRecuperacao {
        <<interface>>
        +potencialRecuperacao() string
    }

    class Organizacao {
        +string cnpj
        +string razaoSocial
        +TipoOrganizacao tipo
        +string contatoResponsavel
        +boolean ativo
    }

    class Lote {
        +string organizacaoId
        +string dataEntrada
        +string notaFiscal
        +string transportadora
        +StatusLote status
        +number quantidadeEquipamentos
    }

    class Usuario {
        +string username
        +Papel papel
        +string senhaHash
        +boolean ativo
        +registrarLogin() void
        +paraJSONPublico() Record
    }

    class Movimentacao {
        +string equipamentoId
        +string usuarioId
        +TipoMovimentacao tipo
        +EstadoFisico estadoFisicoAnterior
        +EstadoFisico estadoFisicoNovo
        +StatusEquipamento statusAnterior
        +StatusEquipamento statusNovo
        +string justificativa
    }

    class Equipamento {
        <<abstract>>
        +string loteId
        +string numeroSerie
        +string codigoBarrasInterno
        +EstadoFisico estadoFisico
        +StatusEquipamento status
        +TipoEquipamento tipo*
        +calcularValorResidual(coefAnual) number
        +obterIdentificadorRastreio() string
        +potencialRecuperacao() string
    }

    class EquipamentoDesktop {
        +tipo = DESKTOP
    }
    class EquipamentoNotebook {
        +tipo = NOTEBOOK
        +potencialRecuperacao() string
    }
    class EquipamentoServidor {
        +tipo = SERVIDOR
        +potencialRecuperacao() string
    }
    class EquipamentoMonitor {
        +tipo = MONITOR
    }
    class EquipamentoPeriferico {
        +tipo = PERIFERICO
        +potencialRecuperacao() string
    }
    class EquipamentoNobreak {
        +tipo = NOBREAK
        +potencialRecuperacao() string
    }

    class EquipamentoFactory {
        <<factory>>
        +criar(tipo, props)$ Equipamento
        +deJSON(obj)$ Equipamento
    }

    Ativo <|-- Organizacao
    Ativo <|-- Lote
    Ativo <|-- Usuario
    Ativo <|-- Movimentacao
    Ativo <|-- Equipamento

    Equipamento ..|> IDepreciavel
    Equipamento ..|> IRastreavel
    Equipamento ..|> IClassificavelParaRecuperacao

    Equipamento <|-- EquipamentoDesktop
    Equipamento <|-- EquipamentoNotebook
    Equipamento <|-- EquipamentoServidor
    Equipamento <|-- EquipamentoMonitor
    Equipamento <|-- EquipamentoPeriferico
    Equipamento <|-- EquipamentoNobreak

    EquipamentoFactory ..> Equipamento : cria >
    Lote "1" o-- "*" Equipamento : contém
    Organizacao "1" o-- "*" Lote : gera
    Equipamento "1" *-- "*" Movimentacao : histórico
```

## Validação: Template Method

```mermaid
classDiagram
    class Validator~T~ {
        <<abstract>>
        #regras()* Array~Function~
        +validar(alvo T) ResultadoValidacao
        +validarOuLancar(alvo T) void
    }

    class CnpjUtils {
        <<utility>>
        +normalizar(cnpj)$ string
        +formatar(cnpj)$ string
        +valido(cnpj)$ boolean
    }

    class OrganizacaoValidator {
        #regras() Array
    }
    class LoteValidator {
        #regras() Array
    }
    class TransicaoStatusValidator {
        #regras() Array
    }
    class MudancaEstadoFisicoValidator {
        #regras() Array
    }

    Validator~T~ <|-- OrganizacaoValidator
    Validator~T~ <|-- LoteValidator
    Validator~T~ <|-- TransicaoStatusValidator
    Validator~T~ <|-- MudancaEstadoFisicoValidator
    OrganizacaoValidator ..> CnpjUtils : usa
```

## Persistência e repositórios (genéricos)

```mermaid
classDiagram
    class CryptoService {
        -Buffer chaveMestra
        +cifrar(textoClaro) string
        +decifrar(payload) string
        +gerarChaveMestra()$ Buffer
    }

    class HashService {
        <<utility>>
        +gerarHash(senha)$ string
        +verificar(senha, hash)$ boolean
        +gerarTokenSessao()$ string
    }

    class AtomicFileStore {
        <<utility>>
        +escreverCifrado(caminho, texto, crypto)$ void
        +lerCifrado(caminho, crypto)$ string
        +escreverAtomico(caminho, texto)$ void
    }

    class JournalManager {
        -string diretorio
        -CryptoService cryptoSvc
        +registrar(entrada) EntradaJournal
        +expurgarAntigos() string[]
        +lerJournalAtual() EntradaJournal[]
    }

    class BaseRepository~T~ {
        <<abstract>>
        #paraObjeto(entidade T)* Record
        #deObjeto(obj)* T
        +listarTodos() T[]
        +buscarPorId(id) T
        +inserir(entidade, usuarioId) T
        +atualizar(id, mutador, usuarioId) T
    }

    class OrganizacaoRepository {
        +existeComCnpj(cnpj) boolean
    }
    class LoteRepository {
        +listarPorOrganizacao(id) Lote[]
    }
    class EquipamentoRepository {
        +listarPorLote(id) Equipamento[]
    }
    class MovimentacaoRepository {
        +listarPorEquipamento(id) Movimentacao[]
    }
    class UsuarioRepository {
        +buscarPorUsername(username) Usuario
    }

    BaseRepository~T~ ..> AtomicFileStore : usa
    BaseRepository~T~ ..> JournalManager : registra antes de persistir
    BaseRepository~T~ <|-- OrganizacaoRepository
    BaseRepository~T~ <|-- LoteRepository
    BaseRepository~T~ <|-- EquipamentoRepository
    BaseRepository~T~ <|-- MovimentacaoRepository
    BaseRepository~T~ <|-- UsuarioRepository
    AtomicFileStore ..> CryptoService : usa
    JournalManager ..> CryptoService : usa
```

## Máquina de estados: Status do Equipamento

```mermaid
stateDiagram-v2
    [*] --> AGUARDANDO_TRIAGEM: cadastro
    AGUARDANDO_TRIAGEM --> TRIADO: triagem
    TRIADO --> EM_DESMONTE: enviar a desmonte
    TRIADO --> RECICLADO: reciclar diretamente
    EM_DESMONTE --> RECICLADO: finalizar reciclagem
    EM_DESMONTE --> DESCARTADO: descarte seguro
    RECICLADO --> [*]
    DESCARTADO --> [*]

    note right of EM_DESMONTE
        Só é alcançável a partir de
        TRIADO (triagem completa),
        nunca diretamente de
        AGUARDANDO_TRIAGEM.
    end note
```
