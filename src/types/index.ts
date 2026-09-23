/**
 * Tipos, enums e interfaces centrais do dominio do greencode.
 *
 * Este arquivo concentra os "contratos" (interfaces) e enumeracoes usados
 * em todo o sistema, evitando dependencias circulares entre as camadas de
 * dominio, persistencia, validacao e CLI.
 */

/** Papeis funcionais suportados pelo sistema (RF: segregacao de responsabilidades). */
export enum Papel {
  ADMINISTRADOR = "ADMINISTRADOR",
  OPERADOR_CADASTRO = "OPERADOR_CADASTRO",
  GESTOR_ALMOXARIFADO = "GESTOR_ALMOXARIFADO",
  AUDITOR = "AUDITOR",
}

/**
 * Estado fisico de um equipamento, do melhor para o pior.
 * O valor numerico associado (ordinal) e usado para calcular quantas
 * "categorias" um equipamento caiu em uma alteracao de estado, o que
 * determina a obrigatoriedade de justificativa textual (RN: queda >= 2
 * categorias exige justificativa).
 */
export enum EstadoFisico {
  NOVO = 4,
  BOM = 3,
  REGULAR = 2,
  RUIM = 1,
  INSERVIVEL = 0,
}

/** Ordem de exibicao dos estados fisicos, do melhor para o pior. */
export const ORDEM_ESTADO_FISICO: EstadoFisico[] = [
  EstadoFisico.NOVO,
  EstadoFisico.BOM,
  EstadoFisico.REGULAR,
  EstadoFisico.RUIM,
  EstadoFisico.INSERVIVEL,
];

/** Ciclo de vida operacional de um lote de recebimento. */
export enum StatusLote {
  RECEBIDO = "RECEBIDO",
  EM_TRIAGEM = "EM_TRIAGEM",
  TRIADO = "TRIADO",
  ENCERRADO = "ENCERRADO",
}

/**
 * Ciclo de vida operacional de um equipamento dentro de um lote.
 * A transicao para EM_DESMONTE so e permitida a partir de TRIADO
 * (RN: triagem completa e pre-requisito do desmonte).
 */
export enum StatusEquipamento {
  AGUARDANDO_TRIAGEM = "AGUARDANDO_TRIAGEM",
  TRIADO = "TRIADO",
  EM_DESMONTE = "EM_DESMONTE",
  RECICLADO = "RECICLADO",
  DESCARTADO = "DESCARTADO",
}

/** Transicoes de status validas para um equipamento (maquina de estados finita). */
export const TRANSICOES_STATUS_EQUIPAMENTO: Record<StatusEquipamento, StatusEquipamento[]> = {
  [StatusEquipamento.AGUARDANDO_TRIAGEM]: [StatusEquipamento.TRIADO],
  [StatusEquipamento.TRIADO]: [StatusEquipamento.EM_DESMONTE, StatusEquipamento.RECICLADO],
  [StatusEquipamento.EM_DESMONTE]: [StatusEquipamento.RECICLADO, StatusEquipamento.DESCARTADO],
  [StatusEquipamento.RECICLADO]: [],
  [StatusEquipamento.DESCARTADO]: [],
};

/** Tipos de ativo suportados pela EquipamentoFactory (RF: fabrica de objetos compostos). */
export enum TipoEquipamento {
  DESKTOP = "DESKTOP",
  NOTEBOOK = "NOTEBOOK",
  SERVIDOR = "SERVIDOR",
  MONITOR = "MONITOR",
  PERIFERICO = "PERIFERICO",
  NOBREAK = "NOBREAK",
}

/** Tipo de organizacao geradora de residuos. */
export enum TipoOrganizacao {
  VAREJO = "VAREJO",
  HOSPITAL = "HOSPITAL",
  UNIVERSIDADE = "UNIVERSIDADE",
  BANCO = "BANCO",
  INDUSTRIA = "INDUSTRIA",
  OUTRO = "OUTRO",
}

/** Tipo de evento registrado em uma movimentacao (auditoria granular). */
export enum TipoMovimentacao {
  CADASTRO = "CADASTRO",
  TRIAGEM = "TRIAGEM",
  MUDANCA_ESTADO = "MUDANCA_ESTADO",
  MUDANCA_STATUS = "MUDANCA_STATUS",
  DESMONTE = "DESMONTE",
  FINALIZACAO = "FINALIZACAO",
}

/** Niveis de severidade usados no feedback da CLI (RF: mensagens categorizadas). */
export enum Severidade {
  SUCESSO = "SUCESSO",
  INFO = "INFO",
  AVISO = "AVISO",
  ERRO = "ERRO",
  CRITICO = "CRITICO",
}

/** Resultado padronizado retornado por comandos e servicos de negocio. */
export type ResultadoOperacao<T = unknown> = {
  ok: boolean;
  severidade: Severidade;
  mensagem: string;
  dados?: T;
};

/** Payload minimo de uma sessao autenticada ativa. */
export interface SessaoAtiva {
  token: string;
  usuarioId: string;
  username: string;
  papel: Papel;
  criadaEm: string; // ISO 8601
  ultimaAtividade: string; // ISO 8601
}

/** Parametros de configuracao global do sistema (RF: parametros globais). */
export interface ParametrosGlobais {
  aliquotaImpostoPercentual: number;
  coeficienteDepreciacaoAnual: number;
  limiteDiasRetroativosLote: number; // default 90
  retencaoJournalDias: number; // default 180, minimo exigido pelo enunciado
  tamanhoMaximoJournalBytes: number; // default 10MB
  timeoutSessaoMinutos: number; // default 30
}

export const PARAMETROS_PADRAO: ParametrosGlobais = {
  aliquotaImpostoPercentual: 0,
  coeficienteDepreciacaoAnual: 20,
  limiteDiasRetroativosLote: 90,
  retencaoJournalDias: 180,
  tamanhoMaximoJournalBytes: 10 * 1024 * 1024,
  timeoutSessaoMinutos: 30,
};

/** Erro de dominio/negocio, distinto de erros tecnicos inesperados. */
export class ErroDominio extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroDominio";
  }
}

/** Erro de autenticacao/autorizacao. */
export class ErroAutenticacao extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroAutenticacao";
  }
}

/** Erro de validacao de dados de entrada. */
export class ErroValidacao extends Error {
  public readonly campos: string[];
  constructor(message: string, campos: string[] = []) {
    super(message);
    this.name = "ErroValidacao";
    this.campos = campos;
  }
}
