// BUILD: 1779992105
// ============================================================
// AgendaPro ? API Supabase com tratamento de erros completo
// ============================================================

import { createClient } from './supabase'

// Função auxiliar: loga e retorna erro formatado
function tratarErro(operacao: string, error: any) {
  console.error(`[API] ${operacao}:`, error)
  return error
}

// ?? CLIENTES ?????????????????????????????????????????????????

export async function listarClientes(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('clientes')
    .select('id, nome, cpf, telefone, whatsapp, email, endereco, data_nascimento, observacoes, plano_id, status, plano:planos(id,nome)')
    .eq('empresa_id', empresaId)
    .order('nome')
  if (error) tratarErro('listarClientes', error)
  return { data, error }
}

export async function criarCliente(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('clientes')
    .insert({ ...limpar(payload), empresa_id: empresaId })
    .select()
    .single()
  if (error) tratarErro('criarCliente', error)
  return { data, error }
}

export async function atualizarCliente(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('clientes')
    .update(limpar(payload))
    .eq('id', id)
    .select()
    .single()
  if (error) tratarErro('atualizarCliente', error)
  return { data, error }
}

export async function excluirCliente(id: string) {
  const sb = createClient()
  const { error } = await sb.from('clientes').delete().eq('id', id)
  if (error) tratarErro('excluirCliente', error)
  return { error }
}

// ?? PROFISSIONAIS ????????????????????????????????????????????

export async function listarProfissionais(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .select('id, nome, email, telefone, cargo, nivel_acesso, status')
    .eq('empresa_id', empresaId)
    .order('nome')
  if (error) tratarErro('listarProfissionais', error)
  return { data, error }
}

export async function atualizarProfissional(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .update(limpar(payload))
    .eq('id', id)
    .select()
    .single()
  if (error) tratarErro('atualizarProfissional', error)
  return { data, error }
}

// ?? SERVIÇOS ?????????????????????????????????????????????????

export async function listarServicos(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('servicos')
    .select('id, nome, descricao, valor, duracao_min, cor, status')
    .eq('empresa_id', empresaId)
    .order('nome')
  if (error) tratarErro('listarServicos', error)
  return { data, error }
}

export async function criarServico(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('servicos')
    .insert({ ...limpar(payload), empresa_id: empresaId })
    .select()
    .single()
  if (error) tratarErro('criarServico', error)
  return { data, error }
}

export async function atualizarServico(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('servicos')
    .update(limpar(payload))
    .eq('id', id)
    .select()
    .single()
  if (error) tratarErro('atualizarServico', error)
  return { data, error }
}

export async function excluirServico(id: string) {
  const sb = createClient()
  const { error } = await sb.from('servicos').delete().eq('id', id)
  if (error) tratarErro('excluirServico', error)
  return { error }
}

// ?? PLANOS ???????????????????????????????????????????????????

export async function listarPlanos(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('planos')
    .select('id, nome, descricao, valor_mensal, sessoes_mes, validade_dias, status')
    .eq('empresa_id', empresaId)
    .order('nome')
  if (error) tratarErro('listarPlanos', error)
  return { data, error }
}

export async function criarPlano(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('planos')
    .insert({ ...limpar(payload), empresa_id: empresaId })
    .select()
    .single()
  if (error) tratarErro('criarPlano', error)
  return { data, error }
}

export async function atualizarPlano(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('planos')
    .update(limpar(payload))
    .eq('id', id)
    .select()
    .single()
  if (error) tratarErro('atualizarPlano', error)
  return { data, error }
}

export async function excluirPlano(id: string) {
  const sb = createClient()
  const { error } = await sb.from('planos').delete().eq('id', id)
  if (error) tratarErro('excluirPlano', error)
  return { error }
}

// ?? AGENDAMENTOS ?????????????????????????????????????????????

export async function listarAgendamentos(
  empresaId: string,
  dataInicio?: string,
  dataFim?: string
) {
  const sb = createClient()
  let query = sb
    .from('agendamentos')
    .select(`
      id, data_inicio, data_fim, status, tipo_cobranca, valor,
      forma_pagamento, observacoes, cliente_id, servico_id, profissional_id,
      cliente:clientes(id, nome, telefone, whatsapp),
      servico:servicos(id, nome, cor, duracao_min),
      profissional:usuarios(id, nome)
    `)
    .eq('empresa_id', empresaId)
    .order('data_inicio')

  if (dataInicio) query = query.gte('data_inicio', dataInicio)
  if (dataFim)    query = query.lte('data_inicio', dataFim + 'T23:59:59')

  const { data, error } = await query
  if (error) tratarErro('listarAgendamentos', error)
  return { data, error }
}

export async function criarAgendamento(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  // Busca o id da tabela usuarios (não auth.uid) para o created_by
  const { data: { user } } = await sb.auth.getUser()
  let createdBy = null
  if (user) {
    const { data: u } = await sb
      .from('usuarios')
      .select('id')
      .eq('auth_id', user.id)
      .single()
    createdBy = u?.id || null
  }
  const { data, error } = await sb
    .from('agendamentos')
    .insert({
      ...limpar(payload),
      empresa_id: empresaId,
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) tratarErro('criarAgendamento', error)
  return { data, error }
}

export async function atualizarAgendamento(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('agendamentos')
    .update(limpar(payload))
    .eq('id', id)
    .select()
    .single()
  if (error) tratarErro('atualizarAgendamento', error)
  return { data, error }
}

export async function excluirAgendamento(id: string) {
  const sb = createClient()
  const { error } = await sb.from('agendamentos').delete().eq('id', id)
  if (error) tratarErro('excluirAgendamento', error)
  return { error }
}

// ?? LANÇAMENTOS ??????????????????????????????????????????????

export async function listarLancamentos(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('lancamentos')
    .select('*, cliente:clientes(id, nome)')
    .eq('empresa_id', empresaId)
    .order('data_vencimento', { ascending: false })
  if (error) tratarErro('listarLancamentos', error)
  return { data, error }
}

export async function criarLancamento(empresaId: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('lancamentos')
    .insert({ ...limpar(payload), empresa_id: empresaId })
    .select()
    .single()
  if (error) tratarErro('criarLancamento', error)
  return { data, error }
}

export async function atualizarLancamento(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('lancamentos')
    .update(limpar(payload))
    .eq('id', id)
    .select()
    .single()
  if (error) tratarErro('atualizarLancamento', error)
  return { data, error }
}

export async function excluirLancamento(id: string) {
  const sb = createClient()
  const { error } = await sb.from('lancamentos').delete().eq('id', id)
  if (error) tratarErro('excluirLancamento', error)
  return { error }
}

// ?? USUÁRIOS ?????????????????????????????????????????????????

export async function listarUsuarios(empresaId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .select('id, nome, email, telefone, cargo, nivel_acesso, empresa_id, status')
    .eq('empresa_id', empresaId)
    .order('nome')
  if (error) tratarErro('listarUsuarios', error)
  return { data, error }
}

export async function listarTodosUsuarios() {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .select('id, nome, email, telefone, cargo, nivel_acesso, empresa_id, status, empresa:empresas(id,nome)')
    .order('nome')
  if (error) tratarErro('listarTodosUsuarios', error)
  return { data, error }
}

export async function atualizarUsuario(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('usuarios')
    .update(limpar(payload))
    .eq('id', id)
    .select()
    .single()
  if (error) tratarErro('atualizarUsuario', error)
  return { data, error }
}

export async function inativarUsuario(id: string) {
  return atualizarUsuario(id, { status: 'inativo' })
}

export async function excluirUsuario(id: string) {
  const sb = createClient()
  const { error } = await sb.from('usuarios').delete().eq('id', id)
  if (error) tratarErro('excluirUsuario', error)
  return { error }
}

// ?? EMPRESAS ?????????????????????????????????????????????????

export async function listarEmpresas() {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .select('*')
    .order('nome')
  if (error) tratarErro('listarEmpresas', error)
  return { data, error }
}

export async function buscarEmpresa(id: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .select('*')
    .eq('id', id)
    .single()
  if (error) tratarErro('buscarEmpresa', error)
  return { data, error }
}

export async function criarEmpresa(payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .insert(limpar(payload))
    .select()
    .single()
  if (error) tratarErro('criarEmpresa', error)
  return { data, error }
}

export async function atualizarEmpresa(id: string, payload: Record<string, any>) {
  const sb = createClient()
  const { data, error } = await sb
    .from('empresas')
    .update(limpar(payload))
    .eq('id', id)
    .select()
    .single()
  if (error) tratarErro('atualizarEmpresa', error)
  return { data, error }
}

export async function atualizarConfiguracoes(id: string, payload: Record<string, any>) {
  return atualizarEmpresa(id, payload)
}

// ?? HORÁRIOS DO PROFISSIONAL ?????????????????????????????????

export async function listarHorariosProfissional(usuarioId: string) {
  const sb = createClient()
  const { data, error } = await sb
    .from('horarios_profissional')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('dia_semana')
  if (error) tratarErro('listarHorariosProfissional', error)
  return { data, error }
}

export async function salvarHorariosProfissional(
  usuarioId: string,
  empresaId: string,
  horarios: { dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean }[]
) {
  const sb = createClient()
  await sb.from('horarios_profissional').delete().eq('usuario_id', usuarioId)
  const ativos = horarios
    .filter(h => h.ativo)
    .map(h => ({ usuario_id: usuarioId, empresa_id: empresaId, dia_semana: h.dia_semana, hora_inicio: h.hora_inicio, hora_fim: h.hora_fim, ativo: true }))
  if (ativos.length === 0) return { error: null }
  const { error } = await sb.from('horarios_profissional').insert(ativos)
  if (error) tratarErro('salvarHorariosProfissional', error)
  return { error }
}

// ?? HELPER: remove campos vazios para não gravar string vazia ?
function limpar(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    // Converte string vazia para null (exceto campos que devem ser string)
    if (v === '') {
      result[k] = null
    } else {
      result[k] = v
    }
  }
  return result
}
