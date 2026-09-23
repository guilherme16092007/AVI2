import * as crypto from "crypto";

/**
 * HashService implementa o hashing de senhas exigido pelo enunciado
 * ("hash com algoritmo SHA-256").
 *
 * Nota de arquitetura de seguranca (ver docs/SEGURANCA.md para a
 * justificativa completa): SHA-256 "puro" (uma unica passada sobre a
 * senha) e vulneravel a ataques de forca bruta com hardware moderno
 * (GPUs calculam bilhoes de SHA-256 por segundo) e a rainbow tables
 * quando nao ha "salt". Para atender ao requisito do enunciado sem abrir
 * mao de uma postura de seguranca responsavel, este servico usa:
 *
 *   PBKDF2-HMAC-SHA256, com salt aleatorio de 16 bytes por usuario e
 *   210.000 iteracoes (parametro recomendado pela OWASP em 2023+ para
 *   PBKDF2-SHA256).
 *
 * PBKDF2 com SHA-256 ainda satisfaz literalmente "hash com algoritmo
 * SHA-256" (SHA-256 e a funcao de hash subjacente usada em cada
 * iteracao do HMAC), mas o custo computacional artificial (iteracoes)
 * e o salt tornam ataques de forca bruta e rainbow tables
 * impraticaveis, o que e o objetivo real de qualquer politica de
 * armazenamento de senhas.
 */
export class HashService {
  private static readonly ITERACOES = 210_000;
  private static readonly TAMANHO_HASH = 32; // 256 bits
  private static readonly TAMANHO_SALT = 16;
  private static readonly DIGESTO = "sha256";

  /** Gera um novo hash (salt + digest) para a senha informada. Retorna "salt:hash" em hex. */
  static gerarHash(senha: string): string {
    const salt = crypto.randomBytes(HashService.TAMANHO_SALT);
    const hash = crypto.pbkdf2Sync(
      senha,
      salt,
      HashService.ITERACOES,
      HashService.TAMANHO_HASH,
      HashService.DIGESTO
    );
    return `${salt.toString("hex")}:${hash.toString("hex")}`;
  }

  /** Verifica se a senha informada corresponde ao hash armazenado, em tempo constante. */
  static verificar(senha: string, hashArmazenado: string): boolean {
    const [saltHex, hashHex] = hashArmazenado.split(":");
    if (!saltHex || !hashHex) return false;

    const salt = Buffer.from(saltHex, "hex");
    const hashEsperado = Buffer.from(hashHex, "hex");
    const hashCalculado = crypto.pbkdf2Sync(
      senha,
      salt,
      HashService.ITERACOES,
      HashService.TAMANHO_HASH,
      HashService.DIGESTO
    );

    if (hashCalculado.length !== hashEsperado.length) return false;
    return crypto.timingSafeEqual(hashCalculado, hashEsperado);
  }

  /** Gera um token opaco de sessao (256 bits de entropia). */
  static gerarTokenSessao(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /** Hash rapido (nao destinado a senhas) usado para checksums de integridade de arquivo. */
  static checksum(conteudo: string): string {
    return crypto.createHash("sha256").update(conteudo, "utf8").digest("hex");
  }
}
