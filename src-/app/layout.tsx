import type { Metadata } from 'next'
import './globals.css'
import { EmpresaProvider } from '@/context/EmpresaContext'

export const metadata: Metadata = {
  title: 'AgendaPro — Sistema de Agenda Profissional',
  description: 'Sistema SaaS de agenda multiempresa',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <EmpresaProvider>
          {children}
        </EmpresaProvider>
      </body>
    </html>
  )
}
