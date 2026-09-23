import * as readline from "readline";

/**
 * Le uma linha de stdin sem ecoar os caracteres digitados na tela
 * (usado para senhas). Usa o hook interno `_writeToOutput` do modulo
 * readline do Node.js - tecnica amplamente adotada em ferramentas de
 * linha de comando para mascarar entrada sensivel sem dependencias
 * externas.
 */
export function perguntarSenhaOculta(pergunta: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const rlInterno = rl as unknown as { _writeToOutput?: (s: string) => void };
    const out = (rl as unknown as { output: NodeJS.WritableStream }).output;

    rlInterno._writeToOutput = (s: string) => {
      if (s === pergunta || s.includes("\n")) out.write(s);
      else out.write("*".repeat(s.length));
    };

    rl.question(pergunta, (resposta: string) => {
      rl.close();
      process.stdout.write("\n");
      resolve(resposta);
    });
  });
}

/** Le uma linha simples de stdin (sem mascaramento). */
export function perguntar(pergunta: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(pergunta, (resposta: string) => {
      rl.close();
      resolve(resposta);
    });
  });
}
