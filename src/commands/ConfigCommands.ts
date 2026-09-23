import { Contexto } from "../cli/Contexto";
import { ComandoAnalisado, CommandParser } from "../cli/CommandParser";
import { Severidade, ResultadoOperacao } from "../types";

export function definirParametros(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const impostoStr = CommandParser.flagOpcional(cmd, "imposto");
  const depreciacaoStr = CommandParser.flagOpcional(cmd, "depreciacao");

  if (impostoStr !== undefined) {
    const valor = Number(impostoStr);
    if (Number.isNaN(valor) || valor < 0) {
      return { ok: false, severidade: Severidade.ERRO, mensagem: "Valor de --imposto invalido." };
    }
    ctx.parametros.aliquotaImpostoPercentual = valor;
  }

  if (depreciacaoStr !== undefined) {
    const valor = Number(depreciacaoStr);
    if (Number.isNaN(valor) || valor < 0) {
      return { ok: false, severidade: Severidade.ERRO, mensagem: "Valor de --depreciacao invalido." };
    }
    ctx.parametros.coeficienteDepreciacaoAnual = valor;
  }

  ctx.configManager.salvarParametros(ctx.parametros, ctx.cryptoSvc);

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: "Parametros globais atualizados.",
    dados: ctx.parametros,
  };
}

export function verParametros(ctx: Contexto): ResultadoOperacao {
  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: "Parametros globais atuais:",
    dados: ctx.parametros,
  };
}
