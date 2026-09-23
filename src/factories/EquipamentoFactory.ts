import {
  Equipamento,
  EquipamentoProps,
  EquipamentoDesktop,
  EquipamentoNotebook,
  EquipamentoServidor,
  EquipamentoMonitor,
  EquipamentoPeriferico,
  EquipamentoNobreak,
} from "../domain/Equipamento";
import { EstadoFisico, StatusEquipamento, TipoEquipamento, ErroDominio } from "../types";

/**
 * EquipamentoFactory centraliza a criacao de instancias concretas de
 * `Equipamento` (RF: "fabricas para criacao de objetos compostos").
 *
 * Justificativa de design: o restante do sistema (repositorios,
 * comandos de CLI) nunca instancia `new EquipamentoDesktop(...)`
 * diretamente. Ele pede a fabrica um equipamento do `TipoEquipamento`
 * desejado. Isso isola o restante do codigo da hierarquia concreta de
 * classes, permitindo adicionar novos tipos de equipamento (ex.: uma
 * futura classe `EquipamentoPainelSolar`) sem alterar nenhum ponto de
 * chamada existente - exatamente a capacidade de evolucao mencionada
 * na proposta de negocio.
 */
export class EquipamentoFactory {
  static criar(tipo: TipoEquipamento, props: EquipamentoProps): Equipamento {
    switch (tipo) {
      case TipoEquipamento.DESKTOP:
        return new EquipamentoDesktop(props);
      case TipoEquipamento.NOTEBOOK:
        return new EquipamentoNotebook(props);
      case TipoEquipamento.SERVIDOR:
        return new EquipamentoServidor(props);
      case TipoEquipamento.MONITOR:
        return new EquipamentoMonitor(props);
      case TipoEquipamento.PERIFERICO:
        return new EquipamentoPeriferico(props);
      case TipoEquipamento.NOBREAK:
        return new EquipamentoNobreak(props);
      default: {
        const _exhaustive: never = tipo;
        throw new ErroDominio(`Tipo de equipamento desconhecido: ${_exhaustive as string}`);
      }
    }
  }

  /** Reconstroi um Equipamento concreto a partir do JSON persistido, preservando o tipo polimorfico. */
  static deJSON(obj: Record<string, unknown>): Equipamento {
    const tipo = obj.tipo as TipoEquipamento;
    const equipamento = EquipamentoFactory.criar(tipo, {
      id: obj.id as string,
      loteId: obj.loteId as string,
      numeroSerie: obj.numeroSerie as string,
      fabricante: obj.fabricante as string | undefined,
      modelo: obj.modelo as string | undefined,
      codigoBarrasInterno: obj.codigoBarrasInterno as string,
    });
    equipamento.estadoFisico = obj.estadoFisico as EstadoFisico;
    equipamento.status = obj.status as StatusEquipamento;
    equipamento.atualizadoEm = obj.atualizadoEm as string;
    return equipamento;
  }
}
