import { Dependencias } from "../repositorios/portas";
import { AutenticacaoServico } from "./AutenticacaoServico";
import { EquipamentoServico } from "./EquipamentoServico";
import { LoteServico } from "./LoteServico";
import { OrganizacaoServico } from "./OrganizacaoServico";
import { ParametroServico } from "./ParametroServico";
import { RelatorioServico } from "./RelatorioServico";
import { UsuarioServico } from "./UsuarioServico";

export interface Servicos {
  autenticacao: AutenticacaoServico;
  usuarios: UsuarioServico;
  parametros: ParametroServico;
  organizacoes: OrganizacaoServico;
  lotes: LoteServico;
  equipamentos: EquipamentoServico;
  relatorios: RelatorioServico;
}

export function criarServicos(dep: Dependencias): Servicos {
  return {
    autenticacao: new AutenticacaoServico(dep),
    usuarios: new UsuarioServico(dep),
    parametros: new ParametroServico(dep),
    organizacoes: new OrganizacaoServico(dep),
    lotes: new LoteServico(dep),
    equipamentos: new EquipamentoServico(dep),
    relatorios: new RelatorioServico(dep),
  };
}
