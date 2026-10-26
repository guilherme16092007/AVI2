import type { FastifyPluginAsync } from "fastify";
import { atorDe } from "../plugins/autenticacao";
import {
  consultaEquipamentos,
  corpoAlterarEstadoFisico,
  corpoAlterarStatus,
  corpoTriagem,
  paramsId,
} from "../schemas";
import { StatusEquipamento } from "../../types";
import { AlterarEstadoEntrada, AlterarStatusEntrada, TriagemEntrada } from "../servicos/EquipamentoServico";
import { ConsultaPaginada, OpcoesController, paginacaoDe } from "./comum";

export const equipamentoController: FastifyPluginAsync<OpcoesController> = async (app, { servicos }) => {
  app.get<{ Querystring: ConsultaPaginada & { loteId?: string; status?: StatusEquipamento } }>(
    "/equipamentos",
    { schema: { querystring: consultaEquipamentos } },
    async (request) =>
      servicos.equipamentos.listar(
        { loteId: request.query.loteId, status: request.query.status },
        paginacaoDe(request.query)
      )
  );

  app.get<{ Params: { id: string } }>("/equipamentos/:id", { schema: { params: paramsId } }, async (request) =>
    servicos.equipamentos.detalhar(request.params.id)
  );

  app.post<{ Params: { id: string }; Body: TriagemEntrada }>(
    "/equipamentos/:id/triagem",
    { schema: { params: paramsId, body: corpoTriagem } },
    async (request) => servicos.equipamentos.triagem(atorDe(request), request.params.id, request.body)
  );

  app.patch<{ Params: { id: string }; Body: AlterarEstadoEntrada }>(
    "/equipamentos/:id/estado-fisico",
    { schema: { params: paramsId, body: corpoAlterarEstadoFisico } },
    async (request) => servicos.equipamentos.alterarEstadoFisico(atorDe(request), request.params.id, request.body)
  );

  app.patch<{ Params: { id: string }; Body: AlterarStatusEntrada }>(
    "/equipamentos/:id/status",
    { schema: { params: paramsId, body: corpoAlterarStatus } },
    async (request) => servicos.equipamentos.alterarStatus(atorDe(request), request.params.id, request.body)
  );

  app.get<{ Params: { id: string } }>("/equipamentos/:id/rastreio", { schema: { params: paramsId } }, async (request) =>
    servicos.equipamentos.rastrear(request.params.id)
  );
};
