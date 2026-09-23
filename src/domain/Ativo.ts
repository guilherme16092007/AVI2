import * as crypto from "crypto";

/**
 * Classe abstrata base de toda entidade persistida no sistema.
 *
 * Demonstra o uso de heranca pedido no enunciado: todas as entidades de
 * dominio (Organizacao, Lote, Equipamento, Usuario, Movimentacao)
 * estendem `Ativo` e herdam identidade, timestamps e o contrato
 * `paraJSON`/`resumo`, que cada subclasse deve implementar (polimorfismo).
 */
export abstract class Ativo {
  public readonly id: string;
  public readonly criadoEm: string;
  public atualizadoEm: string;

  protected constructor(id?: string) {
    this.id = id ?? Ativo.gerarId();
    this.criadoEm = new Date().toISOString();
    this.atualizadoEm = this.criadoEm;
  }

  protected static gerarId(): string {
    return crypto.randomUUID();
  }

  protected tocar(): void {
    this.atualizadoEm = new Date().toISOString();
  }

  /** Cada subclasse define sua propria serializacao para persistencia (polimorfismo). */
  abstract paraJSON(): Record<string, unknown>;

  /** Representacao textual curta e amigavel, usada em listagens de CLI (polimorfismo). */
  abstract resumo(): string;
}
