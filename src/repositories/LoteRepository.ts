import { BaseRepository } from "./BaseRepository";
import { Lote } from "../domain/Lote";
import { CryptoService } from "../crypto/CryptoService";
import { JournalManager } from "../persistence/JournalManager";

export class LoteRepository extends BaseRepository<Lote> {
  constructor(diretorioDados: string, cryptoSvc: CryptoService, journal: JournalManager) {
    super(diretorioDados, "lotes.enc", "Lote", cryptoSvc, journal);
  }

  protected paraObjeto(entidade: Lote): Record<string, unknown> {
    return entidade.paraJSON();
  }

  protected deObjeto(obj: Record<string, unknown>): Lote {
    return Lote.deJSON(obj);
  }

  listarPorOrganizacao(organizacaoId: string): Lote[] {
    return this.listarTodos().filter((l) => l.organizacaoId === organizacaoId);
  }
}
