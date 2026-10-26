import type { FastifyPluginAsync } from "fastify";
import { atorDe } from "../plugins/autenticacao";
import { consultaLotes, corpoAdicionarEquipamento, corpoCriarLote, paramsId } from "../schemas";
import { CriarLoteEntrada, EquipamentoEntrada } from "../servicos/LoteServico";
import { ConsultaPaginada, OpcoesController, paginacaoDe } from "./comum";

export const loteController: FastifyPluginAsync<OpcoesController> = async (app, { servicos }) => {
  app.post<{ Body: CriarLoteEntrada }>("/lotes", { schema: { body: corpoCriarLote } }, async (request, reply) => {
    const lote = await servicos.lotes.criar(atorDe(request), request.body);
    reply.code(201);
    return lote;
  });

  app.get<{ Querystring: ConsultaPaginada & { organizacaoId?: string } }>(
    "/lotes",
    { schema: { querystring: consultaLotes } },
    async (request) => servicos.lotes.listar({ organizacaoId: request.query.organizacaoId }, paginacaoDe(request.query))
  );

  app.get<{ Params: { id: string } }>("/lotes/:id", { schema: { params: paramsId } }, async (request) =>
    servicos.lotes.detalhar(request.params.id)
  );

  app.post<{ Params: { id: string }; Body: EquipamentoEntrada }>(
    "/lotes/:id/equipamentos",
    { schema: { params: paramsId, body: corpoAdicionarEquipamento } },
    async (request, reply) => {
      const equipamento = await servicos.lotes.adicionarEquipamento(atorDe(request), request.params.id, request.body);
      reply.code(201);
      return equipamento;
    }
  );
};
