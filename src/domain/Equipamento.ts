import { Ativo } from "./Ativo";
import { EstadoFisico, StatusEquipamento, TipoEquipamento } from "../types";
import {
  IDepreciavel,
  IRastreavel,
  IClassificavelParaRecuperacao,
  VALOR_BASE_POR_TIPO,
  FATOR_POR_ESTADO,
} from "./interfaces";

export interface EquipamentoProps {
  id?: string;
  loteId: string;
  numeroSerie: string;
  fabricante?: string;
  modelo?: string;
  codigoBarrasInterno: string;
}

/**
 * Classe abstrata que representa um equipamento eletronico dentro de um
 * lote. Implementa as interfaces IDepreciavel, IRastreavel e
 * IClassificavelParaRecuperacao (demonstrando o uso de interfaces do
 * enunciado) e delega a cada subclasse concreta a logica especifica de
 * valorizacao e potencial de recuperacao (polimorfismo).
 *
 * As subclasses concretas (EquipamentoDesktop, EquipamentoNotebook,
 * EquipamentoServidor, EquipamentoMonitor, EquipamentoPeriferico,
 * EquipamentoNobreak) sao instanciadas exclusivamente pela
 * {@link EquipamentoFactory} (RF: fabrica de objetos compostos).
 */
export abstract class Equipamento extends Ativo implements IDepreciavel, IRastreavel, IClassificavelParaRecuperacao {
  public loteId: string;
  public numeroSerie: string;
  public fabricante?: string;
  public modelo?: string;
  public codigoBarrasInterno: string;
  public estadoFisico: EstadoFisico;
  public status: StatusEquipamento;

  abstract readonly tipo: TipoEquipamento;

  constructor(props: EquipamentoProps) {
    super(props.id);
    this.loteId = props.loteId;
    this.numeroSerie = props.numeroSerie;
    this.fabricante = props.fabricante;
    this.modelo = props.modelo;
    this.codigoBarrasInterno = props.codigoBarrasInterno;
    this.estadoFisico = EstadoFisico.BOM;
    this.status = StatusEquipamento.AGUARDANDO_TRIAGEM;
  }

  /** Valor residual estimado = valor base do tipo x fator do estado fisico x fator de depreciacao temporal. */
  calcularValorResidual(coeficienteDepreciacaoAnualPercentual: number): number {
    const valorBase = VALOR_BASE_POR_TIPO[this.tipo] ?? 0;
    const fatorEstado = FATOR_POR_ESTADO[this.estadoFisico];

    const anosDesdeCriacao =
      (Date.now() - new Date(this.criadoEm).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const fatorDepreciacaoTemporal = Math.max(
      0,
      1 - (coeficienteDepreciacaoAnualPercentual / 100) * anosDesdeCriacao
    );

    return Number((valorBase * fatorEstado * fatorDepreciacaoTemporal).toFixed(2));
  }

  obterIdentificadorRastreio(): string {
    return `${this.tipo}:${this.numeroSerie}:${this.id}`;
  }

  /** Cada subclasse concreta pode sobrescrever para refinar a classificacao (polimorfismo). */
  potencialRecuperacao(): "REUTILIZACAO" | "RECICLAGEM" | "DESCARTE_SEGURO" {
    if (this.estadoFisico >= EstadoFisico.REGULAR) return "REUTILIZACAO";
    if (this.estadoFisico === EstadoFisico.RUIM) return "RECICLAGEM";
    return "DESCARTE_SEGURO";
  }

  paraJSON(): Record<string, unknown> {
    return {
      id: this.id,
      tipo: this.tipo,
      loteId: this.loteId,
      numeroSerie: this.numeroSerie,
      fabricante: this.fabricante,
      modelo: this.modelo,
      codigoBarrasInterno: this.codigoBarrasInterno,
      estadoFisico: this.estadoFisico,
      status: this.status,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm,
    };
  }

  resumo(): string {
    return `${this.id}  [${this.tipo}] SN:${this.numeroSerie}  estado=${EstadoFisico[this.estadoFisico]}  status=${this.status}`;
  }
}

export class EquipamentoDesktop extends Equipamento {
  readonly tipo = TipoEquipamento.DESKTOP;
}

export class EquipamentoNotebook extends Equipamento {
  readonly tipo = TipoEquipamento.NOTEBOOK;

  /** Notebooks com bateria degradada (estado RUIM ou pior) vao sempre para reciclagem, nunca reutilizacao. */
  override potencialRecuperacao(): "REUTILIZACAO" | "RECICLAGEM" | "DESCARTE_SEGURO" {
    if (this.estadoFisico === EstadoFisico.INSERVIVEL) return "DESCARTE_SEGURO";
    if (this.estadoFisico <= EstadoFisico.RUIM) return "RECICLAGEM";
    return "REUTILIZACAO";
  }
}

export class EquipamentoServidor extends Equipamento {
  readonly tipo = TipoEquipamento.SERVIDOR;

  /** Servidores tem componentes (fontes redundantes, discos) de alto valor mesmo degradados: raramente vao a descarte direto. */
  override potencialRecuperacao(): "REUTILIZACAO" | "RECICLAGEM" | "DESCARTE_SEGURO" {
    if (this.estadoFisico === EstadoFisico.INSERVIVEL) return "RECICLAGEM";
    return this.estadoFisico >= EstadoFisico.REGULAR ? "REUTILIZACAO" : "RECICLAGEM";
  }
}

export class EquipamentoMonitor extends Equipamento {
  readonly tipo = TipoEquipamento.MONITOR;
}

export class EquipamentoPeriferico extends Equipamento {
  readonly tipo = TipoEquipamento.PERIFERICO;

  /** Perifericos de baixo valor vao direto a reciclagem quando abaixo do estado BOM (custo de triagem individual nao compensa). */
  override potencialRecuperacao(): "REUTILIZACAO" | "RECICLAGEM" | "DESCARTE_SEGURO" {
    return this.estadoFisico >= EstadoFisico.BOM ? "REUTILIZACAO" : "RECICLAGEM";
  }
}

export class EquipamentoNobreak extends Equipamento {
  readonly tipo = TipoEquipamento.NOBREAK;

  /** Nobreaks contem baterias de chumbo-acido: mesmo em bom estado exigem descarte seguro se inserviveis. */
  override potencialRecuperacao(): "REUTILIZACAO" | "RECICLAGEM" | "DESCARTE_SEGURO" {
    if (this.estadoFisico === EstadoFisico.INSERVIVEL) return "DESCARTE_SEGURO";
    return this.estadoFisico >= EstadoFisico.REGULAR ? "REUTILIZACAO" : "RECICLAGEM";
  }
}
