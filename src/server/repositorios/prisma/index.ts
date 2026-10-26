import type { Prisma, PrismaClient } from "@prisma/client";
import { EstadoFisico, Papel, StatusEquipamento, StatusLote, TipoEquipamento, TipoMovimentacao, TipoOrganizacao } from "../../../types";
import { ErroConflito } from "../../erros";
import {
  AtualizacaoContrato,
  ContratoRegistro,
  ContratoRepositorio,
  EquipamentoRegistro,
  EquipamentoRepositorio,
  ExecutorTransacao,
  FiltroEquipamento,
  LoteDetalhe,
  LoteRegistro,
  LoteRepositorio,
  LoteResumo,
  MovimentacaoRegistro,
  MovimentacaoRepositorio,
  NovaMovimentacao,
  NovaOrganizacao,
  NovoContrato,
  NovoEquipamento,
  NovoLote,
  NovoUsuario,
  OrganizacaoDetalhe,
  OrganizacaoRegistro,
  OrganizacaoRepositorio,
  Pagina,
  Paginacao,
  ParametroRegistro,
  ParametroRepositorio,
  Repositorios,
  UsuarioRegistro,
  UsuarioRepositorio,
} from "../portas";

type Db = Prisma.TransactionClient;

function emBanco(valor: string): any {
  return valor;
}

function emDominio<E extends string>(valor: string): E {
  return valor as E;
}

interface LinhaUsuario {
  id: string;
  username: string;
  papel: string;
  senhaHash: string;
  ativo: boolean;
  ultimoLoginEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
}
const paraUsuario = (l: LinhaUsuario): UsuarioRegistro => ({ ...l, papel: emDominio<Papel>(l.papel) });

interface LinhaOrganizacao {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  tipo: string;
  contatoResponsavel: string;
  emailContato: string;
  diasPrazoArmazenamento: number;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
}
const paraOrganizacao = (l: LinhaOrganizacao): OrganizacaoRegistro => ({ ...l, tipo: emDominio<TipoOrganizacao>(l.tipo) });

interface LinhaContrato {
  id: string;
  organizacaoId: string;
  numero: string;
  dataInicio: Date;
  dataFim: Date;
  clausulas: unknown;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
}
const paraContrato = (l: LinhaContrato): ContratoRegistro => ({ ...l });

interface LinhaLote {
  id: string;
  organizacaoId: string;
  dataEntrada: Date;
  notaFiscal: string;
  transportadora: string;
  status: string;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
  _count: { equipamentos: number };
}
const paraLote = (l: LinhaLote): LoteRegistro => ({
  id: l.id,
  organizacaoId: l.organizacaoId,
  dataEntrada: l.dataEntrada,
  notaFiscal: l.notaFiscal,
  transportadora: l.transportadora,
  status: emDominio<StatusLote>(l.status),
  quantidadeEquipamentos: l._count.equipamentos,
  criadoEm: l.criadoEm,
  atualizadoEm: l.atualizadoEm,
  versao: l.versao,
});

interface LinhaEquipamento {
  id: string;
  loteId: string;
  tipo: string;
  numeroSerie: string;
  fabricante: string | null;
  modelo: string | null;
  codigoBarrasInterno: string;
  estadoFisico: number;
  status: string;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
}
const paraEquipamento = (l: LinhaEquipamento): EquipamentoRegistro => ({
  ...l,
  tipo: emDominio<TipoEquipamento>(l.tipo),
  estadoFisico: l.estadoFisico as EstadoFisico,
  status: emDominio<StatusEquipamento>(l.status),
});

interface LinhaLoteResumo {
  id: string;
  dataEntrada: Date;
  notaFiscal: string;
  transportadora: string;
  status: string;
}

interface LinhaMovimentacao {
  id: string;
  equipamentoId: string;
  usuarioId: string;
  tipo: string;
  estadoFisicoAnterior: number | null;
  estadoFisicoNovo: number | null;
  statusAnterior: string | null;
  statusNovo: string | null;
  justificativa: string | null;
  observacao: string | null;
  criadoEm: Date;
  versao: number;
  usuario: { username: string };
}
const paraMovimentacao = (l: LinhaMovimentacao): MovimentacaoRegistro => ({
  id: l.id,
  equipamentoId: l.equipamentoId,
  usuarioId: l.usuarioId,
  tipo: emDominio<TipoMovimentacao>(l.tipo),
  estadoFisicoAnterior: l.estadoFisicoAnterior as EstadoFisico | null,
  estadoFisicoNovo: l.estadoFisicoNovo as EstadoFisico | null,
  statusAnterior: l.statusAnterior === null ? null : emDominio<StatusEquipamento>(l.statusAnterior),
  statusNovo: l.statusNovo === null ? null : emDominio<StatusEquipamento>(l.statusNovo),
  justificativa: l.justificativa,
  observacao: l.observacao,
  usuarioUsername: l.usuario.username,
  criadoEm: l.criadoEm,
  versao: l.versao,
});

interface LinhaParametro {
  aliquotaImpostoPercentual: number;
  coeficienteDepreciacaoAnual: number;
  limiteDiasRetroativosLote: number;
  atualizadoEm: Date;
  versao: number;
}
const paraParametro = (l: LinhaParametro): ParametroRegistro => ({
  aliquotaImpostoPercentual: l.aliquotaImpostoPercentual,
  coeficienteDepreciacaoAnual: l.coeficienteDepreciacaoAnual,
  limiteDiasRetroativosLote: l.limiteDiasRetroativosLote,
  atualizadoEm: l.atualizadoEm,
  versao: l.versao,
});

const conflitoDeVersao = (recurso: string): ErroConflito =>
  new ErroConflito(
    `${recurso} foi alterado por outra requisicao (versao desatualizada). Busque o recurso novamente e repita a operacao.`
  );

class UsuarioRepositorioPrisma implements UsuarioRepositorio {
  constructor(private readonly db: Db) {}

  async buscarPorId(id: string): Promise<UsuarioRegistro | null> {
    const linha = await this.db.usuario.findUnique({ where: { id } });
    return linha ? paraUsuario(linha) : null;
  }

  async buscarPorUsername(username: string): Promise<UsuarioRegistro | null> {
    const linha = await this.db.usuario.findUnique({ where: { username } });
    return linha ? paraUsuario(linha) : null;
  }

  async listar(p: Paginacao): Promise<Pagina<UsuarioRegistro>> {
    const [linhas, total] = await Promise.all([
      this.db.usuario.findMany({ skip: p.offset, take: p.limite, orderBy: [{ criadoEm: "asc" }, { id: "asc" }] }),
      this.db.usuario.count(),
    ]);
    return { itens: linhas.map(paraUsuario), total, limite: p.limite, offset: p.offset };
  }

  async criar(dados: NovoUsuario): Promise<UsuarioRegistro> {
    const linha = await this.db.usuario.create({
      data: { id: dados.id, username: dados.username, papel: emBanco(dados.papel), senhaHash: dados.senhaHash },
    });
    return paraUsuario(linha);
  }

  async registrarLogin(id: string): Promise<void> {
    await this.db.usuario.update({ where: { id }, data: { ultimoLoginEm: new Date(), versao: { increment: 1 } } });
  }
}

class OrganizacaoRepositorioPrisma implements OrganizacaoRepositorio {
  constructor(private readonly db: Db) {}

  async buscarPorId(id: string): Promise<OrganizacaoRegistro | null> {
    const linha = await this.db.organizacao.findUnique({ where: { id } });
    return linha ? paraOrganizacao(linha) : null;
  }

  async buscarDetalhe(id: string): Promise<OrganizacaoDetalhe | null> {
    const linha = await this.db.organizacao.findUnique({
      where: { id },
      include: {
        contrato: true,
        lotes: {
          select: { id: true, dataEntrada: true, notaFiscal: true, transportadora: true, status: true },
          orderBy: { dataEntrada: "desc" },
          take: 100,
        },
      },
    });
    if (!linha) return null;
    const lotes: LoteResumo[] = linha.lotes.map((l: LinhaLoteResumo) => ({
      id: l.id,
      dataEntrada: l.dataEntrada,
      notaFiscal: l.notaFiscal,
      transportadora: l.transportadora,
      status: emDominio<StatusLote>(l.status),
    }));
    return { ...paraOrganizacao(linha), contrato: linha.contrato ? paraContrato(linha.contrato) : null, lotes };
  }

  async existeCnpj(cnpj: string): Promise<boolean> {
    return (await this.db.organizacao.count({ where: { cnpj } })) > 0;
  }

  async listar(p: Paginacao): Promise<Pagina<OrganizacaoRegistro>> {
    const [linhas, total] = await Promise.all([
      this.db.organizacao.findMany({ skip: p.offset, take: p.limite, orderBy: [{ razaoSocial: "asc" }, { id: "asc" }] }),
      this.db.organizacao.count(),
    ]);
    return { itens: linhas.map(paraOrganizacao), total, limite: p.limite, offset: p.offset };
  }

  async criar(dados: NovaOrganizacao): Promise<OrganizacaoRegistro> {
    const linha = await this.db.organizacao.create({
      data: {
        id: dados.id,
        cnpj: dados.cnpj,
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia,
        tipo: emBanco(dados.tipo),
        contatoResponsavel: dados.contatoResponsavel,
        emailContato: dados.emailContato,
        diasPrazoArmazenamento: dados.diasPrazoArmazenamento,
      },
    });
    return paraOrganizacao(linha);
  }
}

class ContratoRepositorioPrisma implements ContratoRepositorio {
  constructor(private readonly db: Db) {}

  async buscarPorOrganizacao(organizacaoId: string): Promise<ContratoRegistro | null> {
    const linha = await this.db.contrato.findUnique({ where: { organizacaoId } });
    return linha ? paraContrato(linha) : null;
  }

  async numeroEmUsoPorOutraOrganizacao(numero: string, organizacaoId: string): Promise<boolean> {
    return (await this.db.contrato.count({ where: { numero, organizacaoId: { not: organizacaoId } } })) > 0;
  }

  async criar(dados: NovoContrato): Promise<ContratoRegistro> {
    const linha = await this.db.contrato.create({
      data: {
        id: dados.id,
        organizacaoId: dados.organizacaoId,
        numero: dados.numero,
        dataInicio: dados.dataInicio,
        dataFim: dados.dataFim,
        clausulas: dados.clausulas as Prisma.InputJsonValue,
      },
    });
    return paraContrato(linha);
  }

  async atualizarComVersao(id: string, versaoEsperada: number, dados: AtualizacaoContrato): Promise<ContratoRegistro> {
    const resultado = await this.db.contrato.updateMany({
      where: { id, versao: versaoEsperada },
      data: {
        numero: dados.numero,
        dataInicio: dados.dataInicio,
        dataFim: dados.dataFim,
        clausulas: dados.clausulas as Prisma.InputJsonValue,
        versao: { increment: 1 },
      },
    });
    if (resultado.count === 0) throw conflitoDeVersao("Contrato");
    const linha = await this.db.contrato.findUnique({ where: { id } });
    if (!linha) throw conflitoDeVersao("Contrato");
    return paraContrato(linha);
  }
}

class LoteRepositorioPrisma implements LoteRepositorio {
  constructor(private readonly db: Db) {}

  async buscarPorId(id: string): Promise<LoteRegistro | null> {
    const linha = await this.db.lote.findUnique({ where: { id }, include: { _count: { select: { equipamentos: true } } } });
    return linha ? paraLote(linha) : null;
  }

  async buscarDetalhe(id: string): Promise<LoteDetalhe | null> {
    const linha = await this.db.lote.findUnique({
      where: { id },
      include: {
        _count: { select: { equipamentos: true } },
        equipamentos: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }] },
      },
    });
    if (!linha) return null;
    return { ...paraLote(linha), equipamentos: linha.equipamentos.map(paraEquipamento) };
  }

  async listar(filtro: { organizacaoId?: string }, p: Paginacao): Promise<Pagina<LoteRegistro>> {
    const where: Prisma.LoteWhereInput = {};
    if (filtro.organizacaoId) where.organizacaoId = filtro.organizacaoId;
    const [linhas, total] = await Promise.all([
      this.db.lote.findMany({
        where,
        skip: p.offset,
        take: p.limite,
        orderBy: [{ dataEntrada: "desc" }, { id: "asc" }],
        include: { _count: { select: { equipamentos: true } } },
      }),
      this.db.lote.count({ where }),
    ]);
    return { itens: linhas.map(paraLote), total, limite: p.limite, offset: p.offset };
  }

  async criar(dados: NovoLote): Promise<LoteRegistro> {
    const linha = await this.db.lote.create({
      data: {
        id: dados.id,
        organizacaoId: dados.organizacaoId,
        dataEntrada: dados.dataEntrada,
        notaFiscal: dados.notaFiscal,
        transportadora: dados.transportadora,
      },
      include: { _count: { select: { equipamentos: true } } },
    });
    return paraLote(linha);
  }
}

class EquipamentoRepositorioPrisma implements EquipamentoRepositorio {
  constructor(private readonly db: Db) {}

  private filtro(f: FiltroEquipamento): Prisma.EquipamentoWhereInput {
    const where: Prisma.EquipamentoWhereInput = {};
    if (f.loteId) where.loteId = f.loteId;
    if (f.status) where.status = emBanco(f.status);
    return where;
  }

  async buscarPorId(id: string): Promise<EquipamentoRegistro | null> {
    const linha = await this.db.equipamento.findUnique({ where: { id } });
    return linha ? paraEquipamento(linha) : null;
  }

  async listar(f: FiltroEquipamento, p: Paginacao): Promise<Pagina<EquipamentoRegistro>> {
    const where = this.filtro(f);
    const [linhas, total] = await Promise.all([
      this.db.equipamento.findMany({ where, skip: p.offset, take: p.limite, orderBy: [{ criadoEm: "desc" }, { id: "asc" }] }),
      this.db.equipamento.count({ where }),
    ]);
    return { itens: linhas.map(paraEquipamento), total, limite: p.limite, offset: p.offset };
  }

  async listarTodos(f: FiltroEquipamento): Promise<EquipamentoRegistro[]> {
    const linhas = await this.db.equipamento.findMany({ where: this.filtro(f), orderBy: [{ criadoEm: "asc" }, { id: "asc" }] });
    return linhas.map(paraEquipamento);
  }

  async codigosExistentes(codigos: string[]): Promise<string[]> {
    const linhas = await this.db.equipamento.findMany({
      where: { codigoBarrasInterno: { in: codigos } },
      select: { codigoBarrasInterno: true },
    });
    return linhas.map((l) => l.codigoBarrasInterno);
  }

  async criarVarios(dados: NovoEquipamento[]): Promise<void> {
    await this.db.equipamento.createMany({
      data: dados.map((d) => ({
        id: d.id,
        loteId: d.loteId,
        tipo: emBanco(d.tipo),
        numeroSerie: d.numeroSerie,
        fabricante: d.fabricante,
        modelo: d.modelo,
        codigoBarrasInterno: d.codigoBarrasInterno,
        estadoFisico: d.estadoFisico,
        status: emBanco(d.status),
      })),
    });
  }

  async atualizarComVersao(
    id: string,
    versaoEsperada: number,
    dados: { estadoFisico?: EstadoFisico; status?: StatusEquipamento }
  ): Promise<EquipamentoRegistro> {
    const data: Prisma.EquipamentoUpdateManyMutationInput = { versao: { increment: 1 } };
    if (dados.estadoFisico !== undefined) data.estadoFisico = dados.estadoFisico;
    if (dados.status !== undefined) data.status = emBanco(dados.status);

    const resultado = await this.db.equipamento.updateMany({ where: { id, versao: versaoEsperada }, data });
    if (resultado.count === 0) throw conflitoDeVersao("Equipamento");
    const linha = await this.db.equipamento.findUnique({ where: { id } });
    if (!linha) throw conflitoDeVersao("Equipamento");
    return paraEquipamento(linha);
  }
}

class MovimentacaoRepositorioPrisma implements MovimentacaoRepositorio {
  constructor(private readonly db: Db) {}

  async criarVarias(dados: NovaMovimentacao[]): Promise<void> {
    await this.db.movimentacao.createMany({
      data: dados.map((d) => ({
        id: d.id,
        equipamentoId: d.equipamentoId,
        usuarioId: d.usuarioId,
        tipo: emBanco(d.tipo),
        estadoFisicoAnterior: d.estadoFisicoAnterior,
        estadoFisicoNovo: d.estadoFisicoNovo,
        statusAnterior: d.statusAnterior === null ? null : emBanco(d.statusAnterior),
        statusNovo: d.statusNovo === null ? null : emBanco(d.statusNovo),
        justificativa: d.justificativa,
        observacao: d.observacao,
      })),
    });
  }

  async listarPorEquipamento(equipamentoId: string): Promise<MovimentacaoRegistro[]> {
    const linhas = await this.db.movimentacao.findMany({
      where: { equipamentoId },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
      include: { usuario: { select: { username: true } } },
    });
    return linhas.map(paraMovimentacao);
  }
}

class ParametroRepositorioPrisma implements ParametroRepositorio {
  constructor(private readonly db: Db) {}

  async obter(): Promise<ParametroRegistro> {
    const linha = await this.db.parametro.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    return paraParametro(linha);
  }

  async atualizarComVersao(
    versaoEsperada: number,
    dados: Partial<Pick<ParametroRegistro, "aliquotaImpostoPercentual" | "coeficienteDepreciacaoAnual" | "limiteDiasRetroativosLote">>
  ): Promise<ParametroRegistro> {
    const resultado = await this.db.parametro.updateMany({
      where: { id: 1, versao: versaoEsperada },
      data: {
        aliquotaImpostoPercentual: dados.aliquotaImpostoPercentual,
        coeficienteDepreciacaoAnual: dados.coeficienteDepreciacaoAnual,
        limiteDiasRetroativosLote: dados.limiteDiasRetroativosLote,
        versao: { increment: 1 },
      },
    });
    if (resultado.count === 0) throw conflitoDeVersao("Parametros");
    return this.obter();
  }
}

export function criarRepositoriosPrisma(db: Db): Repositorios {
  return {
    usuarios: new UsuarioRepositorioPrisma(db),
    organizacoes: new OrganizacaoRepositorioPrisma(db),
    contratos: new ContratoRepositorioPrisma(db),
    lotes: new LoteRepositorioPrisma(db),
    equipamentos: new EquipamentoRepositorioPrisma(db),
    movimentacoes: new MovimentacaoRepositorioPrisma(db),
    parametros: new ParametroRepositorioPrisma(db),
  };
}

export class ExecutorTransacaoPrisma implements ExecutorTransacao {
  constructor(private readonly prisma: PrismaClient) {}

  executar<T>(fn: (repositorios: Repositorios) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => fn(criarRepositoriosPrisma(tx)), { maxWait: 5_000, timeout: 20_000 });
  }
}
