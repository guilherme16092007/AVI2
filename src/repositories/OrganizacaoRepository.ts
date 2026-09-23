import { BaseRepository } from "./BaseRepository";
import { Organizacao } from "../domain/Organizacao";
import { CryptoService } from "../crypto/CryptoService";
import { JournalManager } from "../persistence/JournalManager";

export class OrganizacaoRepository extends BaseRepository<Organizacao> {
  constructor(diretorioDados: string, cryptoSvc: CryptoService, journal: JournalManager) {
    super(diretorioDados, "organizacoes.enc", "Organizacao", cryptoSvc, journal);
  }

  protected paraObjeto(entidade: Organizacao): Record<string, unknown> {
    return entidade.paraJSON();
  }

  protected deObjeto(obj: Record<string, unknown>): Organizacao {
    return Organizacao.deJSON(obj);
  }

  existeComCnpj(cnpjNormalizado: string): boolean {
    return this.listarTodos().some(
      (org) => org.cnpj.replace(/\D/g, "") === cnpjNormalizado && org.ativo
    );
  }
}
