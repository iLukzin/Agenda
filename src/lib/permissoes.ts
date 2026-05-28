// BUILD: 1779992105
// ============================================================
// Sistema de permissões
// ============================================================

import { createClient } from './supabase'

export type Permissao = {
  tela: string
  visualizar: boolean
  criar: boolean
  alterar: boolean
  excluir: boolean
}

export const TELAS = [
  { key:'agenda',         label:'Agenda'          },
  { key:'clientes',       label:'Clientes'        },
  { key:'profissionais',  label:'Profissionais'   },
  { key:'servicos',       label:'Serviços'        },
  { key:'status',         label:'Status'          },
  { key:'financeiro',     label:'Financeiro'      },
  { key:'usuarios',       label:'Usuários'        },
  { key:'configuracoes',  label:'Configurações'   },
]

// Permissões padrão para profissional
export const PERM_PADRAO_PROFISSIONAL: Record<string, Permissao> = {
  agenda:        { tela:'agenda',        visualizar:true,  criar:true,  alterar:true,  excluir:false },
  clientes:      { tela:'clientes',      visualizar:true,  criar:false, alterar:false, excluir:false },
  profissionais: { tela:'profissionais', visualizar:true,  criar:false, alterar:false, excluir:false },
  servicos:      { tela:'servicos',      visualizar:true,  criar:false, alterar:false, excluir:false },
  status:        { tela:'status',        visualizar:true,  criar:false, alterar:false, excluir:false },
  financeiro:    { tela:'financeiro',    visualizar:false, criar:false, alterar:false, excluir:false },
  usuarios:      { tela:'usuarios',      visualizar:false, criar:false, alterar:false, excluir:false },
  configuracoes: { tela:'configuracoes', visualizar:false, criar:false, alterar:false, excluir:false },
}

// Permissões padrão para admin
export const PERM_PADRAO_ADMIN: Record<string, Permissao> = {
  agenda:        { tela:'agenda',        visualizar:true, criar:true, alterar:true, excluir:true  },
  clientes:      { tela:'clientes',      visualizar:true, criar:true, alterar:true, excluir:true  },
  profissionais: { tela:'profissionais', visualizar:true, criar:true, alterar:true, excluir:true  },
  servicos:      { tela:'servicos',      visualizar:true, criar:true, alterar:true, excluir:true  },
  status:        { tela:'status',        visualizar:true, criar:true, alterar:true, excluir:true  },
  financeiro:    { tela:'financeiro',    visualizar:true, criar:true, alterar:true, excluir:true  },
  usuarios:      { tela:'usuarios',      visualizar:true, criar:true, alterar:true, excluir:false },
  configuracoes: { tela:'configuracoes', visualizar:true, criar:true, alterar:true, excluir:false },
}

// Busca permissões de um usuário (retorna map tela->permissao)
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

// Salva permissões de um usuário
export async function salvarPermissoes(
  usuarioId: string,
  empresaId: string,
  permissoes: Permissao[]
): Promise<{ error: any }> {
  const sb = createClient()

  // Remove permissões antigas
  await sb.from('permissoes_usuario').delete().eq('usuario_id', usuarioId)

  // Insere novas
  const { error } = await sb.from('permissoes_usuario').insert(
    permissoes.map(p => ({
      usuario_id:  usuarioId,
      empresa_id:  empresaId,
      tela:        p.tela,
      visualizar:  p.visualizar,
      criar:       p.criar,
      alterar:     p.alterar,
      excluir:     p.excluir,
    }))
  )
  return { error }
}
