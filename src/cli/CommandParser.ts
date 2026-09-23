/**
 * Resultado da analise de uma linha de comando digitada pelo usuario.
 *
 * Convencao adotada (conforme enunciado): o primeiro argumento e a
 * "acao principal" (aqui decomposta em entidade + subacao, ex.:
 * "lote" + "criar"), e os argumentos subsequentes sao os identificadores
 * ou dados necessarios, na forma de flags nomeadas (--flag valor) ou
 * argumentos posicionais soltos.
 *
 * Exemplo: `lote criar --org BR001 --nf 123456 --transp TransRapida`
 *   entidade = "lote"
 *   acao     = "criar"
 *   flags    = { org: "BR001", nf: "123456", transp: "TransRapida" }
 *   posicionais = []
 *
 * Exemplo com posicional: `equipamento triagem eqp-123 --estado BOM`
 *   entidade = "equipamento"
 *   acao     = "triagem"
 *   posicionais = ["eqp-123"]
 *   flags    = { estado: "BOM" }
 */
export interface ComandoAnalisado {
  entidade: string;
  acao: string;
  flags: Record<string, string>;
  posicionais: string[];
  linhaOriginal: string;
}

export class CommandParser {
  /** Tokeniza respeitando aspas simples/duplas, como um shell simplificado. */
  private static tokenizar(linha: string): string[] {
    const tokens: string[] = [];
    const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(linha)) !== null) {
      tokens.push(match[1] ?? match[2] ?? match[3]);
    }
    return tokens;
  }

  static analisar(linha: string): ComandoAnalisado | null {
    const linhaLimpa = linha.trim();
    if (!linhaLimpa) return null;

    const tokens = CommandParser.tokenizar(linhaLimpa);
    if (tokens.length === 0) return null;

    const entidade = tokens[0].toLowerCase();

    // Comandos de nivel unico (sem sub-acao) nao consomem o segundo token
    // como "acao": se o segundo token ja e uma flag (--...), a acao fica
    // vazia e a analise de flags/posicionais comeca a partir dele.
    const segundoTokenEhFlag = tokens[1]?.startsWith("--") ?? false;
    const acao = !segundoTokenEhFlag ? (tokens[1] ?? "").toLowerCase() : "";
    const indiceInicioResto = !segundoTokenEhFlag && tokens[1] !== undefined ? 2 : 1;

    const flags: Record<string, string> = {};
    const posicionais: string[] = [];

    let i = indiceInicioResto;
    while (i < tokens.length) {
      const tok = tokens[i];
      if (tok.startsWith("--")) {
        const nomeFlag = tok.slice(2);
        const proximo = tokens[i + 1];
        if (proximo !== undefined && !proximo.startsWith("--")) {
          flags[nomeFlag] = proximo;
          i += 2;
        } else {
          flags[nomeFlag] = "true"; // flag booleana sem valor
          i += 1;
        }
      } else {
        posicionais.push(tok);
        i += 1;
      }
    }

    return { entidade, acao, flags, posicionais, linhaOriginal: linhaLimpa };
  }

  /** Extrai uma flag obrigatoria, lancando erro descritivo se ausente. */
  static exigirFlag(cmd: ComandoAnalisado, nome: string): string {
    const valor = cmd.flags[nome];
    if (valor === undefined || valor.length === 0) {
      throw new Error(`Parametro obrigatorio ausente: --${nome}`);
    }
    return valor;
  }

  static flagOpcional(cmd: ComandoAnalisado, nome: string, padrao?: string): string | undefined {
    return cmd.flags[nome] ?? padrao;
  }
}
