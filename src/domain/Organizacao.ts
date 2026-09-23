import { Ativo } from "./Ativo";
import { TipoOrganizacao } from "../types";

export interface OrganizacaoProps {
  id?: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  tipo: TipoOrganizacao;
  contatoResponsavel: string;
  emailContato: string;
  diasPrazoArmazenamento: number;
}

/** Organizacao geradora de residuos eletronicos (cliente da plataforma). */
export class Organizacao extends Ativo {
  public cnpj: string;
  public razaoSocial: string;
  public nomeFantasia?: string;
  public tipo: TipoOrganizacao;
  public contatoResponsavel: string;
  public emailContato: string;
  public diasPrazoArmazenamento: number;
  public ativo: boolean;

  constructor(props: OrganizacaoProps) {
    super(props.id);
    this.cnpj = props.cnpj;
    this.razaoSocial = props.razaoSocial;
    this.nomeFantasia = props.nomeFantasia;
    this.tipo = props.tipo;
    this.contatoResponsavel = props.contatoResponsavel;
    this.emailContato = props.emailContato;
    this.diasPrazoArmazenamento = props.diasPrazoArmazenamento;
    this.ativo = true;
  }

  paraJSON(): Record<string, unknown> {
    return {
      id: this.id,
      cnpj: this.cnpj,
      razaoSocial: this.razaoSocial,
      nomeFantasia: this.nomeFantasia,
      tipo: this.tipo,
      contatoResponsavel: this.contatoResponsavel,
      emailContato: this.emailContato,
      diasPrazoArmazenamento: this.diasPrazoArmazenamento,
      ativo: this.ativo,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm,
    };
  }

  static deJSON(obj: Record<string, unknown>): Organizacao {
    const org = new Organizacao({
      id: obj.id as string,
      cnpj: obj.cnpj as string,
      razaoSocial: obj.razaoSocial as string,
      nomeFantasia: obj.nomeFantasia as string | undefined,
      tipo: obj.tipo as TipoOrganizacao,
      contatoResponsavel: obj.contatoResponsavel as string,
      emailContato: obj.emailContato as string,
      diasPrazoArmazenamento: obj.diasPrazoArmazenamento as number,
    });
    org.ativo = obj.ativo as boolean;
    org.atualizadoEm = obj.atualizadoEm as string;
    return org;
  }

  resumo(): string {
    return `${this.id}  ${this.cnpj}  ${this.razaoSocial} [${this.tipo}]`;
  }
}
