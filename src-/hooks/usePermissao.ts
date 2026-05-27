// Hook para verificar permissões do usuário na tela atual
'use client'

import { useState, useEffect } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { buscarPermissoes, type Permissao, PERM_PADRAO_ADMIN, PERM_PADRAO_PROFISSIONAL } from '@/lib/permissoes'

export function usePermissao(tela: string) {
  const { usuario, isMaster } = useEmpresa()
  const [perm, setPerm] = useState<Permissao>({
    tela, visualizar:true, criar:true, alterar:true, excluir:true
  })

  useEffect(() => {
    // Master tem tudo
    if (isMaster) {
      setPerm({ tela, visualizar:true, criar:true, alterar:true, excluir:true })
      return
    }
    if (!usuario?.id) return

    buscarPermissoes(usuario.id).then(mapa => {
      if (mapa[tela]) {
        setPerm(mapa[tela])
      } else {
        // Usa padrão do nível se não tiver permissão cadastrada
        const padrao = usuario.nivel_acesso === 'admin' ? PERM_PADRAO_ADMIN : PERM_PADRAO_PROFISSIONAL
        setPerm(padrao[tela] || { tela, visualizar:true, criar:false, alterar:false, excluir:false })
      }
    })
  }, [usuario?.id, isMaster, tela])

  return perm
}
