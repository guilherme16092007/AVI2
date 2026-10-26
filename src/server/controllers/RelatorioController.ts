import type { FastifyPluginAsync } from "fastify";
import { atorDe } from "../plugins/autenticacao";
import { consultaRelatorio } from "../schemas";
import { OpcoesController } from "./comum";

export const relatorioController: FastifyPluginAsync<OpcoesController> = async (app, { servicos }) => {
  app.get<{ Querystring: { loteId?: string } }>(
    "/relatorios/valor-residual",
    { schema: { querystring: consultaRelatorio } },
    async (request) => servicos.relatorios.valorResidual(atorDe(request), { loteId: request.query.loteId })
  );
};
