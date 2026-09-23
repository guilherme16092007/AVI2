#!/usr/bin/env node
import * as path from "path";
import { inicializarContexto } from "./bootstrap";
import { iniciarRepl, executarComandoUnico } from "./cli/Cli";

/**
 * Ponto de entrada do greencode.
 *
 * Dois modos de uso:
 *  - Interativo (REPL): `node dist/index.js` (ou `greencode`, se instalado
 *    globalmente) sem argumentos abre o prompt interativo com
 *    autocompletacao e historico persistente.
 *  - Script (nao interativo): `node dist/index.js login --user admin`
 *    executa um unico comando e encerra com codigo de saida 0 (sucesso)
 *    ou 1 (falha), util para os scripts de teste automatizados.
 *
 * O diretorio base de dados (`data/`) e de estado (`.greencode/`) e
 * sempre o diretorio de trabalho atual (`process.cwd()`), permitindo
 * que cada instalacao/clone do repositorio mantenha seus proprios dados
 * isolados.
 */
async function main(): Promise<void> {
  const diretorioBase = process.env.GREENCODE_HOME ?? path.resolve(process.cwd());
  const ctx = await inicializarContexto(diretorioBase);

  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    await iniciarRepl(ctx);
  } else {
    const codigoSaida = await executarComandoUnico(ctx, argv);
    process.exit(codigoSaida);
  }
}

main().catch((erro) => {
  console.error("Falha fatal ao iniciar o greencode:");
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
