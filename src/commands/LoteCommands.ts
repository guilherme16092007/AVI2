import { Contexto } from "../cli/Contexto";
import { ComandoAnalisado, CommandParser } from "../cli/CommandParser";
import { Severidade, ResultadoOperacao } from "../types";

function dataHojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function criarLote(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const organizacaoId = CommandParser.exigirFlag(cmd, "org");
  const notaFiscal = CommandParser.exigirFlag(cmd, "nf");
  const transportadora = CommandParser.exigirFlag(cmd, "transp");
  const dataEntrada = CommandParser.flagOpcional(cmd, "data", dataHojeISO())!;

  const lote = ctx.loteService.criar(
    { organizacaoId, notaFiscal, transportadora, dataEntrada },
    ctx.sessao!.usuarioId
  );

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: `Lote criado com id ${lote.id} (status: ${lote.status}).`,
    dados: lote.paraJSON(),
  };
}

export function listarLotes(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const organizacaoId = CommandParser.flagOpcional(cmd, "org");
  const lotes = organizacaoId ? ctx.loteService.listarPorOrganizacao(organizacaoId) : ctx.loteService.listar();

  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: `${lotes.length} lote(s) encontrado(s).`,
    dados: lotes.map((l) => l.resumo()),
  };
}
