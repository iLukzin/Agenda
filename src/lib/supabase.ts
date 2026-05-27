// ============================================================
// AgendaPro — Clientes Supabase
// ============================================================

import { createBrowserClient } from '@supabase/ssr'

// ── Cliente browser (use client) ─────────────────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── Utilitários ───────────────────────────────────────────────

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

export function formatarData(
  data: string | Date,
  formato: 'data' | 'datahora' | 'hora' = 'data'
): string {
  const d = typeof data === 'string' ? new Date(data) : data
  if (formato === 'hora') {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  if (formato === 'datahora') {
    return d.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  return d.toLocaleDateString('pt-BR')
}

export function corStatus(status: string): string {
  const cores: Record<string, string> = {
    aberto:         'bg-blue-100 text-blue-700',
    fechado:        'bg-green-100 text-green-700',
    cancelado:      'bg-red-100 text-red-700',
    // legado
    agendado:       'bg-blue-100 text-blue-700',
    confirmado:     'bg-green-100 text-green-700',
    em_atendimento: 'bg-yellow-100 text-yellow-700',
    finalizado:     'bg-green-100 text-green-600',
    nao_compareceu: 'bg-orange-100 text-orange-700',
  }
  return cores[status] ?? 'bg-gray-100 text-gray-600'
}

export function labelStatus(status: string): string {
  const labels: Record<string, string> = {
    aberto:         'Aberto',
    fechado:        'Fechado',
    cancelado:      'Cancelado',
    // legado
    agendado:       'Agendado',
    confirmado:     'Confirmado',
    em_atendimento: 'Em atendimento',
    finalizado:     'Finalizado',
    nao_compareceu: 'Não compareceu',
  }
  return labels[status] ?? status
}

export const DIAS_SEMANA = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
]

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function iniciais(nome: string): string {
  return nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
