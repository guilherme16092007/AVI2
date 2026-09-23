import { Contexto } from "../cli/Contexto";
import { ComandoAnalisado, CommandParser } from "../cli/CommandParser";
import { Papel, Severidade, ResultadoOperacao } from "../types";

export function criarUsuario(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const username = CommandParser.exigirFlag(cmd, "username");
  const senha = CommandParser.exigirFlag(cmd, "senha");
  const papelStr = CommandParser.exigirFlag(cmd, "papel").toUpperCase();

  if (!Object.values(Papel).includes(papelStr as Papel)) {
    return {
      ok: false,
      severidade: Severidade.ERRO,
      mensagem: `Papel invalido: '${papelStr}'. Valores aceitos: ${Object.values(Papel).join(", ")}.`,
    };
  }

  const usuario = ctx.authService.criarUsuario(username, senha, papelStr as Papel, ctx.sessao!.usuarioId);

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: `Usuario '${usuario.username}' criado com papel ${usuario.papel}.`,
    dados: usuario.paraJSONPublico(),
  };
}

export function listarUsuarios(ctx: Contexto): ResultadoOperacao {
  const usuarios = ctx.usuarioRepo.listarTodos();
  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: `${usuarios.length} usuario(s) cadastrado(s).`,
    dados: usuarios.map((u) => u.resumo()),
  };
}
