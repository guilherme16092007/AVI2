import { Contexto } from "../cli/Contexto";
import { ComandoAnalisado, CommandParser } from "../cli/CommandParser";
import { Severidade, ResultadoOperacao, TipoOrganizacao } from "../types";

export function criarOrganizacao(ctx: Contexto, cmd: ComandoAnalisado): ResultadoOperacao {
  const cnpj = CommandParser.exigirFlag(cmd, "cnpj");
  const razaoSocial = CommandParser.exigirFlag(cmd, "razao");
  const tipoStr = CommandParser.exigirFlag(cmd, "tipo").toUpperCase();
  const contatoResponsavel = CommandParser.exigirFlag(cmd, "contato");
  const emailContato = CommandParser.exigirFlag(cmd, "email");
  const prazoStr = CommandParser.flagOpcional(cmd, "prazo", "30");
  const nomeFantasia = CommandParser.flagOpcional(cmd, "fantasia");

  if (!Object.values(TipoOrganizacao).includes(tipoStr as TipoOrganizacao)) {
    return {
      ok: false,
      severidade: Severidade.ERRO,
      mensagem: `Tipo invalido: '${tipoStr}'. Valores aceitos: ${Object.values(TipoOrganizacao).join(", ")}.`,
    };
  }

  const organizacao = ctx.organizacaoService.cadastrar(
    {
      cnpj,
      razaoSocial,
      nomeFantasia,
      tipo: tipoStr as TipoOrganizacao,
      contatoResponsavel,
      emailContato,
      diasPrazoArmazenamento: Number(prazoStr),
    },
    ctx.sessao!.usuarioId
  );

  return {
    ok: true,
    severidade: Severidade.SUCESSO,
    mensagem: `Organizacao '${organizacao.razaoSocial}' cadastrada com id ${organizacao.id}.`,
    dados: organizacao.paraJSON(),
  };
}

export function listarOrganizacoes(ctx: Contexto): ResultadoOperacao {
  const organizacoes = ctx.organizacaoService.listar();
  return {
    ok: true,
    severidade: Severidade.INFO,
    mensagem: `${organizacoes.length} organizacao(oes) cadastrada(s).`,
    dados: organizacoes.map((o) => o.resumo()),
  };
}
