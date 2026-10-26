export interface Ambiente {
  PORT: number;
  HOST: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  LOG_LEVEL: string;
  SHUTDOWN_TIMEOUT_MS: number;
}

type Fonte = Record<string, string | undefined>;

const NIVEIS_LOG = ["fatal", "error", "warn", "info", "debug", "trace", "silent"];

function inteiro(fonte: Fonte, nome: string, padrao: number, min: number, max: number): number {
  const bruto = fonte[nome];
  if (bruto === undefined || bruto.trim() === "") return padrao;
  const valor = Number(bruto);
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw new Error(`Variavel de ambiente ${nome} invalida: '${bruto}' (esperado inteiro entre ${min} e ${max}).`);
  }
  return valor;
}

export function carregarAmbiente(fonte: Fonte = process.env): Ambiente {
  const DATABASE_URL = fonte.DATABASE_URL?.trim();
  if (!DATABASE_URL) {
    throw new Error("Variavel de ambiente DATABASE_URL nao definida (veja .env.example).");
  }

  const JWT_SECRET = fonte.JWT_SECRET ?? "";
  if (JWT_SECRET.length < 32) {
    throw new Error("Variavel de ambiente JWT_SECRET ausente ou curta demais (minimo 32 caracteres; veja .env.example).");
  }

  const LOG_LEVEL = (fonte.LOG_LEVEL ?? "info").trim() || "info";
  if (!NIVEIS_LOG.includes(LOG_LEVEL)) {
    throw new Error(`Variavel de ambiente LOG_LEVEL invalida: '${LOG_LEVEL}' (use: ${NIVEIS_LOG.join(", ")}).`);
  }

  return {
    PORT: inteiro(fonte, "PORT", 3000, 1, 65535),
    HOST: fonte.HOST?.trim() || "127.0.0.1",
    DATABASE_URL,
    JWT_SECRET,
    JWT_EXPIRES_IN: fonte.JWT_EXPIRES_IN?.trim() || "30m",
    LOG_LEVEL,
    SHUTDOWN_TIMEOUT_MS: inteiro(fonte, "SHUTDOWN_TIMEOUT_MS", 10_000, 1_000, 120_000),
  };
}
