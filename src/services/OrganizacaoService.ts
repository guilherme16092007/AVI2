import { OrganizacaoRepository } from "../repositories/OrganizacaoRepository";
import { OrganizacaoValidator } from "../validation/OrganizacaoValidator";
import { CnpjUtils } from "../validation/CnpjValidator";
import { Organizacao, OrganizacaoProps } from "../domain/Organizacao";

export class OrganizacaoService {
  private readonly validator = new OrganizacaoValidator();

  constructor(private readonly repo: OrganizacaoRepository) {}

  cadastrar(props: OrganizacaoProps, usuarioId: string): Organizacao {
    const cnpjNormalizado = CnpjUtils.normalizar(props.cnpj);
    this.validator.validarOuLancar({
      props: { ...props, cnpj: cnpjNormalizado },
      cnpjJaCadastrado: this.repo.existeComCnpj(cnpjNormalizado),
    });

    const organizacao = new Organizacao({ ...props, cnpj: cnpjNormalizado });
    return this.repo.inserir(organizacao, usuarioId);
  }

  listar(): Organizacao[] {
    return this.repo.listarTodos();
  }

  buscarPorId(id: string): Organizacao | null {
    return this.repo.buscarPorId(id);
  }
}
