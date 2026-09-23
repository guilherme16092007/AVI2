import { Contexto } from "../cli/Contexto";
import { ComandoAnalisado } from "../cli/CommandParser";
import { ResultadoOperacao } from "../types";

export type HandlerComando = (ctx: Contexto, cmd: ComandoAnalisado) => Promise<ResultadoOperacao<unknown>> | ResultadoOperacao<unknown>;

export function chaveComando(entidade: string, acao: string): string {
  return `${entidade}:${acao}`;
}
