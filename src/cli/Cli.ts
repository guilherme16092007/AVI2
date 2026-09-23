import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { Contexto } from "./Contexto";
import { CommandParser } from "./CommandParser";
import { MenuManager, CATALOGO_COMANDOS } from "./MenuManager";
import { despachar } from "./Dispatcher";
import { Severidade } from "../types";

const CORES: Record<Severidade, string> = {
  [Severidade.SUCESSO]: "\x1b[32m", // verde
  [Severidade.INFO]: "\x1b[36m", // ciano
  [Severidade.AVISO]: "\x1b[33m", // amarelo
  [Severidade.ERRO]: "\x1b[31m", // vermelho
  [Severidade.CRITICO]: "\x1b[41m\x1b[37m", // fundo vermelho
};
const RESET = "\x1b[0m";
const NEGRITO = "\x1b[1m";

function imprimirResultado(resultado: { severidade: Severidade; mensagem: string; dados?: unknown }): void {
  const cor = CORES[resultado.severidade] ?? "";
  console.log(`${cor}[${resultado.severidade}]${RESET} ${resultado.mensagem}`);
  if (resultado.dados !== undefined) {
    if (Array.isArray(resultado.dados)) {
      if (resultado.dados.length === 0) {
        console.log("  (nenhum registro)");
      } else {
        for (const item of resultado.dados) {
          console.log(`  - ${typeof item === "string" ? item : JSON.stringify(item)}`);
        }
      }
    } else if (typeof resultado.dados === "object") {
      console.log(JSON.stringify(resultado.dados, null, 2));
    }
  }
}

/** Sugestoes de autocompletacao: entidades e acoes do catalogo de comandos visivel ao papel atual. */
function construirCompleter(ctx: Contexto): (linha: string) => [string[], string] {
  return (linha: string) => {
    const papel = ctx.sessao?.papel;
    const comandos = papel ? MenuManager.comandosVisiveisParaPapel(papel) : CATALOGO_COMANDOS;
    const partes = linha.split(" ");

    let candidatos: string[];
    if (partes.length <= 1) {
      candidatos = Array.from(new Set(comandos.map((c) => c.entidade)));
    } else {
      const entidade = partes[0];
      candidatos = comandos.filter((c) => c.entidade === entidade).map((c) => c.acao);
    }

    const ultimaParte = partes[partes.length - 1];
    const encontrados = candidatos.filter((c) => c.startsWith(ultimaParte));
    return [encontrados.length ? encontrados : candidatos, ultimaParte];
  };
}

/** Executa o loop interativo (REPL) da CLI, com prompt dinamico por papel e historico persistente entre sessoes. */
export async function iniciarRepl(ctx: Contexto): Promise<void> {
  const caminhoHistorico = path.join(ctx.diretorioEstado, "historico_comandos");
  let historico: string[] = [];
  if (fs.existsSync(caminhoHistorico)) {
    historico = fs.readFileSync(caminhoHistorico, "utf8").split("\n").filter(Boolean).reverse();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: construirCompleter(ctx),
    history: historico,
    historySize: 500,
    terminal: true,
  });

  console.log(`\n${NEGRITO}greencode${RESET} - Sistema de Gestao de Logistica Reversa`);
  console.log(`Digite '${NEGRITO}ajuda${RESET}' para ver os comandos ou '${NEGRITO}sair${RESET}' para encerrar.\n`);

  const prompt = () => {
    const usuario = ctx.sessao ? `${ctx.sessao.username}@${ctx.sessao.papel}` : "anonimo";
    rl.setPrompt(`greencode(${usuario})> `);
    rl.prompt();
  };

  prompt();

  rl.on("line", async (linha) => {
    const cmd = CommandParser.analisar(linha);
    if (!cmd) {
      prompt();
      return;
    }

    const resultado = await despachar(ctx, cmd);

    if (resultado.mensagem === "__SAIR__") {
      salvarHistorico(rl, caminhoHistorico);
      console.log("Ate logo!");
      rl.close();
      process.exit(0);
    }

    imprimirResultado(resultado);
    prompt();
  });

  rl.on("close", () => {
    salvarHistorico(rl, caminhoHistorico);
    process.exit(0);
  });
}

function salvarHistorico(rl: readline.Interface, caminho: string): void {
  try {
    const historicoAtual = ((rl as unknown as { history?: string[] }).history ?? []).slice(0, 500);
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, historicoAtual.slice().reverse().join("\n"), { mode: 0o600 });
  } catch {
    // Falha ao persistir historico nao deve impedir o encerramento do programa.
  }
}

/** Executa um unico comando de forma nao interativa (modo script: `greencode <entidade> <acao> ...`). */
export async function executarComandoUnico(ctx: Contexto, argv: string[]): Promise<number> {
  const linha = argv.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ");
  const cmd = CommandParser.analisar(linha);
  if (!cmd) {
    console.log("Nenhum comando informado.");
    return 1;
  }

  const resultado = await despachar(ctx, cmd);
  if (resultado.mensagem === "__SAIR__") return 0;

  imprimirResultado(resultado);
  return resultado.ok ? 0 : 1;
}
