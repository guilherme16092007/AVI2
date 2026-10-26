import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { construirApp } from "./app";
import { carregarAmbiente } from "./config/env";
import { criarRepositoriosPrisma, ExecutorTransacaoPrisma } from "./repositorios/prisma";
import { criarServicos } from "./servicos";

async function main(): Promise<void> {
  const ambiente = carregarAmbiente();

  const prisma = new PrismaClient();
  const servicos = criarServicos({
    repos: criarRepositoriosPrisma(prisma),
    transacao: new ExecutorTransacaoPrisma(prisma),
  });

  const app = await construirApp({
    servicos,
    jwtSecret: ambiente.JWT_SECRET,
    jwtExpiresIn: ambiente.JWT_EXPIRES_IN,
    logLevel: ambiente.LOG_LEVEL,
    verificarBanco: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  await app.listen({ port: ambiente.PORT, host: ambiente.HOST });

  let encerrando = false;
  const encerrar = async (sinal: string): Promise<void> => {
    if (encerrando) return;
    encerrando = true;
    app.log.info({ sinal }, "sinal recebido: iniciando encerramento gracioso");

    const limite = setTimeout(() => {
      app.log.error("tempo limite de encerramento excedido: forcando a saida");
      process.exit(1);
    }, ambiente.SHUTDOWN_TIMEOUT_MS);
    limite.unref();

    try {
      await app.close();
      app.log.info("servidor encerrado com sucesso");
      process.exit(0);
    } catch (erro) {
      app.log.error({ err: erro }, "falha ao encerrar o servidor");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void encerrar("SIGINT"));
  process.on("SIGTERM", () => void encerrar("SIGTERM"));
}

main().catch((erro) => {
  console.error("Falha ao iniciar o servidor:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
