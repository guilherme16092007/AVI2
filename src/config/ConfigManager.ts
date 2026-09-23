import * as fs from "fs";
import * as path from "path";
import { CryptoService } from "../crypto/CryptoService";
import { AtomicFileStore } from "../persistence/AtomicFileStore";
import { ParametrosGlobais, PARAMETROS_PADRAO } from "../types";

/**
 * ConfigManager cuida do arquivo de configuracao mestre exigido pelo
 * enunciado: na inicializacao, o sistema verifica se ele existe; se
 * nao existir, entra em "modo de provisionamento inicial".
 *
 * Trade-off de seguranca documentado (ver docs/SEGURANCA.md, secao
 * "Protecao da chave mestra"): a chave mestra AES-256 e gerada
 * automaticamente no provisionamento e armazenada em
 * `.greencode/master.key`, com permissoes de arquivo restritas a
 * leitura/escrita apenas pelo dono (chmod 600 em sistemas POSIX). Este
 * e um design deliberado e comum em ferramentas CLI locais (ex.: chaves
 * SSH, tokens de CLIs de nuvem): ele protege os dados contra acesso por
 * OUTROS usuarios do mesmo sistema operacional, mas nao contra um
 * atacante com acesso root/administrador a maquina. Para um ambiente de
 * producao multiusuario real, a evolucao natural (mencionada como
 * proxima etapa) seria integrar um cofre de segredos (HashiCorp Vault,
 * AWS KMS, Azure Key Vault) ou o keychain nativo do SO.
 */
export class ConfigManager {
  private readonly caminhoChave: string;
  private readonly caminhoConfig: string;

  constructor(private readonly diretorioConfig: string) {
    this.caminhoChave = path.join(diretorioConfig, "master.key");
    this.caminhoConfig = path.join(diretorioConfig, "config.enc");
  }

  /** true se o sistema ja foi provisionado (primeira execucao concluida). */
  jaProvisionado(): boolean {
    return fs.existsSync(this.caminhoChave) && fs.existsSync(this.caminhoConfig);
  }

  /** Gera a chave mestra e o arquivo de configuracao inicial. Retorna o CryptoService pronto para uso. */
  provisionar(): CryptoService {
    fs.mkdirSync(this.diretorioConfig, { recursive: true });

    const chaveMestra = CryptoService.gerarChaveMestra();
    fs.writeFileSync(this.caminhoChave, chaveMestra.toString("base64"), { mode: 0o600 });
    try {
      fs.chmodSync(this.caminhoChave, 0o600);
    } catch {
      // chmod pode nao ter efeito pleno no Windows; documentado na secao de seguranca.
    }

    const cryptoSvc = new CryptoService(chaveMestra);
    AtomicFileStore.escreverCifrado(this.caminhoConfig, JSON.stringify(PARAMETROS_PADRAO, null, 2), cryptoSvc);

    return cryptoSvc;
  }

  /** Carrega a chave mestra existente e retorna o CryptoService correspondente. */
  carregarCryptoService(): CryptoService {
    if (!fs.existsSync(this.caminhoChave)) {
      throw new Error(
        "Arquivo de chave mestra nao encontrado. Execute o sistema para iniciar o provisionamento."
      );
    }
    const chaveMestra = Buffer.from(fs.readFileSync(this.caminhoChave, "utf8").trim(), "base64");
    return new CryptoService(chaveMestra);
  }

  lerParametros(cryptoSvc: CryptoService): ParametrosGlobais {
    const conteudo = AtomicFileStore.lerCifrado(this.caminhoConfig, cryptoSvc);
    if (!conteudo) return { ...PARAMETROS_PADRAO };
    return JSON.parse(conteudo) as ParametrosGlobais;
  }

  salvarParametros(parametros: ParametrosGlobais, cryptoSvc: CryptoService): void {
    AtomicFileStore.escreverCifrado(this.caminhoConfig, JSON.stringify(parametros, null, 2), cryptoSvc);
  }
}
