import { Ativo } from "./Ativo";
import { Papel } from "../types";

export interface UsuarioProps {
  id?: string;
  username: string;
  papel: Papel;
  senhaHash: string;
  ativo?: boolean;
}

/** Conta de acesso ao sistema, com papel funcional associado. */
export class Usuario extends Ativo {
  public username: string;
  public papel: Papel;
  public senhaHash: string;
  public ativo: boolean;
  public ultimoLoginEm?: string;

  constructor(props: UsuarioProps) {
    super(props.id);
    this.username = props.username;
    this.papel = props.papel;
    this.senhaHash = props.senhaHash;
    this.ativo = props.ativo ?? true;
  }

  registrarLogin(): void {
    this.ultimoLoginEm = new Date().toISOString();
    this.tocar();
  }

  paraJSON(): Record<string, unknown> {
    return {
      id: this.id,
      username: this.username,
      papel: this.papel,
      senhaHash: this.senhaHash,
      ativo: this.ativo,
      ultimoLoginEm: this.ultimoLoginEm,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm,
    };
  }

  /** Serializacao segura para exibicao (NUNCA inclui o hash da senha). */
  paraJSONPublico(): Record<string, unknown> {
    const { senhaHash: _senhaHash, ...resto } = this.paraJSON();
    return resto;
  }

  static deJSON(obj: Record<string, unknown>): Usuario {
    const usuario = new Usuario({
      id: obj.id as string,
      username: obj.username as string,
      papel: obj.papel as Papel,
      senhaHash: obj.senhaHash as string,
      ativo: obj.ativo as boolean,
    });
    usuario.ultimoLoginEm = obj.ultimoLoginEm as string | undefined;
    usuario.atualizadoEm = obj.atualizadoEm as string;
    return usuario;
  }

  resumo(): string {
    return `${this.username}  [${this.papel}]  ${this.ativo ? "ativo" : "inativo"}`;
  }
}
