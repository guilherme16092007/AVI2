/**
 * tests/journey.test.ts
 *
 * Script de teste automatizado que simula uma jornada COMPLETA de
 * usuario do greencode".
 * 
 * O script tambem exercita explicitamente os cenarios de FALHA listados
 * na documentacao de seguranca (docs/SEGURANCA.md e docs/TESTES.md):
 * CNPJ invalido, lote com data fora da janela permitida, desmonte sem
 * triagem previa, mudanca de estado fisico sem justificativa, login com
 * senha errada, comando fora do papel do usuario e sessao expirada.
 * 
 * Como este script cria seu proprio ambiente isolado (um diretorio
 * temporario), ele pode ser executado repetidamente sem interferir com
 * dados reais do sistema, e nao requer nenhuma dependencia externa
 * alem do proprio Node.js/TypeScript.
 *
 * Uso:
 *   npx tsx tests/journey.test.ts
 * ou, apos o build:
 *   npm run build && node -r ts-node/register tests/journey.test.ts
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { inicializarContexto } from "../src/bootstrap";
import { despachar } from "../src/cli/Dispatcher";
import { CommandParser } from "../src/cli/CommandParser";
import { Contexto } from "../src/cli/Contexto";
import { EstadoFisico } from "../src/types";

let totalTestes = 0;
let totalFalhas = 0;

function afirmar(condicao: boolean, descricao: string): void {
  totalTestes += 1;
  if (condicao) {
    console.log(`  \x1b[32mOK\x1b[0m   ${descricao}`);
  } else {
    totalFalhas += 1;
    console.log(`  \x1b[31mFALHOU\x1b[0m ${descricao}`);
  }
}

async function executar(ctx: Contexto, linha: string) {
  const cmd = CommandParser.analisar(linha)!;
  return despachar(ctx, cmd);
}

/** Extrai o primeiro item de uma listagem (formato "id  resto...") retornando o id completo. */
function primeiroIdDe(dados: unknown): string {
  const linha = (dados as string[])[0];
  return linha.split(/\s+/)[0];
}

async function main(): Promise<void> {
  const diretorioTemp = fs.mkdtempSync(path.join(os.tmpdir(), "greencode-teste-"));
  console.log(`Ambiente de teste isolado: ${diretorioTemp}\n`);

  // Provisionamento nao interativo (ver bootstrap.ts).
  process.env.GREENCODE_ADMIN_USER = "admin";
  process.env.GREENCODE_ADMIN_PASSWORD = "AdminSenhaForte123";

  console.log("=== ETAPA 1: Provisionamento inicial ===");
  const ctx = await inicializarContexto(diretorioTemp);
  afirmar(fs.existsSync(path.join(diretorioTemp, ".greencode", "master.key")), "chave mestra AES-256 foi gerada");
  afirmar(fs.existsSync(path.join(diretorioTemp, "data", "credenciais.enc")), "arquivo de credenciais foi criado");
  afirmar(ctx.usuarioRepo.existeUsername("admin"), "usuario administrador foi criado no provisionamento");

  console.log("\n=== ETAPA 2: Autenticacao ===");
  let r = await executar(ctx, "login --user admin --senha SenhaErrada999");
  afirmar(!r.ok, "login com senha incorreta deve falhar");

  r = await executar(ctx, "login --user admin --senha AdminSenhaForte123");
  afirmar(r.ok, "login com credenciais corretas deve funcionar");
  afirmar(ctx.sessao?.papel === "ADMINISTRADOR", "sessao criada com papel ADMINISTRADOR");

  console.log("\n=== ETAPA 3: Gestao de usuarios (segregacao de papeis) ===");
  r = await executar(ctx, "usuario criar --username almox1 --senha AlmoxSenha123 --papel GESTOR_ALMOXARIFADO");
  afirmar(r.ok, "administrador pode criar usuario GESTOR_ALMOXARIFADO");

  r = await executar(ctx, "usuario criar --username auditor1 --senha AuditorSenha123 --papel AUDITOR");
  afirmar(r.ok, "administrador pode criar usuario AUDITOR");

  r = await executar(ctx, "login --user almox1 --senha AlmoxSenha123");
  afirmar(r.ok, "login do gestor de almoxarifado funciona");

  r = await executar(ctx, "usuario criar --username outro --senha Outro12345 --papel AUDITOR");
  afirmar(!r.ok, "gestor de almoxarifado NAO pode criar usuarios (fora de seu papel)");

  console.log("\n=== ETAPA 4: Cadastro de organizacao (validacao de CNPJ) ===");
  r = await executar(ctx, "login --user admin --senha AdminSenhaForte123");
  afirmar(r.ok, "re-login como administrador");

  r = await executar(
    ctx,
    'org criar --cnpj "11.222.333/0001-81" --razao "Hospital Central LTDA" --tipo HOSPITAL --contato "Maria Silva" --email maria@hospital.com'
  );
  afirmar(r.ok, "cadastro de organizacao com CNPJ matematicamente valido deve funcionar");
  const orgId = (r.dados as Record<string, unknown>).id as string;

  r = await executar(
    ctx,
    'org criar --cnpj "11.111.111/1111-11" --razao "Empresa Invalida" --tipo VAREJO --contato "X" --email x@x.com'
  );
  afirmar(!r.ok, "cadastro de organizacao com CNPJ de digitos repetidos deve ser rejeitado");

  r = await executar(
    ctx,
    'org criar --cnpj "11.222.333/0001-81" --razao "Duplicada" --tipo VAREJO --contato "Y" --email y@y.com'
  );
  afirmar(!r.ok, "cadastro de organizacao com CNPJ ja existente deve ser rejeitado (unicidade)");

  console.log("\n=== ETAPA 5: Criacao de lote (validacao de janela de datas) ===");
  r = await executar(ctx, `lote criar --org ${orgId} --nf 123456 --transp TransRapida`);
  afirmar(r.ok, "criacao de lote com data padrao (hoje) deve funcionar");
  const loteId = (r.dados as Record<string, unknown>).id as string;

  const dataFutura = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  r = await executar(ctx, `lote criar --org ${orgId} --nf 999999 --transp X --data ${dataFutura}`);
  afirmar(!r.ok, "criacao de lote com data futura deve ser rejeitada");

  const dataMuitoAntiga = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  r = await executar(ctx, `lote criar --org ${orgId} --nf 888888 --transp X --data ${dataMuitoAntiga}`);
  afirmar(!r.ok, "criacao de lote com data anterior a 90 dias deve ser rejeitada");

  console.log("\n=== ETAPA 6: Cadastro e triagem de equipamento ===");
  r = await executar(
    ctx,
    `equipamento cadastrar --lote ${loteId} --tipo NOTEBOOK --serie SN-0001 --codigo BC-0001 --fabricante Dell --modelo Latitude`
  );
  afirmar(r.ok, "cadastro de equipamento deve funcionar");
  const equipamentoId = (r.dados as Record<string, unknown>).id as string;
  afirmar((r.dados as Record<string, unknown>).status === "AGUARDANDO_TRIAGEM", "equipamento nasce com status AGUARDANDO_TRIAGEM");

  r = await executar(ctx, `equipamento status ${equipamentoId} --novo EM_DESMONTE`);
  afirmar(!r.ok, "enviar para desmonte SEM triagem previa deve ser rejeitado (maquina de estados)");

  r = await executar(ctx, `equipamento triagem ${equipamentoId} --estado BOM`);
  afirmar(r.ok, "triagem do equipamento deve funcionar");
  afirmar((r.dados as Record<string, unknown>).status === "TRIADO", "apos triagem, status deve ser TRIADO");

  console.log("\n=== ETAPA 7: Mudanca de estado fisico (regra de justificativa) ===");
  r = await executar(ctx, `equipamento estado ${equipamentoId} --novo RUIM`);
  afirmar(!r.ok, "queda de 2 categorias (BOM->RUIM) sem justificativa deve ser rejeitada");

  r = await executar(ctx, `equipamento estado ${equipamentoId} --novo RUIM --justificativa "Placa-mae com sinais de queima identificados na inspecao"`);
  afirmar(r.ok, "queda de 2 categorias COM justificativa valida deve ser aceita");

  r = await executar(ctx, `equipamento estado ${equipamentoId} --novo REGULAR`);
  afirmar(r.ok, "queda de apenas 1 categoria nao exige justificativa");

  console.log("\n=== ETAPA 8: Desmonte apos triagem completa ===");
  r = await executar(ctx, `equipamento status ${equipamentoId} --novo EM_DESMONTE --obs "Encaminhado para bancada 3"`);
  afirmar(r.ok, "enviar para desmonte APOS triagem completa deve funcionar");

  r = await executar(ctx, `equipamento status ${equipamentoId} --novo RECICLADO`);
  afirmar(r.ok, "finalizar como RECICLADO apos desmonte deve funcionar");

  console.log("\n=== ETAPA 9: Rastreabilidade apos multiplas movimentacoes ===");
  r = await executar(ctx, `rastreio consultar ${equipamentoId}`);
  afirmar(r.ok, "consulta de rastreio deve funcionar");
  const historico = (r.dados as { historico: string[] }).historico;
  afirmar(historico.length >= 5, `historico de rastreio contem multiplas movimentacoes (encontrado: ${historico.length})`);

  console.log("\n=== ETAPA 10: Controle de acesso do AUDITOR (somente leitura) ===");
  r = await executar(ctx, "login --user auditor1 --senha AuditorSenha123");
  afirmar(r.ok, "login do auditor funciona");

  r = await executar(ctx, "org listar");
  afirmar(r.ok, "auditor pode listar organizacoes (leitura)");

  r = await executar(ctx, `equipamento triagem ${equipamentoId} --estado BOM`);
  afirmar(!r.ok, "auditor NAO pode realizar triagem (somente leitura)");

  r = await executar(ctx, `lote criar --org ${orgId} --nf 000001 --transp X`);
  afirmar(!r.ok, "auditor NAO pode criar lote (somente leitura)");

  console.log("\n=== ETAPA 11: Expiracao de sessao por inatividade ===");
  r = await executar(ctx, "login --user admin --senha AdminSenhaForte123");
  afirmar(r.ok, "login novamente como administrador");

  // Simula inatividade forcando a data de 'ultimaAtividade' da sessao para o passado.
  const caminhoSessao = path.join(diretorioTemp, ".greencode", "session.json");
  const conteudoSessao = ctx.cryptoSvc.decifrar(fs.readFileSync(caminhoSessao, "utf8"));
  const sessaoObj = JSON.parse(conteudoSessao);
  sessaoObj.ultimaAtividade = new Date(Date.now() - 40 * 60 * 1000).toISOString(); // 40 min atras
  fs.writeFileSync(caminhoSessao, ctx.cryptoSvc.cifrar(JSON.stringify(sessaoObj)));

  r = await executar(ctx, "org listar");
  afirmar(!r.ok, "comando apos 40 min de inatividade (limite de 30 min) deve exigir novo login");

  console.log("\n=== ETAPA 12: Journal (write-ahead log) ===");
  const arquivosJournal = ctx.journal.listarArquivos();
  afirmar(arquivosJournal.length >= 1, "arquivo(s) de journal foram gerados durante a jornada");
  const entradas = ctx.journal.lerJournalAtual();
  afirmar(entradas.length > 0, `journal contem entradas cifradas decodificaveis (${entradas.length} entradas)`);
  afirmar(
    entradas.some((e) => e.entidade === "Equipamento" && e.operacao === "MUDANCA_STATUS"),
    "journal registrou a mudanca de status do equipamento (auditoria)"
  );

  console.log("\n=== ETAPA 13: Escrita atomica e criptografia dos arquivos de persistencia ===");
  const arquivoOrgs = path.join(diretorioTemp, "data", "organizacoes.enc");
  const bruto = fs.readFileSync(arquivoOrgs, "utf8");
  afirmar(!bruto.includes("Hospital Central"), "arquivo de organizacoes em disco NAO contem texto claro (esta cifrado)");
  afirmar(!fs.existsSync(arquivoOrgs + ".tmp"), "nenhum arquivo temporario de escrita atomica ficou orfao");

  // limpeza
  fs.rmSync(diretorioTemp, { recursive: true, force: true });

  console.log("\n" + "=".repeat(60));
  console.log(`RESULTADO: ${totalTestes - totalFalhas}/${totalTestes} testes passaram.`);
  console.log("=".repeat(60));

  if (totalFalhas > 0) {
    process.exit(1);
  }
}

main().catch((erro) => {
  console.error("Falha inesperada na execucao dos testes:", erro);
  process.exit(1);
});
