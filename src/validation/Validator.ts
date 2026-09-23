import { ErroValidacao } from "../types";

/** Resultado de uma validacao, acumulando todos os erros encontrados (nao para no primeiro). */
export interface ResultadoValidacao {
  valido: boolean;
  erros: string[];
}

/**
 * Classe abstrata generica de validacao (RF: "classes abstratas para
 * validacao de dados"). Implementa o padrao Template Method: a classe
 * base define o fluxo (`validar`) e as subclasses concretas implementam
 * apenas as regras especificas via `regras()`.
 *
 * Cada regra e uma funcao que recebe o objeto a validar e retorna uma
 * mensagem de erro (string) caso a regra seja violada, ou `null` caso
 * esteja tudo certo. Isso permite compor validacoes complexas de forma
 * declarativa e testavel isoladamente.
 */
export abstract class Validator<T> {
  /** Lista de regras de validacao que a subclasse concreta deve fornecer. */
  protected abstract regras(): Array<(alvo: T) => string | null>;

  /** Executa todas as regras e acumula os erros, sem interromper na primeira falha. */
  validar(alvo: T): ResultadoValidacao {
    const erros: string[] = [];
    for (const regra of this.regras()) {
      const erro = regra(alvo);
      if (erro) erros.push(erro);
    }
    return { valido: erros.length === 0, erros };
  }

  /** Atalho que lanca ErroValidacao se a validacao falhar. Util em pontos de entrada da CLI. */
  validarOuLancar(alvo: T): void {
    const resultado = this.validar(alvo);
    if (!resultado.valido) {
      throw new ErroValidacao(resultado.erros.join("; "), resultado.erros);
    }
  }
}
