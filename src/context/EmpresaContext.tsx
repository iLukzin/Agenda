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
  tipo_agenda: string  // 'grade' | 'calendario'
  whatsapp_habilitado?: boolean
}

export type UsuarioLogado = {
  id: string
  nome: string
  email: string
  nivel_acesso: 'master' | 'admin' | 'profissional' | 'usuario'
  empresa_id?: string
  profissional_id?: string
  bloquear_edicao_valor?: boolean
  permitir_desconto?: boolean
  permitir_cancelar?: boolean
  permitir_finalizar?: boolean
  permitir_ver_pagamento?: boolean
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
        .select('id, nome, email, nivel_acesso, empresa_id, profissional_id, status, bloquear_edicao_valor, permitir_desconto, permitir_cancelar, permitir_finalizar, permitir_ver_pagamento')
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
        id:                      u.id,
        nome:                    u.nome,
        email:                   u.email,
        nivel_acesso:            u.nivel_acesso,
        empresa_id:              u.empresa_id,
        profissional_id:         u.profissional_id || undefined,
        bloquear_edicao_valor:   u.bloquear_edicao_valor !== false,
        permitir_desconto:       u.permitir_desconto === true,
        permitir_cancelar:       u.permitir_cancelar !== false,
        permitir_finalizar:      u.permitir_finalizar !== false,
        permitir_ver_pagamento:  u.permitir_ver_pagamento !== false,
      }
      setUsuario(usuarioLogado)

      if (u.nivel_acesso === 'master') {
        // Master: carrega todas as empresas
        const { data: lista } = await sb
          .from('empresas')
          .select('id, nome, logo_url, plano, status, bloqueada, motivo_bloqueio, tipo_agenda, whatsapp_habilitado')
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

      } else {
        const SELECT_EMP = 'id, nome, logo_url, plano, status, bloqueada, motivo_bloqueio, tipo_agenda, whatsapp_habilitado'

        // Buscar empresa principal do cadastro do usuário
        const idsSet = new Set<string>()
        if (u.empresa_id) idsSet.add(u.empresa_id)

        // Buscar vínculos via usuario_empresas (usuário vinculado na aba da empresa)
        const resVinc = await sb
          .from('usuario_empresas')
          .select('empresa_id')
          .eq('usuario_id', u.id)

        console.log('[EmpresaCtx] usuario_id:', u.id, 'vinculos:', resVinc.data, 'erro:', resVinc.error)
        ;(resVinc.data || []).forEach((v: any) => { if (v.empresa_id) idsSet.add(v.empresa_id) })

        // Usar todos os IDs - o banco define o que é válido
        const todasIds = Array.from(idsSet).filter((id: string) => !!id)
        console.log('[EmpresaCtx] todasIds:', todasIds)

        if (todasIds.length === 0) {
          setEmpresas([])
          setEmpresaAtiva(null)
        } else {
          // Verificar sessão antes das queries
          const { data: { session } } = await sb.auth.getSession()
          if (!session) {
            console.error('[EmpresaCtx] Sem sessao ao buscar empresas')
            setEmpresas([])
            setEmpresaAtiva(null)
            return
          }
          console.log('[EmpresaCtx] Session OK, access_token:', session.access_token ? 'presente' : 'ausente')

          // Buscar cada empresa com .eq() + maybeSingle()
          const todasEmpresas: any[] = []
          for (const empId of todasIds) {
            const { data: emp, error: errEmp } = await sb
              .from('empresas')
              .select(SELECT_EMP)
              .eq('id', empId)
              .maybeSingle()
            console.log('[EmpresaCtx] empresa', empId, ':', emp ? 'OK' : 'null', errEmp ? errEmp.message : '')
            if (emp) todasEmpresas.push(emp)
          }

          // Empresa principal para verificar bloqueio
          const empPrincipal = u.empresa_id
            ? todasEmpresas.find(e => e.id === u.empresa_id)
            : todasEmpresas[0]

          // Bloquear acesso se empresa principal bloqueada
          if (empPrincipal?.bloqueada && u.nivel_acesso !== 'master') {
            const motivo = empPrincipal.motivo_bloqueio || 'Falta de pagamento'
            await sb.auth.signOut()
            if (typeof window !== 'undefined') {
              window.location.href = '/auth/login?bloqueada=1&motivo=' + encodeURIComponent(motivo)
            }
            return
          }

          setEmpresas(todasEmpresas)

          // Empresa ativa: 1 empresa = usa direto; múltiplas = respeita localStorage
          let ativa: any = empPrincipal || todasEmpresas[0]
          if (todasEmpresas.length > 1) {
            try {
              if (typeof window !== 'undefined') {
                const salvaId = localStorage.getItem('empresa_ativa_id')
                if (salvaId) {
                  const found = todasEmpresas.find((e: any) => e.id === salvaId)
                  if (found) ativa = found
                }
              }
            } catch {}
          }
          setEmpresaAtiva(ativa || null)
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
