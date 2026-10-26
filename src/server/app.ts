import Fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { authController } from "./controllers/AuthController";
import { equipamentoController } from "./controllers/EquipamentoController";
import { loteController } from "./controllers/LoteController";
import { organizacaoController } from "./controllers/OrganizacaoController";
import { parametroController } from "./controllers/ParametroController";
import { relatorioController } from "./controllers/RelatorioController";
import { saudeController } from "./controllers/SaudeController";
import { usuarioController } from "./controllers/UsuarioController";
import { traduzirErro } from "./erros";
import { autenticar } from "./plugins/autenticacao";
import { Servicos } from "./servicos";
import "./tipos-jwt";

export interface OpcoesApp {
  servicos: Servicos;
  jwtSecret: string;
  jwtExpiresIn: string;
  logLevel?: string;
  logger?: boolean;
  verificarBanco?: () => Promise<void>;
}

export async function construirApp(opcoes: OpcoesApp): Promise<FastifyInstance> {
  const configuracao: FastifyServerOptions = {
    logger: opcoes.logger === false ? false : { level: opcoes.logLevel ?? "info" },
    ajv: { customOptions: { removeAdditional: false, coerceTypes: "array", useDefaults: true, allErrors: false } },
  };
  const app = Fastify(configuracao);

  await app.register(fastifyJwt, {
    secret: opcoes.jwtSecret,
    sign: { expiresIn: opcoes.jwtExpiresIn },
  });

  app.setErrorHandler((erro, request, reply) => {
    const resposta = traduzirErro(erro);
    if (resposta.statusCode >= 500) {
      request.log.error({ err: erro }, "erro nao tratado");
    } else {
      request.log.info({ codigo: resposta.erro, status: resposta.statusCode }, resposta.mensagem);
    }
    return reply.status(resposta.statusCode).send(resposta);
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      statusCode: 404,
      erro: "NAO_ENCONTRADO",
      mensagem: `Rota ${request.method} ${request.url} nao encontrada.`,
    })
  );

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      { metodo: request.method, url: request.url, status: reply.statusCode, usuario: request.user?.sub },
      "requisicao concluida"
    );
  });

  await app.register(saudeController, { verificarBanco: opcoes.verificarBanco });
  await app.register(authController, { servicos: opcoes.servicos, validade: opcoes.jwtExpiresIn });

  await app.register(async (protegido: FastifyInstance) => {
    protegido.addHook("onRequest", autenticar);
    const dependencias = { servicos: opcoes.servicos };
    await protegido.register(usuarioController, dependencias);
    await protegido.register(parametroController, dependencias);
    await protegido.register(organizacaoController, dependencias);
    await protegido.register(loteController, dependencias);
    await protegido.register(equipamentoController, dependencias);
    await protegido.register(relatorioController, dependencias);
  });

  return app;
}
