import { StatusEquipamento, TipoMovimentacao } from "../../types";
import { MudancaEstadoFisicoValidator, TransicaoStatusValidator } from "../../validation/EquipamentoValidator";
import { ErroValidacao } from "../../types";
import { Dependencias, FiltroEquipamento, Pagina, Paginacao, Repositorios } from "../repositorios/portas";
import { EquipamentoDto, paraEquipamentoDto, paraMovimentacaoDto } from "./dto";
import { Ator, exigirPapel, PERMISSOES } from "./politicas";
import {
  conferirVersao,
  exigirEncontrado,
  interpretarEstadoFisico,
  mapearPagina,
  novoId,
} from "./util";

export interface TriagemEntrada {
  estadoFisico: string;
  versao?: number;
}
export interface AlterarEstadoEntrada {
  novoEstado: string;
  justificativa?: string;
  versao?: number;
}
export interface AlterarStatusEntrada {
  novoStatus: StatusEquipamento;
  observacao?: string;
  versao?: number;
}

const STATUS_ALTERAVEIS: StatusEquipamento[] = [
  StatusEquipamento.EM_DESMONTE,
  StatusEquipamento.RECICLADO,
  StatusEquipamento.DESCARTADO,
];

export class EquipamentoServico {
  private readonly transicao = new TransicaoStatusValidator();
  private readonly estadoValidator = new MudancaEstadoFisicoValidator();

  constructor(private readonly dep: Dependencias) {}

  async listar(filtro: FiltroEquipamento, paginacao: Paginacao): Promise<Pagina<EquipamentoDto>> {
    return mapearPagina(await this.dep.repos.equipamentos.listar(filtro, paginacao), paraEquipamentoDto);
  }

  async detalhar(id: string): Promise<EquipamentoDto> {
    return paraEquipamentoDto(exigirEncontrado(await this.dep.repos.equipamentos.buscarPorId(id), "Equipamento nao encontrado."));
  }

  async triagem(ator: Ator, id: string, entrada: TriagemEntrada): Promise<EquipamentoDto> {
    exigirPapel(ator, PERMISSOES.equipamentoOperar);
    const estadoAvaliado = interpretarEstadoFisico(entrada.estadoFisico);

    return this.dep.transacao.executar(async (repos) => {
      const atual = await this.buscar(repos, id);
      conferirVersao(atual.versao, entrada.versao, "Equipamento");
      this.transicao.validarOuLancar({ statusAtual: atual.status, statusDesejado: StatusEquipamento.TRIADO });

      const atualizado = await repos.equipamentos.atualizarComVersao(id, atual.versao, {
        status: StatusEquipamento.TRIADO,
        estadoFisico: estadoAvaliado,
      });
      await repos.movimentacoes.criarVarias([
        {
          id: novoId(),
          equipamentoId: id,
          usuarioId: ator.id,
          tipo: TipoMovimentacao.TRIAGEM,
          estadoFisicoAnterior: atual.estadoFisico,
          estadoFisicoNovo: estadoAvaliado,
          statusAnterior: atual.status,
          statusNovo: StatusEquipamento.TRIADO,
          justificativa: null,
          observacao: null,
        },
      ]);
      return paraEquipamentoDto(atualizado);
    });
  }

  async alterarEstadoFisico(ator: Ator, id: string, entrada: AlterarEstadoEntrada): Promise<EquipamentoDto> {
    exigirPapel(ator, PERMISSOES.equipamentoOperar);
    const novoEstado = interpretarEstadoFisico(entrada.novoEstado);
    const justificativa = entrada.justificativa?.trim() || undefined;

    return this.dep.transacao.executar(async (repos) => {
      const atual = await this.buscar(repos, id);
      conferirVersao(atual.versao, entrada.versao, "Equipamento");
      this.estadoValidator.validarOuLancar({
        estadoAtual: atual.estadoFisico,
        estadoDesejado: novoEstado,
        justificativa,
      });

      const atualizado = await repos.equipamentos.atualizarComVersao(id, atual.versao, { estadoFisico: novoEstado });
      await repos.movimentacoes.criarVarias([
        {
          id: novoId(),
          equipamentoId: id,
          usuarioId: ator.id,
          tipo: TipoMovimentacao.MUDANCA_ESTADO,
          estadoFisicoAnterior: atual.estadoFisico,
          estadoFisicoNovo: novoEstado,
          statusAnterior: null,
          statusNovo: null,
          justificativa: justificativa ?? null,
          observacao: null,
        },
      ]);
      return paraEquipamentoDto(atualizado);
    });
  }

  async alterarStatus(ator: Ator, id: string, entrada: AlterarStatusEntrada): Promise<EquipamentoDto> {
    exigirPapel(ator, PERMISSOES.equipamentoOperar);
    if (!STATUS_ALTERAVEIS.includes(entrada.novoStatus)) {
      throw new ErroValidacao(
        `Status '${entrada.novoStatus}' nao pode ser definido por esta operacao. ` +
          `Aceitos: ${STATUS_ALTERAVEIS.join(", ")} (para TRIADO use a operacao de triagem).`,
        ["novoStatus"]
      );
    }

    return this.dep.transacao.executar(async (repos) => {
      const atual = await this.buscar(repos, id);
      conferirVersao(atual.versao, entrada.versao, "Equipamento");
      this.transicao.validarOuLancar({ statusAtual: atual.status, statusDesejado: entrada.novoStatus });

      const atualizado = await repos.equipamentos.atualizarComVersao(id, atual.versao, { status: entrada.novoStatus });
      await repos.movimentacoes.criarVarias([
        {
          id: novoId(),
          equipamentoId: id,
          usuarioId: ator.id,
          tipo: entrada.novoStatus === StatusEquipamento.EM_DESMONTE ? TipoMovimentacao.DESMONTE : TipoMovimentacao.MUDANCA_STATUS,
          estadoFisicoAnterior: null,
          estadoFisicoNovo: null,
          statusAnterior: atual.status,
          statusNovo: entrada.novoStatus,
          justificativa: null,
          observacao: entrada.observacao?.trim() || null,
        },
      ]);
      return paraEquipamentoDto(atualizado);
    });
  }

  async rastrear(id: string) {
    const equipamento = exigirEncontrado(await this.dep.repos.equipamentos.buscarPorId(id), "Equipamento nao encontrado.");
    const historico = await this.dep.repos.movimentacoes.listarPorEquipamento(id);
    return { equipamento: paraEquipamentoDto(equipamento), historico: historico.map(paraMovimentacaoDto) };
  }

  private async buscar(repos: Repositorios, id: string) {
    return exigirEncontrado(await repos.equipamentos.buscarPorId(id), "Equipamento nao encontrado.");
  }
}
