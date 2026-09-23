import { BaseRepository } from "./BaseRepository";
import { Usuario } from "../domain/Usuario";
import { CryptoService } from "../crypto/CryptoService";
import { JournalManager } from "../persistence/JournalManager";

/**
 * Repositorio de credenciais. Armazenado em arquivo separado
 * (credenciais.enc), tambem cifrado com AES-256, conforme exigido pelo
 * enunciado ("senhas armazenadas em arquivo separado").
 */
export class UsuarioRepository extends BaseRepository<Usuario> {
  constructor(diretorioDados: string, cryptoSvc: CryptoService, journal: JournalManager) {
    super(diretorioDados, "credenciais.enc", "Usuario", cryptoSvc, journal);
  }

  protected paraObjeto(entidade: Usuario): Record<string, unknown> {
    return entidade.paraJSON();
  }

  protected deObjeto(obj: Record<string, unknown>): Usuario {
    return Usuario.deJSON(obj);
  }

  buscarPorUsername(username: string): Usuario | null {
    return this.listarTodos().find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
  }

  existeUsername(username: string): boolean {
    return this.buscarPorUsername(username) !== null;
  }
}
