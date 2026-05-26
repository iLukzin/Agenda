'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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
  avatar?: string
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
  trocarEmpresa: () => {}, carregando: true, isMaster: false, recarregar: () => {},
})

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null)
  const [empresaAtiva, setEmpresaAtiva] = useState<EmpresaResumo | null>(null)
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCarregando(false); return }

    // Busca dados do usuário
    const { data: u } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_id', user.id)
      .single()

    if (!u) { setCarregando(false); return }

    const usuarioLogado: UsuarioLogado = {
      id: u.id, nome: u.nome, email: u.email,
      nivel_acesso: u.nivel_acesso, empresa_id: u.empresa_id,
    }
    setUsuario(usuarioLogado)

    // Master vê todas as empresas
    if (u.nivel_acesso === 'master') {
      const { data: todasEmpresas } = await supabase
        .from('empresas')
        .select('id,nome,logo_url,plano,status')
        .order('nome')
      const lista = todasEmpresas || []
      setEmpresas(lista)
      // Restaura empresa selecionada do localStorage
      const salva = localStorage.getItem('empresa_ativa')
      if (salva) {
        const encontrada = lista.find((e: EmpresaResumo) => e.id === salva)
        if (encontrada) { setEmpresaAtiva(encontrada); setCarregando(false); return }
      }
      if (lista.length > 0) setEmpresaAtiva(lista[0])
    } else {
      // Admin/profissional vê apenas sua empresa
      if (u.empresa_id) {
        const { data: emp } = await supabase
          .from('empresas')
          .select('id,nome,logo_url,plano,status')
          .eq('id', u.empresa_id)
          .single()
        if (emp) { setEmpresas([emp]); setEmpresaAtiva(emp) }
      }
    }
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  function trocarEmpresa(empresa: EmpresaResumo) {
    setEmpresaAtiva(empresa)
    localStorage.setItem('empresa_ativa', empresa.id)
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
