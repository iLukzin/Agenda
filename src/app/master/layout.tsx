'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/context/EmpresaContext'

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  const { usuario, carregando } = useEmpresa()
  const router = useRouter()

  useEffect(() => {
    if (!carregando && usuario?.nivel_acesso !== 'master') {
      router.push('/dashboard')
    }
  }, [usuario, carregando])

  if (carregando) return null

  return <>{children}</>
}
