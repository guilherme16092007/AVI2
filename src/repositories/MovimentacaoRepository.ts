import { BaseRepository } from "./BaseRepository";
import { Movimentacao } from "../domain/Movimentacao";
import { CryptoService } from "../crypto/CryptoService";
import { JournalManager } from "../persistence/JournalManager";

export class MovimentacaoRepository extends BaseRepository<Movimentacao> {
  constructor(diretorioDados: string, cryptoSvc: CryptoService, journal: JournalManager) {
    super(diretorioDados, "movimentacoes.enc", "Movimentacao", cryptoSvc, journal);
  }

  protected paraObjeto(entidade: Movimentacao): Record<string, unknown> {
    return entidade.paraJSON();
  }

  protected deObjeto(obj: Record<string, unknown>): Movimentacao {
    return Movimentacao.deJSON(obj);
  }

  listarPorEquipamento(equipamentoId: string): Movimentacao[] {
    return this.listarTodos()
      .filter((m) => m.equipamentoId === equipamentoId)
      .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  }
}
