import { EstadoFisico, Papel, TipoEquipamento, TipoOrganizacao } from "../types";

const uuid = { type: "string", format: "uuid" };
const texto = (max = 200) => ({ type: "string", minLength: 1, maxLength: max });
const versao = { type: "integer", minimum: 1 };
const NOMES_ESTADO = Object.keys(EstadoFisico).filter((k) => Number.isNaN(Number(k)));
const STATUS_ALTERAVEIS = ["EM_DESMONTE", "RECICLADO", "DESCARTADO"];
const STATUS_EQUIPAMENTO = ["AGUARDANDO_TRIAGEM", "TRIADO", "EM_DESMONTE", "RECICLADO", "DESCARTADO"];

const paginacao = {
  limite: { type: "integer", minimum: 1, maximum: 200, default: 50 },
  offset: { type: "integer", minimum: 0, default: 0 },
};

export const paramsId = {
  type: "object",
  required: ["id"],
  properties: { id: uuid },
};

export const consultaPaginada = {
  type: "object",
  additionalProperties: false,
  properties: { ...paginacao },
};

export const consultaLotes = {
  type: "object",
  additionalProperties: false,
  properties: { ...paginacao, organizacaoId: uuid },
};

export const consultaEquipamentos = {
  type: "object",
  additionalProperties: false,
  properties: { ...paginacao, loteId: uuid, status: { type: "string", enum: STATUS_EQUIPAMENTO } },
};

export const consultaRelatorio = {
  type: "object",
  additionalProperties: false,
  properties: { loteId: uuid },
};

export const corpoLogin = {
  type: "object",
  required: ["username", "senha"],
  additionalProperties: false,
  properties: { username: texto(100), senha: texto(200) },
};

export const corpoCriarUsuario = {
  type: "object",
  required: ["username", "senha", "papel"],
  additionalProperties: false,
  properties: {
    username: texto(50),
    senha: { type: "string", minLength: 8, maxLength: 200 },
    papel: { type: "string", enum: Object.values(Papel) },
  },
};

export const corpoDefinirParametros = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    aliquotaImpostoPercentual: { type: "number", minimum: 0, maximum: 100 },
    coeficienteDepreciacaoAnual: { type: "number", minimum: 0, maximum: 100 },
    limiteDiasRetroativosLote: { type: "integer", minimum: 1, maximum: 3650 },
    versao,
  },
};

export const corpoCriarOrganizacao = {
  type: "object",
  required: ["cnpj", "razaoSocial", "tipo", "contatoResponsavel", "emailContato"],
  additionalProperties: false,
  properties: {
    cnpj: { type: "string", minLength: 14, maxLength: 18 },
    razaoSocial: texto(200),
    nomeFantasia: texto(200),
    tipo: { type: "string", enum: Object.values(TipoOrganizacao) },
    contatoResponsavel: texto(200),
    emailContato: texto(200),
    diasPrazoArmazenamento: { type: "integer", minimum: 0, maximum: 3650 },
  },
};

export const corpoDefinirContrato = {
  type: "object",
  required: ["numero", "dataInicio", "dataFim"],
  additionalProperties: false,
  properties: {
    numero: texto(100),
    dataInicio: { type: "string", format: "date" },
    dataFim: { type: "string", format: "date" },
    clausulas: { type: "object" },
    versao,
  },
};

const itemEquipamento = {
  type: "object",
  required: ["tipo", "numeroSerie", "codigoBarrasInterno"],
  additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: Object.values(TipoEquipamento) },
    numeroSerie: texto(100),
    codigoBarrasInterno: texto(100),
    fabricante: texto(100),
    modelo: texto(100),
  },
};

export const corpoCriarLote = {
  type: "object",
  required: ["organizacaoId", "notaFiscal", "transportadora"],
  additionalProperties: false,
  properties: {
    organizacaoId: uuid,
    notaFiscal: texto(100),
    transportadora: texto(100),
    dataEntrada: { type: "string", format: "date" },
    equipamentos: { type: "array", maxItems: 500, items: itemEquipamento },
  },
};

export const corpoAdicionarEquipamento = itemEquipamento;

export const corpoTriagem = {
  type: "object",
  required: ["estadoFisico"],
  additionalProperties: false,
  properties: { estadoFisico: { type: "string", enum: NOMES_ESTADO }, versao },
};

export const corpoAlterarEstadoFisico = {
  type: "object",
  required: ["novoEstado"],
  additionalProperties: false,
  properties: {
    novoEstado: { type: "string", enum: NOMES_ESTADO },
    justificativa: { type: "string", maxLength: 1000 },
    versao,
  },
};

export const corpoAlterarStatus = {
  type: "object",
  required: ["novoStatus"],
  additionalProperties: false,
  properties: {
    novoStatus: { type: "string", enum: STATUS_ALTERAVEIS },
    observacao: { type: "string", maxLength: 1000 },
    versao,
  },
};
