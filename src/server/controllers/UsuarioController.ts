import type { FastifyPluginAsync } from "fastify";
import { atorDe } from "../plugins/autenticacao";
import { corpoCriarUsuario, consultaPaginada } from "../schemas";
import { CriarUsuarioEntrada } from "../servicos/UsuarioServico";
import { ConsultaPaginada, OpcoesController, paginacaoDe } from "./comum";

export const usuarioController: FastifyPluginAsync<OpcoesController> = async (app, { servicos }) => {
  app.get("/auth/me", async (request) => {
    const ator = atorDe(request);
    return { id: ator.id, username: ator.username, papel: ator.papel };
  });

  app.post<{ Body: CriarUsuarioEntrada }>("/usuarios", { schema: { body: corpoCriarUsuario } }, async (request, reply) => {
    const usuario = await servicos.usuarios.criar(atorDe(request), request.body);
    reply.code(201);
    return usuario;
  });

  app.get<{ Querystring: ConsultaPaginada }>("/usuarios", { schema: { querystring: consultaPaginada } }, async (request) =>
    servicos.usuarios.listar(atorDe(request), paginacaoDe(request.query))
  );
};
