'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

export type EmpresaResumo = {
  id: string
  nome: string
  logo_url?: string
  plano: string
  status: string
}

export type UsuarioLogado = {
  id: string
  nome: string
  email: string
  nivel_acesso: 'master' | 'admin' | 'profissional'
  empresa_id?: string
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
      const supabase = createClient()

      // getUser() é mais confiável que getSession() na Vercel
      const { data: { user }, error: erroAuth } = await supabase.auth.getUser()

      if (erroAuth || !user) {
        setUsuario(null)
        setCarregando(false)
        return
      }

      // Busca dados do usuário na tabela
      const { data: u } = await supabase
        .from('usuarios')
        .select('id, nome, email, nivel_acesso, empresa_id, status')
        .eq('auth_id', user.id)
        .single()

      if (!u) {
        // Autenticado mas sem registro na tabela — usa dados mínimos
        setUsuario({
          id: user.id,
          nome: user.email?.split('@')[0] || 'Usuário',
          email: user.email || '',
          nivel_acesso: 'profissional',
        })
        setCarregando(false)
        return
      }

      setUsuario({
        id:           u.id,
        nome:         u.nome,
        email:        u.email,
        nivel_acesso: u.nivel_acesso,
        empresa_id:   u.empresa_id,
      })

      // Carrega empresas conforme nível
      if (u.nivel_acesso === 'master') {
        const { data: lista } = await supabase
          .from('empresas')
          .select('id,nome,logo_url,plano,status')
          .eq('status', 'ativo')
          .order('nome')

        const l = lista || []
        setEmpresas(l)

        // Restaura última empresa selecionada
        try {
          const salva = localStorage.getItem('empresa_ativa_id')
          const encontrada = salva ? l.find((e: EmpresaResumo) => e.id === salva) : null
          setEmpresaAtiva(encontrada || l[0] || null)
        } catch {
          setEmpresaAtiva(l[0] || null)
        }

      } else if (u.empresa_id) {
        const { data: emp } = await supabase
          .from('empresas')
          .select('id,nome,logo_url,plano,status')
          .eq('id', u.empresa_id)
          .single()

        if (emp) {
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

  // Carrega uma única vez ao montar
  useEffect(() => {
    if (!iniciou) {
      setIniciou(true)
      carregar()
    }
  }, [iniciou, carregar])

  // Escuta mudanças de autenticação
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        carregar()
      }
      if (event === 'SIGNED_OUT') {
        setUsuario(null)
        setEmpresaAtiva(null)
        setEmpresas([])
        setCarregando(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [carregar])

  function trocarEmpresa(empresa: EmpresaResumo) {
    setEmpresaAtiva(empresa)
    try { localStorage.setItem('empresa_ativa_id', empresa.id) } catch {}
  }

  return (
    <EmpresaContext.Provider value={{
      usuario,
      empresaAtiva,
      empresas,
      trocarEmpresa,
      carregando,
      isMaster: usuario?.nivel_acesso === 'master',
      recarregar: carregar,
    }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  return useContext(EmpresaContext)
}
