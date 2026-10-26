import { ErroValidacao, TipoOrganizacao } from "../../types";
import { OrganizacaoProps } from "../../domain/Organizacao";
import { OrganizacaoValidator } from "../../validation/OrganizacaoValidator";
import { CnpjUtils } from "../../validation/CnpjValidator";
import { ErroConflito } from "../erros";
import { Dependencias, Pagina, Paginacao } from "../repositorios/portas";
import {
  ContratoDto,
  OrganizacaoDto,
  paraContratoDto,
  paraOrganizacaoDetalheDto,
  paraOrganizacaoDto,
} from "./dto";
import { Ator, exigirPapel, PERMISSOES } from "./politicas";
import { conferirVersao, exigirEncontrado, mapearPagina, novoId, paraData } from "./util";

export interface CriarOrganizacaoEntrada {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  tipo: TipoOrganizacao;
  contatoResponsavel: string;
  emailContato: string;
  diasPrazoArmazenamento?: number;
}

export interface DefinirContratoEntrada {
  numero: string;
  dataInicio: string;
  dataFim: string;
  clausulas?: Record<string, unknown>;
  versao?: number;
}

export class OrganizacaoServico {
  private readonly validator = new OrganizacaoValidator();

  constructor(private readonly dep: Dependencias) {}

  async criar(ator: Ator, entrada: CriarOrganizacaoEntrada): Promise<OrganizacaoDto> {
    exigirPapel(ator, PERMISSOES.organizacaoCriar);

    const cnpj = CnpjUtils.normalizar(entrada.cnpj);
    const props: OrganizacaoProps = {
      cnpj,
      razaoSocial: entrada.razaoSocial.trim(),
      nomeFantasia: entrada.nomeFantasia?.trim() || undefined,
      tipo: entrada.tipo,
      contatoResponsavel: entrada.contatoResponsavel.trim(),
      emailContato: entrada.emailContato.trim(),
      diasPrazoArmazenamento: entrada.diasPrazoArmazenamento ?? 30,
    };

    this.validator.validarOuLancar({ props, cnpjJaCadastrado: false });
    if (await this.dep.repos.organizacoes.existeCnpj(cnpj)) {
      throw new ErroConflito("Ja existe uma organizacao cadastrada com este CNPJ.");
    }

    const criada = await this.dep.repos.organizacoes.criar({
      id: novoId(),
      cnpj,
      razaoSocial: props.razaoSocial,
      nomeFantasia: props.nomeFantasia ?? null,
      tipo: props.tipo,
      contatoResponsavel: props.contatoResponsavel,
      emailContato: props.emailContato,
      diasPrazoArmazenamento: props.diasPrazoArmazenamento,
    });
    return paraOrganizacaoDto(criada);
  }

  async listar(paginacao: Paginacao): Promise<Pagina<OrganizacaoDto>> {
    return mapearPagina(await this.dep.repos.organizacoes.listar(paginacao), paraOrganizacaoDto);
  }

  async detalhar(id: string) {
    const detalhe = exigirEncontrado(await this.dep.repos.organizacoes.buscarDetalhe(id), "Organizacao nao encontrada.");
    return paraOrganizacaoDetalheDto(detalhe);
  }

  async obterContrato(organizacaoId: string): Promise<ContratoDto> {
    exigirEncontrado(await this.dep.repos.organizacoes.buscarPorId(organizacaoId), "Organizacao nao encontrada.");
    const contrato = exigirEncontrado(
      await this.dep.repos.contratos.buscarPorOrganizacao(organizacaoId),
      "A organizacao nao possui contrato."
    );
    return paraContratoDto(contrato);
  }

  async definirContrato(
    ator: Ator,
    organizacaoId: string,
    entrada: DefinirContratoEntrada
  ): Promise<{ criado: boolean; contrato: ContratoDto }> {
    exigirPapel(ator, PERMISSOES.contratoGerenciar);
    exigirEncontrado(await this.dep.repos.organizacoes.buscarPorId(organizacaoId), "Organizacao nao encontrada.");

    const numero = entrada.numero.trim();
    if (numero.length === 0) throw new ErroValidacao("Numero do contrato e obrigatorio.", ["numero"]);
    const dataInicio = paraData(entrada.dataInicio, "dataInicio");
    const dataFim = paraData(entrada.dataFim, "dataFim");
    if (dataFim.getTime() <= dataInicio.getTime()) {
      throw new ErroValidacao("A data de fim do contrato deve ser posterior a data de inicio.", ["dataFim"]);
    }
    if (await this.dep.repos.contratos.numeroEmUsoPorOutraOrganizacao(numero, organizacaoId)) {
      throw new ErroConflito(`O numero de contrato '${numero}' ja esta em uso por outra organizacao.`);
    }

    const clausulas = entrada.clausulas ?? {};
    const existente = await this.dep.repos.contratos.buscarPorOrganizacao(organizacaoId);

    if (!existente) {
      const criado = await this.dep.repos.contratos.criar({
        id: novoId(),
        organizacaoId,
        numero,
        dataInicio,
        dataFim,
        clausulas,
      });
      return { criado: true, contrato: paraContratoDto(criado) };
    }

    conferirVersao(existente.versao, entrada.versao, "Contrato");
    const atualizado = await this.dep.repos.contratos.atualizarComVersao(existente.id, existente.versao, {
      numero,
      dataInicio,
      dataFim,
      clausulas,
    });
    return { criado: false, contrato: paraContratoDto(atualizado) };
  }
}
