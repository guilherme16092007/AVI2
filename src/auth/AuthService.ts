import * as fs from "fs";
import * as path from "path";
import { HashService } from "../crypto/HashService";
import { CryptoService } from "../crypto/CryptoService";
import { AtomicFileStore } from "../persistence/AtomicFileStore";
import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { Usuario } from "../domain/Usuario";
import { Papel, SessaoAtiva, ErroAutenticacao, ErroValidacao } from "../types";

/**
 * AuthService concentra autenticacao (login/logout), gestao de sessao
 * com expiracao por inatividade (RF: 30 minutos) e autorizacao por
 * papel (RF: segregacao de responsabilidades entre os 4 papeis).
 *
 * A sessao ativa e persistida em `.greencode/session.json`, cifrada com
 * a mesma chave mestra dos demais dados, permitindo que o usuario
 * execute varios comandos da CLI em invocacoes de processo separadas
 * (`greencode lote criar ...`, depois `greencode lote listar`) sem
 * precisar reautenticar a cada comando, respeitando o timeout de
 * inatividade - de forma similar ao "sudo timestamp" do Linux.
 */
export class AuthService {
  private readonly caminhoSessao: string;

  constructor(
    private readonly usuarioRepo: UsuarioRepository,
    private readonly cryptoSvc: CryptoService,
    diretorioEstado: string,
    private readonly timeoutInatividadeMinutos: number = 30
  ) {
    this.caminhoSessao = path.join(diretorioEstado, "session.json");
  }

  /** Usado apenas durante o provisionamento inicial, para criar a primeira conta ADMINISTRADOR. */
  criarAdministradorInicial(username: string, senha: string): Usuario {
    AuthService.validarForcaSenha(senha);
    const usuario = new Usuario({
      username,
      papel: Papel.ADMINISTRADOR,
      senhaHash: HashService.gerarHash(senha),
    });
    return this.usuarioRepo.inserir(usuario, null);
  }

  criarUsuario(username: string, senha: string, papel: Papel, usuarioIdCriador: string): Usuario {
    if (this.usuarioRepo.existeUsername(username)) {
      throw new ErroValidacao(`Ja existe um usuario com o username '${username}'.`);
    }
    AuthService.validarForcaSenha(senha);
    const usuario = new Usuario({
      username,
      papel,
      senhaHash: HashService.gerarHash(senha),
    });
    return this.usuarioRepo.inserir(usuario, usuarioIdCriador);
  }

  private static validarForcaSenha(senha: string): void {
    if (!senha || senha.length < 8) {
      throw new ErroValidacao("A senha deve ter no minimo 8 caracteres.");
    }
  }

  /** Autentica o usuario e cria/persiste uma nova sessao. */
  login(username: string, senha: string): SessaoAtiva {
    const usuario = this.usuarioRepo.buscarPorUsername(username);
    if (!usuario || !usuario.ativo) {
      throw new ErroAutenticacao("Usuario ou senha invalidos.");
    }
    if (!HashService.verificar(senha, usuario.senhaHash)) {
      throw new ErroAutenticacao("Usuario ou senha invalidos.");
    }

    this.usuarioRepo.atualizar(
      usuario.id,
      (u) => u.registrarLogin(),
      usuario.id,
      "LOGIN"
    );

    const agora = new Date().toISOString();
    const sessao: SessaoAtiva = {
      token: HashService.gerarTokenSessao(),
      usuarioId: usuario.id,
      username: usuario.username,
      papel: usuario.papel,
      criadaEm: agora,
      ultimaAtividade: agora,
    };

    this.persistirSessao(sessao);
    return sessao;
  }

  logout(): void {
    if (fs.existsSync(this.caminhoSessao)) {
      fs.unlinkSync(this.caminhoSessao);
    }
  }

  /**
   * Recupera a sessao ativa, validando o timeout de inatividade.
   * Se valida, atualiza `ultimaAtividade` (renova o timeout) e
   * repersiste. Se expirada ou inexistente, lanca ErroAutenticacao.
   */
  sessaoAtual(): SessaoAtiva {
    if (!fs.existsSync(this.caminhoSessao)) {
      throw new ErroAutenticacao("Nenhuma sessao ativa. Faca login com: greencode login --user <usuario>");
    }

    const conteudo = AtomicFileStore.lerCifrado(this.caminhoSessao, this.cryptoSvc);
    if (!conteudo) {
      throw new ErroAutenticacao("Sessao invalida. Faca login novamente.");
    }

    const sessao = JSON.parse(conteudo) as SessaoAtiva;
    const ultimaAtividadeMs = new Date(sessao.ultimaAtividade).getTime();
    const limiteMs = this.timeoutInatividadeMinutos * 60 * 1000;

    if (Date.now() - ultimaAtividadeMs > limiteMs) {
      this.logout();
      throw new ErroAutenticacao(
        `Sessao expirada por inatividade (limite de ${this.timeoutInatividadeMinutos} minutos). Faca login novamente.`
      );
    }

    sessao.ultimaAtividade = new Date().toISOString();
    this.persistirSessao(sessao);
    return sessao;
  }

  /** Lanca ErroAutenticacao se o papel da sessao nao estiver entre os papeis permitidos. */
  exigirPapel(sessao: SessaoAtiva, papeisPermitidos: Papel[]): void {
    if (!papeisPermitidos.includes(sessao.papel)) {
      throw new ErroAutenticacao(
        `Acesso negado: a operacao exige um dos papeis [${papeisPermitidos.join(", ")}], ` +
          `mas o usuario '${sessao.username}' possui o papel '${sessao.papel}'.`
      );
    }
  }

  private persistirSessao(sessao: SessaoAtiva): void {
    AtomicFileStore.escreverCifrado(this.caminhoSessao, JSON.stringify(sessao), this.cryptoSvc);
  }
}
