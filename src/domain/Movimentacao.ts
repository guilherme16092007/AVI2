import { Ativo } from "./Ativo";
import { TipoMovimentacao, EstadoFisico, StatusEquipamento } from "../types";

export interface MovimentacaoProps {
  id?: string;
  equipamentoId: string;
  usuarioId: string;
  tipo: TipoMovimentacao;
  estadoFisicoAnterior?: EstadoFisico;
  estadoFisicoNovo?: EstadoFisico;
  statusAnterior?: StatusEquipamento;
  statusNovo?: StatusEquipamento;
  justificativa?: string;
  observacao?: string;
}

/**
 * Registro imutável de uma movimentação/alteração sofrida por um
 * equipamento. Cada Movimentacao tambem gera uma entrada correspondente
 * no journal (write-ahead log), mas e adicionalmente persistida como
 * entidade de dominio consultavel para o comando `rastreio`.
 */
export class Movimentacao extends Ativo {
  public equipamentoId: string;
  public usuarioId: string;
  public tipo: TipoMovimentacao;
  public estadoFisicoAnterior?: EstadoFisico;
  public estadoFisicoNovo?: EstadoFisico;
  public statusAnterior?: StatusEquipamento;
  public statusNovo?: StatusEquipamento;
  public justificativa?: string;
  public observacao?: string;

  constructor(props: MovimentacaoProps) {
    super(props.id);
    this.equipamentoId = props.equipamentoId;
    this.usuarioId = props.usuarioId;
    this.tipo = props.tipo;
    this.estadoFisicoAnterior = props.estadoFisicoAnterior;
    this.estadoFisicoNovo = props.estadoFisicoNovo;
    this.statusAnterior = props.statusAnterior;
    this.statusNovo = props.statusNovo;
    this.justificativa = props.justificativa;
    this.observacao = props.observacao;
  }

  paraJSON(): Record<string, unknown> {
    return {
      id: this.id,
      equipamentoId: this.equipamentoId,
      usuarioId: this.usuarioId,
      tipo: this.tipo,
      estadoFisicoAnterior: this.estadoFisicoAnterior,
      estadoFisicoNovo: this.estadoFisicoNovo,
      statusAnterior: this.statusAnterior,
      statusNovo: this.statusNovo,
      justificativa: this.justificativa,
      observacao: this.observacao,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm,
    };
  }

  static deJSON(obj: Record<string, unknown>): Movimentacao {
    const mov = new Movimentacao({
      id: obj.id as string,
      equipamentoId: obj.equipamentoId as string,
      usuarioId: obj.usuarioId as string,
      tipo: obj.tipo as TipoMovimentacao,
      estadoFisicoAnterior: obj.estadoFisicoAnterior as EstadoFisico | undefined,
      estadoFisicoNovo: obj.estadoFisicoNovo as EstadoFisico | undefined,
      statusAnterior: obj.statusAnterior as StatusEquipamento | undefined,
      statusNovo: obj.statusNovo as StatusEquipamento | undefined,
      justificativa: obj.justificativa as string | undefined,
      observacao: obj.observacao as string | undefined,
    });
    mov.atualizadoEm = obj.atualizadoEm as string;
    return mov;
  }

  resumo(): string {
    const quando = new Date(this.criadoEm).toLocaleString("pt-BR");
    return `${quando}  ${this.tipo}  ${this.statusAnterior ?? "-"}->${this.statusNovo ?? "-"}${
      this.justificativa ? `  motivo: ${this.justificativa}` : ""
    }`;
  }
}
