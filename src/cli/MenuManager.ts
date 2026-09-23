import { Papel } from "../types";

export interface DefinicaoComando {
  entidade: string;
  acao: string;
  sintaxe: string;
  descricao: string;
  papeisPermitidos: Papel[] | "TODOS";
}

/**
 * Catalogo central de comandos da CLI. Cada entrada define quais papeis
 * podem executa-la (RF: menu principal se adapta dinamicamente ao papel
 * do usuario autenticado, ocultando opcoes sem permissao).
 */
export const CATALOGO_COMANDOS: DefinicaoComando[] = [
  {
    entidade: "usuario",
    acao: "criar",
    sintaxe: "usuario criar --username <nome> --senha <senha> --papel <ADMINISTRADOR|OPERADOR_CADASTRO|GESTOR_ALMOXARIFADO|AUDITOR>",
    descricao: "Cria uma nova conta de acesso ao sistema.",
    papeisPermitidos: [Papel.ADMINISTRADOR],
  },
  {
    entidade: "usuario",
    acao: "listar",
    sintaxe: "usuario listar",
    descricao: "Lista as contas de acesso cadastradas.",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.AUDITOR],
  },
  {
    entidade: "config",
    acao: "definir",
    sintaxe: "config definir --imposto <percentual> --depreciacao <percentual>",
    descricao: "Atualiza parametros globais (aliquotas, depreciacao).",
    papeisPermitidos: [Papel.ADMINISTRADOR],
  },
  {
    entidade: "config",
    acao: "ver",
    sintaxe: "config ver",
    descricao: "Exibe os parametros globais atuais.",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.AUDITOR],
  },
  {
    entidade: "org",
    acao: "criar",
    sintaxe: "org criar --cnpj <cnpj> --razao <razao social> --tipo <VAREJO|HOSPITAL|UNIVERSIDADE|BANCO|INDUSTRIA|OUTRO> --contato <nome> --email <email> [--prazo <dias>]",
    descricao: "Cadastra uma nova organizacao geradora de residuos.",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.OPERADOR_CADASTRO],
  },
  {
    entidade: "org",
    acao: "listar",
    sintaxe: "org listar",
    descricao: "Lista as organizacoes cadastradas.",
    papeisPermitidos: "TODOS",
  },
  {
    entidade: "lote",
    acao: "criar",
    sintaxe: "lote criar --org <organizacaoId> --nf <notaFiscal> --transp <transportadora> [--data <AAAA-MM-DD>]",
    descricao: "Registra um novo lote recebido de uma organizacao.",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO],
  },
  {
    entidade: "lote",
    acao: "listar",
    sintaxe: "lote listar [--org <organizacaoId>]",
    descricao: "Lista lotes (opcionalmente filtrando por organizacao).",
    papeisPermitidos: "TODOS",
  },
  {
    entidade: "equipamento",
    acao: "cadastrar",
    sintaxe: "equipamento cadastrar --lote <loteId> --tipo <DESKTOP|NOTEBOOK|SERVIDOR|MONITOR|PERIFERICO|NOBREAK> --serie <numeroSerie> --codigo <codigoBarras> [--fabricante <f>] [--modelo <m>]",
    descricao: "Cadastra um equipamento dentro de um lote (aguardando triagem).",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO],
  },
  {
    entidade: "equipamento",
    acao: "triagem",
    sintaxe: "equipamento triagem <equipamentoId> --estado <NOVO|BOM|REGULAR|RUIM|INSERVIVEL>",
    descricao: "Realiza a triagem do equipamento, avaliando seu estado fisico.",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO],
  },
  {
    entidade: "equipamento",
    acao: "estado",
    sintaxe: "equipamento estado <equipamentoId> --novo <estado> [--justificativa \"texto\"]",
    descricao: "Altera o estado fisico do equipamento (exige justificativa se a queda for >= 2 categorias).",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO],
  },
  {
    entidade: "equipamento",
    acao: "status",
    sintaxe: "equipamento status <equipamentoId> --novo <TRIADO|EM_DESMONTE|RECICLADO|DESCARTADO> [--obs \"texto\"]",
    descricao: "Altera o status operacional do equipamento (respeitando a maquina de estados).",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO],
  },
  {
    entidade: "equipamento",
    acao: "listar",
    sintaxe: "equipamento listar [--lote <loteId>]",
    descricao: "Lista equipamentos (opcionalmente filtrando por lote).",
    papeisPermitidos: "TODOS",
  },
  {
    entidade: "rastreio",
    acao: "consultar",
    sintaxe: "rastreio consultar <equipamentoId>",
    descricao: "Exibe o historico completo de movimentacoes de um equipamento.",
    papeisPermitidos: "TODOS",
  },
  {
    entidade: "relatorio",
    acao: "valor",
    sintaxe: "relatorio valor [--lote <loteId>]",
    descricao: "Gera relatorio de valor residual estimado dos equipamentos.",
    papeisPermitidos: [Papel.ADMINISTRADOR, Papel.AUDITOR],
  },
  {
    entidade: "journal",
    acao: "expurgar",
    sintaxe: "journal expurgar",
    descricao: "Remove arquivos de journal rotacionados mais antigos que a politica de retencao.",
    papeisPermitidos: [Papel.ADMINISTRADOR],
  },
  {
    entidade: "ajuda",
    acao: "",
    sintaxe: "ajuda",
    descricao: "Exibe os comandos disponiveis para o seu papel.",
    papeisPermitidos: "TODOS",
  },
  {
    entidade: "sair",
    acao: "",
    sintaxe: "sair",
    descricao: "Encerra a sessao e sai do sistema.",
    papeisPermitidos: "TODOS",
  },
];

export class MenuManager {
  /** Retorna apenas os comandos visiveis/permitidos para o papel informado (menu dinamico). */
  static comandosVisiveisParaPapel(papel: Papel): DefinicaoComando[] {
    return CATALOGO_COMANDOS.filter(
      (c) => c.papeisPermitidos === "TODOS" || c.papeisPermitidos.includes(papel)
    );
  }

  static comandoPermitido(papel: Papel, entidade: string, acao: string): boolean {
    const def = CATALOGO_COMANDOS.find((c) => c.entidade === entidade && c.acao === acao);
    if (!def) return false;
    return def.papeisPermitidos === "TODOS" || def.papeisPermitidos.includes(papel);
  }

  static formatarMenu(papel: Papel): string {
    const comandos = MenuManager.comandosVisiveisParaPapel(papel);
    const linhas = [`Comandos disponiveis para o papel ${papel}:`, ""];
    for (const c of comandos) {
      linhas.push(`  ${c.sintaxe}`);
      linhas.push(`      ${c.descricao}`);
    }
    return linhas.join("\n");
  }
}
