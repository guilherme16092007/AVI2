import { Papel } from "../../types";
import { ErroPermissao } from "../erros";

export interface Ator {
  id: string;
  username: string;
  papel: Papel;
}

export const PERMISSOES = {
  usuarioCriar: [Papel.ADMINISTRADOR],
  usuarioListar: [Papel.ADMINISTRADOR, Papel.AUDITOR],
  parametroVer: [Papel.ADMINISTRADOR, Papel.AUDITOR],
  parametroDefinir: [Papel.ADMINISTRADOR],
  organizacaoCriar: [Papel.ADMINISTRADOR, Papel.OPERADOR_CADASTRO],
  contratoGerenciar: [Papel.ADMINISTRADOR, Papel.OPERADOR_CADASTRO],
  loteCriar: [Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO],
  equipamentoOperar: [Papel.ADMINISTRADOR, Papel.GESTOR_ALMOXARIFADO],
  relatorioValor: [Papel.ADMINISTRADOR, Papel.AUDITOR],
} as const satisfies Record<string, readonly Papel[]>;

export function exigirPapel(ator: Ator, permitidos: readonly Papel[]): void {
  if (!permitidos.includes(ator.papel)) {
    throw new ErroPermissao(
      `Acesso negado: a operacao exige um dos papeis [${permitidos.join(", ")}], mas o usuario '${ator.username}' possui o papel '${ator.papel}'.`
    );
  }
}
