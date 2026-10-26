import { Paginacao } from "../repositorios/portas";
import { Servicos } from "../servicos";
import { normalizarPaginacao } from "../servicos/util";

export interface OpcoesController {
  servicos: Servicos;
}

export interface ConsultaPaginada {
  limite?: number;
  offset?: number;
}

export function paginacaoDe(consulta: ConsultaPaginada): Paginacao {
  return normalizarPaginacao(consulta);
}
