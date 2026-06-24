// BUILD: 1782266000
import { createClient } from './supabase'

export type Permissao = {
  tela: string
  visualizar: boolean
  criar: boolean
  alterar: boolean
  excluir: boolean
}

export const TELAS = [
  { key:'dashboard',      label:'Dashboard'     },
  { key:'agenda',         label:'Agenda'        },
  { key:'agenda_wpp',     label:'Agenda - WPP'  },
  { key:'clientes',       label:'Clientes'      },
  { key:'profissionais',  label:'Profissionais' },
  { key:'servicos',       label:'Servicos'      },
  { key:'financeiro',     label:'Financeiro'    },
  { key:'mensagens',      label:'Mensagens WPP'        },
  { key:'usuarios',       label:'Usuarios'             },
  { key:'configuracoes',  label:'Configuracoes'         },
  { key:'rel_profissional', label:'Rel. Profissionais'  },
]

// ============================================================
// Padroes hardcoded — fallback se nao houver padrao salvo no DB para a empresa
// ============================================================

// Nivel usuario: so ve e agenda para o profissional vinculado a ele
export const PERM_PADRAO_USUARIO: Record<string, Permissao> = {
  dashboard:     { tela:'dashboard',     visualizar:true,  criar:false, alterar:false, excluir:false },
  agenda:        { tela:'agenda',        visualizar:true,  criar:true,  alterar:false, excluir:false },
  agenda_wpp:    { tela:'agenda_wpp',    visualizar:false, criar:false, alterar:false, excluir:false },
  clientes:      { tela:'clientes',      visualizar:false, criar:false, alterar:false, excluir:false },
  profissionais: { tela:'profissionais', visualizar:false, criar:false, alterar:false, excluir:false },
  servicos:      { tela:'servicos',      visualizar:false, criar:false, alterar:false, excluir:false },
  financeiro:    { tela:'financeiro',    visualizar:false, criar:false, alterar:false, excluir:false },
  mensagens:     { tela:'mensagens',     visualizar:false, criar:false, alterar:false, excluir:false },
  usuarios:      { tela:'usuarios',      visualizar:false, criar:false, alterar:false, excluir:false },
  configuracoes: { tela:'configuracoes', visualizar:false, criar:false, alterar:false, excluir:false },
  rel_profissional: { tela:'rel_profissional', visualizar:false, criar:false, alterar:false, excluir:false },
}

// Nivel profissional: ve agenda de todos, pode criar/alterar, nao exclui
export const PERM_PADRAO_PROFISSIONAL: Record<string, Permissao> = {
  dashboard:     { tela:'dashboard',     visualizar:true,  criar:false, alterar:false, excluir:false },
  agenda:        { tela:'agenda',        visualizar:true,  criar:true,  alterar:true,  excluir:false },
  agenda_wpp:    { tela:'agenda_wpp',    visualizar:false, criar:false, alterar:false, excluir:false },
  clientes:      { tela:'clientes',      visualizar:true,  criar:true,  alterar:true,  excluir:false },
  profissionais: { tela:'profissionais', visualizar:true,  criar:false, alterar:false, excluir:false },
  servicos:      { tela:'servicos',      visualizar:true,  criar:false, alterar:false, excluir:false },
  financeiro:    { tela:'financeiro',    visualizar:false, criar:false, alterar:false, excluir:false },
  mensagens:     { tela:'mensagens',     visualizar:false, criar:false, alterar:false, excluir:false },
  usuarios:      { tela:'usuarios',      visualizar:false, criar:false, alterar:false, excluir:false },
  configuracoes: { tela:'configuracoes', visualizar:false, criar:false, alterar:false, excluir:false },
  rel_profissional: { tela:'rel_profissional', visualizar:false, criar:false, alterar:false, excluir:false },
}

// Nivel admin: acesso total exceto exclusao de usuarios
export const PERM_PADRAO_ADMIN: Record<string, Permissao> = {
  dashboard:     { tela:'dashboard',     visualizar:true,  criar:false, alterar:false, excluir:false },
  agenda:        { tela:'agenda',        visualizar:true,  criar:true,  alterar:true,  excluir:true  },
  agenda_wpp:    { tela:'agenda_wpp',    visualizar:true,  criar:false, alterar:false, excluir:false },
  clientes:      { tela:'clientes',      visualizar:true,  criar:true,  alterar:true,  excluir:true  },
  profissionais: { tela:'profissionais', visualizar:true,  criar:true,  alterar:true,  excluir:true  },
  servicos:      { tela:'servicos',      visualizar:true,  criar:true,  alterar:true,  excluir:true  },
  financeiro:    { tela:'financeiro',    visualizar:true,  criar:true,  alterar:true,  excluir:true  },
  mensagens:     { tela:'mensagens',     visualizar:true,  criar:true,  alterar:true,  excluir:false },
  usuarios:      { tela:'usuarios',      visualizar:true,  criar:true,  alterar:true,  excluir:false },
  configuracoes: { tela:'configuracoes', visualizar:true,  criar:true,  alterar:true,  excluir:false },
  rel_profissional: { tela:'rel_profissional', visualizar:true,  criar:false, alterar:false, excluir:false },
}

// Retorna o padrao hardcoded para o nivel de acesso (fallback final)
export function permPadrao(nivel: string): Record<string, Permissao> {
  if (nivel === 'admin')        return PERM_PADRAO_ADMIN
  if (nivel === 'profissional') return PERM_PADRAO_PROFISSIONAL
  if (nivel === 'usuario')      return PERM_PADRAO_USUARIO
  return PERM_PADRAO_ADMIN
}

// ============================================================
// Permissoes individuais por usuario (tabela permissoes_usuario)
// ============================================================

export async function buscarPermissoes(usuarioId: string): Promise<Record<string, Permissao>> {
  const sb = createClient()
  const { data } = await sb
    .from('permissoes_usuario')
    .select('tela, visualizar, criar, alterar, excluir')
    .eq('usuario_id', usuarioId)
  if (!data || data.length === 0) return {}
  const map: Record<string, Permissao> = {}
  data.forEach((p: any) => { map[p.tela] = p })
  return map
}

export async function salvarPermissoes(
  usuarioId: string,
  empresaId: string,
  permissoes: Permissao[]
): Promise<{ error: any }> {
  const sb = createClient()
  await sb.from('permissoes_usuario').delete().eq('usuario_id', usuarioId)
  const { error } = await sb.from('permissoes_usuario').insert(
    permissoes.map(p => ({
      usuario_id: usuarioId,
      empresa_id: empresaId,
      tela:       p.tela,
      visualizar: p.visualizar,
      criar:      p.criar,
      alterar:    p.alterar,
      excluir:    p.excluir,
    }))
  )
  return { error }
}

// ============================================================
// NOVO: Padroes configuraveis por empresa (tabela permissoes_padrao)
// O master define os padroes; eles aparecem como sugestao na tela de Permissoes de Usuario
// ============================================================

/**
 * Busca o padrao configurado pelo master para uma empresa + nivel.
 * Se a empresa nao tem padrao salvo, cai no padrao hardcoded (permPadrao).
 * Garante que todas as TELAS estejam presentes no resultado.
 */
export async function buscarPadraoEmpresa(
  empresaId: string,
  nivel: string
): Promise<Record<string, Permissao>> {
  const hardcoded = permPadrao(nivel)
  if (!empresaId) return hardcoded
  const sb = createClient()
  const { data } = await sb
    .from('permissoes_padrao')
    .select('tela, visualizar, criar, alterar, excluir')
    .eq('empresa_id', empresaId)
    .eq('nivel_acesso', nivel)
  if (!data || data.length === 0) return hardcoded
  const map: Record<string, Permissao> = {}
  data.forEach((p: any) => { map[p.tela] = p })
  // Preenche telas que nao foram salvas no DB com o padrao hardcoded
  for (const t of TELAS) {
    if (!map[t.key]) {
      map[t.key] = hardcoded[t.key] || { tela:t.key, visualizar:false, criar:false, alterar:false, excluir:false }
    }
  }
  return map
}

/**
 * Salva o padrao configurado pelo master para uma empresa + nivel.
 * Faz delete + insert (substitui inteiro).
 */
export async function salvarPadraoEmpresa(
  empresaId: string,
  nivel: string,
  permissoes: Permissao[]
): Promise<{ error: any }> {
  const sb = createClient()
  await sb.from('permissoes_padrao')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('nivel_acesso', nivel)
  const { error } = await sb.from('permissoes_padrao').insert(
    permissoes.map(p => ({
      empresa_id:   empresaId,
      nivel_acesso: nivel,
      tela:         p.tela,
      visualizar:   p.visualizar,
      criar:        p.criar,
      alterar:      p.alterar,
      excluir:      p.excluir,
    }))
  )
  return { error }
}
