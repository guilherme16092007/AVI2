import { Validator } from "./Validator";
import { EstadoFisico, StatusEquipamento, TRANSICOES_STATUS_EQUIPAMENTO } from "../types";

export interface ContextoValidacaoMudancaStatus {
  statusAtual: StatusEquipamento;
  statusDesejado: StatusEquipamento;
}

/**
 * Validador da maquina de estados de Status do Equipamento.
 * RN: um equipamento so pode ser movimentado para EM_DESMONTE apos
 * passar por triagem completa (status TRIADO).
 */
export class TransicaoStatusValidator extends Validator<ContextoValidacaoMudancaStatus> {
  protected regras(): Array<(ctx: ContextoValidacaoMudancaStatus) => string | null> {
    return [
      (ctx) => {
        const permitidos = TRANSICOES_STATUS_EQUIPAMENTO[ctx.statusAtual];
        if (!permitidos.includes(ctx.statusDesejado)) {
          return `Transicao de status invalida: ${ctx.statusAtual} -> ${ctx.statusDesejado}. ` +
            `Transicoes permitidas a partir de ${ctx.statusAtual}: ${
              permitidos.length ? permitidos.join(", ") : "(nenhuma; status final)"
            }.`;
        }
        return null;
      },
      (ctx) => {
        if (
          ctx.statusDesejado === StatusEquipamento.EM_DESMONTE &&
          ctx.statusAtual !== StatusEquipamento.TRIADO
        ) {
          return "Equipamento so pode ser enviado para desmonte apos triagem completa (status TRIADO).";
        }
        return null;
      },
    ];
  }
}

export interface ContextoValidacaoMudancaEstado {
  estadoAtual: EstadoFisico;
  estadoDesejado: EstadoFisico;
  justificativa?: string;
}

/**
 * Validador da regra de justificativa obrigatoria.
 * RN: sempre que o estado fisico de um equipamento for alterado para
 * duas categorias (ou mais) abaixo do estado anterior, e obrigatoria
 * uma justificativa textual.
 */
export class MudancaEstadoFisicoValidator extends Validator<ContextoValidacaoMudancaEstado> {
  protected regras(): Array<(ctx: ContextoValidacaoMudancaEstado) => string | null> {
    return [
      (ctx) => {
        const quedaCategorias = ctx.estadoAtual - ctx.estadoDesejado;
        if (quedaCategorias >= 2 && (!ctx.justificativa || ctx.justificativa.trim().length < 10)) {
          return (
            `Queda de ${quedaCategorias} categorias no estado fisico (${EstadoFisico[ctx.estadoAtual]} -> ` +
            `${EstadoFisico[ctx.estadoDesejado]}) exige justificativa textual com no minimo 10 caracteres.`
          );
        }
        return null;
      },
    ];
  }
}
