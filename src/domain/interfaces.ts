import { EstadoFisico } from "../types";

/**
 * Contrato implementado por qualquer entidade cujo valor de mercado se
 * deprecia ao longo do tempo (RF: coeficiente de depreciacao de
 * equipamentos configurado pelo administrador).
 */
export interface IDepreciavel {
  calcularValorResidual(coeficienteDepreciacaoAnualPercentual: number): number;
}

/** Contrato implementado por entidades que podem ser rastreadas via `rastreio`. */
export interface IRastreavel {
  obterIdentificadorRastreio(): string;
}

/** Contrato para qualquer classe capaz de descrever seu potencial de recuperacao. */
export interface IClassificavelParaRecuperacao {
  potencialRecuperacao(): "REUTILIZACAO" | "RECICLAGEM" | "DESCARTE_SEGURO";
}

/** Constantes de peso usadas nos calculos polimorficos de valor residual por tipo. */
export const VALOR_BASE_POR_TIPO: Record<string, number> = {
  DESKTOP: 800,
  NOTEBOOK: 1500,
  SERVIDOR: 6000,
  MONITOR: 400,
  PERIFERICO: 80,
  NOBREAK: 350,
};

/** Fator multiplicador de valor conforme o estado fisico atual do equipamento. */
export const FATOR_POR_ESTADO: Record<EstadoFisico, number> = {
  [EstadoFisico.NOVO]: 1.0,
  [EstadoFisico.BOM]: 0.75,
  [EstadoFisico.REGULAR]: 0.45,
  [EstadoFisico.RUIM]: 0.15,
  [EstadoFisico.INSERVIVEL]: 0.0,
};
