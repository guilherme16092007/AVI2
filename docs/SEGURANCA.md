# Arquitetura de Segurança do greencode

Este documento justifica cada escolha de segurança do sistema e descreve os cenários de falha testados, conforme exigido pelo enunciado da atividade: *"documentar a arquitetura de segurança adotada, justificando a escolha do algoritmo de criptografia, do esquema de hashing de senhas e da política de expiração de sessões, bem como descrever os cenários de falha testados e as respectivas respostas do sistema"*.

## 1. Criptografia simétrica dos dados em repouso — AES-256-GCM

**Exigência do enunciado:** todos os arquivos de persistência (credenciais, organizações, lotes, equipamentos e movimentações) devem ser gravados com criptografia simétrica AES-256.

**Escolha:** AES-256 no modo **GCM** (Galois/Counter Mode), implementado em `src/crypto/CryptoService.ts`.

**Justificativa:** GCM é um modo de operação **autenticado** (AEAD — Authenticated Encryption with Associated Data). Além de cifrar o conteúdo, ele produz uma *authentication tag* de 128 bits que é verificada na decriptografia. Isso significa que qualquer adulteração ou corrupção do arquivo cifrado — seja por um ataque deliberado (um terceiro editando o arquivo `.enc` manualmente) ou por corrupção acidental de disco — é **detectada e rejeitada** na leitura, em vez de produzir dados corrompidos silenciosamente. O modo CBC "puro", alternativa mais simples, não oferece essa garantia nativamente e exigiria um HMAC separado (Encrypt-then-MAC) para alcançar o mesmo nível de proteção, adicionando complexidade e superfície de erro. Cada operação de cifra gera um IV (vetor de inicialização) aleatório de 96 bits, o tamanho recomendado para GCM, evitando reuso de IV — um erro clássico que compromete a segurança do AES-GCM.

**Formato serializado:** `[1 byte versão][12 bytes IV][16 bytes tag][N bytes ciphertext]`, armazenado em Base64 para ser texto-seguro em qualquer sistema de arquivos, incluindo Windows.

## 2. Hashing de senhas — PBKDF2-HMAC-SHA256

**Exigência do enunciado:** senhas armazenadas em arquivo separado, utilizando hash com algoritmo SHA-256.

**Escolha:** PBKDF2-HMAC-SHA256 com salt aleatório de 128 bits por usuário e **210.000 iterações** (`src/crypto/HashService.ts`).

**Justificativa — por que não SHA-256 "puro":** uma única passada de SHA-256 sobre a senha, mesmo com salt, é vulnerável a ataques de força bruta com hardware moderno: GPUs de consumo calculam bilhões de hashes SHA-256 por segundo (o próprio algoritmo de mineração de Bitcoin usa SHA-256 justamente por ser *rápido* de calcular em massa — a propriedade oposta do que se deseja para senhas). Um atacante que obtivesse o arquivo de credenciais poderia testar uma lista de senhas comuns contra todos os hashes em questão de minutos.

**Por que PBKDF2-HMAC-SHA256 ainda satisfaz o enunciado:** SHA-256 continua sendo a função de hash subjacente — ela é executada repetidamente (210.000 vezes) dentro do HMAC a cada tentativa de verificação. O enunciado pede "hash com algoritmo SHA-256"; PBKDF2-HMAC-SHA256 é literalmente isso, mas com o custo computacional artificial (o parâmetro de iterações, recomendado pela OWASP em suas diretrizes de 2023+ para PBKDF2-SHA256) que torna ataques de força bruta e tabelas pré-computadas (*rainbow tables*) computacionalmente inviáveis. O salt aleatório por usuário garante que dois usuários com a mesma senha produzam hashes diferentes, eliminando o uso de rainbow tables genéricas.

**Comparação em tempo constante:** a verificação usa `crypto.timingSafeEqual`, evitando ataques de temporização (*timing attacks*) que poderiam inferir o hash correto medindo o tempo de resposta de comparações byte a byte.

## 3. Expiração de sessão por inatividade — 30 minutos

**Exigência do enunciado:** expiração de sessão após 30 minutos de inatividade.

**Implementação (`src/auth/AuthService.ts`):** a sessão ativa é persistida (cifrada) em `.greencode/session.json`, contendo `ultimaAtividade`. A cada comando executado, `AuthService.sessaoAtual()` verifica se `Date.now() - ultimaAtividade` excede o limite configurado (30 minutos por padrão, ajustável via parâmetro global); se exceder, a sessão é invalidada e removida, e o usuário precisa autenticar novamente. Se a verificação passar, `ultimaAtividade` é renovada — ou seja, o timeout é de **inatividade**, não de duração total da sessão, conforme pedido.

**Por que persistir a sessão em arquivo, e não apenas em memória:** como o `greencode` também opera em modo "um comando por invocação de processo" (útil para scripts), uma sessão apenas em memória expiraria a cada comando. Persistir a sessão (cifrada, com permissão de arquivo restrita) permite que o usuário execute múltiplos comandos em invocações de processo separadas sem reautenticar a cada vez — de forma análoga ao mecanismo de *timestamp* do `sudo` no Linux — respeitando ainda assim o limite de inatividade.

## 4. Proteção da chave mestra — trade-off documentado

A chave mestra AES-256 é gerada aleatoriamente no provisionamento inicial e armazenada em `.greencode/master.key`, com permissões de arquivo restritas ao dono (`chmod 600` em sistemas POSIX; no Windows, a proteção equivalente depende das ACLs do sistema de arquivos NTFS do usuário logado).

**Isto é um trade-off deliberado, não um descuido**, e é importante ser transparente sobre ele: este design protege os dados contra acesso por **outros usuários do mesmo sistema operacional**, mas **não** contra um atacante com acesso de root/administrador à máquina, nem contra alguém com acesso físico ao disco fora de um contexto de sistema operacional ativo (ex.: bootar de um pendrive live e ler o arquivo diretamente). Esse é um padrão comum e aceito em ferramentas de linha de comando locais (chaves SSH em `~/.ssh/`, tokens de CLIs de nuvem como AWS CLI e `gcloud`, por exemplo). Para um ambiente de produção multiusuário real — a evolução natural mencionada no roadmap do projeto — a chave mestra deveria ser movida para um cofre de segredos dedicado (HashiCorp Vault, AWS KMS, Azure Key Vault) ou para o keychain nativo do sistema operacional (Windows Credential Manager, macOS Keychain, `libsecret` no Linux), removendo-a do sistema de arquivos por completo.

## 5. Journal (write-ahead log) como mecanismo de recuperação

**Exigência do enunciado:** cada transação registrada em um log imutável antes de ser aplicada ao estado corrente; retenção mínima de 180 dias; rotação automática ao atingir 10 MB.

**Implementação (`src/persistence/JournalManager.ts`):** toda mutação em qualquer repositório passa primeiro por `JournalManager.registrar(...)`, que serializa a entrada (com estado "antes" e "depois"), cifra individualmente cada linha com AES-256-GCM e a acrescenta (`append`) ao arquivo `journal.log` **antes** de o repositório persistir o novo estado no arquivo de entidades correspondente. Isso garante que, mesmo que o processo seja interrompido entre o registro no journal e a persistência do novo estado, existe um registro auditável da intenção da transação. A rotação ocorre automaticamente quando `journal.log` excede o limite configurado (10 MB por padrão): o arquivo corrente é renomeado para `journal-<timestampISO>.log` e um novo `journal.log` vazio é iniciado. A retenção (180 dias por padrão) é aplicada sobre os arquivos rotacionados — o `journal.log` corrente nunca é removido automaticamente.

## 6. Escrita atômica — proteção contra corrupção por interrupção abrupta

**Exigência do enunciado:** operações de leitura e escrita atômicas, utilizando arquivos temporários e renomeação, para evitar corrupção de dados em caso de interrupção brusca.

**Implementação (`src/persistence/AtomicFileStore.ts`):** toda escrita grava primeiro em um arquivo temporário exclusivo (`.<nome>.<pid>.<random>.tmp`), executa `fsync` para garantir que o conteúdo chegou ao disco físico (não apenas ao cache do sistema operacional), e só então executa `rename` para o nome final. A operação de `rename` dentro do mesmo volume/partição é atômica do ponto de vista do sistema operacional em sistemas de arquivos POSIX (ext4, no Ubuntu) e no NTFS (Windows): ou o arquivo antigo permanece intacto, ou o novo arquivo passa a existir por completo — nunca existe um estado intermediário visível de "meio escrito". Isso protege contra quedas de energia, `kill -9` do processo, ou crashes durante a escrita.

## 7. Validação de CNPJ — prevenção de dados inválidos na origem

Embora não seja estritamente um mecanismo de "segurança" no sentido de confidencialidade, a validação de CNPJ (`src/validation/CnpjValidator.ts`) com o algoritmo real de dígitos verificadores da Receita Federal é uma camada de **integridade de dados**: impede que um erro de digitação ou uma tentativa de injeção de dado inválido no CNPJ passe despercebida, o que teria implicações fiscais e regulatórias reais no domínio de negócio (Política Nacional de Resíduos Sólidos, mencionada na proposta).

## Cenários de falha testados

A tabela abaixo resume os cenários de falha exercitados pelo script `tests/journey.test.ts` (ver [docs/TESTES.md](TESTES.md) para o detalhamento completo) e a resposta do sistema a cada um:

| Cenário de falha | Resposta do sistema |
|---|---|
| Login com senha incorreta | Rejeitado com mensagem genérica ("Usuário ou senha inválidos") — **não** revela se o problema foi o usuário inexistente ou a senha errada, evitando enumeração de contas válidas. |
| Comando de negócio executado sem sessão ativa | Rejeitado antes de qualquer acesso a dados, com instrução para fazer login. |
| Comando executado após 30 minutos de inatividade | Sessão é invalidada e removida; comando é rejeitado; usuário precisa autenticar novamente. |
| Usuário tenta executar comando fora de seu papel (ex.: `GESTOR_ALMOXARIFADO` tentando criar outro usuário) | Rejeitado por `AuthService.exigirPapel`/`MenuManager.comandoPermitido`, com mensagem indicando o papel exigido. |
| Cadastro de organização com CNPJ matematicamente inválido | Rejeitado por `CnpjUtils.valido`, com indicação de que os dígitos verificadores não conferem. |
| Cadastro de organização com CNPJ já cadastrado | Rejeitado por violação de unicidade. |
| Criação de lote com data de entrada futura | Rejeitado por `LoteValidator`. |
| Criação de lote com data de entrada anterior a 90 dias | Rejeitado por `LoteValidator`. |
| Equipamento enviado para desmonte sem triagem prévia | Rejeitado por `TransicaoStatusValidator` (a máquina de estados não permite `AGUARDANDO_TRIAGEM -> EM_DESMONTE` diretamente). |
| Queda de 2+ categorias no estado físico sem justificativa | Rejeitado por `MudancaEstadoFisicoValidator`, com indicação da quantidade de categorias e do mínimo de caracteres exigido na justificativa. |
| Arquivo de persistência cifrado é lido diretamente do disco | Conteúdo é ilegível (Base64 de ciphertext AES-256-GCM); qualquer tentativa de adulteração manual do arquivo faz a `authTag` falhar na próxima leitura, e o sistema recusa decifrar. |
| Interrupção do processo durante uma escrita | Como a escrita é atômica (arquivo temporário + rename), o arquivo de destino nunca fica em estado parcialmente escrito; na pior hipótese, um arquivo `.tmp` órfão permanece no diretório de dados, sem afetar a integridade do arquivo oficial. |

## Resumo das escolhas

| Requisito do enunciado | Escolha técnica | Motivo |
|---|---|---|
| Criptografia simétrica AES-256 | AES-256-**GCM** | Autenticado (detecta adulteração/corrupção), não apenas confidencial. |
| Hash de senha com SHA-256 | **PBKDF2**-HMAC-**SHA256**, salt + 210k iterações | Satisfaz o algoritmo pedido, mas resistente a força bruta moderna. |
| Expiração de sessão em 30 min | Sessão persistida cifrada, `ultimaAtividade` verificada a cada comando | Funciona tanto no REPL quanto no modo de comando único (scripts). |
| Journal imutável, retenção 180 dias, rotação 10 MB | Write-ahead log cifrado, `rename` para rotação, expurgo por idade do arquivo | Rastreabilidade e recuperação, conforme exigido. |
| Escrita/leitura atômica | Arquivo temporário + `fsync` + `rename` | Garantia do sistema operacional contra corrupção. |
