import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { CryptoService } from "../crypto/CryptoService";

/**
 * AtomicFileStore garante que operacoes de escrita em arquivos de
 * persistencia sejam atomicas: o conteudo e primeiro gravado em um
 * arquivo temporario exclusivo e, somente apos o `fsync` bem-sucedido,
 * o arquivo temporario e renomeado (rename) para o nome final.
 *
 * Por que isso importa: em sistemas de arquivos POSIX e NTFS, a
 * operacao de `rename` para um destino no mesmo volume e atomica do
 * ponto de vista do sistema operacional - ou o arquivo antigo continua
 * intacto, ou o novo arquivo passa a existir por completo. Nunca existe
 * um estado intermediario visivel de "meio escrito". Isso protege o
 * sistema contra corrupcao de dados em caso de queda de energia, kill
 * do processo ou crash durante a escrita (RNF explicito do enunciado).
 */
export class AtomicFileStore {
  /**
   * Escreve texto cifrado em disco de forma atomica.
   * @param caminhoDestino caminho final do arquivo
   * @param conteudoClaro conteudo em texto claro a ser cifrado e persistido
   * @param crypto instancia de CryptoService com a chave mestra ja carregada
   */
  static escreverCifrado(caminhoDestino: string, conteudoClaro: string, cryptoSvc: CryptoService): void {
    const cifrado = cryptoSvc.cifrar(conteudoClaro);
    AtomicFileStore.escreverAtomico(caminhoDestino, cifrado);
  }

  /** Le e decifra um arquivo gravado por {@link escreverCifrado}. */
  static lerCifrado(caminho: string, cryptoSvc: CryptoService): string | null {
    if (!fs.existsSync(caminho)) return null;
    const conteudoCifrado = fs.readFileSync(caminho, "utf8");
    if (conteudoCifrado.trim().length === 0) return null;
    return cryptoSvc.decifrar(conteudoCifrado);
  }

  /**
   * Escreve conteudo em texto claro de forma atomica (usado apenas para
   * arquivos que, por definicao, nao carregam dados sensiveis, como o
   * historico de comandos do readline).
   */
  static escreverAtomico(caminhoDestino: string, conteudo: string): void {
    const dir = path.dirname(caminhoDestino);
    fs.mkdirSync(dir, { recursive: true });

    const nomeTemp = path.join(
      dir,
      `.${path.basename(caminhoDestino)}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`
    );

    const fd = fs.openSync(nomeTemp, "w", 0o600);
    try {
      fs.writeSync(fd, conteudo, null, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    // rename e atomico dentro do mesmo volume/particao (garantia do SO).
    fs.renameSync(nomeTemp, caminhoDestino);
  }

  /** Acrescenta uma linha a um arquivo de append-only (journal) de forma segura. */
  static acrescentarLinha(caminho: string, linha: string): void {
    const dir = path.dirname(caminho);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(caminho, linha + "\n", { encoding: "utf8", mode: 0o600 });
  }
}
