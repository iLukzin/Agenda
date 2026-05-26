// ============================================================
// AgendaPro — Cliente Supabase
// ============================================================

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Utilitário: formatar moeda BRL
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

// Utilitário: formatar data
export function formatarData(data: string | Date, formato: 'data' | 'datahora' | 'hora' = 'data'): string {
  const d = typeof data === 'string' ? new Date(data) : data
  if (formato === 'hora') {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  if (formato === 'datahora') {
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }
  return d.toLocaleDateString('pt-BR')
}

// Utilitário: cor de status do agendamento
export function corStatus(status: string): string {
  const cores: Record<string, string> = {
    agendado:        'bg-blue-100 text-blue-700',
    confirmado:      'bg-green-100 text-green-700',
    em_atendimento:  'bg-yellow-100 text-yellow-700',
    finalizado:      'bg-gray-100 text-gray-600',
    cancelado:       'bg-red-100 text-red-700',
    nao_compareceu:  'bg-orange-100 text-orange-700',
  }
  return cores[status] ?? 'bg-gray-100 text-gray-600'
}

// Utilitário: label de status
export function labelStatus(status: string): string {
  const labels: Record<string, string> = {
    agendado:        'Agendado',
    confirmado:      'Confirmado',
    em_atendimento:  'Em atendimento',
    finalizado:      'Finalizado',
    cancelado:       'Cancelado',
    nao_compareceu:  'Não compareceu',
  }
  return labels[status] ?? status
}

// Utilitário: dias da semana
export const DIAS_SEMANA = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
]

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Utilitário: gerar horas do dia (intervalos de X min)
export function gerarHorasDia(inicio = '07:00', fim = '20:00', intervalo = 30): string[] {
  const horas: string[] = []
  const [hI, mI] = inicio.split(':').map(Number)
  const [hF, mF] = fim.split(':').map(Number)
  let totalMin = hI * 60 + mI
  const fimMin = hF * 60 + mF
  while (totalMin <= fimMin) {
    const h = Math.floor(totalMin / 60).toString().padStart(2, '0')
    const m = (totalMin % 60).toString().padStart(2, '0')
    horas.push(`${h}:${m}`)
    totalMin += intervalo
  }
  return horas
}

// Utilitário: iniciais do nome
export function iniciais(nome: string): string {
  return nome
    .split(' ')
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase()
}

// Merge de classes CSS
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
