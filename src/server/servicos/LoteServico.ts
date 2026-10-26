import { EstadoFisico, ErroValidacao, StatusEquipamento, TipoEquipamento, TipoMovimentacao } from "../../types";
import { LoteValidator } from "../../validation/LoteValidator";
import { ErroConflito } from "../erros";
import { Dependencias, NovoEquipamento, Pagina, Paginacao, Repositorios } from "../repositorios/portas";
import {
  EquipamentoDto,
  LoteDto,
  paraEquipamentoDto,
  paraLoteDetalheDto,
  paraLoteDto,
} from "./dto";
import { Ator, exigirPapel, PERMISSOES } from "./politicas";
import { exigirEncontrado, hojeLocalISO, mapearPagina, novoId, paraData } from "./util";

export interface EquipamentoEntrada {
  tipo: TipoEquipamento;
  numeroSerie: string;
  codigoBarrasInterno: string;
  fabricante?: string;
  modelo?: string;
}

export interface CriarLoteEntrada {
  organizacaoId: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada?: string;
  equipamentos?: EquipamentoEntrada[];
}

async function registrarEquipamentos(
  repos: Repositorios,
  loteId: string,
  itens: EquipamentoEntrada[],
  ator: Ator
): Promise<NovoEquipamento[]> {
  const codigos = itens.map((i) => i.codigoBarrasInterno.trim());

  for (const item of itens) {
    if (item.numeroSerie.trim().length === 0) throw new ErroValidacao("numeroSerie e obrigatorio.", ["numeroSerie"]);
  }
  if (codigos.some((c) => c.length === 0)) {
    throw new ErroValidacao("codigoBarrasInterno e obrigatorio.", ["codigoBarrasInterno"]);
  }
  const repetidos = Array.from(new Set(codigos.filter((c, i) => codigos.indexOf(c) !== i)));
  if (repetidos.length > 0) {
    throw new ErroValidacao(`Codigos de barras repetidos na requisicao: ${repetidos.join(", ")}.`, ["codigoBarrasInterno"]);
  }
  const jaExistentes = await repos.equipamentos.codigosExistentes(codigos);
  if (jaExistentes.length > 0) {
    throw new ErroConflito(`Codigo(s) de barras ja cadastrado(s): ${jaExistentes.join(", ")}.`, jaExistentes);
  }

  const novos: NovoEquipamento[] = itens.map((item, i) => ({
    id: novoId(),
    loteId,
    tipo: item.tipo,
    numeroSerie: item.numeroSerie.trim(),
    fabricante: item.fabricante?.trim() || null,
    modelo: item.modelo?.trim() || null,
    codigoBarrasInterno: codigos[i],
    estadoFisico: EstadoFisico.BOM,
    status: StatusEquipamento.AGUARDANDO_TRIAGEM,
  }));

  await repos.equipamentos.criarVarios(novos);
  await repos.movimentacoes.criarVarias(
    novos.map((n) => ({
      id: novoId(),
      equipamentoId: n.id,
      usuarioId: ator.id,
      tipo: TipoMovimentacao.CADASTRO,
      estadoFisicoAnterior: null,
      estadoFisicoNovo: n.estadoFisico,
      statusAnterior: null,
      statusNovo: n.status,
      justificativa: null,
      observacao: null,
    }))
  );
  return novos;
}

export class LoteServico {
  private readonly validator = new LoteValidator();

  constructor(private readonly dep: Dependencias) {}

  async criar(ator: Ator, entrada: CriarLoteEntrada): Promise<ReturnType<typeof paraLoteDetalheDto>> {
    exigirPapel(ator, PERMISSOES.loteCriar);

    const organizacao = await this.dep.repos.organizacoes.buscarPorId(entrada.organizacaoId);
    const parametros = await this.dep.repos.parametros.obter();
    const dataEntrada = entrada.dataEntrada ?? hojeLocalISO();

    this.validator.validarOuLancar({
      props: {
        organizacaoId: entrada.organizacaoId,
        dataEntrada,
        notaFiscal: entrada.notaFiscal.trim(),
        transportadora: entrada.transportadora.trim(),
      },
      organizacaoExiste: !!organizacao && organizacao.ativo,
      limiteDiasRetroativos: parametros.limiteDiasRetroativosLote,
    });
    const dataConvertida = paraData(dataEntrada, "dataEntrada");

    const itens = entrada.equipamentos ?? [];

    const detalhe = await this.dep.transacao.executar(async (repos) => {
      const lote = await repos.lotes.criar({
        id: novoId(),
        organizacaoId: entrada.organizacaoId,
        dataEntrada: dataConvertida,
        notaFiscal: entrada.notaFiscal.trim(),
        transportadora: entrada.transportadora.trim(),
      });
      if (itens.length > 0) {
        await registrarEquipamentos(repos, lote.id, itens, ator);
      }
      return exigirEncontrado(await repos.lotes.buscarDetalhe(lote.id), "Lote nao encontrado apos a criacao.");
    });

    return paraLoteDetalheDto(detalhe);
  }

  async adicionarEquipamento(ator: Ator, loteId: string, entrada: EquipamentoEntrada): Promise<EquipamentoDto> {
    exigirPapel(ator, PERMISSOES.equipamentoOperar);
    exigirEncontrado(await this.dep.repos.lotes.buscarPorId(loteId), "Lote nao encontrado.");

    const criado = await this.dep.transacao.executar(async (repos) => {
      const [novo] = await registrarEquipamentos(repos, loteId, [entrada], ator);
      return exigirEncontrado(await repos.equipamentos.buscarPorId(novo.id), "Equipamento nao encontrado apos o cadastro.");
    });
    return paraEquipamentoDto(criado);
  }

  async listar(filtro: { organizacaoId?: string }, paginacao: Paginacao): Promise<Pagina<LoteDto>> {
    return mapearPagina(await this.dep.repos.lotes.listar(filtro, paginacao), paraLoteDto);
  }

  async detalhar(id: string): Promise<ReturnType<typeof paraLoteDetalheDto>> {
    return paraLoteDetalheDto(exigirEncontrado(await this.dep.repos.lotes.buscarDetalhe(id), "Lote nao encontrado."));
  }
}
