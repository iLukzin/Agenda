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
}

export type UsuarioLogado = {
  id: string
  nome: string
  email: string
  nivel_acesso: 'master' | 'admin' | 'profissional'
  empresa_id?: string
  profissional_id?: string
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
        .select('id, nome, email, nivel_acesso, empresa_id, profissional_id, status')
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
          .from('empresas').select('id, nome, logo_url, plano, status, bloqueada, motivo_bloqueio').order('nome')
        const lista: EmpresaResumo[] = emps || []
        setEmpresas(lista)
        setEmpresaAtiva(lista[0] || null)
        setCarregando(false)
        return
      }

      const usuarioLogado: UsuarioLogado = {
        id:              u.id,
        nome:            u.nome,
        email:           u.email,
        nivel_acesso:    u.nivel_acesso,
        empresa_id:      u.empresa_id,
        profissional_id: u.profissional_id,
      }
      setUsuario(usuarioLogado)

      if (u.nivel_acesso === 'master') {
        // Master: carrega todas as empresas
        const { data: lista } = await sb
          .from('empresas')
          .select('id, nome, logo_url, plano, status, bloqueada, motivo_bloqueio')
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
        // Admin/profissional: somente a empresa vinculada
        const { data: emp } = await sb
          .from('empresas')
          .select('id, nome, logo_url, plano, status, bloqueada, motivo_bloqueio')
          .eq('id', u.empresa_id)
          .single()

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
          setEmpresas([emp])
          setEmpresaAtiva(emp)
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
    const u = usuario
    if (!u || u.nivel_acesso === 'master') return // master nunca e bloqueado

    const empresaId = empresaAtiva.id
    const sb = createClient()

    const channel = sb
      .channel('bloqueio-empresa-' + empresaId)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'empresas',
        filter: 'id=eq.' + empresaId,
      }, async (payload: any) => {
        const rec = payload.new
        if (rec && rec.bloqueada === true) {
          // Empresa foi bloqueada - deslogar imediatamente
          const motivo = rec.motivo_bloqueio || 'Falta de pagamento'
          await sb.auth.signOut()
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login?bloqueada=1&motivo=' + encodeURIComponent(motivo)
          }
        }
      })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [empresaAtiva?.id, usuario])

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
