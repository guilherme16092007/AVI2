import "dotenv/config";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { HashService } from "../src/crypto/HashService";
import { criarRepositoriosPrisma, ExecutorTransacaoPrisma } from "../src/server/repositorios/prisma";
import { criarServicos, Servicos } from "../src/server/servicos";
import { EquipamentoEntrada } from "../src/server/servicos/LoteServico";
import { Ator } from "../src/server/servicos/politicas";
import { Papel, StatusEquipamento, TipoEquipamento, TipoOrganizacao } from "../src/types";
import { CnpjUtils } from "../src/validation/CnpjValidator";

const SENHAS = {
  admin: "Admin@12345",
  operador: "Operador@123",
  gestor: "Gestor@1234",
  auditor: "Auditor@123",
};

function gerarCnpj(base12: string): string {
  const digito = (digitos: string, pesos: number[]): number => {
    const resto = digitos.split("").reduce((soma, d, i) => soma + Number(d) * pesos[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const cnpj = `${base12}${d1}${d2}`;
  if (!CnpjUtils.valido(cnpj)) throw new Error(`CNPJ gerado invalido: ${cnpj}`);
  return cnpj;
}

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const dois = (x: number): string => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

async function limparTudo(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Movimentacao", "Equipamento", "Lote", "Contrato", "Organizacao", "Usuario", "Parametro" RESTART IDENTITY CASCADE'
  );
}

async function popular(prisma: PrismaClient): Promise<void> {
  const repos = criarRepositoriosPrisma(prisma);
  const servicos: Servicos = criarServicos({ repos, transacao: new ExecutorTransacaoPrisma(prisma) });

  const adminRegistro = await repos.usuarios.criar({
    id: randomUUID(),
    username: "admin",
    papel: Papel.ADMINISTRADOR,
    senhaHash: HashService.gerarHash(SENHAS.admin),
  });
  const admin: Ator = { id: adminRegistro.id, username: "admin", papel: Papel.ADMINISTRADOR };
  const criarAtor = async (username: string, senha: string, papel: Papel): Promise<Ator> => {
    const u = await servicos.usuarios.criar(admin, { username, senha, papel });
    return { id: u.id, username: u.username, papel };
  };
  const operador = await criarAtor("operador", SENHAS.operador, Papel.OPERADOR_CADASTRO);
  const gestor = await criarAtor("gestor", SENHAS.gestor, Papel.GESTOR_ALMOXARIFADO);
  await criarAtor("auditor", SENHAS.auditor, Papel.AUDITOR);

  await servicos.parametros.definir(admin, { aliquotaImpostoPercentual: 9.25, coeficienteDepreciacaoAnual: 20 });

  const hospital = await servicos.organizacoes.criar(operador, {
    cnpj: gerarCnpj("112223330001"), razaoSocial: "Hospital Central LTDA", nomeFantasia: "Hospital Central",
    tipo: TipoOrganizacao.HOSPITAL, contatoResponsavel: "Maria Silva", emailContato: "maria.silva@hospitalcentral.example", diasPrazoArmazenamento: 45,
  });
  const banco = await servicos.organizacoes.criar(operador, {
    cnpj: gerarCnpj("445556660001"), razaoSocial: "Banco Atlantico S.A.", tipo: TipoOrganizacao.BANCO,
    contatoResponsavel: "Carlos Mendes", emailContato: "carlos.mendes@atlantico.example", diasPrazoArmazenamento: 30,
  });
  const universidade = await servicos.organizacoes.criar(operador, {
    cnpj: gerarCnpj("778889990001"), razaoSocial: "Universidade Federal do Litoral", tipo: TipoOrganizacao.UNIVERSIDADE,
    contatoResponsavel: "Prof. Helena Costa", emailContato: "helena.costa@ufl.example", diasPrazoArmazenamento: 60,
  });
  const varejo = await servicos.organizacoes.criar(operador, {
    cnpj: gerarCnpj("334445550001"), razaoSocial: "Varejo Mais Comercio LTDA", tipo: TipoOrganizacao.VAREJO,
    contatoResponsavel: "Joao Pereira", emailContato: "joao.pereira@varejomais.example",
  });

  await servicos.organizacoes.definirContrato(operador, hospital.id, {
    numero: "CT-2026-0001", dataInicio: "2026-01-01", dataFim: "2027-12-31",
    clausulas: { prazoColetaDias: 15, coletaMinimaEquipamentos: 10, descarteSeguroObrigatorio: true, multaAtrasoPercentual: 2 },
  });
  await servicos.organizacoes.definirContrato(operador, banco.id, {
    numero: "CT-2026-0002", dataInicio: "2026-02-01", dataFim: "2028-01-31",
    clausulas: { prazoColetaDias: 7, certificadoDestruicaoDados: true, sla: { coletaHoras: 48 } },
  });
  await servicos.organizacoes.definirContrato(operador, universidade.id, {
    numero: "CT-2026-0003", dataInicio: "2026-03-01", dataFim: "2027-02-28",
    clausulas: { prazoColetaDias: 30, reaproveitamentoSocial: true },
  });

  const L = (organizacaoId: string, nf: string, dias: number, equipamentos?: EquipamentoEntrada[]) =>
    servicos.lotes.criar(gestor, { organizacaoId, notaFiscal: nf, transportadora: "TransRapida Logistica", dataEntrada: diasAtras(dias), equipamentos });

  const lote1 = await L(hospital.id, "NF-100001", 12, [
    { tipo: TipoEquipamento.NOTEBOOK, numeroSerie: "H-NB-001", codigoBarrasInterno: "BC-H-0001", fabricante: "Dell", modelo: "Latitude 5420" },
    { tipo: TipoEquipamento.DESKTOP, numeroSerie: "H-DT-002", codigoBarrasInterno: "BC-H-0002", fabricante: "HP", modelo: "ProDesk 400" },
    { tipo: TipoEquipamento.SERVIDOR, numeroSerie: "H-SV-003", codigoBarrasInterno: "BC-H-0003", fabricante: "Dell", modelo: "PowerEdge R740" },
    { tipo: TipoEquipamento.NOBREAK, numeroSerie: "H-NK-004", codigoBarrasInterno: "BC-H-0004", fabricante: "APC", modelo: "Smart-UPS 1500" },
  ]);
  const lote2 = await L(banco.id, "NF-200001", 5, [
    { tipo: TipoEquipamento.DESKTOP, numeroSerie: "B-DT-001", codigoBarrasInterno: "BC-B-0001", fabricante: "Lenovo" },
    { tipo: TipoEquipamento.DESKTOP, numeroSerie: "B-DT-002", codigoBarrasInterno: "BC-B-0002", fabricante: "Lenovo" },
    { tipo: TipoEquipamento.DESKTOP, numeroSerie: "B-DT-003", codigoBarrasInterno: "BC-B-0003", fabricante: "Lenovo" },
    { tipo: TipoEquipamento.MONITOR, numeroSerie: "B-MN-004", codigoBarrasInterno: "BC-B-0004", fabricante: "LG" },
    { tipo: TipoEquipamento.PERIFERICO, numeroSerie: "B-PF-005", codigoBarrasInterno: "BC-B-0005" },
  ]);
  const lote3 = await L(universidade.id, "NF-300001", 1, [
    { tipo: TipoEquipamento.NOTEBOOK, numeroSerie: "U-NB-001", codigoBarrasInterno: "BC-U-0001", fabricante: "Acer" },
    { tipo: TipoEquipamento.MONITOR, numeroSerie: "U-MN-002", codigoBarrasInterno: "BC-U-0002", fabricante: "Samsung" },
  ]);
  const lote4 = await L(varejo.id, "NF-400001", 30, [
    { tipo: TipoEquipamento.PERIFERICO, numeroSerie: "V-PF-001", codigoBarrasInterno: "BC-V-0001" },
  ]);
  await L(banco.id, "NF-200002", 0);

  const id = (lote: { equipamentos: { id: string; codigoBarrasInterno: string }[] }, codigo: string): string => {
    const e = lote.equipamentos.find((x) => x.codigoBarrasInterno === codigo);
    if (!e) throw new Error(`Equipamento ${codigo} nao encontrado no seed.`);
    return e.id;
  };
  const E = servicos.equipamentos;

  await E.triagem(gestor, id(lote1, "BC-H-0001"), { estadoFisico: "BOM" });
  const servidor = id(lote1, "BC-H-0003");
  await E.triagem(gestor, servidor, { estadoFisico: "BOM" });
  await E.alterarEstadoFisico(gestor, servidor, { novoEstado: "RUIM", justificativa: "Fonte redundante danificada e discos com setores defeituosos" });
  await E.alterarStatus(gestor, servidor, { novoStatus: StatusEquipamento.EM_DESMONTE, observacao: "Encaminhado para a bancada 2" });
  const nobreak = id(lote1, "BC-H-0004");
  await E.triagem(gestor, nobreak, { estadoFisico: "REGULAR" });
  await E.alterarStatus(gestor, nobreak, { novoStatus: StatusEquipamento.RECICLADO });
  await E.triagem(gestor, id(lote2, "BC-B-0001"), { estadoFisico: "NOVO" });
  const b2 = id(lote2, "BC-B-0002");
  await E.triagem(gestor, b2, { estadoFisico: "BOM" });
  await E.alterarEstadoFisico(gestor, b2, { novoEstado: "REGULAR" });
  await E.triagem(gestor, id(lote2, "BC-B-0003"), { estadoFisico: "RUIM" });
  const monitor = id(lote2, "BC-B-0004");
  await E.triagem(gestor, monitor, { estadoFisico: "INSERVIVEL" });
  await E.alterarStatus(gestor, monitor, { novoStatus: StatusEquipamento.EM_DESMONTE });
  await E.alterarStatus(gestor, monitor, { novoStatus: StatusEquipamento.DESCARTADO, observacao: "Painel trincado; descarte seguro conforme contrato" });
  await E.triagem(gestor, id(lote3, "BC-U-0002"), { estadoFisico: "BOM" });

  console.log("\n==============================================================");
  console.log(" Seed concluido");
  console.log("==============================================================");
  console.log(" Usuarios (senhas de DESENVOLVIMENTO; nunca use em producao):");
  console.log(`   admin    / ${SENHAS.admin}     (ADMINISTRADOR)`);
  console.log(`   operador / ${SENHAS.operador}   (OPERADOR_CADASTRO)`);
  console.log(`   gestor   / ${SENHAS.gestor}    (GESTOR_ALMOXARIFADO)`);
  console.log(`   auditor  / ${SENHAS.auditor}    (AUDITOR)`);
  console.log("\n Registros para testar as regras manualmente:");
  console.log(`   Equipamento AGUARDANDO_TRIAGEM (desmonte deve falhar com 422): ${id(lote1, "BC-H-0002")}`);
  console.log(`   Equipamento TRIADO (queda BOM->RUIM exige justificativa)     : ${id(lote1, "BC-H-0001")}`);
  console.log(`   Equipamento com historico completo (rastreio)                : ${monitor}`);
  console.log(`   Organizacao SEM contrato                                      : ${varejo.id}`);
  console.log(`   Lote com 5 equipamentos                                       : ${lote2.id}`);
  console.log(`   Lote da organizacao sem contrato                              : ${lote4.id}`);
  console.log("==============================================================\n");
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const existentes = (await prisma.usuario.count()) + (await prisma.organizacao.count());
    if (existentes > 0) {
      if (process.env.SEED_RESET === "1") {
        console.log("SEED_RESET=1: apagando todos os dados existentes...");
        await limparTudo(prisma);
      } else {
        console.log("O banco ja possui dados: seed ignorado. Use SEED_RESET=1 para apagar tudo e recriar.");
        return;
      }
    }
    await popular(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error("Falha no seed:", erro);
  process.exit(1);
});
