// BUILD: 1779992105
'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export type EmpresaResumo = {
  id: string
  nome: string
  logo_url?: string
  plano: string
  status: string
  bloqueada?: boolean
  motivo_bloqueio?: string
  tipo_agenda?: string
}

export type UsuarioLogado = {
  id: string
  nome: string
  email: string
  nivel_acesso: 'master' | 'admin' | 'profissional' | 'usuario'
  empresa_id?: string
  profissional_id?: string
  bloquear_edicao_valor?: boolean
}

type EmpresaContextType = {
  usuario: UsuarioLogado | null
  empresaAtiva: EmpresaResumo | null
  empresas: EmpresaResumo[]
  trocarEmpresa: (empresa: EmpresaResumo) => void
  carregando: boolean
  isMaster: boolean
  recarregar: () => void
}

const EmpresaContext = createContext<EmpresaContextType>({
  usuario: null, empresaAtiva: null, empresas: [],
  trocarEmpresa: () => {}, carregando: true,
  isMaster: false, recarregar: () => {},
})

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [usuario,      setUsuario]      = useState<UsuarioLogado | null>(null)
  const [empresaAtiva, setEmpresaAtiva] = useState<EmpresaResumo | null>(null)
  const [empresas,     setEmpresas]     = useState<EmpresaResumo[]>([])
  const [carregando,   setCarregando]   = useState(true)
  const [iniciou,      setIniciou]      = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const sb = createClient()
      const { data: { user }, error: erroAuth } = await sb.auth.getUser()

      if (erroAuth || !user) {
        setUsuario(null)
        setCarregando(false)
        return
      }

      // Busca o usuário na tabela
      const { data: u } = await sb
        .from('usuarios')
        .select('id, nome, email, nivel_acesso, empresa_id, profissional_id, status, bloquear_edicao_valor')
        .eq('auth_id', user.id)
        .single()

      if (!u) {
        // Sem registro na tabela ? trata como master temporário para não bloquear
        setUsuario({
          id: user.id,
          nome: user.email?.split('@')[0] || 'Usuário',
          email: user.email || '',
          nivel_acesso: 'master',
        })
        // Tenta carregar empresas mesmo assim
        const { data: emps } = await sb
          .from('empresas').select('id, nome, logo_url, plano, status, bloqueada, motivo_bloqueio, tipo_agenda, whatsapp_habilitado').order('nome')
        const lista: EmpresaResumo[] = emps || []
        setEmpresas(lista)
        setEmpresaAtiva(lista[0] || null)
        setCarregando(false)
        return
      }

      const usuarioLogado: UsuarioLogado = {
        id:                    u.id,
        nome:                  u.nome,
        email:                 u.email,
        nivel_acesso:          u.nivel_acesso,
        empresa_id:            u.empresa_id,
        profissional_id:       u.profissional_id,
        bloquear_edicao_valor: u.bloquear_edicao_valor !== false,
      }
      setUsuario(usuarioLogado)

      if (u.nivel_acesso === 'master') {
        // Master: carrega todas as empresas
        const { data: lista } = await sb
          .from('empresas')
          .select('id, nome, logo_url, plano, status, bloqueada, motivo_bloqueio, tipo_agenda, whatsapp_habilitado, bloquear_edicao_valor')
          .order('nome')

        const l: EmpresaResumo[] = lista || []
        setEmpresas(l)

        // Tenta restaurar empresa salva no localStorage
        let empresaRestaurada: EmpresaResumo | null = null
        try {
          if (typeof window !== 'undefined') {
            const salva = localStorage.getItem('empresa_ativa_id')
            if (salva) empresaRestaurada = l.find(e => e.id === salva) || null
          }
        } catch {}

        // Usa empresa salva, ou a primeira da lista
        setEmpresaAtiva(empresaRestaurada || l[0] || null)

      } else if (u.empresa_id) {
        // Buscar TODAS as empresas do usuário:
        // 1. Empresa principal (empresa_id no cadastro do usuário)
        // 2. Empresas vinculadas via aba "Usuários" da empresa (tabela usuario_empresas)
        const SELECT_EMP = 'id, nome, logo_url, plano, status, bloqueada, motivo_bloqueio, tipo_agenda, whatsapp_habilitado, bloquear_edicao_valor'
        
        // Buscar empresa principal
        const empRes = await sb.from('empresas').select(SELECT_EMP).eq('id', u.empresa_id).single()
        const emp = empRes.data

        // Buscar todos os vínculos do usuário na tabela usuario_empresas
        let todasIds = u.empresa_id ? [u.empresa_id] : []
        try {
          const { data: vinculos } = await sb.from('usuario_empresas').select('empresa_id').eq('usuario_id', u.id)
          const vinculoIds = (vinculos || []).map((v: any) => v.empresa_id)
          // Juntar IDs sem duplicar
          vinculoIds.forEach((id: string) => { if (!todasIds.includes(id)) todasIds.push(id) })
        } catch { /* tabela pode não existir */ }

        // Buscar dados de todas as empresas de uma vez
        let todasEmpresas: any[] = emp ? [emp] : []
        const extrasIds = todasIds.filter((id: string) => id !== u.empresa_id)
        if (extrasIds.length > 0) {
          const { data: extras } = await sb.from('empresas').select(SELECT_EMP).in('id', extrasIds)
          todasEmpresas = [...todasEmpresas, ...(extras || [])]
        }

        if (emp) {
          // Verificar se empresa esta bloqueada
          if (emp.bloqueada && u.nivel_acesso !== 'master') {
            const motivo = emp.motivo_bloqueio || 'Falta de pagamento'
            await sb.auth.signOut()
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login?bloqueada=1&motivo=' + encodeURIComponent(motivo)
            }
            return
          }
          setEmpresas(todasEmpresas)
          // Restaurar empresa ativa salva ou usar a principal
          let ativa = emp
          try {
            if (typeof window !== 'undefined') {
              const salva = localStorage.getItem('empresa_ativa_id')
              if (salva) ativa = todasEmpresas.find((e: any) => e.id === salva) || emp
            }
          } catch {}
          setEmpresaAtiva(ativa)
        }
      }

    } catch (err) {
      console.error('Erro EmpresaContext:', err)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Monitorar bloqueio em tempo real - deslogar se empresa for bloqueada
  useEffect(() => {
    if (!empresaAtiva?.id) return
    if (!usuario || usuario.nivel_acesso === 'master') return

    const empresaId = empresaAtiva.id
    const nivelAcesso = usuario.nivel_acesso
    const sb = createClient()

    const channel = sb
      .channel('bloqueio-' + empresaId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'empresas',
        filter: 'id=eq.' + empresaId,
      }, async (payload: any) => {
        const rec = payload.new
        if (rec && rec.bloqueada === true && nivelAcesso !== 'master') {
          const motivo = rec.motivo_bloqueio || 'Falta de pagamento'
          await sb.auth.signOut()
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login?bloqueada=1&motivo=' + encodeURIComponent(motivo)
          }
        }
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [empresaAtiva?.id, usuario?.nivel_acesso])

  useEffect(() => {
    if (!iniciou) { setIniciou(true); carregar() }
  }, [iniciou, carregar])

  useEffect(() => {
    const sb = createClient()
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      // Só recarrega no SIGNED_IN se ainda não tem usuário (primeiro login)
      // Evita recarregar toda vez que o usuário troca de aba no navegador
      if (event === 'SIGNED_IN') {
        setUsuario(prev => {
          if (!prev) carregar()  // só carrega se não tinha usuário
          return prev
        })
      }
      if (event === 'SIGNED_OUT') {
        setUsuario(null); setEmpresaAtiva(null); setEmpresas([]); setCarregando(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [carregar])

  function trocarEmpresa(empresa: EmpresaResumo) {
    setEmpresaAtiva(empresa)
    try {
      if (typeof window !== 'undefined') localStorage.setItem('empresa_ativa_id', empresa.id)
    } catch {}
  }

  return (
    <EmpresaContext.Provider value={{
      usuario, empresaAtiva, empresas, trocarEmpresa,
      carregando, isMaster: usuario?.nivel_acesso === 'master',
      recarregar: carregar,
    }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() { return useContext(EmpresaContext) }
