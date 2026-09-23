import { LoteRepository } from "../repositories/LoteRepository";
import { OrganizacaoRepository } from "../repositories/OrganizacaoRepository";
import { LoteValidator } from "../validation/LoteValidator";
import { Lote, LoteProps } from "../domain/Lote";
import { StatusLote, ParametrosGlobais, ErroDominio } from "../types";

export class LoteService {
  private readonly validator = new LoteValidator();

  constructor(
    private readonly loteRepo: LoteRepository,
    private readonly organizacaoRepo: OrganizacaoRepository,
    private readonly parametros: ParametrosGlobais
  ) {}

  criar(props: LoteProps, usuarioId: string): Lote {
    const organizacao = this.organizacaoRepo.buscarPorId(props.organizacaoId);

    this.validator.validarOuLancar({
      props,
      organizacaoExiste: !!organizacao && organizacao.ativo,
      limiteDiasRetroativos: this.parametros.limiteDiasRetroativosLote,
    });

    const lote = new Lote(props);
    return this.loteRepo.inserir(lote, usuarioId);
  }

  listar(): Lote[] {
    return this.loteRepo.listarTodos();
  }

  listarPorOrganizacao(organizacaoId: string): Lote[] {
    return this.loteRepo.listarPorOrganizacao(organizacaoId);
  }

  buscarPorId(id: string): Lote | null {
    return this.loteRepo.buscarPorId(id);
  }

  /** Incrementa o contador de equipamentos do lote e atualiza seu status conforme a triagem avanca. */
  registrarEquipamentoAdicionado(loteId: string, usuarioId: string): void {
    this.loteRepo.atualizar(
      loteId,
      (lote) => {
        lote.quantidadeEquipamentos += 1;
      },
      usuarioId,
      "INCREMENTAR_EQUIPAMENTOS"
    );
  }

  atualizarStatus(loteId: string, novoStatus: StatusLote, usuarioId: string): Lote {
    const lote = this.loteRepo.buscarPorId(loteId);
    if (!lote) throw new ErroDominio(`Lote '${loteId}' nao encontrado.`);

    return this.loteRepo.atualizar(
      loteId,
      (l) => {
        l.status = novoStatus;
      },
      usuarioId,
      "ATUALIZAR_STATUS"
    );
  }
}
