import * as fs from "fs";
import * as path from "path";
import { CryptoService } from "../crypto/CryptoService";
import { AtomicFileStore } from "./AtomicFileStore";

/** Um registro individual do journal (log de transacoes). */
export interface EntradaJournal {
  id: string;
  timestamp: string; // ISO 8601
  usuarioId: string | null;
  entidade: string; // ex: "Lote", "Equipamento"
  operacao: string; // ex: "CRIAR", "ATUALIZAR_STATUS"
  entidadeId: string;
  antes: unknown;
  depois: unknown;
}

/**
 * JournalManager implementa o mecanismo de journaling (write-ahead log)
 * exigido pelo enunciado: toda transacao e registrada em um log imutavel
 * ANTES de ser aplicada ao estado corrente, garantindo rastreabilidade e
 * possibilidade de recuperacao em caso de falhas.
 *
 * Politicas implementadas:
 *  - Rotacao automatica quando journal.log ultrapassa o tamanho configurado
 *    (padrao 10 MB): o arquivo corrente e renomeado para
 *    journal-<timestampISO>.log e um novo journal.log vazio é iniciado.
 *  - Retencao minima de 180 dias: arquivos rotacionados mais antigos que
 *    a retencao configurada sao elegiveis para expurgo via
 *    {@link expurgarAntigos}, que deve ser executado periodicamente
 *    (ex.: por um comando de administracao, ou automaticamente a cada
 *    rotacao).
 *  - Cada linha do journal e cifrada individualmente com AES-256-GCM,
 *    consistente com a exigencia de que dados de movimentacao sejam
 *    protegidos.
 */
export class JournalManager {
  constructor(
    private readonly diretorio: string,
    private readonly cryptoSvc: CryptoService,
    private readonly tamanhoMaximoBytes: number,
    private readonly retencaoDias: number
  ) {
    fs.mkdirSync(this.diretorio, { recursive: true });
  }

  private get caminhoJournalAtual(): string {
    return path.join(this.diretorio, "journal.log");
  }

  /**
   * Registra uma entrada no journal ANTES de retornar o controle ao
   * chamador, que so entao deve persistir o novo estado nos repositorios.
   * Isso garante a semantica de write-ahead log.
   */
  registrar(entrada: Omit<EntradaJournal, "timestamp">): EntradaJournal {
    this.rotacionarSeNecessario();

    const completa: EntradaJournal = {
      ...entrada,
      timestamp: new Date().toISOString(),
    };

    const linhaCifrada = this.cryptoSvc.cifrar(JSON.stringify(completa));
    AtomicFileStore.acrescentarLinha(this.caminhoJournalAtual, linhaCifrada);

    return completa;
  }

  /** Rotaciona o journal atual se ele exceder o tamanho maximo configurado. */
  private rotacionarSeNecessario(): void {
    if (!fs.existsSync(this.caminhoJournalAtual)) return;

    const stat = fs.statSync(this.caminhoJournalAtual);
    if (stat.size < this.tamanhoMaximoBytes) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destino = path.join(this.diretorio, `journal-${timestamp}.log`);
    fs.renameSync(this.caminhoJournalAtual, destino);

    // Aproveita a rotacao para tambem expurgar arquivos vencidos.
    this.expurgarAntigos();
  }

  /**
   * Remove arquivos de journal rotacionados cuja data (extraida do nome
   * do arquivo) seja mais antiga que a politica de retencao configurada
   * (minimo de 180 dias, conforme enunciado). O journal.log corrente
   * NUNCA e removido por esta rotina.
   */
  expurgarAntigos(): string[] {
    const removidos: string[] = [];
    const limiteMs = this.retencaoDias * 24 * 60 * 60 * 1000;
    const agora = Date.now();

    const arquivos = fs.readdirSync(this.diretorio).filter((f) => /^journal-.*\.log$/.test(f));

    for (const arquivo of arquivos) {
      const caminhoCompleto = path.join(this.diretorio, arquivo);
      const stat = fs.statSync(caminhoCompleto);
      if (agora - stat.mtimeMs > limiteMs) {
        fs.unlinkSync(caminhoCompleto);
        removidos.push(arquivo);
      }
    }

    return removidos;
  }

  /** Le e decifra todas as entradas do journal corrente (uso em auditoria/testes). */
  lerJournalAtual(): EntradaJournal[] {
    if (!fs.existsSync(this.caminhoJournalAtual)) return [];

    const conteudo = fs.readFileSync(this.caminhoJournalAtual, "utf8");
    const linhas = conteudo.split("\n").filter((l) => l.trim().length > 0);

    return linhas.map((linha) => JSON.parse(this.cryptoSvc.decifrar(linha)) as EntradaJournal);
  }

  /** Lista todos os arquivos de journal (ativo + rotacionados), do mais antigo ao mais recente. */
  listarArquivos(): string[] {
    const arquivos = fs.readdirSync(this.diretorio).filter((f) => /^journal(-.*)?\.log$/.test(f));
    return arquivos.sort();
  }
}
