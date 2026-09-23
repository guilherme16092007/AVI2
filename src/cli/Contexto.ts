import { CryptoService } from "../crypto/CryptoService";
import { JournalManager } from "../persistence/JournalManager";
import { AuthService } from "../auth/AuthService";
import { OrganizacaoRepository } from "../repositories/OrganizacaoRepository";
import { LoteRepository } from "../repositories/LoteRepository";
import { EquipamentoRepository } from "../repositories/EquipamentoRepository";
import { MovimentacaoRepository } from "../repositories/MovimentacaoRepository";
import { UsuarioRepository } from "../repositories/UsuarioRepository";
import { OrganizacaoService } from "../services/OrganizacaoService";
import { LoteService } from "../services/LoteService";
import { EquipamentoService } from "../services/EquipamentoService";
import { ConfigManager } from "../config/ConfigManager";
import { ParametrosGlobais, SessaoAtiva } from "../types";

/**
 * Agrupa todas as dependencias construidas na inicializacao (injecao de
 * dependencia manual/explicita), evitando estado global mutavel
 * espalhado pelo sistema. Cada comando da CLI recebe este contexto e
 * dele extrai apenas o que precisa.
 */
export interface Contexto {
  diretorioDados: string;
  diretorioEstado: string;
  cryptoSvc: CryptoService;
  configManager: ConfigManager;
  parametros: ParametrosGlobais;
  journal: JournalManager;
  authService: AuthService;
  usuarioRepo: UsuarioRepository;
  organizacaoRepo: OrganizacaoRepository;
  loteRepo: LoteRepository;
  equipamentoRepo: EquipamentoRepository;
  movimentacaoRepo: MovimentacaoRepository;
  organizacaoService: OrganizacaoService;
  loteService: LoteService;
  equipamentoService: EquipamentoService;
  /** Sessao atual, preenchida apos login bem sucedido e validada a cada comando. */
  sessao: SessaoAtiva | null;
}
