import { HashService } from "../../src/crypto/HashService";
import { ErroConflito, ErroHttp, ErroNaoAutenticado, ErroNaoEncontrado, ErroPermissao } from "../../src/server/erros";
import { criarServicos, Servicos } from "../../src/server/servicos";
import { Ator } from "../../src/server/servicos/politicas";
import { ErroValidacao, Papel, TipoEquipamento, TipoOrganizacao } from "../../src/types";
import { BancoMemoria, dataRelativa, gerarCnpj } from "./memoria";

let total = 0;
let falhas = 0;

function afirmar(condicao: boolean, descricao: string): void {
  total += 1;
  if (condicao) {
    console.log(`  \x1b[32mOK\x1b[0m     ${descricao}`);
  } else {
    falhas += 1;
    console.log(`  \x1b[31mFALHOU\x1b[0m ${descricao}`);
  }
}

type Construtor = new (...args: never[]) => Error;

async function rejeita(descricao: string, fn: () => Promise<unknown>, esperado: Construtor, trecho?: string): Promise<void> {
  try {
    await fn();
    afirmar(false, `${descricao} (nenhum erro foi lancado)`);
  } catch (erro) {
    const tipoOk = erro instanceof esperado;
    const msgOk = trecho === undefined || (erro instanceof Error && erro.message.includes(trecho));
    afirmar(tipoOk && msgOk, descricao + (tipoOk && msgOk ? "" : ` [recebido: ${(erro as Error).name}: ${(erro as Error).message}]`));
  }
}

async function main(): Promise<void> {
  const banco = new BancoMemoria();
  const s: Servicos = criarServicos(banco);

  const adminRegistro = await banco.repos.usuarios.criar({
    id: "00000000-0000-4000-8000-000000000001",
    username: "admin",
    papel: Papel.ADMINISTRADOR,
    senhaHash: HashService.gerarHash("AdminSenha123"),
  });
  const admin: Ator = { id: adminRegistro.id, username: "admin", papel: Papel.ADMINISTRADOR };

  console.log("\n=== 1. Usuarios e autenticacao ===");
  const uOperador = await s.usuarios.criar(admin, { username: "Operador1", senha: "OperadorSenha1", papel: Papel.OPERADOR_CADASTRO });
  afirmar(uOperador.username === "operador1", "username e normalizado para minusculas");
  afirmar(!("senhaHash" in uOperador), "DTO de usuario nao expoe o hash da senha");
  const uGestor = await s.usuarios.criar(admin, { username: "gestor1", senha: "GestorSenha1", papel: Papel.GESTOR_ALMOXARIFADO });
  const uAuditor = await s.usuarios.criar(admin, { username: "auditor1", senha: "AuditorSenha1", papel: Papel.AUDITOR });
  const operador: Ator = { id: uOperador.id, username: uOperador.username, papel: Papel.OPERADOR_CADASTRO };
  const gestor: Ator = { id: uGestor.id, username: uGestor.username, papel: Papel.GESTOR_ALMOXARIFADO };
  const auditor: Ator = { id: uAuditor.id, username: uAuditor.username, papel: Papel.AUDITOR };

  await rejeita("username repetido -> conflito (409)", () => s.usuarios.criar(admin, { username: "gestor1", senha: "OutraSenha123", papel: Papel.AUDITOR }), ErroConflito);
  await rejeita("senha com menos de 8 caracteres e rejeitada", () => s.usuarios.criar(admin, { username: "novo1", senha: "curta", papel: Papel.AUDITOR }), ErroValidacao);
  await rejeita("username com caracteres invalidos e rejeitado", () => s.usuarios.criar(admin, { username: "ab", senha: "SenhaForte123", papel: Papel.AUDITOR }), ErroValidacao);
  await rejeita("GESTOR nao pode criar usuarios (403)", () => s.usuarios.criar(gestor, { username: "x1234", senha: "SenhaForte123", papel: Papel.AUDITOR }), ErroPermissao);
  await rejeita("OPERADOR nao pode listar usuarios (403)", () => s.usuarios.listar(operador, { limite: 10, offset: 0 }), ErroPermissao);
  afirmar((await s.usuarios.listar(auditor, { limite: 10, offset: 0 })).total === 4, "AUDITOR pode listar usuarios (4 cadastrados)");

  const logado = await s.autenticacao.autenticar("ADMIN", "AdminSenha123");
  afirmar(logado.username === "admin" && logado.papel === Papel.ADMINISTRADOR, "login valido (username case-insensitive) devolve o usuario");
  afirmar((await banco.repos.usuarios.buscarPorUsername("admin"))?.ultimoLoginEm !== null, "login registra o ultimo acesso");
  await rejeita("senha incorreta -> 401", () => s.autenticacao.autenticar("admin", "SenhaErrada999"), ErroNaoAutenticado, "invalidos");
  await rejeita("usuario inexistente -> 401 com a MESMA mensagem generica", () => s.autenticacao.autenticar("fantasma", "qualquer123"), ErroNaoAutenticado, "invalidos");
  banco.estado.usuarios.find((u) => u.username === "auditor1")!.ativo = false;
  await rejeita("usuario inativo nao consegue autenticar", () => s.autenticacao.autenticar("auditor1", "AuditorSenha1"), ErroNaoAutenticado);
  banco.estado.usuarios.find((u) => u.username === "auditor1")!.ativo = true;

  console.log("\n=== 2. Parametros globais ===");
  const p0 = await s.parametros.obter(admin);
  afirmar(p0.limiteDiasRetroativosLote === 90 && p0.coeficienteDepreciacaoAnual === 20, "parametros padrao da AV1 (90 dias, 20% de depreciacao)");
  await rejeita("AUDITOR nao pode alterar parametros", () => s.parametros.definir(auditor, { aliquotaImpostoPercentual: 5 }), ErroPermissao);
  await rejeita("aliquota fora de 0..100 e rejeitada", () => s.parametros.definir(admin, { aliquotaImpostoPercentual: 150 }), ErroValidacao);
  await rejeita("requisicao sem nenhum parametro e rejeitada", () => s.parametros.definir(admin, {}), ErroValidacao);
  const p1 = await s.parametros.definir(admin, { aliquotaImpostoPercentual: 10, coeficienteDepreciacaoAnual: 0, versao: p0.versao });
  afirmar(p1.aliquotaImpostoPercentual === 10 && p1.versao === p0.versao + 1, "ADMIN altera parametros e a versao e incrementada");
  await rejeita("versao desatualizada -> conflito (409)", () => s.parametros.definir(admin, { aliquotaImpostoPercentual: 12, versao: p0.versao }), ErroConflito);
  afirmar((await s.parametros.obter(auditor)).aliquotaImpostoPercentual === 10, "AUDITOR pode ler os parametros");

  console.log("\n=== 3. Organizacoes e contratos ===");
  const cnpjA = gerarCnpj("123456780001");
  const orgDados = {
    cnpj: cnpjA, razaoSocial: "Hospital Central LTDA", tipo: TipoOrganizacao.HOSPITAL,
    contatoResponsavel: "Maria Silva", emailContato: "maria@hospital.com",
  };
  await rejeita("AUDITOR nao pode cadastrar organizacao", () => s.organizacoes.criar(auditor, orgDados), ErroPermissao);
  await rejeita("GESTOR nao pode cadastrar organizacao", () => s.organizacoes.criar(gestor, orgDados), ErroPermissao);
  await rejeita("CNPJ com digitos verificadores errados e rejeitado (422)", () => s.organizacoes.criar(operador, { ...orgDados, cnpj: "12.345.678/0001-00" }), ErroValidacao, "CNPJ");
  await rejeita("CNPJ de digitos repetidos e rejeitado", () => s.organizacoes.criar(operador, { ...orgDados, cnpj: "11111111111111" }), ErroValidacao);
  await rejeita("e-mail invalido e rejeitado", () => s.organizacoes.criar(operador, { ...orgDados, emailContato: "invalido" }), ErroValidacao);
  const org = await s.organizacoes.criar(operador, { ...orgDados, cnpj: ` ${cnpjA.slice(0, 2)}.${cnpjA.slice(2, 5)}.${cnpjA.slice(5, 8)}/${cnpjA.slice(8, 12)}-${cnpjA.slice(12)} ` });
  afirmar(org.cnpj === cnpjA && org.diasPrazoArmazenamento === 30, "OPERADOR cadastra organizacao; CNPJ formatado e normalizado para 14 digitos");
  await rejeita("CNPJ duplicado -> conflito (409)", () => s.organizacoes.criar(operador, orgDados), ErroConflito);

  await rejeita("organizacao sem contrato -> 404 ao consultar contrato", () => s.organizacoes.obterContrato(org.id), ErroNaoEncontrado);
  await rejeita("AUDITOR nao pode definir contrato", () => s.organizacoes.definirContrato(auditor, org.id, { numero: "C-1", dataInicio: "2026-01-01", dataFim: "2027-01-01" }), ErroPermissao);
  await rejeita("contrato com fim <= inicio e rejeitado", () => s.organizacoes.definirContrato(operador, org.id, { numero: "C-1", dataInicio: "2026-05-01", dataFim: "2026-05-01" }), ErroValidacao);
  await rejeita("data inexistente (31/02) e rejeitada", () => s.organizacoes.definirContrato(operador, org.id, { numero: "C-1", dataInicio: "2026-02-31", dataFim: "2027-01-01" }), ErroValidacao);
  await rejeita("contrato para organizacao inexistente -> 404", () => s.organizacoes.definirContrato(operador, "ffffffff-ffff-4fff-8fff-ffffffffffff", { numero: "C-1", dataInicio: "2026-01-01", dataFim: "2027-01-01" }), ErroNaoEncontrado);
  const c1 = await s.organizacoes.definirContrato(operador, org.id, { numero: "C-2026-001", dataInicio: "2026-01-01", dataFim: "2027-01-01", clausulas: { prazoColetaDias: 15, multa: "2%" } });
  afirmar(c1.criado && c1.contrato.versao === 1, "contrato criado (1:1 opcional) com clausulas semiestruturadas");
  const c2 = await s.organizacoes.definirContrato(operador, org.id, { numero: "C-2026-001", dataInicio: "2026-01-01", dataFim: "2027-06-30", versao: 1 });
  afirmar(!c2.criado && c2.contrato.versao === 2 && c2.contrato.dataFim === "2027-06-30", "segunda chamada atualiza o contrato e incrementa a versao");
  await rejeita("atualizar contrato com versao antiga -> conflito (409)", () => s.organizacoes.definirContrato(operador, org.id, { numero: "C-2026-001", dataInicio: "2026-01-01", dataFim: "2028-01-01", versao: 1 }), ErroConflito);
  const org2 = await s.organizacoes.criar(operador, { ...orgDados, cnpj: gerarCnpj("987654320001"), razaoSocial: "Banco Atlantico SA", tipo: TipoOrganizacao.BANCO });
  await rejeita("numero de contrato ja usado por outra organizacao -> conflito", () => s.organizacoes.definirContrato(operador, org2.id, { numero: "C-2026-001", dataInicio: "2026-01-01", dataFim: "2027-01-01" }), ErroConflito);
  const detalheOrg = await s.organizacoes.detalhar(org.id);
  afirmar(detalheOrg.contrato?.numero === "C-2026-001" && Array.isArray(detalheOrg.lotes), "detalhe da organizacao inclui contrato e lotes (eager loading)");

  console.log("\n=== 4. Lotes (janela de datas e transacao) ===");
  const base = { organizacaoId: org.id, notaFiscal: "NF-100", transportadora: "TransRapida" };
  await rejeita("AUDITOR nao pode criar lote", () => s.lotes.criar(auditor, base), ErroPermissao);
  await rejeita("OPERADOR nao pode criar lote", () => s.lotes.criar(operador, base), ErroPermissao);
  await rejeita("lote para organizacao inexistente e rejeitado", () => s.lotes.criar(gestor, { ...base, organizacaoId: "ffffffff-ffff-4fff-8fff-ffffffffffff" }), ErroValidacao);
  await rejeita("data de entrada futura e rejeitada", () => s.lotes.criar(gestor, { ...base, dataEntrada: dataRelativa(3) }), ErroValidacao, "futuro");
  await rejeita("data anterior a 90 dias e rejeitada", () => s.lotes.criar(gestor, { ...base, dataEntrada: dataRelativa(-120) }), ErroValidacao, "90");
  const loteHoje = await s.lotes.criar(gestor, base);
  afirmar(loteHoje.quantidadeEquipamentos === 0 && loteHoje.status === "RECEBIDO", "lote criado com data padrao (hoje), status RECEBIDO, sem equipamentos");
  const lote90 = await s.lotes.criar(gestor, { ...base, notaFiscal: "NF-101", dataEntrada: dataRelativa(-89) });
  afirmar(lote90.dataEntrada === dataRelativa(-89), "data dentro da janela (89 dias atras) e aceita");
  await s.parametros.definir(admin, { limiteDiasRetroativosLote: 30 });
  await rejeita("limite de dias vem dos parametros globais (agora 30)", () => s.lotes.criar(gestor, { ...base, dataEntrada: dataRelativa(-60) }), ErroValidacao);
  await s.parametros.definir(admin, { limiteDiasRetroativosLote: 90 });

  const lote = await s.lotes.criar(gestor, {
    ...base, notaFiscal: "NF-200",
    equipamentos: [
      { tipo: TipoEquipamento.NOTEBOOK, numeroSerie: "SN-1", codigoBarrasInterno: "BC-001", fabricante: "Dell", modelo: "Latitude" },
      { tipo: TipoEquipamento.SERVIDOR, numeroSerie: "SN-2", codigoBarrasInterno: "BC-002" },
      { tipo: TipoEquipamento.DESKTOP, numeroSerie: "SN-3", codigoBarrasInterno: "BC-003" },
    ],
  });
  afirmar(lote.equipamentos.length === 3 && lote.quantidadeEquipamentos === 3, "lote criado junto com 3 equipamentos (quantidade obtida por contagem, nao por coluna)");
  afirmar(banco.estado.movimentacoes.filter((m) => m.tipo === "CADASTRO").length === 3, "cada equipamento ganhou uma movimentacao CADASTRO");
  afirmar(lote.equipamentos.every((e) => e.status === "AGUARDANDO_TRIAGEM" && e.estadoFisico === "BOM"), "equipamentos nascem AGUARDANDO_TRIAGEM, estado BOM");

  const antes = { lotes: banco.estado.lotes.length, equip: banco.estado.equipamentos.length, mov: banco.estado.movimentacoes.length };
  await rejeita("codigos de barras repetidos na mesma requisicao sao rejeitados", () => s.lotes.criar(gestor, { ...base, notaFiscal: "NF-300", equipamentos: [
    { tipo: TipoEquipamento.MONITOR, numeroSerie: "A", codigoBarrasInterno: "BC-900" }, { tipo: TipoEquipamento.MONITOR, numeroSerie: "B", codigoBarrasInterno: "BC-900" }] }), ErroValidacao);
  await rejeita("codigo de barras ja existente -> conflito (409)", () => s.lotes.criar(gestor, { ...base, notaFiscal: "NF-301", equipamentos: [
    { tipo: TipoEquipamento.MONITOR, numeroSerie: "A", codigoBarrasInterno: "BC-001" }] }), ErroConflito);
  afirmar(banco.estado.lotes.length === antes.lotes, "pre-validacoes falham sem gravar nada (nenhum lote orfao)");

  banco.falhas.add("movimentacoes.criarVarias");
  await rejeita("falha no meio da criacao do lote propaga o erro", () => s.lotes.criar(gestor, { ...base, notaFiscal: "NF-302", equipamentos: [
    { tipo: TipoEquipamento.MONITOR, numeroSerie: "A", codigoBarrasInterno: "BC-950" }] }), Error, "Falha simulada");
  banco.falhas.clear();
  afirmar(banco.estado.lotes.length === antes.lotes && banco.estado.equipamentos.length === antes.equip && banco.estado.movimentacoes.length === antes.mov,
    "ROLLBACK: lote + equipamentos criados antes da falha foram desfeitos (tudo ou nada)");

  const extra = await s.lotes.adicionarEquipamento(gestor, lote.id, { tipo: TipoEquipamento.NOBREAK, numeroSerie: "SN-4", codigoBarrasInterno: "BC-004" });
  afirmar(extra.loteId === lote.id && (await s.lotes.detalhar(lote.id)).quantidadeEquipamentos === 4, "equipamento adicionado a lote existente (quantidade passa a 4)");
  await rejeita("adicionar equipamento a lote inexistente -> 404", () => s.lotes.adicionarEquipamento(gestor, "ffffffff-ffff-4fff-8fff-ffffffffffff", { tipo: TipoEquipamento.NOBREAK, numeroSerie: "S", codigoBarrasInterno: "BC-777" }), ErroNaoEncontrado);
  afirmar((await s.lotes.listar({ organizacaoId: org.id }, { limite: 2, offset: 0 })).itens.length === 2, "listagem de lotes respeita a paginacao (limite=2)");

  console.log("\n=== 5. Equipamentos: triagem, estado fisico e maquina de estados ===");
  const [notebook, servidor, desktop] = lote.equipamentos;
  await rejeita("desmonte SEM triagem previa e rejeitado", () => s.equipamentos.alterarStatus(gestor, notebook.id, { novoStatus: "EM_DESMONTE" as never }), ErroValidacao, "triagem");
  await rejeita("status TRIADO nao pode ser definido fora da triagem", () => s.equipamentos.alterarStatus(gestor, notebook.id, { novoStatus: "TRIADO" as never }), ErroValidacao);
  await rejeita("AUDITOR nao pode fazer triagem", () => s.equipamentos.triagem(auditor, notebook.id, { estadoFisico: "BOM" }), ErroPermissao);
  await rejeita("estado fisico desconhecido e rejeitado", () => s.equipamentos.triagem(gestor, notebook.id, { estadoFisico: "OTIMO" }), ErroValidacao);
  await rejeita("equipamento inexistente -> 404", () => s.equipamentos.triagem(gestor, "ffffffff-ffff-4fff-8fff-ffffffffffff", { estadoFisico: "BOM" }), ErroNaoEncontrado);

  const triado = await s.equipamentos.triagem(gestor, notebook.id, { estadoFisico: "bom", versao: 1 });
  afirmar(triado.status === "TRIADO" && triado.versao === 2, "triagem leva a TRIADO e incrementa a versao (1 -> 2)");
  await rejeita("triagem repetida e rejeitada (TRIADO -> TRIADO nao e transicao valida)", () => s.equipamentos.triagem(gestor, notebook.id, { estadoFisico: "BOM" }), ErroValidacao);

  await rejeita("queda de 2 categorias (BOM -> RUIM) SEM justificativa e rejeitada", () => s.equipamentos.alterarEstadoFisico(gestor, notebook.id, { novoEstado: "RUIM" }), ErroValidacao, "justificativa");
  await rejeita("justificativa curta demais (<10 caracteres) e rejeitada", () => s.equipamentos.alterarEstadoFisico(gestor, notebook.id, { novoEstado: "RUIM", justificativa: "queimou" }), ErroValidacao);
  const ruim = await s.equipamentos.alterarEstadoFisico(gestor, notebook.id, { novoEstado: "RUIM", justificativa: "Placa-mae com sinais de queima" });
  afirmar(ruim.estadoFisico === "RUIM" && ruim.versao === 3, "queda de 2 categorias COM justificativa e aceita");
  const regular = await s.equipamentos.alterarEstadoFisico(gestor, notebook.id, { novoEstado: "REGULAR" });
  afirmar(regular.estadoFisico === "REGULAR", "melhora de estado nao exige justificativa");

  await rejeita("versao desatualizada (stale) -> conflito (409)", () => s.equipamentos.alterarEstadoFisico(gestor, notebook.id, { novoEstado: "BOM", versao: 2 }), ErroConflito, "Conflito de versao");

  banco.falhas.add("movimentacoes.criarVarias");
  const versaoAntes = (await s.equipamentos.detalhar(notebook.id)).versao;
  await rejeita("falha ao registrar a movimentacao propaga o erro", () => s.equipamentos.alterarStatus(gestor, notebook.id, { novoStatus: "EM_DESMONTE" as never }), Error, "Falha simulada");
  banco.falhas.clear();
  const aposFalha = await s.equipamentos.detalhar(notebook.id);
  afirmar(aposFalha.status === "TRIADO" && aposFalha.versao === versaoAntes, "ROLLBACK: o status NAO mudou porque a movimentacao nao foi gravada");

  const desmontando = await s.equipamentos.alterarStatus(gestor, notebook.id, { novoStatus: "EM_DESMONTE" as never, observacao: "Bancada 3" });
  afirmar(desmontando.status === "EM_DESMONTE", "desmonte APOS a triagem e aceito");
  await rejeita("EM_DESMONTE nao pode voltar para TRIADO/AGUARDANDO (transicao invalida)", () => s.equipamentos.triagem(gestor, notebook.id, { estadoFisico: "BOM" }), ErroValidacao);
  const reciclado = await s.equipamentos.alterarStatus(gestor, notebook.id, { novoStatus: "RECICLADO" as never });
  afirmar(reciclado.status === "RECICLADO", "EM_DESMONTE -> RECICLADO");
  await rejeita("RECICLADO e estado final (nenhuma transicao)", () => s.equipamentos.alterarStatus(gestor, notebook.id, { novoStatus: "DESCARTADO" as never }), ErroValidacao);

  console.log("\n=== 6. Rastreabilidade ===");
  const rastreio = await s.equipamentos.rastrear(notebook.id);
  const tipos = rastreio.historico.map((m) => m.tipo);
  afirmar(
    JSON.stringify(tipos) === JSON.stringify(["CADASTRO", "TRIAGEM", "MUDANCA_ESTADO", "MUDANCA_ESTADO", "DESMONTE", "MUDANCA_STATUS"]),
    `historico em ordem cronologica: ${tipos.join(" > ")}`
  );
  afirmar(rastreio.historico.every((m) => typeof m.usuario === "string" && m.usuario.length > 0), "cada evento registra o usuario responsavel");
  afirmar(rastreio.historico[2].justificativa === "Placa-mae com sinais de queima", "a justificativa da queda de estado ficou registrada");
  await rejeita("rastreio de equipamento inexistente -> 404", () => s.equipamentos.rastrear("ffffffff-ffff-4fff-8fff-ffffffffffff"), ErroNaoEncontrado);
  afirmar((await s.equipamentos.listar({ loteId: lote.id }, { limite: 50, offset: 0 })).total === 4, "listagem de equipamentos filtrada por lote");
  afirmar((await s.equipamentos.listar({ status: "RECICLADO" as never }, { limite: 50, offset: 0 })).total === 1, "listagem de equipamentos filtrada por status");

  console.log("\n=== 7. Relatorio de valor residual (polimorfismo + calculos financeiros) ===");
  await s.equipamentos.triagem(gestor, servidor.id, { estadoFisico: "INSERVIVEL" });
  await s.equipamentos.triagem(gestor, desktop.id, { estadoFisico: "NOVO" });
  await rejeita("OPERADOR nao pode ver o relatorio", () => s.relatorios.valorResidual(operador, {}), ErroPermissao);
  await rejeita("relatorio de lote inexistente -> 404", () => s.relatorios.valorResidual(auditor, { loteId: "ffffffff-ffff-4fff-8fff-ffffffffffff" }), ErroNaoEncontrado);
  const rel = await s.relatorios.valorResidual(auditor, { loteId: lote.id });
  const linhaDesktop = rel.linhas.find((l) => l.equipamentoId === desktop.id)!;
  afirmar(linhaDesktop.valorResidual === 800 && linhaDesktop.impostoEstimado === 80 && linhaDesktop.valorLiquido === 720, "DESKTOP NOVO: R$ 800,00, imposto 10% = R$ 80,00, liquido R$ 720,00");
  const linhaNotebook = rel.linhas.find((l) => l.equipamentoId === notebook.id)!;
  afirmar(linhaNotebook.valorResidual === 675, "NOTEBOOK REGULAR: 1500 x 0,45 = R$ 675,00");
  const linhaServidor = rel.linhas.find((l) => l.equipamentoId === servidor.id)!;
  afirmar(linhaServidor.valorResidual === 0, "SERVIDOR INSERVIVEL: valor residual zero");
  afirmar(linhaServidor.potencialRecuperacao === "RECICLAGEM", "polimorfismo: SERVIDOR inservivel -> RECICLAGEM (componentes valiosos)");
  const rel2 = await s.relatorios.valorResidual(admin, {});
  const outro = rel2.linhas.find((l) => l.equipamentoId === extra.id)!;
  afirmar(outro.tipo === "NOBREAK", "relatorio sem filtro inclui equipamentos de todos os lotes");
  await s.equipamentos.alterarEstadoFisico(gestor, extra.id, { novoEstado: "INSERVIVEL", justificativa: "Baterias estufadas e vazando" });
  const rel3 = await s.relatorios.valorResidual(admin, { loteId: lote.id });
  afirmar(rel3.linhas.find((l) => l.equipamentoId === extra.id)!.potencialRecuperacao === "DESCARTE_SEGURO", "polimorfismo: NOBREAK inservivel -> DESCARTE_SEGURO (bateria de chumbo-acido)");
  afirmar(rel3.totais.quantidade === 4 && rel3.totais.valorResidual === 1475 && rel3.totais.valorLiquido === 1327.5, "totais: 4 equipamentos, R$ 1.475,00 residual, R$ 1.327,50 liquido");

  console.log("\n=== 8. Utilitarios de erro ===");
  const instancia: ErroHttp = new ErroConflito("x");
  afirmar(instancia.statusCode === 409, "ErroConflito mapeia para 409");

  console.log("\n" + "=".repeat(64));
  console.log(`RESULTADO: ${total - falhas}/${total} verificacoes passaram.`);
  console.log("=".repeat(64));
  if (falhas > 0) process.exit(1);
}

main().catch((erro) => {
  console.error("Falha inesperada na execucao dos testes:", erro);
  process.exit(1);
});
