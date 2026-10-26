import {
  ContratoRegistro,
  EquipamentoRegistro,
  LoteDetalhe,
  LoteRegistro,
  MovimentacaoRegistro,
  OrganizacaoDetalhe,
  OrganizacaoRegistro,
  ParametroRegistro,
  UsuarioRegistro,
} from "../repositorios/portas";
import { dataISO, nomeEstadoFisico } from "./util";

export function paraUsuarioDto(u: UsuarioRegistro) {
  return {
    id: u.id,
    username: u.username,
    papel: u.papel,
    ativo: u.ativo,
    ultimoLoginEm: u.ultimoLoginEm ? u.ultimoLoginEm.toISOString() : null,
    criadoEm: u.criadoEm.toISOString(),
    versao: u.versao,
  };
}
export type UsuarioDto = ReturnType<typeof paraUsuarioDto>;

export function paraOrganizacaoDto(o: OrganizacaoRegistro) {
  return {
    id: o.id,
    cnpj: o.cnpj,
    razaoSocial: o.razaoSocial,
    nomeFantasia: o.nomeFantasia,
    tipo: o.tipo,
    contatoResponsavel: o.contatoResponsavel,
    emailContato: o.emailContato,
    diasPrazoArmazenamento: o.diasPrazoArmazenamento,
    ativo: o.ativo,
    criadoEm: o.criadoEm.toISOString(),
    atualizadoEm: o.atualizadoEm.toISOString(),
    versao: o.versao,
  };
}
export type OrganizacaoDto = ReturnType<typeof paraOrganizacaoDto>;

export function paraContratoDto(c: ContratoRegistro) {
  return {
    id: c.id,
    organizacaoId: c.organizacaoId,
    numero: c.numero,
    dataInicio: dataISO(c.dataInicio),
    dataFim: dataISO(c.dataFim),
    clausulas: c.clausulas,
    criadoEm: c.criadoEm.toISOString(),
    atualizadoEm: c.atualizadoEm.toISOString(),
    versao: c.versao,
  };
}
export type ContratoDto = ReturnType<typeof paraContratoDto>;

export function paraOrganizacaoDetalheDto(o: OrganizacaoDetalhe) {
  return {
    ...paraOrganizacaoDto(o),
    contrato: o.contrato ? paraContratoDto(o.contrato) : null,
    lotes: o.lotes.map((l) => ({
      id: l.id,
      dataEntrada: dataISO(l.dataEntrada),
      notaFiscal: l.notaFiscal,
      transportadora: l.transportadora,
      status: l.status,
    })),
  };
}

export function paraEquipamentoDto(e: EquipamentoRegistro) {
  return {
    id: e.id,
    loteId: e.loteId,
    tipo: e.tipo,
    numeroSerie: e.numeroSerie,
    fabricante: e.fabricante,
    modelo: e.modelo,
    codigoBarrasInterno: e.codigoBarrasInterno,
    estadoFisico: nomeEstadoFisico(e.estadoFisico),
    status: e.status,
    criadoEm: e.criadoEm.toISOString(),
    atualizadoEm: e.atualizadoEm.toISOString(),
    versao: e.versao,
  };
}
export type EquipamentoDto = ReturnType<typeof paraEquipamentoDto>;

export function paraLoteDto(l: LoteRegistro) {
  return {
    id: l.id,
    organizacaoId: l.organizacaoId,
    dataEntrada: dataISO(l.dataEntrada),
    notaFiscal: l.notaFiscal,
    transportadora: l.transportadora,
    status: l.status,
    quantidadeEquipamentos: l.quantidadeEquipamentos,
    criadoEm: l.criadoEm.toISOString(),
    atualizadoEm: l.atualizadoEm.toISOString(),
    versao: l.versao,
  };
}
export type LoteDto = ReturnType<typeof paraLoteDto>;

export function paraLoteDetalheDto(l: LoteDetalhe) {
  return { ...paraLoteDto(l), equipamentos: l.equipamentos.map(paraEquipamentoDto) };
}

export function paraMovimentacaoDto(m: MovimentacaoRegistro) {
  return {
    id: m.id,
    tipo: m.tipo,
    estadoFisicoAnterior: m.estadoFisicoAnterior === null ? null : nomeEstadoFisico(m.estadoFisicoAnterior),
    estadoFisicoNovo: m.estadoFisicoNovo === null ? null : nomeEstadoFisico(m.estadoFisicoNovo),
    statusAnterior: m.statusAnterior,
    statusNovo: m.statusNovo,
    justificativa: m.justificativa,
    observacao: m.observacao,
    usuario: m.usuarioUsername,
    criadoEm: m.criadoEm.toISOString(),
  };
}

export function paraParametroDto(p: ParametroRegistro) {
  return {
    aliquotaImpostoPercentual: p.aliquotaImpostoPercentual,
    coeficienteDepreciacaoAnual: p.coeficienteDepreciacaoAnual,
    limiteDiasRetroativosLote: p.limiteDiasRetroativosLote,
    atualizadoEm: p.atualizadoEm.toISOString(),
    versao: p.versao,
  };
}
export type ParametroDto = ReturnType<typeof paraParametroDto>;
