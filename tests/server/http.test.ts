import { HashService } from "../../src/crypto/HashService";
import { construirApp } from "../../src/server/app";
import { criarServicos } from "../../src/server/servicos";
import { Papel } from "../../src/types";
import { BancoMemoria, dataRelativa, gerarCnpj } from "./memoria";

let total = 0;
let falhas = 0;
function afirmar(condicao: boolean, descricao: string): void {
  total += 1;
  if (condicao) console.log(`  \x1b[32mOK\x1b[0m     ${descricao}`);
  else {
    falhas += 1;
    console.log(`  \x1b[31mFALHOU\x1b[0m ${descricao}`);
  }
}

interface Resposta {
  status: number;
  corpo: any;
}

async function main(): Promise<void> {
  const banco = new BancoMemoria();
  await banco.repos.usuarios.criar({
    id: "00000000-0000-4000-8000-000000000001",
    username: "admin",
    papel: Papel.ADMINISTRADOR,
    senhaHash: HashService.gerarHash("AdminSenha123"),
  });

  const app = await construirApp({
    servicos: criarServicos(banco),
    jwtSecret: "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres",
    jwtExpiresIn: "30m",
    logger: false,
    verificarBanco: async () => undefined,
  });

  const chamar = async (metodo: "GET" | "POST" | "PUT" | "PATCH", url: string, token?: string, corpo?: unknown): Promise<Resposta> => {
    const resposta = await app.inject({
      method: metodo,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      payload: corpo as object | undefined,
    });
    let json: unknown = null;
    try {
      json = resposta.json();
    } catch {
      json = null;
    }
    return { status: resposta.statusCode, corpo: json };
  };
  const login = async (username: string, senha: string): Promise<string> => {
    const r = await chamar("POST", "/auth/login", undefined, { username, senha });
    return r.corpo.token as string;
  };

  console.log("\n=== 1. Rotas publicas e autenticacao JWT ===");
  let r = await chamar("GET", "/saude");
  afirmar(r.status === 200 && r.corpo.status === "ok", "GET /saude e publica e responde 200");
  r = await chamar("POST", "/auth/login", undefined, { username: "admin", senha: "AdminSenha123" });
  afirmar(r.status === 200 && typeof r.corpo.token === "string" && r.corpo.tipo === "Bearer", "POST /auth/login devolve um JWT");
  afirmar(r.corpo.usuario.papel === "ADMINISTRADOR" && !("senhaHash" in r.corpo.usuario), "resposta do login traz o papel e NAO traz o hash da senha");
  r = await chamar("POST", "/auth/login", undefined, { username: "admin", senha: "errada123" });
  afirmar(r.status === 401 && r.corpo.erro === "NAO_AUTENTICADO", "credenciais invalidas -> 401");
  r = await chamar("POST", "/auth/login", undefined, { username: "admin" });
  afirmar(r.status === 400 && r.corpo.erro === "REQUISICAO_INVALIDA", "login sem senha -> 400 (JSON Schema)");
  r = await chamar("GET", "/organizacoes");
  afirmar(r.status === 401, "rota protegida sem token -> 401");
  r = await chamar("GET", "/organizacoes", "token.invalido.aqui");
  afirmar(r.status === 401, "rota protegida com token invalido -> 401");
  const tokenAdmin = await login("admin", "AdminSenha123");
  r = await chamar("GET", "/auth/me", tokenAdmin);
  afirmar(r.status === 200 && r.corpo.username === "admin" && r.corpo.papel === "ADMINISTRADOR", "GET /auth/me devolve o usuario do token");
  r = await chamar("GET", "/rota-que-nao-existe", tokenAdmin);
  afirmar(r.status === 404 && r.corpo.erro === "NAO_ENCONTRADO", "rota inexistente -> 404 no formato padrao de erro");

  console.log("\n=== 2. Usuarios e autorizacao por papel ===");
  for (const [username, papel] of [["operador", "OPERADOR_CADASTRO"], ["gestor", "GESTOR_ALMOXARIFADO"], ["auditor", "AUDITOR"]] as const) {
    r = await chamar("POST", "/usuarios", tokenAdmin, { username, senha: `${username}Senha1`, papel });
    afirmar(r.status === 201 && r.corpo.papel === papel, `ADMIN cria o usuario ${username} (${papel}) -> 201`);
  }
  const tokenOperador = await login("operador", "operadorSenha1");
  const tokenGestor = await login("gestor", "gestorSenha1");
  const tokenAuditor = await login("auditor", "auditorSenha1");
  r = await chamar("POST", "/usuarios", tokenGestor, { username: "intruso", senha: "Intruso1234", papel: "ADMINISTRADOR" });
  afirmar(r.status === 403 && r.corpo.erro === "ACESSO_NEGADO", "GESTOR tentando criar usuario -> 403");
  r = await chamar("POST", "/usuarios", tokenAdmin, { username: "operador", senha: "OutraSenha123", papel: "AUDITOR" });
  afirmar(r.status === 409, "username repetido -> 409");
  r = await chamar("POST", "/usuarios", tokenAdmin, { username: "novo", senha: "curta", papel: "AUDITOR" });
  afirmar(r.status === 400, "senha curta rejeitada ja pelo JSON Schema -> 400");
  r = await chamar("POST", "/usuarios", tokenAdmin, { username: "novo", senha: "SenhaForte1", papel: "SUPERUSER" });
  afirmar(r.status === 400, "papel fora do enum -> 400");
  r = await chamar("POST", "/usuarios", tokenAdmin, { username: "novo", senha: "SenhaForte1", papel: "AUDITOR", extra: true });
  afirmar(r.status === 400, "campo desconhecido no corpo -> 400 (schema estrito)");
  r = await chamar("GET", "/usuarios?limite=2", tokenAuditor);
  afirmar(r.status === 200 && r.corpo.itens.length === 2 && r.corpo.total === 4 && r.corpo.limite === 2, "GET /usuarios?limite=2 pagina (2 de 4) e AUDITOR pode listar");
  r = await chamar("GET", "/usuarios?limite=0", tokenAuditor);
  afirmar(r.status === 400, "paginacao invalida (limite=0) -> 400");

  console.log("\n=== 3. Organizacoes e contratos ===");
  const cnpj = gerarCnpj("123456780001");
  const dadosOrg = { cnpj, razaoSocial: "Hospital Central LTDA", tipo: "HOSPITAL", contatoResponsavel: "Maria Silva", emailContato: "maria@hospital.com" };
  r = await chamar("POST", "/organizacoes", tokenAuditor, dadosOrg);
  afirmar(r.status === 403, "AUDITOR nao cadastra organizacao -> 403");
  r = await chamar("POST", "/organizacoes", tokenOperador, { ...dadosOrg, cnpj: "12345678000100" });
  afirmar(r.status === 422 && r.corpo.erro === "VALIDACAO_NEGOCIO", "CNPJ com digitos verificadores errados -> 422");
  r = await chamar("POST", "/organizacoes", tokenOperador, { razaoSocial: "Sem CNPJ" });
  afirmar(r.status === 400 && Array.isArray(r.corpo.detalhes), "campos obrigatorios ausentes -> 400 com detalhes");
  r = await chamar("POST", "/organizacoes", tokenOperador, dadosOrg);
  afirmar(r.status === 201 && r.corpo.cnpj === cnpj, "OPERADOR cadastra organizacao -> 201");
  const orgId = r.corpo.id as string;
  r = await chamar("POST", "/organizacoes", tokenOperador, dadosOrg);
  afirmar(r.status === 409, "CNPJ duplicado -> 409");
  r = await chamar("GET", "/organizacoes/nao-e-um-uuid", tokenOperador);
  afirmar(r.status === 400, "id que nao e UUID -> 400");
  r = await chamar("GET", `/organizacoes/${orgId}/contrato`, tokenOperador);
  afirmar(r.status === 404, "organizacao sem contrato -> 404");
  r = await chamar("PUT", `/organizacoes/${orgId}/contrato`, tokenOperador, { numero: "CT-1", dataInicio: "2026-01-01", dataFim: "2027-01-01", clausulas: { prazoColetaDias: 15 } });
  afirmar(r.status === 201 && r.corpo.versao === 1, "PUT contrato novo -> 201");
  r = await chamar("PUT", `/organizacoes/${orgId}/contrato`, tokenOperador, { numero: "CT-1", dataInicio: "2026-01-01", dataFim: "2028-01-01", versao: 1 });
  afirmar(r.status === 200 && r.corpo.versao === 2, "PUT contrato existente -> 200 (versao incrementada)");
  r = await chamar("PUT", `/organizacoes/${orgId}/contrato`, tokenOperador, { numero: "CT-1", dataInicio: "2026-01-01", dataFim: "2029-01-01", versao: 1 });
  afirmar(r.status === 409, "PUT contrato com versao antiga -> 409 (concorrencia otimista)");
  r = await chamar("PUT", `/organizacoes/${orgId}/contrato`, tokenOperador, { numero: "CT-1", dataInicio: "2026-01-01", dataFim: "2026-01-01" });
  afirmar(r.status === 422, "contrato com fim = inicio -> 422");
  r = await chamar("GET", `/organizacoes/${orgId}`, tokenAuditor);
  afirmar(r.status === 200 && r.corpo.contrato?.numero === "CT-1" && Array.isArray(r.corpo.lotes), "GET /organizacoes/:id traz contrato e lotes");

  console.log("\n=== 4. Lotes e equipamentos ===");
  r = await chamar("POST", "/lotes", tokenOperador, { organizacaoId: orgId, notaFiscal: "NF-1", transportadora: "TransRapida" });
  afirmar(r.status === 403, "OPERADOR nao cria lote -> 403");
  r = await chamar("POST", "/lotes", tokenGestor, { organizacaoId: orgId, notaFiscal: "NF-1", transportadora: "TransRapida", dataEntrada: dataRelativa(5) });
  afirmar(r.status === 422, "data de entrada futura -> 422");
  r = await chamar("POST", "/lotes", tokenGestor, { organizacaoId: orgId, notaFiscal: "NF-1", transportadora: "TransRapida", dataEntrada: "2026/01/01" });
  afirmar(r.status === 400, "data fora do formato AAAA-MM-DD -> 400");
  r = await chamar("POST", "/lotes", tokenGestor, {
    organizacaoId: orgId, notaFiscal: "NF-1", transportadora: "TransRapida",
    equipamentos: [
      { tipo: "NOTEBOOK", numeroSerie: "SN-1", codigoBarrasInterno: "BC-1" },
      { tipo: "SERVIDOR", numeroSerie: "SN-2", codigoBarrasInterno: "BC-2" },
    ],
  });
  afirmar(r.status === 201 && r.corpo.equipamentos.length === 2 && r.corpo.quantidadeEquipamentos === 2, "POST /lotes com equipamentos -> 201 (transacao unica)");
  const loteId = r.corpo.id as string;
  const [eq1, eq2] = r.corpo.equipamentos as { id: string }[];
  r = await chamar("POST", "/lotes", tokenGestor, { organizacaoId: orgId, notaFiscal: "NF-2", transportadora: "T", equipamentos: [{ tipo: "DESKTOP", numeroSerie: "X", codigoBarrasInterno: "BC-1" }] });
  afirmar(r.status === 409, "codigo de barras ja existente -> 409");
  r = await chamar("POST", `/lotes/${loteId}/equipamentos`, tokenGestor, { tipo: "NOBREAK", numeroSerie: "SN-3", codigoBarrasInterno: "BC-3" });
  afirmar(r.status === 201 && r.corpo.status === "AGUARDANDO_TRIAGEM", "POST /lotes/:id/equipamentos -> 201");
  r = await chamar("GET", `/lotes?organizacaoId=${orgId}`, tokenAuditor);
  afirmar(r.status === 200 && r.corpo.total === 1 && r.corpo.itens[0].quantidadeEquipamentos === 3, "GET /lotes filtra por organizacao e conta equipamentos");
  r = await chamar("GET", `/equipamentos?loteId=${loteId}&status=AGUARDANDO_TRIAGEM`, tokenAuditor);
  afirmar(r.status === 200 && r.corpo.total === 3, "GET /equipamentos filtra por lote e status");

  console.log("\n=== 5. Triagem, regras de estado e rastreio ===");
  r = await chamar("PATCH", `/equipamentos/${eq1.id}/status`, tokenGestor, { novoStatus: "EM_DESMONTE" });
  afirmar(r.status === 422, "desmonte sem triagem previa -> 422");
  r = await chamar("PATCH", `/equipamentos/${eq1.id}/status`, tokenGestor, { novoStatus: "TRIADO" });
  afirmar(r.status === 400, "status TRIADO nao e aceito pelo endpoint de status (use /triagem) -> 400");
  r = await chamar("POST", `/equipamentos/${eq1.id}/triagem`, tokenAuditor, { estadoFisico: "BOM" });
  afirmar(r.status === 403, "AUDITOR nao faz triagem -> 403");
  r = await chamar("POST", `/equipamentos/${eq1.id}/triagem`, tokenGestor, { estadoFisico: "OTIMO" });
  afirmar(r.status === 400, "estado fisico fora do enum -> 400");
  r = await chamar("POST", `/equipamentos/${eq1.id}/triagem`, tokenGestor, { estadoFisico: "BOM", versao: 1 });
  afirmar(r.status === 200 && r.corpo.status === "TRIADO" && r.corpo.versao === 2, "triagem -> 200, TRIADO, versao 2");
  r = await chamar("PATCH", `/equipamentos/${eq1.id}/estado-fisico`, tokenGestor, { novoEstado: "RUIM" });
  afirmar(r.status === 422, "queda de 2 categorias sem justificativa -> 422");
  r = await chamar("PATCH", `/equipamentos/${eq1.id}/estado-fisico`, tokenGestor, { novoEstado: "RUIM", justificativa: "Placa-mae com sinais de queima" });
  afirmar(r.status === 200 && r.corpo.estadoFisico === "RUIM", "queda de 2 categorias com justificativa -> 200");
  r = await chamar("PATCH", `/equipamentos/${eq1.id}/estado-fisico`, tokenGestor, { novoEstado: "REGULAR", versao: 2 });
  afirmar(r.status === 409, "alteracao com versao desatualizada -> 409");
  r = await chamar("PATCH", `/equipamentos/${eq1.id}/status`, tokenGestor, { novoStatus: "EM_DESMONTE", observacao: "Bancada 3" });
  afirmar(r.status === 200 && r.corpo.status === "EM_DESMONTE", "desmonte apos triagem -> 200");
  r = await chamar("GET", `/equipamentos/${eq1.id}/rastreio`, tokenAuditor);
  afirmar(r.status === 200 && r.corpo.historico.length === 4, "rastreio: 4 eventos (cadastro, triagem, mudanca de estado, desmonte)");
  afirmar(r.corpo.historico.map((m: { tipo: string }) => m.tipo).join(">") === "CADASTRO>TRIAGEM>MUDANCA_ESTADO>DESMONTE", "rastreio em ordem cronologica");

  console.log("\n=== 6. Parametros e relatorio ===");
  r = await chamar("PATCH", "/parametros", tokenAuditor, { aliquotaImpostoPercentual: 5 });
  afirmar(r.status === 403, "AUDITOR nao altera parametros -> 403");
  r = await chamar("PATCH", "/parametros", tokenAdmin, {});
  afirmar(r.status === 400, "PATCH /parametros sem nenhum campo -> 400");
  r = await chamar("PATCH", "/parametros", tokenAdmin, { aliquotaImpostoPercentual: 10, coeficienteDepreciacaoAnual: 0 });
  afirmar(r.status === 200 && r.corpo.aliquotaImpostoPercentual === 10, "ADMIN altera parametros -> 200");
  await chamar("POST", `/equipamentos/${eq2.id}/triagem`, tokenGestor, { estadoFisico: "NOVO" });
  r = await chamar("GET", `/relatorios/valor-residual?loteId=${loteId}`, tokenAuditor);
  const linhaServidor = r.corpo.linhas?.find((l: { equipamentoId: string }) => l.equipamentoId === eq2.id);
  afirmar(r.status === 200 && linhaServidor?.valorResidual === 6000 && linhaServidor?.valorLiquido === 5400, "relatorio: SERVIDOR NOVO = R$ 6.000,00; liquido (10%) = R$ 5.400,00");
  r = await chamar("GET", `/relatorios/valor-residual`, tokenOperador);
  afirmar(r.status === 403, "OPERADOR nao acessa o relatorio -> 403");

  await app.close();

  console.log("\n" + "=".repeat(64));
  console.log(`RESULTADO: ${total - falhas}/${total} verificacoes passaram.`);
  console.log("=".repeat(64));
  if (falhas > 0) process.exit(1);
}

main().catch((erro) => {
  console.error("Falha inesperada na execucao dos testes HTTP:", erro);
  process.exit(1);
});
