import * as path from "path";
import * as crypto from "crypto";
import { CryptoService } from "../crypto/CryptoService";
import { AtomicFileStore } from "../persistence/AtomicFileStore";
import { JournalManager } from "../persistence/JournalManager";
import { Ativo } from "../domain/Ativo";
import { ErroDominio } from "../types";

/**
 * Repositorio generico abstrato (RF implicito de arquitetura em
 * camadas). Cada repositorio concreto (OrganizacaoRepository,
 * LoteRepository, etc.) define apenas o nome do arquivo de persistencia
 * e as funcoes de (de)serializacao especificas da sua entidade,
 * herdando toda a logica de:
 *   - leitura/escrita atomica cifrada com AES-256 (via AtomicFileStore);
 *   - registro previo de cada mutacao no journal (write-ahead log) antes
 *     de persistir o novo estado, conforme exigido pelo enunciado.
 *
 * Estrategia de concorrencia: cada operacao de escrita le o arquivo
 * inteiro, aplica a mutacao em memoria e regrava o arquivo inteiro de
 * forma atomica. Isso e adequado ao escopo de uma CLI de uso
 * predominantemente sequencial/monousuario por processo; a atomicidade
 * do `rename` garante que o arquivo nunca fica corrompido mesmo que o
 * processo seja interrompido no meio da escrita.
 */
export abstract class BaseRepository<T extends Ativo> {
  protected constructor(
    private readonly diretorioDados: string,
    private readonly nomeArquivo: string,
    private readonly nomeEntidade: string,
    private readonly cryptoSvc: CryptoService,
    private readonly journal: JournalManager
  ) {}

  protected abstract paraObjeto(entidade: T): Record<string, unknown>;
  protected abstract deObjeto(obj: Record<string, unknown>): T;

  private get caminhoArquivo(): string {
    return path.join(this.diretorioDados, this.nomeArquivo);
  }

  /** Carrega todas as entidades persistidas (decifrando o arquivo). */
  listarTodos(): T[] {
    const conteudo = AtomicFileStore.lerCifrado(this.caminhoArquivo, this.cryptoSvc);
    if (!conteudo) return [];
    const bruto = JSON.parse(conteudo) as Record<string, unknown>[];
    return bruto.map((obj) => this.deObjeto(obj));
  }

  buscarPorId(id: string): T | null {
    return this.listarTodos().find((e) => e.id === id) ?? null;
  }

  private persistirTodos(lista: T[]): void {
    const bruto = lista.map((e) => this.paraObjeto(e));
    AtomicFileStore.escreverCifrado(this.caminhoArquivo, JSON.stringify(bruto, null, 2), this.cryptoSvc);
  }

  /**
   * Insere uma nova entidade. Registra a mutacao no journal ANTES de
   * persistir o novo estado (semantica de write-ahead log).
   */
  inserir(entidade: T, usuarioId: string | null): T {
    this.journal.registrar({
      id: crypto.randomUUID(),
      usuarioId,
      entidade: this.nomeEntidade,
      operacao: "CRIAR",
      entidadeId: entidade.id,
      antes: null,
      depois: this.paraObjeto(entidade),
    });

    const lista = this.listarTodos();
    lista.push(entidade);
    this.persistirTodos(lista);
    return entidade;
  }

  /**
   * Atualiza uma entidade existente via funcao de mutacao. Registra o
   * estado "antes" e "depois" no journal antes de persistir.
   */
  atualizar(id: string, mutador: (entidade: T) => void, usuarioId: string | null, operacao = "ATUALIZAR"): T {
    const lista = this.listarTodos();
    const indice = lista.findIndex((e) => e.id === id);
    if (indice === -1) {
      throw new ErroDominio(`${this.nomeEntidade} com id '${id}' nao encontrado(a).`);
    }

    const antes = this.paraObjeto(lista[indice]);
    mutador(lista[indice]);
    const depois = this.paraObjeto(lista[indice]);

    this.journal.registrar({
      id: crypto.randomUUID(),
      usuarioId,
      entidade: this.nomeEntidade,
      operacao,
      entidadeId: id,
      antes,
      depois,
    });

    this.persistirTodos(lista);
    return lista[indice];
  }

  contar(): number {
    return this.listarTodos().length;
  }
}

