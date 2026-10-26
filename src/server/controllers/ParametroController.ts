import type { FastifyPluginAsync } from "fastify";
import { atorDe } from "../plugins/autenticacao";
import { corpoDefinirParametros } from "../schemas";
import { DefinirParametrosEntrada } from "../servicos/ParametroServico";
import { OpcoesController } from "./comum";

export const parametroController: FastifyPluginAsync<OpcoesController> = async (app, { servicos }) => {
  app.get("/parametros", async (request) => servicos.parametros.obter(atorDe(request)));

  app.patch<{ Body: DefinirParametrosEntrada }>(
    "/parametros",
    { schema: { body: corpoDefinirParametros } },
    async (request) => servicos.parametros.definir(atorDe(request), request.body)
  );
};
