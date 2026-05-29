// BUILD: 1779992105
import type { Metadata } from 'next'
import './globals.css'
import { EmpresaProvider } from '@/context/EmpresaContext'

export const metadata: Metadata = {
  title: 'AgendaFortitude',
  description: 'Sistema de agenda profissional - Fortitude Sistym',
  icons: {
    icon: '/logo-fortitude.png',
    apple: '/logo-fortitude.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"/>
        <link rel="icon" href="/logo-fortitude.png" type="image/png"/>
        <link rel="apple-touch-icon" href="/logo-fortitude.png"/>
      </head>
      <body>
        <EmpresaProvider>
          {children}
        </EmpresaProvider>
      </body>
    </html>
  )
}
