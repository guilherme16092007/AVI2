import { ErroConflito } from "../../src/server/erros";
import {
  ContratoRegistro,
  Dependencias,
  EquipamentoRegistro,
  ExecutorTransacao,
  LoteRegistro,
  MovimentacaoRegistro,
  OrganizacaoRegistro,
  Pagina,
  Paginacao,
  ParametroRegistro,
  Repositorios,
  UsuarioRegistro,
} from "../../src/server/repositorios/portas";

type LoteArmazenado = Omit<LoteRegistro, "quantidadeEquipamentos">;

interface Estado {
  usuarios: UsuarioRegistro[];
  organizacoes: OrganizacaoRegistro[];
  contratos: ContratoRegistro[];
  lotes: LoteArmazenado[];
  equipamentos: EquipamentoRegistro[];
  movimentacoes: MovimentacaoRegistro[];
  parametro: ParametroRegistro | null;
}

function erroUnico(campo: string): Error {
  return Object.assign(new Error(`Unique constraint failed on the fields: (${campo})`), {
    code: "P2002",
    meta: { target: [campo] },
  });
}

function paginar<T>(todos: T[], p: Paginacao): Pagina<T> {
  return { itens: todos.slice(p.offset, p.offset + p.limite), total: todos.length, limite: p.limite, offset: p.offset };
}

export class BancoMemoria implements Dependencias {
  estado: Estado = {
    usuarios: [],
    organizacoes: [],
    contratos: [],
    lotes: [],
    equipamentos: [],
    movimentacoes: [],
    parametro: null,
  };
  falhas = new Set<string>();

  readonly repos: Repositorios;
  readonly transacao: ExecutorTransacao;

  constructor() {
    const banco = this;
    const agora = (): Date => new Date();
    const falharSe = (op: string): void => {
      if (banco.falhas.has(op)) throw new Error(`Falha simulada em ${op}`);
    };
    const comQuantidade = (l: LoteArmazenado): LoteRegistro => ({
      ...l,
      quantidadeEquipamentos: banco.estado.equipamentos.filter((e) => e.loteId === l.id).length,
    });

    this.repos = {
      usuarios: {
        async buscarPorId(id) {
          return banco.estado.usuarios.find((u) => u.id === id) ?? null;
        },
        async buscarPorUsername(username) {
          return banco.estado.usuarios.find((u) => u.username === username) ?? null;
        },
        async listar(p) {
          return paginar([...banco.estado.usuarios], p);
        },
        async criar(dados) {
          if (banco.estado.usuarios.some((u) => u.username === dados.username)) throw erroUnico("username");
          const registro: UsuarioRegistro = {
            ...dados,
            ativo: true,
            ultimoLoginEm: null,
            criadoEm: agora(),
            atualizadoEm: agora(),
            versao: 1,
          };
          banco.estado.usuarios.push(registro);
          return registro;
        },
        async registrarLogin(id) {
          const u = banco.estado.usuarios.find((x) => x.id === id);
          if (u) {
            u.ultimoLoginEm = agora();
            u.versao += 1;
          }
        },
      },

      organizacoes: {
        async buscarPorId(id) {
          return banco.estado.organizacoes.find((o) => o.id === id) ?? null;
        },
        async buscarDetalhe(id) {
          const org = banco.estado.organizacoes.find((o) => o.id === id);
          if (!org) return null;
          return {
            ...org,
            contrato: banco.estado.contratos.find((c) => c.organizacaoId === id) ?? null,
            lotes: banco.estado.lotes
              .filter((l) => l.organizacaoId === id)
              .map((l) => ({
                id: l.id,
                dataEntrada: l.dataEntrada,
                notaFiscal: l.notaFiscal,
                transportadora: l.transportadora,
                status: l.status,
              })),
          };
        },
        async existeCnpj(cnpj) {
          return banco.estado.organizacoes.some((o) => o.cnpj === cnpj);
        },
        async listar(p) {
          return paginar([...banco.estado.organizacoes], p);
        },
        async criar(dados) {
          if (banco.estado.organizacoes.some((o) => o.cnpj === dados.cnpj)) throw erroUnico("cnpj");
          const registro: OrganizacaoRegistro = {
            ...dados,
            ativo: true,
            criadoEm: agora(),
            atualizadoEm: agora(),
            versao: 1,
          };
          banco.estado.organizacoes.push(registro);
          return registro;
        },
      },

      contratos: {
        async buscarPorOrganizacao(organizacaoId) {
          return banco.estado.contratos.find((c) => c.organizacaoId === organizacaoId) ?? null;
        },
        async numeroEmUsoPorOutraOrganizacao(numero, organizacaoId) {
          return banco.estado.contratos.some((c) => c.numero === numero && c.organizacaoId !== organizacaoId);
        },
        async criar(dados) {
          if (banco.estado.contratos.some((c) => c.numero === dados.numero)) throw erroUnico("numero");
          const registro: ContratoRegistro = { ...dados, criadoEm: agora(), atualizadoEm: agora(), versao: 1 };
          banco.estado.contratos.push(registro);
          return registro;
        },
        async atualizarComVersao(id, versaoEsperada, dados) {
          const c = banco.estado.contratos.find((x) => x.id === id && x.versao === versaoEsperada);
          if (!c) throw new ErroConflito("Contrato alterado por outra requisicao (versao desatualizada).");
          Object.assign(c, dados, { atualizadoEm: agora(), versao: c.versao + 1 });
          return c;
        },
      },

      lotes: {
        async buscarPorId(id) {
          const l = banco.estado.lotes.find((x) => x.id === id);
          return l ? comQuantidade(l) : null;
        },
        async buscarDetalhe(id) {
          const l = banco.estado.lotes.find((x) => x.id === id);
          if (!l) return null;
          return { ...comQuantidade(l), equipamentos: banco.estado.equipamentos.filter((e) => e.loteId === id) };
        },
        async listar(filtro, p) {
          const todos = banco.estado.lotes
            .filter((l) => !filtro.organizacaoId || l.organizacaoId === filtro.organizacaoId)
            .map(comQuantidade);
          return paginar(todos, p);
        },
        async criar(dados) {
          falharSe("lotes.criar");
          const registro: LoteArmazenado = {
            ...dados,
            status: "RECEBIDO" as LoteArmazenado["status"],
            criadoEm: agora(),
            atualizadoEm: agora(),
            versao: 1,
          };
          banco.estado.lotes.push(registro);
          return comQuantidade(registro);
        },
      },

      equipamentos: {
        async buscarPorId(id) {
          return banco.estado.equipamentos.find((e) => e.id === id) ?? null;
        },
        async listar(filtro, p) {
          const todos = banco.estado.equipamentos.filter(
            (e) => (!filtro.loteId || e.loteId === filtro.loteId) && (!filtro.status || e.status === filtro.status)
          );
          return paginar(todos, p);
        },
        async listarTodos(filtro) {
          return banco.estado.equipamentos.filter(
            (e) => (!filtro.loteId || e.loteId === filtro.loteId) && (!filtro.status || e.status === filtro.status)
          );
        },
        async codigosExistentes(codigos) {
          return codigos.filter((c) => banco.estado.equipamentos.some((e) => e.codigoBarrasInterno === c));
        },
        async criarVarios(dados) {
          falharSe("equipamentos.criarVarios");
          for (const d of dados) {
            if (banco.estado.equipamentos.some((e) => e.codigoBarrasInterno === d.codigoBarrasInterno)) {
              throw erroUnico("codigoBarrasInterno");
            }
            banco.estado.equipamentos.push({ ...d, criadoEm: agora(), atualizadoEm: agora(), versao: 1 });
          }
        },
        async atualizarComVersao(id, versaoEsperada, dados) {
          falharSe("equipamentos.atualizarComVersao");
          const e = banco.estado.equipamentos.find((x) => x.id === id && x.versao === versaoEsperada);
          if (!e) throw new ErroConflito("Equipamento alterado por outra requisicao (versao desatualizada).");
          if (dados.estadoFisico !== undefined) e.estadoFisico = dados.estadoFisico;
          if (dados.status !== undefined) e.status = dados.status;
          e.atualizadoEm = agora();
          e.versao += 1;
          return e;
        },
      },

      movimentacoes: {
        async criarVarias(dados) {
          falharSe("movimentacoes.criarVarias");
          for (const d of dados) {
            const usuario = banco.estado.usuarios.find((u) => u.id === d.usuarioId);
            banco.estado.movimentacoes.push({
              ...d,
              usuarioUsername: usuario?.username ?? "desconhecido",
              criadoEm: agora(),
              versao: 1,
            });
          }
        },
        async listarPorEquipamento(equipamentoId) {
          return banco.estado.movimentacoes.filter((m) => m.equipamentoId === equipamentoId);
        },
      },

      parametros: {
        async obter() {
          if (!banco.estado.parametro) {
            banco.estado.parametro = {
              aliquotaImpostoPercentual: 0,
              coeficienteDepreciacaoAnual: 20,
              limiteDiasRetroativosLote: 90,
              atualizadoEm: agora(),
              versao: 1,
            };
          }
          return banco.estado.parametro;
        },
        async atualizarComVersao(versaoEsperada, dados) {
          const p = await this.obter();
          if (p.versao !== versaoEsperada) throw new ErroConflito("Parametros alterados por outra requisicao.");
          if (dados.aliquotaImpostoPercentual !== undefined) p.aliquotaImpostoPercentual = dados.aliquotaImpostoPercentual;
          if (dados.coeficienteDepreciacaoAnual !== undefined) p.coeficienteDepreciacaoAnual = dados.coeficienteDepreciacaoAnual;
          if (dados.limiteDiasRetroativosLote !== undefined) p.limiteDiasRetroativosLote = dados.limiteDiasRetroativosLote;
          p.atualizadoEm = agora();
          p.versao += 1;
          return p;
        },
      },
    };

    this.transacao = {
      async executar<T>(fn: (repositorios: Repositorios) => Promise<T>): Promise<T> {
        const snapshot = structuredClone(banco.estado);
        try {
          return await fn(banco.repos);
        } catch (erro) {
          Object.assign(banco.estado, snapshot);
          throw erro;
        }
      },
    };
  }
}

export function gerarCnpj(base12: string): string {
  const calcular = (digitos: string, pesos: number[]): number => {
    const soma = digitos.split("").reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calcular(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcular(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base12}${d1}${d2}`;
}

export function dataRelativa(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const dois = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}
