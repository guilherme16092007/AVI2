import { ErroDominio, ErroValidacao } from "../types";

export class ErroHttp extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly detalhes?: unknown
  ) {
    super(mensagem);
    this.name = codigo;
  }
}

export class ErroNaoAutenticado extends ErroHttp {
  constructor(mensagem = "Autenticacao necessaria.") {
    super(401, "NAO_AUTENTICADO", mensagem);
  }
}

export class ErroPermissao extends ErroHttp {
  constructor(mensagem = "Acesso negado.") {
    super(403, "ACESSO_NEGADO", mensagem);
  }
}

export class ErroNaoEncontrado extends ErroHttp {
  constructor(mensagem = "Recurso nao encontrado.") {
    super(404, "NAO_ENCONTRADO", mensagem);
  }
}

export class ErroConflito extends ErroHttp {
  constructor(mensagem: string, detalhes?: unknown) {
    super(409, "CONFLITO", mensagem, detalhes);
  }
}

export interface RespostaErro {
  statusCode: number;
  erro: string;
  mensagem: string;
  detalhes?: unknown;
}

interface ErroGenerico {
  code?: unknown;
  message?: unknown;
  statusCode?: unknown;
  validation?: unknown;
  validationContext?: unknown;
  meta?: { target?: unknown };
}

interface DetalheAjv {
  instancePath?: string;
  message?: string;
  params?: { missingProperty?: string };
}

export function traduzirErro(erro: unknown): RespostaErro {
  if (erro instanceof ErroHttp) {
    return { statusCode: erro.statusCode, erro: erro.codigo, mensagem: erro.message, detalhes: erro.detalhes };
  }
  if (erro instanceof ErroValidacao) {
    return {
      statusCode: 422,
      erro: "VALIDACAO_NEGOCIO",
      mensagem: erro.message,
      detalhes: erro.campos.length > 0 ? erro.campos : undefined,
    };
  }
  if (erro instanceof ErroDominio) {
    return { statusCode: 422, erro: "REGRA_DE_NEGOCIO", mensagem: erro.message };
  }

  if (typeof erro === "object" && erro !== null) {
    const e = erro as ErroGenerico;
    const mensagem = typeof e.message === "string" ? e.message : "";

    if (Array.isArray(e.validation)) {
      const detalhes = (e.validation as DetalheAjv[]).map((v) => ({
        local: typeof e.validationContext === "string" ? e.validationContext : undefined,
        campo: v.instancePath || v.params?.missingProperty || undefined,
        mensagem: v.message,
      }));
      return { statusCode: 400, erro: "REQUISICAO_INVALIDA", mensagem, detalhes };
    }

    if (e.code === "P2002") {
      const alvo = Array.isArray(e.meta?.target) ? (e.meta?.target as string[]).join(", ") : undefined;
      return {
        statusCode: 409,
        erro: "CONFLITO",
        mensagem: `Ja existe um registro com o mesmo valor unico${alvo ? ` (campo: ${alvo})` : ""}.`,
      };
    }
    if (e.code === "P2003") {
      return { statusCode: 422, erro: "REFERENCIA_INVALIDA", mensagem: "Referencia a um registro inexistente." };
    }
    if (e.code === "P2025") {
      return { statusCode: 404, erro: "NAO_ENCONTRADO", mensagem: "Registro nao encontrado." };
    }
    if (/violates check constraint|Movimentacao e imutavel/i.test(mensagem)) {
      return {
        statusCode: 422,
        erro: "RESTRICAO_BANCO",
        mensagem: "A operacao viola uma regra de integridade do banco de dados.",
      };
    }

    if (typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 500) {
      return { statusCode: e.statusCode, erro: "REQUISICAO_INVALIDA", mensagem };
    }
  }

  return { statusCode: 500, erro: "ERRO_INTERNO", mensagem: "Erro interno do servidor." };
}
