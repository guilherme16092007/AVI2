import { Contexto } from "../cli/Contexto";
import { ComandoAnalisado, CommandParser } from "../cli/CommandParser";
import { Severidade, ResultadoOperacao, TipoEquipamento, EstadoFisico, StatusEquipamento } from "../types";

function parseEstadoFisico(valor: string): EstadoFisico | null {
  const chave = valor.toUpperCase() as keyof typeof EstadoFisico;
  return EstadoFisico[chave] !== undefined ? EstadoFisico[chave] : null;
}

function parseStatusEquipamento(valor: string): StatusEquipamento | null {
  const chave = valor.toUpperCase();
  return Object.values(StatusEquipamento).includes(chave as StatusEquipamento)
    ? (chave as StatusEquipamento)
    : null;
}

export function cadastrarEquipamento(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const loteId = CommandParser.exigirFlag(cmd, "lote");
  const tipoStr = CommandParser.exigirFlag(cmd, "tipo").toUpperCase();
  const numeroSerie = CommandParser.exigirFlag(cmd, "serie");
  const codigoBarrasInterno = CommandParser.exigirFlag(cmd, "codigo");
  const fabricante = CommandParser.flagOpcional(cmd, "fabricante");
  const modelo = CommandParser.flagOpcional(cmd, "modelo");

  if (!Object.values(TipoEquipamento).includes(tipoStr as TipoEquipamento)) {
    return {
      ok: false,
      severidade: Severidade.ERRO,
      mensagem: `Tipo invalido: '${tipoStr}'. Valores aceitos: ${Object.values(TipoEquipamento).join(", ")}.`,
    };
  }

  const equipamento = ctx.equipamentoService.cadastrar(
    tipoStr as TipoEquipamento,
    { loteId, numeroSerie, codigoBarrasInterno, fabricante, modelo },
    ctx.sessao!.usuarioId
  );

  ctx.loteService.registrarEquipamentoAdicionado(loteId, ctx.sessao!.usuarioId);

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: `Equipamento cadastrado com id ${equipamento.id} (status: ${equipamento.status}).`,
    dados: equipamento.paraJSON(),
  };
}

export function triagemEquipamento(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const equipamentoId = cmd.posicionais[0];
  if (!equipamentoId) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: "Informe o id do equipamento como parametro posicional." };
  }
  const estadoStr = CommandParser.exigirFlag(cmd, "estado");
  const estado = parseEstadoFisico(estadoStr);
  if (estado === null) {
    return {
      ok: false,
      severidade: Severidade.ERRO,
      mensagem: `Estado fisico invalido: '${estadoStr}'. Valores aceitos: ${Object.keys(EstadoFisico).filter((k) => Number.isNaN(Number(k))).join(", ")}.`,
    };
  }

  const equipamento = ctx.equipamentoService.realizarTriagem(equipamentoId, estado, ctx.sessao!.usuarioId);

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: `Triagem concluida para o equipamento ${equipamento.id}. Status: ${equipamento.status}, estado fisico: ${EstadoFisico[equipamento.estadoFisico]}.`,
    dados: equipamento.paraJSON(),
  };
}

export function alterarEstadoEquipamento(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const equipamentoId = cmd.posicionais[0];
  if (!equipamentoId) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: "Informe o id do equipamento como parametro posicional." };
  }
  const novoEstadoStr = CommandParser.exigirFlag(cmd, "novo");
  const novoEstado = parseEstadoFisico(novoEstadoStr);
  if (novoEstado === null) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: `Estado fisico invalido: '${novoEstadoStr}'.` };
  }
  const justificativa = CommandParser.flagOpcional(cmd, "justificativa");

  const equipamento = ctx.equipamentoService.atualizarEstadoFisico(
    equipamentoId,
    novoEstado,
    ctx.sessao!.usuarioId,
    justificativa
  );

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: `Estado fisico do equipamento ${equipamento.id} atualizado para ${EstadoFisico[equipamento.estadoFisico]}.`,
    dados: equipamento.paraJSON(),
  };
}

export function alterarStatusEquipamento(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const equipamentoId = cmd.posicionais[0];
  if (!equipamentoId) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: "Informe o id do equipamento como parametro posicional." };
  }
  const novoStatusStr = CommandParser.exigirFlag(cmd, "novo");
  const novoStatus = parseStatusEquipamento(novoStatusStr);
  if (novoStatus === null) {
    return { ok: false, severidade: Severidade.ERRO, mensagem: `Status invalido: '${novoStatusStr}'.` };
  }
  const observacao = CommandParser.flagOpcional(cmd, "obs");

  const equipamento = ctx.equipamentoService.atualizarStatus(
    equipamentoId,
    novoStatus,
    ctx.sessao!.usuarioId,
    observacao
  );

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: `Status do equipamento ${equipamento.id} atualizado para ${equipamento.status}.`,
    dados: equipamento.paraJSON(),
  };
}

export function listarEquipamentos(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const loteId = CommandParser.flagOpcional(cmd, "lote");
  const equipamentos = loteId ? ctx.equipamentoService.listarPorLote(loteId) : ctx.equipamentoService.listarTodos();

  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: `${equipamentos.length} equipamento(s) encontrado(s).`,
    dados: equipamentos.map((e) => e.resumo()),
  };
}
