import { HashService } from "../../crypto/HashService";
import { Papel, ErroValidacao } from "../../types";
import { ErroConflito } from "../erros";
import { Dependencias, Pagina, Paginacao } from "../repositorios/portas";
import { paraUsuarioDto, UsuarioDto } from "./dto";
import { Ator, exigirPapel, PERMISSOES } from "./politicas";
import { mapearPagina, novoId } from "./util";

export interface CriarUsuarioEntrada {
  username: string;
  senha: string;
  papel: Papel;
}

const FORMATO_USERNAME = /^[a-z0-9._-]{3,50}$/;

export class UsuarioServico {
  constructor(private readonly dep: Dependencias) {}

  async criar(ator: Ator, entrada: CriarUsuarioEntrada): Promise<UsuarioDto> {
    exigirPapel(ator, PERMISSOES.usuarioCriar);

    const username = entrada.username.trim().toLowerCase();
    if (!FORMATO_USERNAME.test(username)) {
      throw new ErroValidacao("Username deve ter de 3 a 50 caracteres: letras minusculas, digitos, '.', '_' ou '-'.", ["username"]);
    }
    if (!entrada.senha || entrada.senha.length < 8) {
      throw new ErroValidacao("A senha deve ter no minimo 8 caracteres.", ["senha"]);
    }
    if (!Object.values(Papel).includes(entrada.papel)) {
      throw new ErroValidacao(`Papel invalido: '${entrada.papel}'.`, ["papel"]);
    }
    if (await this.dep.repos.usuarios.buscarPorUsername(username)) {
      throw new ErroConflito(`Ja existe um usuario com o username '${username}'.`);
    }

    const criado = await this.dep.repos.usuarios.criar({
      id: novoId(),
      username,
      papel: entrada.papel,
      senhaHash: HashService.gerarHash(entrada.senha),
    });
    return paraUsuarioDto(criado);
  }

  async listar(ator: Ator, paginacao: Paginacao): Promise<Pagina<UsuarioDto>> {
    exigirPapel(ator, PERMISSOES.usuarioListar);
    return mapearPagina(await this.dep.repos.usuarios.listar(paginacao), paraUsuarioDto);
  }
}
