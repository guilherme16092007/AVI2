import * as path from "path";
import { perguntar, perguntarSenhaOculta } from "./utils/TerminalUtils";
import { ConfigManager } from "./config/ConfigManager";
import { JournalManager } from "./persistence/JournalManager";
import { AuthService } from "./auth/AuthService";
import { OrganizacaoRepository } from "./repositories/OrganizacaoRepository";
import { LoteRepository } from "./repositories/LoteRepository";
import { EquipamentoRepository } from "./repositories/EquipamentoRepository";
import { MovimentacaoRepository } from "./repositories/MovimentacaoRepository";
import { UsuarioRepository } from "./repositories/UsuarioRepository";
import { OrganizacaoService } from "./services/OrganizacaoService";
import { LoteService } from "./services/LoteService";
import { EquipamentoService } from "./services/EquipamentoService";
import { Contexto } from "./cli/Contexto";


/**
 * Inicializa o sistema: verifica se ja foi provisionado; caso
 * contrario, executa o fluxo de provisionamento inicial (RF: modo de
 * provisionamento na ausencia do arquivo de configuracao mestre),
 * solicitando a senha do primeiro administrador e gerando
 * automaticamente a chave criptografica mestra.
 */
export async function inicializarContexto(diretorioBase: string): Promise<Contexto> {
  const diretorioDados = path.join(diretorioBase, "data");
  const diretorioEstado = path.join(diretorioBase, ".greencode");

  const configManager = new ConfigManager(diretorioEstado);

  let cryptoSvc;
  let primeiroProvisionamento = false;

  if (!configManager.jaProvisionado()) {
    primeiroProvisionamento = true;
    console.log("=".repeat(70));
    console.log(" GREENCODE - Provisionamento inicial");
    console.log("=".repeat(70));
    console.log(
      "Nenhum arquivo de configuracao mestre foi encontrado.\n" +
        "O sistema entrara em modo de provisionamento inicial:\n" +
        "sera gerada a chave criptografica mestra (AES-256) e criada a\n" +
        "primeira conta de ADMINISTRADOR.\n"
    );
    cryptoSvc = configManager.provisionar();
  } else {
    cryptoSvc = configManager.carregarCryptoService();
  }

  const parametros = configManager.lerParametros(cryptoSvc);

  const journal = new JournalManager(
    diretorioDados,
    cryptoSvc,
    parametros.tamanhoMaximoJournalBytes,
    parametros.retencaoJournalDias
  );

  const usuarioRepo = new UsuarioRepository(diretorioDados, cryptoSvc, journal);
  const organizacaoRepo = new OrganizacaoRepository(diretorioDados, cryptoSvc, journal);
  const loteRepo = new LoteRepository(diretorioDados, cryptoSvc, journal);
  const equipamentoRepo = new EquipamentoRepository(diretorioDados, cryptoSvc, journal);
  const movimentacaoRepo = new MovimentacaoRepository(diretorioDados, cryptoSvc, journal);

  const authService = new AuthService(usuarioRepo, cryptoSvc, diretorioEstado, parametros.timeoutSessaoMinutos);

  if (primeiroProvisionamento) {
    const usernameEnv = process.env.GREENCODE_ADMIN_USER;
    const senhaEnv = process.env.GREENCODE_ADMIN_PASSWORD;

    let username: string;
    let senha: string;

    if (usernameEnv && senhaEnv) {
      // Modo nao interativo: usado por scripts de teste automatizados e
      // pipelines de CI, onde nao ha um terminal (TTY) para responder
      // prompts interativos. Documentado em docs/TESTES.md.
      username = usernameEnv;
      senha = senhaEnv;
      console.log(`Provisionamento nao interativo detectado (GREENCODE_ADMIN_USER/GREENCODE_ADMIN_PASSWORD).`);
    } else {
      username = (await perguntar("Defina o username do administrador [admin]: ")) || "admin";
      senha = "";
      while (senha.length < 8) {
        senha = await perguntarSenhaOculta("Defina a senha do administrador (min. 8 caracteres): ");
        if (senha.length < 8) console.log("Senha muito curta. Tente novamente.");
      }
    }

    authService.criarAdministradorInicial(username, senha);
    console.log(`\nAdministrador '${username}' criado com sucesso. Provisionamento concluido.\n`);
  }

  const organizacaoService = new OrganizacaoService(organizacaoRepo);
  const loteService = new LoteService(loteRepo, organizacaoRepo, parametros);
  const equipamentoService = new EquipamentoService(equipamentoRepo, loteRepo, movimentacaoRepo);

  return {
    diretorioDados,
    diretorioEstado,
    cryptoSvc,
    configManager,
    parametros,
    journal,
    authService,
    usuarioRepo,
    organizacaoRepo,
    loteRepo,
    equipamentoRepo,
    movimentacaoRepo,
    organizacaoService,
    loteService,
    equipamentoService,
    sessao: null,
  };
}
