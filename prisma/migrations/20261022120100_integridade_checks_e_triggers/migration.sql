ALTER TABLE "Usuario"      ADD CONSTRAINT "ck_usuario_versao"      CHECK ("versao" >= 1);
ALTER TABLE "Organizacao"  ADD CONSTRAINT "ck_organizacao_versao"  CHECK ("versao" >= 1);
ALTER TABLE "Contrato"     ADD CONSTRAINT "ck_contrato_versao"     CHECK ("versao" >= 1);
ALTER TABLE "Lote"         ADD CONSTRAINT "ck_lote_versao"         CHECK ("versao" >= 1);
ALTER TABLE "Equipamento"  ADD CONSTRAINT "ck_equipamento_versao"  CHECK ("versao" >= 1);
ALTER TABLE "Movimentacao" ADD CONSTRAINT "ck_movimentacao_versao" CHECK ("versao" >= 1);
ALTER TABLE "Parametro"    ADD CONSTRAINT "ck_parametro_versao"    CHECK ("versao" >= 1);

ALTER TABLE "Organizacao" ADD CONSTRAINT "ck_organizacao_cnpj_formato"
  CHECK ("cnpj" ~ '^[0-9]{14}$');
ALTER TABLE "Organizacao" ADD CONSTRAINT "ck_organizacao_prazo"
  CHECK ("diasPrazoArmazenamento" >= 0);
ALTER TABLE "Organizacao" ADD CONSTRAINT "ck_organizacao_email"
  CHECK ("emailContato" ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$');

ALTER TABLE "Contrato" ADD CONSTRAINT "ck_contrato_vigencia"
  CHECK ("dataFim" > "dataInicio");

ALTER TABLE "Equipamento" ADD CONSTRAINT "ck_equipamento_estado_fisico"
  CHECK ("estadoFisico" BETWEEN 0 AND 4);

ALTER TABLE "Movimentacao" ADD CONSTRAINT "ck_movimentacao_estados_validos"
  CHECK (
    ("estadoFisicoAnterior" IS NULL OR "estadoFisicoAnterior" BETWEEN 0 AND 4)
    AND ("estadoFisicoNovo" IS NULL OR "estadoFisicoNovo" BETWEEN 0 AND 4)
  );

ALTER TABLE "Movimentacao" ADD CONSTRAINT "ck_movimentacao_justificativa_queda"
  CHECK (
    "tipo" <> 'MUDANCA_ESTADO'
    OR "estadoFisicoAnterior" IS NULL
    OR "estadoFisicoNovo" IS NULL
    OR ("estadoFisicoAnterior" - "estadoFisicoNovo") < 2
    OR char_length(btrim(coalesce("justificativa", ''))) >= 10
  );

ALTER TABLE "Movimentacao" ADD CONSTRAINT "ck_movimentacao_desmonte_apos_triagem"
  CHECK ("statusNovo" IS DISTINCT FROM 'EM_DESMONTE' OR "statusAnterior" = 'TRIADO');

ALTER TABLE "Movimentacao" ADD CONSTRAINT "ck_movimentacao_triagem_status"
  CHECK ("tipo" <> 'TRIAGEM' OR "statusNovo" = 'TRIADO');

ALTER TABLE "Parametro" ADD CONSTRAINT "ck_parametro_linha_unica" CHECK ("id" = 1);
ALTER TABLE "Parametro" ADD CONSTRAINT "ck_parametro_aliquota"
  CHECK ("aliquotaImpostoPercentual" BETWEEN 0 AND 100);
ALTER TABLE "Parametro" ADD CONSTRAINT "ck_parametro_depreciacao"
  CHECK ("coeficienteDepreciacaoAnual" BETWEEN 0 AND 100);
ALTER TABLE "Parametro" ADD CONSTRAINT "ck_parametro_limite_dias"
  CHECK ("limiteDiasRetroativosLote" BETWEEN 1 AND 3650);

CREATE FUNCTION "fn_movimentacao_imutavel"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Movimentacao e imutavel (append-only): a operacao % nao e permitida.', TG_OP;
END;
$$;

CREATE TRIGGER "trg_movimentacao_imutavel"
BEFORE UPDATE OR DELETE ON "Movimentacao"
FOR EACH ROW EXECUTE FUNCTION "fn_movimentacao_imutavel"();
