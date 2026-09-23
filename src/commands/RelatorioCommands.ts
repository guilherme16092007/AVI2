import { Contexto } from "../cli/Contexto";
import { ComandoAnalisado } from "../cli/CommandParser";
import { CommandParser } from "../cli/CommandParser";
import { Severidade, ResultadoOperacao, EstadoFisico } from "../types";

export function consultarRastreio(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const equipamentoId = cmd.posicionais[0];
  if (!equipamentoId) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: "Informe o id do equipamento como parametro posicional." };
  }

  const { equipamento, historico } = ctx.equipamentoService.rastrear(equipamentoId);

  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: `Rastreio do equipamento ${equipamento.id} (${equipamento.tipo}, SN ${equipamento.numeroSerie}): ${historico.length} evento(s).`,
    dados: {
      equipamento: equipamento.paraJSON(),
      historico: historico.map((m) => m.resumo()),
    },
  };
}

export function relatorioValor(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const loteId = CommandParser.flagOpcional(cmd, "lote");
  const equipamentos = loteId ? ctx.equipamentoService.listarPorLote(loteId) : ctx.equipamentoService.listarTodos();

  const linhas = equipamentos.map((e) => {
    const valor = e.calcularValorResidual(ctx.parametros.coeficienteDepreciacaoAnual);
    return `${e.id}  [${e.tipo}]  estado=${EstadoFisico[e.estadoFisico]}  valor_residual=R$ ${valor.toFixed(2)}  recuperacao=${e.potencialRecuperacao()}`;
  });

  const total = equipamentos.reduce((soma, e) => soma + e.calcularValorResidual(ctx.parametros.coeficienteDepreciacaoAnual), 0);

  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: `Relatorio de valor residual: ${equipamentos.length} equipamento(s), total estimado R$ ${total.toFixed(2)}.`,
    dados: linhas,
  };
}

export function expurgarJournal(ctx: Contexto): ResultadoOperacao {
  const removidos = ctx.journal.expurgarAntigos();
  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: removidos.length
      ? `${removidos.length} arquivo(s) de journal removido(s) por exceder a retencao de ${ctx.parametros.retencaoJournalDias} dias.`
      : "Nenhum arquivo de journal elegivel para expurgo.",
    dados: removidos,
  };
}
