import {
  EstadoFisico,
  Papel,
  StatusEquipamento,
  StatusLote,
  TipoEquipamento,
  TipoMovimentacao,
  TipoOrganizacao,
} from "../../types";

export interface Paginacao {
  limite: number;
  offset: number;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  limite: number;
  offset: number;
}

export interface UsuarioRegistro {
  id: string;
  username: string;
  papel: Papel;
  senhaHash: string;
  ativo: boolean;
  ultimoLoginEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
}

export interface NovoUsuario {
  id: string;
  username: string;
  papel: Papel;
  senhaHash: string;
}

export interface UsuarioRepositorio {
  buscarPorId(id: string): Promise<UsuarioRegistro | null>;
  buscarPorUsername(username: string): Promise<UsuarioRegistro | null>;
  listar(paginacao: Paginacao): Promise<Pagina<UsuarioRegistro>>;
  criar(dados: NovoUsuario): Promise<UsuarioRegistro>;
  registrarLogin(id: string): Promise<void>;
}

export interface OrganizacaoRegistro {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  tipo: TipoOrganizacao;
  contatoResponsavel: string;
  emailContato: string;
  diasPrazoArmazenamento: number;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
}

export interface NovaOrganizacao {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  tipo: TipoOrganizacao;
  contatoResponsavel: string;
  emailContato: string;
  diasPrazoArmazenamento: number;
}

export interface LoteResumo {
  id: string;
  dataEntrada: Date;
  notaFiscal: string;
  transportadora: string;
  status: StatusLote;
}

export interface OrganizacaoDetalhe extends OrganizacaoRegistro {
  contrato: ContratoRegistro | null;
  lotes: LoteResumo[];
}

export interface OrganizacaoRepositorio {
  buscarPorId(id: string): Promise<OrganizacaoRegistro | null>;
  buscarDetalhe(id: string): Promise<OrganizacaoDetalhe | null>;
  existeCnpj(cnpj: string): Promise<boolean>;
  listar(paginacao: Paginacao): Promise<Pagina<OrganizacaoRegistro>>;
  criar(dados: NovaOrganizacao): Promise<OrganizacaoRegistro>;
}

export interface ContratoRegistro {
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

export interface NovoContrato {
  id: string;
  organizacaoId: string;
  numero: string;
  dataInicio: Date;
  dataFim: Date;
  clausulas: unknown;
}

export interface AtualizacaoContrato {
  numero: string;
  dataInicio: Date;
  dataFim: Date;
  clausulas: unknown;
}

export interface ContratoRepositorio {
  buscarPorOrganizacao(organizacaoId: string): Promise<ContratoRegistro | null>;
  numeroEmUsoPorOutraOrganizacao(numero: string, organizacaoId: string): Promise<boolean>;
  criar(dados: NovoContrato): Promise<ContratoRegistro>;
  atualizarComVersao(id: string, versaoEsperada: number, dados: AtualizacaoContrato): Promise<ContratoRegistro>;
}

export interface LoteRegistro {
  id: string;
  organizacaoId: string;
  dataEntrada: Date;
  notaFiscal: string;
  transportadora: string;
  status: StatusLote;
  quantidadeEquipamentos: number;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
}

export interface NovoLote {
  id: string;
  organizacaoId: string;
  dataEntrada: Date;
  notaFiscal: string;
  transportadora: string;
}

export interface LoteDetalhe extends LoteRegistro {
  equipamentos: EquipamentoRegistro[];
}

export interface LoteRepositorio {
  buscarPorId(id: string): Promise<LoteRegistro | null>;
  buscarDetalhe(id: string): Promise<LoteDetalhe | null>;
  listar(filtro: { organizacaoId?: string }, paginacao: Paginacao): Promise<Pagina<LoteRegistro>>;
  criar(dados: NovoLote): Promise<LoteRegistro>;
}

export interface EquipamentoRegistro {
  id: string;
  loteId: string;
  tipo: TipoEquipamento;
  numeroSerie: string;
  fabricante: string | null;
  modelo: string | null;
  codigoBarrasInterno: string;
  estadoFisico: EstadoFisico;
  status: StatusEquipamento;
  criadoEm: Date;
  atualizadoEm: Date;
  versao: number;
}

export interface NovoEquipamento {
  id: string;
  loteId: string;
  tipo: TipoEquipamento;
  numeroSerie: string;
  fabricante: string | null;
  modelo: string | null;
  codigoBarrasInterno: string;
  estadoFisico: EstadoFisico;
  status: StatusEquipamento;
}

export interface FiltroEquipamento {
  loteId?: string;
  status?: StatusEquipamento;
}

export interface EquipamentoRepositorio {
  buscarPorId(id: string): Promise<EquipamentoRegistro | null>;
  listar(filtro: FiltroEquipamento, paginacao: Paginacao): Promise<Pagina<EquipamentoRegistro>>;
  listarTodos(filtro: FiltroEquipamento): Promise<EquipamentoRegistro[]>;
  codigosExistentes(codigos: string[]): Promise<string[]>;
  criarVarios(dados: NovoEquipamento[]): Promise<void>;
  atualizarComVersao(
    id: string,
    versaoEsperada: number,
    dados: { estadoFisico?: EstadoFisico; status?: StatusEquipamento }
  ): Promise<EquipamentoRegistro>;
}

export interface NovaMovimentacao {
  id: string;
  equipamentoId: string;
  usuarioId: string;
  tipo: TipoMovimentacao;
  estadoFisicoAnterior: EstadoFisico | null;
  estadoFisicoNovo: EstadoFisico | null;
  statusAnterior: StatusEquipamento | null;
  statusNovo: StatusEquipamento | null;
  justificativa: string | null;
  observacao: string | null;
}

export interface MovimentacaoRegistro extends NovaMovimentacao {
  usuarioUsername: string;
  criadoEm: Date;
  versao: number;
}

export interface MovimentacaoRepositorio {
  criarVarias(dados: NovaMovimentacao[]): Promise<void>;
  listarPorEquipamento(equipamentoId: string): Promise<MovimentacaoRegistro[]>;
}

export interface ParametroRegistro {
  aliquotaImpostoPercentual: number;
  coeficienteDepreciacaoAnual: number;
  limiteDiasRetroativosLote: number;
  atualizadoEm: Date;
  versao: number;
}

export interface ParametroRepositorio {
  obter(): Promise<ParametroRegistro>;
  atualizarComVersao(
    versaoEsperada: number,
    dados: Partial<Pick<ParametroRegistro, "aliquotaImpostoPercentual" | "coeficienteDepreciacaoAnual" | "limiteDiasRetroativosLote">>
  ): Promise<ParametroRegistro>;
}

export interface Repositorios {
  usuarios: UsuarioRepositorio;
  organizacoes: OrganizacaoRepositorio;
  contratos: ContratoRepositorio;
  lotes: LoteRepositorio;
  equipamentos: EquipamentoRepositorio;
  movimentacoes: MovimentacaoRepositorio;
  parametros: ParametroRepositorio;
}

export interface ExecutorTransacao {
  executar<T>(fn: (repositorios: Repositorios) => Promise<T>): Promise<T>;
}

export interface Dependencias {
  repos: Repositorios;
  transacao: ExecutorTransacao;
}
