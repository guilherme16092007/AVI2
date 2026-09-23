# Testes

## Como executar

```bash
npm install
npm test
```

Isso executa `tests/journey.test.ts` diretamente com [`tsx`](https://github.com/privatenumber/tsx) (TypeScript executado sem passo de build separado). Não há dependência de nenhum framework de testes externo (Jest, Mocha etc.) — o script é autocontido, com um pequeno helper `afirmar(condicao, descricao)` que imprime `OK`/`FALHOU` para cada verificação e finaliza com código de saída `1` se qualquer verificação falhar (compatível com pipelines de CI).

Alternativamente, após compilar:

```bash
npm run build
npx tsx tests/journey.test.ts
```

## Por que um script de jornada, e não testes unitários isolados

O enunciado pede explicitamente "um conjunto de scripts de teste que simulam uma jornada completa de usuário, desde o provisionamento inicial até a consulta de rastreabilidade de um equipamento específico após múltiplas movimentações". `tests/journey.test.ts` foi desenhado exatamente para isso: ele chama o mesmo `Dispatcher` que a CLI real usa (`despachar(ctx, cmd)`), simulando comandos digitados por um usuário real, em vez de testar funções isoladas fora de contexto. Isso tem uma vantagem prática relevante: o teste valida o sistema **de ponta a ponta**, incluindo a integração entre CLI, autenticação, validação, regras de negócio, persistência cifrada e journal — exatamente como ele se comportaria em produção.

## Isolamento do ambiente de teste

Cada execução do script cria um diretório temporário exclusivo (`fs.mkdtempSync`) como "home" do greencode para aquela execução (via a variável de ambiente equivalente ao `GREENCODE_HOME` usado internamente por `inicializarContexto`), executa o provisionamento e toda a jornada dentro dele, e remove o diretório ao final (`fs.rmSync(..., { recursive: true })`). Isso garante que o teste:

- Pode ser executado repetidamente sem acumular dados de execuções anteriores.
- Nunca interfere com dados reais de uma instalação do greencode em uso.
- Pode ser executado em paralelo com outra instância do sistema rodando na mesma máquina.

## Provisionamento não interativo

O provisionamento inicial normalmente pede a senha do administrador via `readline` interativo (mascarado). Isso não funciona em um script automatizado/CI, onde não há um terminal (TTY) respondendo aos prompts. Para viabilizar testes e automação, `src/bootstrap.ts` reconhece duas variáveis de ambiente:

```bash
GREENCODE_ADMIN_USER=admin
GREENCODE_ADMIN_PASSWORD=SenhaForte123
```

Se ambas estiverem definidas no momento do primeiro provisionamento, o sistema as usa diretamente, sem solicitar entrada interativa, e registra no console que o modo não interativo foi detectado. Fora do provisionamento inicial (login, criação de outros usuários etc.), a senha pode sempre ser passada via flag `--senha`, então nenhuma outra adaptação foi necessária para tornar o restante da jornada scriptável.

## O que é coberto (40 verificações)

| Etapa | O que é validado |
|---|---|
| 1. Provisionamento inicial | Chave mestra AES-256 gerada; arquivo de credenciais criado; conta ADMINISTRADOR criada. |
| 2. Autenticação | Login com senha incorreta falha; login correto funciona; sessão carrega o papel correto. |
| 3. Segregação de papéis | ADMINISTRADOR cria usuários de outros papéis; um GESTOR_ALMOXARIFADO **não** consegue criar usuários (fora de seu papel). |
| 4. Validação de CNPJ | CNPJ matematicamente válido é aceito; CNPJ com dígitos repetidos é rejeitado; CNPJ duplicado é rejeitado (unicidade). |
| 5. Janela de datas de lote | Data de hoje é aceita; data futura é rejeitada; data anterior a 90 dias é rejeitada. |
| 6. Máquina de estados do equipamento | Equipamento nasce `AGUARDANDO_TRIAGEM`; desmonte sem triagem prévia é rejeitado; triagem funciona e muda o status para `TRIADO`. |
| 7. Regra de justificativa | Queda de 2 categorias sem justificativa é rejeitada; com justificativa válida (≥10 caracteres) é aceita; queda de 1 categoria não exige justificativa. |
| 8. Desmonte após triagem | Transição `TRIADO -> EM_DESMONTE -> RECICLADO` funciona corretamente após a triagem completa. |
| 9. Rastreabilidade | `rastreio consultar` retorna o histórico completo; múltiplas movimentações (≥5) ficam registradas para o mesmo equipamento. |
| 10. Controle de acesso do AUDITOR | Auditor pode listar (leitura); **não** pode realizar triagem nem criar lote (escrita). |
| 11. Expiração de sessão | Após simular 40 minutos de inatividade (acima do limite de 30), o próximo comando exige novo login. |
| 12. Journal | Arquivos de journal são gerados; entradas cifradas são decodificáveis; a mudança de status do equipamento aparece registrada (auditoria). |
| 13. Criptografia e atomicidade | O arquivo `organizacoes.enc` em disco não contém o texto claro dos dados cadastrados (está de fato cifrado); nenhum arquivo `.tmp` órfão permanece após as escritas atômicas. |

## Testes manuais complementares (CLI real)

Além do script automatizado, a CLI foi validada manualmente em modo de comando único (útil para verificar a experiência real do usuário e o modo não interativo de scripting):

```bash
GREENCODE_ADMIN_USER=admin GREENCODE_ADMIN_PASSWORD=SenhaForte123 node dist/index.js login --user admin --senha SenhaForte123

node dist/index.js org criar --cnpj "11.222.333/0001-81" --razao "Hospital Central LTDA" \
  --tipo HOSPITAL --contato "Maria Silva" --email maria@hospital.com

node dist/index.js org criar --cnpj "11.111.111/1111-11" --razao "Teste Invalido" \
  --tipo VAREJO --contato "X" --email x@x.com
# -> [ERRO] Validacao falhou: CNPJ '11111111111111' invalido (digitos verificadores nao conferem).
```

## Limitações conhecidas da suíte de testes

- Não há testes de carga/desempenho (ex.: comportamento do sistema com dezenas de milhares de equipamentos em um único arquivo `.enc`). Para o volume de dados esperado nesta fase do produto (protótipo/piloto), isso não é uma preocupação imediata, mas seria um ponto de atenção antes de uma migração de escala — reforçando a decisão de roadmap de migrar para um banco de dados relacional.
- Não há testes automatizados específicos de rotação do journal ao atingir 10 MB nem de expurgo por 180 dias de retenção real (isso exigiria gerar essa quantidade de dados ou manipular datas de modificação de arquivo em massa); a lógica de rotação e expurgo (`JournalManager.rotacionarSeNecessario` e `expurgarAntigos`) foi validada por inspeção de código e por execução manual com limites reduzidos durante o desenvolvimento.
- Não há testes de compatibilidade automatizados entre Windows e Linux nesta entrega (ambiente de desenvolvimento é Linux); a compatibilidade declarada em `package.json` (`engines.node >= 18`) e o uso exclusivo de APIs portáveis do Node.js (`fs`, `path`, `crypto`, `readline`) é a garantia adotada — ver [README.md § Compatibilidade de plataformas](../README.md#compatibilidade-de-plataformas).
