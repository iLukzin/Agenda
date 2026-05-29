'use client'

import { useState, useEffect } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { buscarPermissoes, permPadrao, type Permissao } from '@/lib/permissoes'

const TUDO:    Permissao = { tela:'', visualizar:true,  criar:true,  alterar:true,  excluir:true  }
const NADA:    Permissao = { tela:'', visualizar:false, criar:false, alterar:false, excluir:false }

export function usePermissao(tela: string) {
  const { usuario, isMaster } = useEmpresa()
  const [perm, setPerm] = useState<Permissao>({ ...TUDO, tela })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (isMaster) { setPerm({ ...TUDO, tela }); setCarregando(false); return }
    if (!usuario?.id) { setPerm({ ...NADA, tela }); setCarregando(false); return }

    setCarregando(true)
    buscarPermissoes(usuario.id).then(mapa => {
      if (mapa[tela]) {
        setPerm(mapa[tela])
      } else {
        const padrao = permPadrao(usuario.nivel_acesso || 'profissional')
        setPerm(padrao[tela] || { ...NADA, tela })
      }
      setCarregando(false)
    })
  }, [usuario?.id, usuario?.nivel_acesso, isMaster, tela])

  return { ...perm, carregando }
}
