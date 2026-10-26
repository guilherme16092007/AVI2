import type { FastifyPluginAsync } from "fastify";

export interface OpcoesSaude {
  verificarBanco?: () => Promise<void>;
}

export const saudeController: FastifyPluginAsync<OpcoesSaude> = async (app, opcoes) => {
  app.get("/saude", async (_request, reply) => {
    try {
      if (opcoes.verificarBanco) await opcoes.verificarBanco();
      return { status: "ok", banco: opcoes.verificarBanco ? "conectado" : "nao verificado", hora: new Date().toISOString() };
    } catch {
      reply.code(503);
      return { status: "indisponivel", banco: "sem conexao", hora: new Date().toISOString() };
    }
  });
};
