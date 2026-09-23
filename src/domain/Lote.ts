import { Ativo } from "./Ativo";
import { StatusLote } from "../types";

export interface LoteProps {
  id?: string;
  organizacaoId: string;
  dataEntrada: string; // ISO date (yyyy-mm-dd)
  notaFiscal: string;
  transportadora: string;
}

/** Lote de equipamentos recebido de uma organizacao geradora. */
export class Lote extends Ativo {
  public organizacaoId: string;
  public dataEntrada: string;
  public notaFiscal: string;
  public transportadora: string;
  public status: StatusLote;
  public quantidadeEquipamentos: number;

  constructor(props: LoteProps) {
    super(props.id);
    this.organizacaoId = props.organizacaoId;
    this.dataEntrada = props.dataEntrada;
    this.notaFiscal = props.notaFiscal;
    this.transportadora = props.transportadora;
    this.status = StatusLote.RECEBIDO;
    this.quantidadeEquipamentos = 0;
  }

  paraJSON(): Record<string, unknown> {
    return {
      id: this.id,
      organizacaoId: this.organizacaoId,
      dataEntrada: this.dataEntrada,
      notaFiscal: this.notaFiscal,
      transportadora: this.transportadora,
      status: this.status,
      quantidadeEquipamentos: this.quantidadeEquipamentos,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm,
    };
  }

  static deJSON(obj: Record<string, unknown>): Lote {
    const lote = new Lote({
      id: obj.id as string,
      organizacaoId: obj.organizacaoId as string,
      dataEntrada: obj.dataEntrada as string,
      notaFiscal: obj.notaFiscal as string,
      transportadora: obj.transportadora as string,
    });
    lote.status = obj.status as StatusLote;
    lote.quantidadeEquipamentos = obj.quantidadeEquipamentos as number;
    lote.atualizadoEm = obj.atualizadoEm as string;
    return lote;
  }

  resumo(): string {
    return `${this.id}  NF ${this.notaFiscal}  ${this.transportadora}  [${this.status}]  ${this.quantidadeEquipamentos} equip.`;
  }
}
