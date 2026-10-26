import { HashService } from "../../crypto/HashService";
import { ErroNaoAutenticado } from "../erros";
import { Dependencias } from "../repositorios/portas";
import { paraUsuarioDto, UsuarioDto } from "./dto";

export class AutenticacaoServico {
  private hashFalso: string | undefined;

  constructor(private readonly dep: Dependencias) {}

  async autenticar(username: string, senha: string): Promise<UsuarioDto> {
    const usuario = await this.dep.repos.usuarios.buscarPorUsername(username.trim().toLowerCase());

    if (!usuario && this.hashFalso === undefined) {
      this.hashFalso = HashService.gerarHash("senha-inexistente-tempo-constante");
    }
    const hash = usuario ? usuario.senhaHash : (this.hashFalso as string);
    const senhaConfere = HashService.verificar(senha, hash);

    if (!usuario || !usuario.ativo || !senhaConfere) {
      throw new ErroNaoAutenticado("Usuario ou senha invalidos.");
    }

    await this.dep.repos.usuarios.registrarLogin(usuario.id);
    return paraUsuarioDto(usuario);
  }
}
