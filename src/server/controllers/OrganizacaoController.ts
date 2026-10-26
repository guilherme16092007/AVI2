import type { FastifyPluginAsync } from "fastify";
import { atorDe } from "../plugins/autenticacao";
import { consultaPaginada, corpoCriarOrganizacao, corpoDefinirContrato, paramsId } from "../schemas";
import { CriarOrganizacaoEntrada, DefinirContratoEntrada } from "../servicos/OrganizacaoServico";
import { ConsultaPaginada, OpcoesController, paginacaoDe } from "./comum";

export const organizacaoController: FastifyPluginAsync<OpcoesController> = async (app, { servicos }) => {
  app.post<{ Body: CriarOrganizacaoEntrada }>(
    "/organizacoes",
    { schema: { body: corpoCriarOrganizacao } },
    async (request, reply) => {
      const organizacao = await servicos.organizacoes.criar(atorDe(request), request.body);
      reply.code(201);
      return organizacao;
    }
  );

  app.get<{ Querystring: ConsultaPaginada }>("/organizacoes", { schema: { querystring: consultaPaginada } }, async (request) =>
    servicos.organizacoes.listar(paginacaoDe(request.query))
  );

  app.get<{ Params: { id: string } }>("/organizacoes/:id", { schema: { params: paramsId } }, async (request) =>
    servicos.organizacoes.detalhar(request.params.id)
  );

  app.get<{ Params: { id: string } }>("/organizacoes/:id/contrato", { schema: { params: paramsId } }, async (request) =>
    servicos.organizacoes.obterContrato(request.params.id)
  );

  app.put<{ Params: { id: string }; Body: DefinirContratoEntrada }>(
    "/organizacoes/:id/contrato",
    { schema: { params: paramsId, body: corpoDefinirContrato } },
    async (request, reply) => {
      const resultado = await servicos.organizacoes.definirContrato(atorDe(request), request.params.id, request.body);
      reply.code(resultado.criado ? 201 : 200);
      return resultado.contrato;
    }
  );
};
