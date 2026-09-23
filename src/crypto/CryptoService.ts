import * as crypto from "crypto";

/**
 * CryptoService encapsula a criptografia simetrica exigida pelo enunciado
 * (AES-256) para todos os arquivos de persistencia do sistema.
 *
 * Escolha tecnica: usamos AES-256-GCM (Galois/Counter Mode) em vez de
 * AES-256-CBC "puro". GCM e um modo de operacao autenticado (AEAD): alem
 * de cifrar, ele gera uma "authentication tag" que permite detectar
 * qualquer adulteracao ou corrupcao do arquivo cifrado na leitura -
 * propriedade que o CBC nao oferece nativamente e que e essencial para um
 * sistema que se propoe auditavel e a prova de corrupcao de dados.
 *
 * O formato serializado de cada arquivo cifrado e:
 *   [1 byte versao][12 bytes IV][16 bytes authTag][N bytes ciphertext]
 * armazenado em base64 (para ser texto-seguro em qualquer sistema de
 * arquivos/SO, inclusive Windows).
 */
export class CryptoService {
  private static readonly ALGORITMO = "aes-256-gcm";
  private static readonly TAMANHO_IV = 12; // recomendado para GCM
  private static readonly TAMANHO_TAG = 16;
  private static readonly VERSAO_FORMATO = 1;

  constructor(private readonly chaveMestra: Buffer) {
    if (chaveMestra.length !== 32) {
      throw new Error("A chave mestra deve ter exatamente 32 bytes (256 bits).");
    }
  }

  /** Gera uma nova chave mestra aleatoria de 256 bits. */
  static gerarChaveMestra(): Buffer {
    return crypto.randomBytes(32);
  }

  /** Cifra uma string em texto claro e retorna o payload serializado em base64. */
  cifrar(textoClaro: string): string {
    const iv = crypto.randomBytes(CryptoService.TAMANHO_IV);
    const cipher = crypto.createCipheriv(CryptoService.ALGORITMO, this.chaveMestra, iv);
    const ciphertext = Buffer.concat([cipher.update(textoClaro, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    const payload = Buffer.concat([
      Buffer.from([CryptoService.VERSAO_FORMATO]),
      iv,
      tag,
      ciphertext,
    ]);
    return payload.toString("base64");
  }

  /** Decifra um payload gerado por {@link cifrar}. Lanca erro se a tag de autenticacao nao bater. */
  decifrar(payloadBase64: string): string {
    const payload = Buffer.from(payloadBase64, "base64");

    const versao = payload.readUInt8(0);
    if (versao !== CryptoService.VERSAO_FORMATO) {
      throw new Error(`Versao de formato de criptografia desconhecida: ${versao}`);
    }

    let offset = 1;
    const iv = payload.subarray(offset, offset + CryptoService.TAMANHO_IV);
    offset += CryptoService.TAMANHO_IV;
    const tag = payload.subarray(offset, offset + CryptoService.TAMANHO_TAG);
    offset += CryptoService.TAMANHO_TAG;
    const ciphertext = payload.subarray(offset);

    const decipher = crypto.createDecipheriv(CryptoService.ALGORITMO, this.chaveMestra, iv);
    decipher.setAuthTag(tag);

    try {
      const textoClaro = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return textoClaro.toString("utf8");
    } catch {
      throw new Error(
        "Falha na decriptografia: dado corrompido, adulterado ou chave incorreta (auth tag invalida)."
      );
    }
  }
}
