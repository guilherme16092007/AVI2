import { Validator } from "./Validator";
import { LoteProps } from "../domain/Lote";

export interface ContextoValidacaoLote {
  props: LoteProps;
  organizacaoExiste: boolean;
  limiteDiasRetroativos: number;
}

/**
 * Validador de regras de negocio para cadastro de Lote.
 * RN: impedir data de entrada futura, ou anterior a mais de N dias
 * (parametro configuravel, padrao 90 dias, conforme enunciado).
 */
export class LoteValidator extends Validator<ContextoValidacaoLote> {
  protected regras(): Array<(ctx: ContextoValidacaoLote) => string | null> {
    return [
      (ctx) => (!ctx.organizacaoExiste ? "Organizacao informada nao existe ou esta inativa." : null),
      (ctx) => (!ctx.props.notaFiscal ? "Nota fiscal e obrigatoria." : null),
      (ctx) => (!ctx.props.transportadora ? "Transportadora e obrigatoria." : null),
      (ctx) => {
        if (!ctx.props.dataEntrada) return "Data de entrada e obrigatoria (formato AAAA-MM-DD).";
        const data = new Date(ctx.props.dataEntrada + "T00:00:00");
        if (Number.isNaN(data.getTime())) return "Data de entrada invalida (use o formato AAAA-MM-DD).";

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        if (data.getTime() > hoje.getTime()) {
          return "Data de entrada nao pode ser no futuro.";
        }

        const diasDiferenca = (hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24);
        if (diasDiferenca > ctx.limiteDiasRetroativos) {
          return `Data de entrada nao pode ser anterior a ${ctx.limiteDiasRetroativos} dias (recebida: ${Math.floor(
            diasDiferenca
          )} dias atras).`;
        }
        return null;
      },
    ];
  }
}
