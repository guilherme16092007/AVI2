CREATE TYPE "Papel" AS ENUM ('ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR');

CREATE TYPE "TipoOrganizacao" AS ENUM ('VAREJO', 'HOSPITAL', 'UNIVERSIDADE', 'BANCO', 'INDUSTRIA', 'OUTRO');

CREATE TYPE "StatusLote" AS ENUM ('RECEBIDO', 'EM_TRIAGEM', 'TRIADO', 'ENCERRADO');

CREATE TYPE "TipoEquipamento" AS ENUM ('DESKTOP', 'NOTEBOOK', 'SERVIDOR', 'MONITOR', 'PERIFERICO', 'NOBREAK');

CREATE TYPE "StatusEquipamento" AS ENUM ('AGUARDANDO_TRIAGEM', 'TRIADO', 'EM_DESMONTE', 'RECICLADO', 'DESCARTADO');

CREATE TYPE "TipoMovimentacao" AS ENUM ('CADASTRO', 'TRIAGEM', 'MUDANCA_ESTADO', 'MUDANCA_STATUS', 'DESMONTE', 'FINALIZACAO');

CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoLoginEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organizacao" (
    "id" UUID NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "tipo" "TipoOrganizacao" NOT NULL,
    "contatoResponsavel" TEXT NOT NULL,
    "emailContato" TEXT NOT NULL,
    "diasPrazoArmazenamento" INTEGER NOT NULL DEFAULT 30,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Organizacao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contrato" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "dataInicio" DATE NOT NULL,
    "dataFim" DATE NOT NULL,
    "clausulas" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lote" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "dataEntrada" DATE NOT NULL,
    "notaFiscal" TEXT NOT NULL,
    "transportadora" TEXT NOT NULL,
    "status" "StatusLote" NOT NULL DEFAULT 'RECEBIDO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Equipamento" (
    "id" UUID NOT NULL,
    "loteId" UUID NOT NULL,
    "tipo" "TipoEquipamento" NOT NULL,
    "numeroSerie" TEXT NOT NULL,
    "fabricante" TEXT,
    "modelo" TEXT,
    "codigoBarrasInterno" TEXT NOT NULL,
    "estadoFisico" INTEGER NOT NULL DEFAULT 3,
    "status" "StatusEquipamento" NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Movimentacao" (
    "id" UUID NOT NULL,
    "equipamentoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "estadoFisicoAnterior" INTEGER,
    "estadoFisicoNovo" INTEGER,
    "statusAnterior" "StatusEquipamento",
    "statusNovo" "StatusEquipamento",
    "justificativa" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Parametro" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "aliquotaImpostoPercentual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coeficienteDepreciacaoAnual" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "limiteDiasRetroativosLote" INTEGER NOT NULL DEFAULT 90,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

CREATE UNIQUE INDEX "Organizacao_cnpj_key" ON "Organizacao"("cnpj");

CREATE UNIQUE INDEX "Contrato_organizacaoId_key" ON "Contrato"("organizacaoId");

CREATE UNIQUE INDEX "Contrato_numero_key" ON "Contrato"("numero");

CREATE INDEX "Lote_organizacaoId_idx" ON "Lote"("organizacaoId");

CREATE UNIQUE INDEX "Equipamento_codigoBarrasInterno_key" ON "Equipamento"("codigoBarrasInterno");

CREATE INDEX "Equipamento_loteId_idx" ON "Equipamento"("loteId");

CREATE INDEX "Equipamento_status_idx" ON "Equipamento"("status");

CREATE INDEX "Movimentacao_equipamentoId_criadoEm_idx" ON "Movimentacao"("equipamentoId", "criadoEm");

CREATE INDEX "Movimentacao_usuarioId_idx" ON "Movimentacao"("usuarioId");

ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lote" ADD CONSTRAINT "Lote_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
