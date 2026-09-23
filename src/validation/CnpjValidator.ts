/**
 * CnpjUtils implementa a validacao do CNPJ conforme o algoritmo oficial
 * de digitos verificadores definido pela Receita Federal do Brasil.
 *
 * O algoritmo, resumidamente:
 *   1. Remove formatacao (pontos, barra, hifen), restando 14 digitos.
 *   2. Rejeita sequencias de digitos repetidos (00000000000000, 1111...,
 *      etc.), que passam matematicamente no calculo mas sao invalidas.
 *   3. Calcula o 1º digito verificador (posicao 13) usando pesos
 *      [5,4,3,2,9,8,7,6,5,4,3,2] sobre os 12 primeiros digitos.
 *   4. Calcula o 2º digito verificador (posicao 14) usando pesos
 *      [6,5,4,3,2,9,8,7,6,5,4,3,2] sobre os 13 primeiros digitos
 *      (incluindo o 1º digito verificador ja calculado).
 *   5. Para cada digito: soma = sum(digito[i] * peso[i]); resto = soma % 11;
 *      digito_verificador = resto < 2 ? 0 : 11 - resto.
 */
export class CnpjUtils {
  /** Remove qualquer caractere que nao seja digito numerico. */
  static normalizar(cnpj: string): string {
    return cnpj.replace(/\D/g, "");
  }

  /** Formata um CNPJ de 14 digitos no padrao XX.XXX.XXX/XXXX-XX. */
  static formatar(cnpj: string): string {
    const limpo = CnpjUtils.normalizar(cnpj);
    if (limpo.length !== 14) return cnpj;
    return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  private static calcularDigito(base: string, pesos: number[]): number {
    const soma = base
      .split("")
      .map((d, i) => Number(d) * pesos[i])
      .reduce((a, b) => a + b, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  /** Retorna true se o CNPJ (com ou sem formatacao) e matematicamente valido. */
  static valido(cnpjEntrada: string): boolean {
    const cnpj = CnpjUtils.normalizar(cnpjEntrada);

    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false; // todos os digitos iguais

    const doze = cnpj.slice(0, 12);
    const pesosPrimeiroDigito = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const primeiroDigito = CnpjUtils.calcularDigito(doze, pesosPrimeiroDigito);

    const treze = doze + String(primeiroDigito);
    const pesosSegundoDigito = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const segundoDigito = CnpjUtils.calcularDigito(treze, pesosSegundoDigito);

    const digitosCalculados = `${primeiroDigito}${segundoDigito}`;
    const digitosInformados = cnpj.slice(12, 14);

    return digitosCalculados === digitosInformados;
  }
}
