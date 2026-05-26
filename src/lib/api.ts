// ============================================================
// AgendaPro — Serviços de API (todas as operações no Supabase)
// ============================================================

import { createClient } from './supabase'

// ── CLIENTES ─────────────────────────────────────────────────

export async function listarClientes(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('clientes')
    .select('*, plano:planos(id,nome)')
    .eq('empresa_id', empresaId)
    .order('nome')
  return { data, error }
}

export async function criarCliente(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('clientes')
    .insert({ ...payload, empresa_id: empresaId })
    .select()
    .single()
  return { data, error }
}

export async function atualizarCliente(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('clientes')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function excluirCliente(id: string) {
  const sb = createClient()
  const { error } = await sb.from('clientes').delete().eq('id', id)
  return { error }
}

// ── PROFISSIONAIS (usuários com cargo) ───────────────────────

export async function listarProfissionais(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .select('*')
    .eq('empresa_id', empresaId)
    .in('nivel_acesso', ['profissional', 'admin'])
    .order('nome')
  return { data, error }
}

export async function criarProfissional(empresaId: string, payload: Record<string, any>, senha: string) {
  const sb = createClient()
  // Cria no Auth
  const { data: authData, error: authError } = await sb.auth.signUp({
    email: payload.email,
    password: senha,
    options: { emailRedirectTo: undefined },
  })
  if (authError) return { data: null, error: authError }

  // Insere na tabela usuarios
  const { data, error } = await sb
    .from('usuarios')
    .insert({
      ...payload,
      empresa_id: empresaId,
      auth_id: authData.user?.id,
      nivel_acesso: 'profissional',
    })
    .select()
    .single()
  return { data, error }
}

export async function atualizarProfissional(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function excluirProfissional(id: string) {
  const sb = createClient()
  const { error } = await sb.from('usuarios').update({ status: 'inativo' }).eq('id', id)
  return { error }
}

// ── SERVIÇOS ─────────────────────────────────────────────────

export async function listarServicos(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('servicos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nome')
  return { data, error }
}

export async function criarServico(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('servicos')
    .insert({ ...payload, empresa_id: empresaId })
    .select()
    .single()
  return { data, error }
}

export async function atualizarServico(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('servicos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function excluirServico(id: string) {
  const sb = createClient()
  const { error } = await sb.from('servicos').delete().eq('id', id)
  return { error }
}

// ── PLANOS ───────────────────────────────────────────────────

export async function listarPlanos(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('planos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nome')
  return { data, error }
}

export async function criarPlano(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('planos')
    .insert({ ...payload, empresa_id: empresaId })
    .select()
    .single()
  return { data, error }
}

export async function atualizarPlano(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('planos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function excluirPlano(id: string) {
  const sb = createClient()
  const { error } = await sb.from('planos').delete().eq('id', id)
  return { error }
}

// ── AGENDAMENTOS ─────────────────────────────────────────────

export async function listarAgendamentos(empresaId: string, dataInicio?: string, dataFim?: string) {
  const sb = createClient()
  let query = sb
    .from('agendamentos')
    .select(`
      *,
      cliente:clientes(id,nome,telefone,whatsapp),
      servico:servicos(id,nome,cor,duracao_min),
      profissional:usuarios(id,nome)
    `)
    .eq('empresa_id', empresaId)
    .order('data_inicio')

  if (dataInicio) query = query.gte('data_inicio', dataInicio)
  if (dataFim)    query = query.lte('data_inicio', dataFim + 'T23:59:59')

  const { data, error } = await query
  return { data, error }
}

export async function criarAgendamento(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('agendamentos')
    .insert({ ...payload, empresa_id: empresaId })
    .select()
    .single()
  return { data, error }
}

export async function atualizarAgendamento(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('agendamentos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function excluirAgendamento(id: string) {
  const sb = createClient()
  const { error } = await sb.from('agendamentos').delete().eq('id', id)
  return { error }
}

// ── LANÇAMENTOS FINANCEIROS ──────────────────────────────────

export async function listarLancamentos(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('lancamentos')
    .select('*, cliente:clientes(id,nome)')
    .eq('empresa_id', empresaId)
    .order('data_vencimento', { ascending: false })
  return { data, error }
}

export async function criarLancamento(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('lancamentos')
    .insert({ ...payload, empresa_id: empresaId })
    .select()
    .single()
  return { data, error }
}

export async function atualizarLancamento(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('lancamentos')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function excluirLancamento(id: string) {
  const sb = createClient()
  const { error } = await sb.from('lancamentos').delete().eq('id', id)
  return { error }
}

// ── USUÁRIOS ─────────────────────────────────────────────────

export async function listarUsuarios(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .select('*, empresa:empresas(id,nome)')
    .eq('empresa_id', empresaId)
    .order('nome')
  return { data, error }
}

export async function atualizarUsuario(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ── EMPRESAS (master) ────────────────────────────────────────

export async function listarEmpresas() {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .select('*')
    .order('nome')
  return { data, error }
}

export async function criarEmpresa(payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .insert(payload)
    .select()
    .single()
  return { data, error }
}

export async function atualizarEmpresa(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ── CONFIGURAÇÕES DA EMPRESA ─────────────────────────────────

export async function buscarEmpresa(id: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .select('*')
    .eq('id', id)
    .single()
  return { data, error }
}

export async function atualizarConfiguracoes(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// ── HORÁRIOS DO PROFISSIONAL ─────────────────────────────────

export async function salvarHorariosProfissional(
  usuarioId: string,
  empresaId: string,
  horarios: { dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean }[]
) {
  const sb = createClient()
  // Remove horários existentes e reinsere
  await sb.from('horarios_profissional').delete().eq('usuario_id', usuarioId)
  const ativos = horarios.filter(h => h.ativo).map(h => ({
    usuario_id:  usuarioId,
    empresa_id:  empresaId,
    dia_semana:  h.dia_semana,
    hora_inicio: h.hora_inicio,
    hora_fim:    h.hora_fim,
    ativo:       true,
  }))
  if (ativos.length === 0) return { error: null }
  const { error } = await sb.from('horarios_profissional').insert(ativos)
  return { error }
}

export async function listarHorariosProfissional(usuarioId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('horarios_profissional')
    .select('*')
    .eq('usuario_id', usuarioId)
  return { data, error }
}
