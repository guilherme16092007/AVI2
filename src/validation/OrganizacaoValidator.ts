import { Validator } from "./Validator";
import { CnpjUtils } from "./CnpjValidator";
import { OrganizacaoProps } from "../domain/Organizacao";

export interface ContextoValidacaoOrganizacao {
  props: OrganizacaoProps;
  cnpjJaCadastrado: boolean;
}

/**
 * Validador de regras de negocio para cadastro de Organizacao.
 * RN: unicidade de CNPJ com digitos verificadores validos conforme
 * legislacao brasileira.
 */
export class OrganizacaoValidator extends Validator<ContextoValidacaoOrganizacao> {
  protected regras(): Array<(ctx: ContextoValidacaoOrganizacao) => string | null> {
    return [
      (ctx) => (!ctx.props.cnpj ? "CNPJ e obrigatorio." : null),
      (ctx) =>
        ctx.props.cnpj && !CnpjUtils.valido(ctx.props.cnpj)
          ? `CNPJ '${ctx.props.cnpj}' invalido (digitos verificadores nao conferem).`
          : null,
      (ctx) => (ctx.cnpjJaCadastrado ? "Ja existe uma organizacao cadastrada com este CNPJ." : null),
      (ctx) => (!ctx.props.razaoSocial || ctx.props.razaoSocial.trim().length < 3
        ? "Razao social deve ter ao menos 3 caracteres."
        : null),
      (ctx) => (!ctx.props.contatoResponsavel ? "Contato responsavel e obrigatorio." : null),
      (ctx) =>
        !ctx.props.emailContato || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ctx.props.emailContato)
          ? "E-mail de contato invalido."
          : null,
      (ctx) =>
        ctx.props.diasPrazoArmazenamento !== undefined && ctx.props.diasPrazoArmazenamento < 0
          ? "Prazo de armazenamento nao pode ser negativo."
          : null,
    ];
  }
}
