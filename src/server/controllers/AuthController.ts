import type { FastifyPluginAsync } from "fastify";
import { corpoLogin } from "../schemas";
import { OpcoesController } from "./comum";
import "../tipos-jwt";

export interface OpcoesAuth extends OpcoesController {
  validade: string;
}

export const authController: FastifyPluginAsync<OpcoesAuth> = async (app, { servicos, validade }) => {
  app.post<{ Body: { username: string; senha: string } }>(
    "/auth/login",
    { schema: { body: corpoLogin } },
    async (request) => {
      const usuario = await servicos.autenticacao.autenticar(request.body.username, request.body.senha);
      const token = app.jwt.sign({ sub: usuario.id, username: usuario.username, papel: usuario.papel });
      return { token, tipo: "Bearer", validade, usuario };
    }
  );
};
