// ============================================================
// AgendaPro — Tipos TypeScript
// ============================================================

export type NivelAcesso = 'master' | 'admin' | 'profissional'
export type StatusEmpresa = 'ativo' | 'inativo' | 'bloqueado'
export type PlanoEmpresa = 'basico' | 'profissional' | 'enterprise'
export type StatusAgendamento = 'agendado' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'cancelado' | 'nao_compareceu'
export type TipoCobranca = 'avulso' | 'plano'
export type FormaPagamento = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'transferencia' | 'plano'
export type TipoLancamento = 'receita' | 'despesa'
export type StatusLancamento = 'pendente' | 'pago' | 'cancelado'

export interface Empresa {
  id: string
  nome: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  logo_url?: string
  plano: PlanoEmpresa
  status: StatusEmpresa
  vencimento?: string
  configuracoes?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  empresa_id?: string
  auth_id?: string
  nome: string
  email: string
  telefone?: string
  cargo?: string
  nivel_acesso: NivelAcesso
  avatar_url?: string
  status: 'ativo' | 'inativo'
  created_at: string
  updated_at: string
  empresa?: Empresa
}

export interface Servico {
  id: string
  empresa_id: string
  nome: string
  descricao?: string
  valor: number
  duracao_min: number
  cor: string
  status: 'ativo' | 'inativo'
  created_at: string
  updated_at: string
  profissionais?: Usuario[]
}

export interface Plano {
  id: string
  empresa_id: string
  nome: string
  descricao?: string
  valor_mensal: number
  sessoes_mes?: number // null = ilimitado
  validade_dias: number
  status: 'ativo' | 'inativo'
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: string
  empresa_id: string
  nome: string
  cpf?: string
  telefone?: string
  whatsapp?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  data_nascimento?: string
  foto_url?: string
  observacoes?: string
  plano_id?: string
  plano_inicio?: string
  plano_fim?: string
  plano_sessoes_usadas: number
  status: 'ativo' | 'inativo'
  created_at: string
  updated_at: string
  plano?: Plano
}

export interface Agendamento {
  id: string
  empresa_id: string
  cliente_id: string
  servico_id: string
  profissional_id: string
  data_inicio: string
  data_fim: string
  status: StatusAgendamento
  tipo_cobranca: TipoCobranca
  valor?: number
  forma_pagamento?: FormaPagamento
  observacoes?: string
  recorrente: boolean
  recorrencia_id?: string
  created_by?: string
  created_at: string
  updated_at: string
  cliente?: Cliente
  servico?: Servico
  profissional?: Usuario
}

export interface Lancamento {
  id: string
  empresa_id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  status: StatusLancamento
  categoria?: string
  agendamento_id?: string
  cliente_id?: string
  forma_pagamento?: string
  observacoes?: string
  created_at: string
  updated_at: string
  cliente?: Cliente
  agendamento?: Agendamento
}

export interface HorarioProfissional {
  id: string
  usuario_id: string
  empresa_id: string
  dia_semana: number // 0=Dom, 6=Sáb
  hora_inicio: string
  hora_fim: string
  intervalo_min: number
  ativo: boolean
}

export interface Bloqueio {
  id: string
  usuario_id: string
  empresa_id: string
  data_inicio: string
  data_fim: string
  motivo?: string
}

// ============================================================
// DTOs (para criar/atualizar)
// ============================================================

export type CriarAgendamentoDTO = Omit<Agendamento,
  'id' | 'empresa_id' | 'created_at' | 'updated_at' | 'cliente' | 'servico' | 'profissional'>

export type AtualizarAgendamentoDTO = Partial<CriarAgendamentoDTO>

export type CriarClienteDTO = Omit<Cliente,
  'id' | 'empresa_id' | 'created_at' | 'updated_at' | 'plano' | 'plano_sessoes_usadas'>

export type CriarServicoDTO = Omit<Servico,
  'id' | 'empresa_id' | 'created_at' | 'updated_at' | 'profissionais'>

// ============================================================
// Contexto de autenticação
// ============================================================

export interface SessaoUsuario {
  usuario: Usuario
  empresa: Empresa | null
  carregando: boolean
}

// ============================================================
// Resumos para Dashboard
// ============================================================

export interface ResumoDashboard {
  agendamentosHoje: number
  agendamentosSemana: number
  clientesAtivos: number
  faturamentoMes: number
  ticketMedio: number
  taxaCancelamento: number
  proximosAgendamentos: Agendamento[]
  servicosMaisVendidos: { nome: string; total: number; valor: number }[]
  faturamentoPorDia: { dia: string; valor: number }[]
}
