import { BaseRepository } from "./BaseRepository";
import { Equipamento } from "../domain/Equipamento";
import { EquipamentoFactory } from "../factories/EquipamentoFactory";
import { CryptoService } from "../crypto/CryptoService";
import { JournalManager } from "../persistence/JournalManager";

export class EquipamentoRepository extends BaseRepository<Equipamento> {
  constructor(diretorioDados: string, cryptoSvc: CryptoService, journal: JournalManager) {
    super(diretorioDados, "equipamentos.enc", "Equipamento", cryptoSvc, journal);
  }

  protected paraObjeto(entidade: Equipamento): Record<string, unknown> {
    return entidade.paraJSON();
  }

  protected deObjeto(obj: Record<string, unknown>): Equipamento {
    return EquipamentoFactory.deJSON(obj);
  }

  listarPorLote(loteId: string): Equipamento[] {
    return this.listarTodos().filter((e) => e.loteId === loteId);
  }

  existeComCodigoBarras(codigo: string): boolean {
    return this.listarTodos().some((e) => e.codigoBarrasInterno === codigo);
  }
}
