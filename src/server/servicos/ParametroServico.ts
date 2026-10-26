import { ErroValidacao } from "../../types";
import { Dependencias } from "../repositorios/portas";
import { paraParametroDto, ParametroDto } from "./dto";
import { Ator, exigirPapel, PERMISSOES } from "./politicas";
import { conferirVersao } from "./util";

export interface DefinirParametrosEntrada {
  aliquotaImpostoPercentual?: number;
  coeficienteDepreciacaoAnual?: number;
  limiteDiasRetroativosLote?: number;
  versao?: number;
}

export class ParametroServico {
  constructor(private readonly dep: Dependencias) {}

  async obter(ator: Ator): Promise<ParametroDto> {
    exigirPapel(ator, PERMISSOES.parametroVer);
    return paraParametroDto(await this.dep.repos.parametros.obter());
  }

  async definir(ator: Ator, entrada: DefinirParametrosEntrada): Promise<ParametroDto> {
    exigirPapel(ator, PERMISSOES.parametroDefinir);

    const { aliquotaImpostoPercentual: aliquota, coeficienteDepreciacaoAnual: depreciacao, limiteDiasRetroativosLote: limite } = entrada;
    if (aliquota === undefined && depreciacao === undefined && limite === undefined) {
      throw new ErroValidacao("Informe ao menos um parametro para alterar.");
    }
    if (aliquota !== undefined && !(aliquota >= 0 && aliquota <= 100)) {
      throw new ErroValidacao("aliquotaImpostoPercentual deve estar entre 0 e 100.", ["aliquotaImpostoPercentual"]);
    }
    if (depreciacao !== undefined && !(depreciacao >= 0 && depreciacao <= 100)) {
      throw new ErroValidacao("coeficienteDepreciacaoAnual deve estar entre 0 e 100.", ["coeficienteDepreciacaoAnual"]);
    }
    if (limite !== undefined && !(Number.isInteger(limite) && limite >= 1 && limite <= 3650)) {
      throw new ErroValidacao("limiteDiasRetroativosLote deve ser um inteiro entre 1 e 3650.", ["limiteDiasRetroativosLote"]);
    }

    const atual = await this.dep.repos.parametros.obter();
    conferirVersao(atual.versao, entrada.versao, "Parametros");

    const atualizado = await this.dep.repos.parametros.atualizarComVersao(atual.versao, {
      aliquotaImpostoPercentual: aliquota,
      coeficienteDepreciacaoAnual: depreciacao,
      limiteDiasRetroativosLote: limite,
    });
    return paraParametroDto(atualizado);
  }
}
