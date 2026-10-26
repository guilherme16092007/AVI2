import { randomUUID } from "crypto";
import { ErroValidacao, EstadoFisico } from "../../types";
import { ErroConflito, ErroNaoEncontrado } from "../erros";
import { Pagina, Paginacao } from "../repositorios/portas";

export const novoId = (): string => randomUUID();

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function dataISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function paraData(texto: string, campo = "data"): Date {
  if (!FORMATO_DATA.test(texto)) {
    throw new ErroValidacao(`${campo} invalida (use o formato AAAA-MM-DD).`, [campo]);
  }
  const data = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime()) || dataISO(data) !== texto) {
    throw new ErroValidacao(`${campo} invalida: '${texto}' nao e uma data de calendario valida.`, [campo]);
  }
  return data;
}

export function hojeLocalISO(): string {
  const agora = new Date();
  const dois = (n: number): string => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

export function conferirVersao(versaoAtual: number, versaoInformada: number | undefined, recurso: string): void {
  if (versaoInformada !== undefined && versaoInformada !== versaoAtual) {
    throw new ErroConflito(
      `Conflito de versao em ${recurso}: o cliente enviou a versao ${versaoInformada}, mas a versao atual e ${versaoAtual}. ` +
        "Busque o recurso novamente antes de alterar.",
      { versaoInformada, versaoAtual }
    );
  }
}

export function exigirEncontrado<T>(valor: T | null | undefined, mensagem: string): T {
  if (valor === null || valor === undefined) throw new ErroNaoEncontrado(mensagem);
  return valor;
}

export function interpretarEstadoFisico(nome: string): EstadoFisico {
  const valor = (EstadoFisico as unknown as Record<string, string | number>)[nome.trim().toUpperCase()];
  if (typeof valor !== "number") {
    const aceitos = Object.keys(EstadoFisico).filter((k) => Number.isNaN(Number(k)));
    throw new ErroValidacao(`Estado fisico invalido: '${nome}'. Valores aceitos: ${aceitos.join(", ")}.`, ["estadoFisico"]);
  }
  return valor as EstadoFisico;
}

export function nomeEstadoFisico(estado: EstadoFisico): string {
  return EstadoFisico[estado];
}

export const LIMITE_PADRAO = 50;
export const LIMITE_MAXIMO = 200;

export function normalizarPaginacao(entrada?: Partial<Paginacao>): Paginacao {
  const limite = Math.min(Math.max(Math.trunc(entrada?.limite ?? LIMITE_PADRAO), 1), LIMITE_MAXIMO);
  const offset = Math.max(Math.trunc(entrada?.offset ?? 0), 0);
  return { limite, offset };
}

export function mapearPagina<A, B>(pagina: Pagina<A>, fn: (item: A) => B): Pagina<B> {
  return { itens: pagina.itens.map(fn), total: pagina.total, limite: pagina.limite, offset: pagina.offset };
}

export function arredondar(valor: number): number {
  return Number(valor.toFixed(2));
}
