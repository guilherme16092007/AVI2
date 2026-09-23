import { EquipamentoRepository } from "../repositories/EquipamentoRepository";
import { LoteRepository } from "../repositories/LoteRepository";
import { MovimentacaoRepository } from "../repositories/MovimentacaoRepository";
import { EquipamentoFactory } from "../factories/EquipamentoFactory";
import {
  TransicaoStatusValidator,
  MudancaEstadoFisicoValidator,
} from "../validation/EquipamentoValidator";
import { Equipamento, EquipamentoProps } from "../domain/Equipamento";
import { Movimentacao } from "../domain/Movimentacao";
import {
  TipoEquipamento,
  EstadoFisico,
  StatusEquipamento,
  TipoMovimentacao,
  ErroDominio,
} from "../types";

export class EquipamentoService {
  private readonly transicaoValidator = new TransicaoStatusValidator();
  private readonly estadoValidator = new MudancaEstadoFisicoValidator();

  constructor(
    private readonly equipamentoRepo: EquipamentoRepository,
    private readonly loteRepo: LoteRepository,
    private readonly movimentacaoRepo: MovimentacaoRepository
  ) {}

  cadastrar(
    tipo: TipoEquipamento,
    props: EquipamentoProps,
    usuarioId: string
  ): Equipamento {
    const lote = this.loteRepo.buscarPorId(props.loteId);
    if (!lote) throw new ErroDominio(`Lote '${props.loteId}' nao encontrado.`);

    if (this.equipamentoRepo.existeComCodigoBarras(props.codigoBarrasInterno)) {
      throw new ErroDominio(`Ja existe um equipamento com o codigo de barras '${props.codigoBarrasInterno}'.`);
    }

    const equipamento = EquipamentoFactory.criar(tipo, props);
    this.equipamentoRepo.inserir(equipamento, usuarioId);

    this.registrarMovimentacao(
      equipamento.id,
      usuarioId,
      TipoMovimentacao.CADASTRO,
      { statusNovo: equipamento.status, estadoFisicoNovo: equipamento.estadoFisico }
    );

    return equipamento;
  }

  /** Executa a triagem: equipamento sai de AGUARDANDO_TRIAGEM e passa a TRIADO, com estado fisico avaliado. */
  realizarTriagem(equipamentoId: string, estadoFisicoAvaliado: EstadoFisico, usuarioId: string): Equipamento {
    const atual = this.buscarOuFalhar(equipamentoId);

    this.transicaoValidator.validarOuLancar({
      statusAtual: atual.status,
      statusDesejado: StatusEquipamento.TRIADO,
    });

    const estadoAnterior = atual.estadoFisico;
    const statusAnterior = atual.status;

    const atualizado = this.equipamentoRepo.atualizar(
      equipamentoId,
      (e) => {
        e.status = StatusEquipamento.TRIADO;
        e.estadoFisico = estadoFisicoAvaliado;
      },
      usuarioId,
      "TRIAGEM"
    );

    this.registrarMovimentacao(equipamentoId, usuarioId, TipoMovimentacao.TRIAGEM, {
      statusAnterior,
      statusNovo: StatusEquipamento.TRIADO,
      estadoFisicoAnterior: estadoAnterior,
      estadoFisicoNovo: estadoFisicoAvaliado,
    });

    return atualizado;
  }

  /** Altera o estado fisico do equipamento, exigindo justificativa se a queda for de 2+ categorias. */
  atualizarEstadoFisico(
    equipamentoId: string,
    novoEstado: EstadoFisico,
    usuarioId: string,
    justificativa?: string
  ): Equipamento {
    const atual = this.buscarOuFalhar(equipamentoId);

    this.estadoValidator.validarOuLancar({
      estadoAtual: atual.estadoFisico,
      estadoDesejado: novoEstado,
      justificativa,
    });

    const estadoAnterior = atual.estadoFisico;

    const atualizado = this.equipamentoRepo.atualizar(
      equipamentoId,
      (e) => {
        e.estadoFisico = novoEstado;
      },
      usuarioId,
      "MUDANCA_ESTADO_FISICO"
    );

    this.registrarMovimentacao(equipamentoId, usuarioId, TipoMovimentacao.MUDANCA_ESTADO, {
      estadoFisicoAnterior: estadoAnterior,
      estadoFisicoNovo: novoEstado,
      justificativa,
    });

    return atualizado;
  }

  /** Altera o status operacional do equipamento (ex.: enviar para desmonte), respeitando a maquina de estados. */
  atualizarStatus(
    equipamentoId: string,
    novoStatus: StatusEquipamento,
    usuarioId: string,
    observacao?: string
  ): Equipamento {
    const atual = this.buscarOuFalhar(equipamentoId);

    this.transicaoValidator.validarOuLancar({
      statusAtual: atual.status,
      statusDesejado: novoStatus,
    });

    const statusAnterior = atual.status;

    const atualizado = this.equipamentoRepo.atualizar(
      equipamentoId,
      (e) => {
        e.status = novoStatus;
      },
      usuarioId,
      "MUDANCA_STATUS"
    );

    const tipoEvento =
      novoStatus === StatusEquipamento.EM_DESMONTE ? TipoMovimentacao.DESMONTE : TipoMovimentacao.MUDANCA_STATUS;

    this.registrarMovimentacao(equipamentoId, usuarioId, tipoEvento, {
      statusAnterior,
      statusNovo: novoStatus,
      observacao,
    });

    return atualizado;
  }

  listarPorLote(loteId: string): Equipamento[] {
    return this.equipamentoRepo.listarPorLote(loteId);
  }

  listarTodos(): Equipamento[] {
    return this.equipamentoRepo.listarTodos();
  }

  buscarPorId(id: string): Equipamento | null {
    return this.equipamentoRepo.buscarPorId(id);
  }

  /** Retorna o historico completo (rastreio) de movimentacoes de um equipamento, em ordem cronologica. */
  rastrear(equipamentoId: string): { equipamento: Equipamento; historico: Movimentacao[] } {
    const equipamento = this.buscarOuFalhar(equipamentoId);
    const historico = this.movimentacaoRepo.listarPorEquipamento(equipamentoId);
    return { equipamento, historico };
  }

  private buscarOuFalhar(equipamentoId: string): Equipamento {
    const equipamento = this.equipamentoRepo.buscarPorId(equipamentoId);
    if (!equipamento) throw new ErroDominio(`Equipamento '${equipamentoId}' nao encontrado.`);
    return equipamento;
  }

  private registrarMovimentacao(
    equipamentoId: string,
    usuarioId: string,
    tipo: TipoMovimentacao,
    dados: Partial<
      Pick<
        Movimentacao,
        "estadoFisicoAnterior" | "estadoFisicoNovo" | "statusAnterior" | "statusNovo" | "justificativa" | "observacao"
      >
    >
  ): void {
    const movimentacao = new Movimentacao({
      equipamentoId,
      usuarioId,
      tipo,
      ...dados,
    });
    this.movimentacaoRepo.inserir(movimentacao, usuarioId);
  }
}
