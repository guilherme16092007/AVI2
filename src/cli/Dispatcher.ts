import { Contexto } from "./Contexto";
import { ComandoAnalisado } from "./CommandParser";
import { MenuManager } from "./MenuManager";
import { Severidade, ResultadoOperacao, ErroDominio, ErroAutenticacao, ErroValidacao } from "../types";

import { executarLogin, executarLogout, executarWhoami } from "../commands/AuthCommands";
import { criarUsuario, listarUsuarios } from "../commands/UsuarioCommands";
import { definirParametros, verParametros } from "../commands/ConfigCommands";
import { criarOrganizacao, listarOrganizacoes } from "../commands/OrganizacaoCommands";
import { criarLote, listarLotes } from "../commands/LoteCommands";
import {
  cadastrarEquipamento,
  triagemEquipamento,
  alterarEstadoEquipamento,
  alterarStatusEquipamento,
  listarEquipamentos,
} from "../commands/EquipamentoCommands";
import { consultarRastreio, relatorioValor, expurgarJournal } from "../commands/RelatorioCommands";

/** Comandos que nao exigem sessao autenticada (a propria autenticacao, ajuda e saida). */
const COMANDOS_PUBLICOS = new Set(["login:", "ajuda:", "sair:"]);

function chave(entidade: string, acao: string): string {
  return `${entidade}:${acao}`;
}

/**
 * Despacha um comando ja analisado para o handler correspondente,
 * aplicando, nesta ordem: (1) exigencia de sessao ativa, (2) controle
 * de acesso por papel (RF: segregacao de responsabilidades) e (3)
 * tratamento uniforme de erros de dominio/validacao/autenticacao.
 */
export async function despachar(ctx: Contexto, cmd: ComandoAnalisado): Promise<ResultadoOperacao<unknown>> {
  const k = chave(cmd.entidade, cmd.acao);

  try {
    if (k === "login:") return await executarLogin(ctx, cmd);
    if (k === "logout:") return executarLogout(ctx);
    if (k === "whoami:") return executarWhoami(ctx);
    if (cmd.entidade === "ajuda") {
      const papel = ctx.sessao?.papel;
      return {
        ok: true,
        severidade: Severidade.INFO,
        mensagem: papel ? MenuManager.formatarMenu(papel) : "Faca login para ver os comandos disponiveis ao seu papel.",
      };
    }
    if (cmd.entidade === "sair") {
      return { ok: true, severidade: Severidade.INFO, mensagem: "__SAIR__" };
    }

    // Toda operacao de negocio exige sessao ativa e valida (RF: expiracao por inatividade).
    if (!COMANDOS_PUBLICOS.has(k)) {
      ctx.sessao = ctx.authService.sessaoAtual();
    }

    if (!ctx.sessao) {
      return { ok: false, severidade: Severidade.ERRO, mensagem: "Comando desconhecido ou sessao necessaria. Digite 'ajuda'." };
    }

    if (!MenuManager.comandoPermitido(ctx.sessao.papel, cmd.entidade, cmd.acao)) {
      return {
        ok: false,
        severidade: Severidade.ERRO,
        mensagem: `Comando '${cmd.entidade} ${cmd.acao}' nao reconhecido ou nao permitido para o papel ${ctx.sessao.papel}. Digite 'ajuda'.`,
      };
    }

    switch (k) {
      case "usuario:criar":
        return criarUsuario(ctx, cmd);
      case "usuario:listar":
        return listarUsuarios(ctx);
      case "config:definir":
        return definirParametros(ctx, cmd);
      case "config:ver":
        return verParametros(ctx);
      case "org:criar":
        return criarOrganizacao(ctx, cmd);
      case "org:listar":
        return listarOrganizacoes(ctx);
      case "lote:criar":
        return criarLote(ctx, cmd);
      case "lote:listar":
        return listarLotes(ctx, cmd);
      case "equipamento:cadastrar":
        return cadastrarEquipamento(ctx, cmd);
      case "equipamento:triagem":
        return triagemEquipamento(ctx, cmd);
      case "equipamento:estado":
        return alterarEstadoEquipamento(ctx, cmd);
      case "equipamento:status":
        return alterarStatusEquipamento(ctx, cmd);
      case "equipamento:listar":
        return listarEquipamentos(ctx, cmd);
      case "rastreio:consultar":
        return consultarRastreio(ctx, cmd);
      case "relatorio:valor":
        return relatorioValor(ctx, cmd);
      case "journal:expurgar":
        return expurgarJournal(ctx);
      default:
        return {
          ok: false,
          severidade: Severidade.ERRO,
          mensagem: `Comando '${cmd.linhaOriginal}' nao reconhecido. Digite 'ajuda' para ver os comandos disponiveis.`,
        };
    }
  } catch (erro) {
    return tratarErro(erro);
  }
}

function tratarErro(erro: unknown): ResultadoOperacao {
  if (erro instanceof ErroValidacao) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: `Validacao falhou: ${erro.message}` };
  }
  if (erro instanceof ErroAutenticacao) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: erro.message };
  }
  if (erro instanceof ErroDominio) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: erro.message };
  }
  if (erro instanceof Error) {
    return { ok: false, severidade: Severidade.CRITICO, mensagem: `Erro inesperado: ${erro.message}` };
  }
  return { ok: false, severidade: Severidade.CRITICO, mensagem: "Erro inesperado desconhecido." };
}
