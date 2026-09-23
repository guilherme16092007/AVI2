import { Contexto } from "../cli/Contexto";
import { ComandoAnalisado, CommandParser } from "../cli/CommandParser";
import { perguntarSenhaOculta } from "../utils/TerminalUtils";
import { Severidade, ResultadoOperacao } from "../types";

export async function executarLogin(ctx: Contexto, cmd: ComandoAnalisado): Promise<ResultadoOperacao> {
  const username = CommandParser.exigirFlag(cmd, "user");
  let senha = CommandParser.flagOpcional(cmd, "senha");
  if (!senha) {
    senha = await perguntarSenhaOculta("Senha: ");
  }

  const sessao = ctx.authService.login(username, senha);
  ctx.sessao = sessao;

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: `Login efetuado com sucesso. Bem-vindo(a), ${sessao.username} [${sessao.papel}].`,
  };
}

export function executarLogout(ctx: Contexto): ResultadoOperacao {
  ctx.authService.logout();
  ctx.sessao = null;
  return { ok: true, severidade: Severidade.INFO, mensagem: "Sessao encerrada." };
}

export function executarWhoami(ctx: Contexto): ResultadoOperacao {
  if (!ctx.sessao) {
    return { ok: false, severidade: Severidade.AVISO, mensagem: "Nenhuma sessao ativa." };
  }
  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: `Usuario: ${ctx.sessao.username}  |  Papel: ${ctx.sessao.papel}  |  Sessao ativa desde: ${new Date(
      ctx.sessao.criadaEm
    ).toLocaleString("pt-BR")}`,
  };
}
