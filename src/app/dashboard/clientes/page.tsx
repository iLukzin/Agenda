// BUILD: 1779992105
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'
import { createClient } from '@/lib/supabase'

type Cliente = {
  id: string
  nome: string
  cpf: string
  telefone: string
  whatsapp: string
  email: string
  endereco: string
  data_nascimento: string
  observacoes: string
  plano_id: string
  status: string
  plano_nome: string
  created_at?: string
}

function mascaraTel(v: string): string {
  const n = v.replace(/\D/g,'').slice(0,11)
  if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'')
  return n.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'')
}

const inputStyle = {
  width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px',
  padding: '9px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const,
}

const formVazio = {
  nome: '', cpf: '', telefone: '', whatsapp: '', email: '',
  data_nascimento: '', endereco: '', plano_id: '', observacoes: '', status: 'ativo',
}


function useVisibilityRefresh(fn: () => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (typeof window === 'undefined') return
    let t = Date.now()
    const onVis = () => { if (document.visibilityState==='visible' && Date.now()-t>15000) ref.current(); t=Date.now() }
    const onFoc = () => { if (Date.now()-t>120000) ref.current(); t=Date.now() }
    const onBlr = () => { t=Date.now() }
    document.addEventListener('visibilitychange',onVis)
    window.addEventListener('focus',onFoc)
    window.addEventListener('blur',onBlr)
    return () => { document.removeEventListener('visibilitychange',onVis); window.removeEventListener('focus',onFoc); window.removeEventListener('blur',onBlr) }
  }, [])
}
export default function ClientesPage() {
  const { empresaAtiva, isMaster, usuario } = useEmpresa()
  const perm = usePermissao('clientes')
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [planos, setPlanos]         = useState<{id:string;nome:string}[]>([])
  const [profissionais, setProfissionais] = useState<{id:string;nome:string;servicos:string[]}[]>([])
  const [servicos, setServicos]     = useState<{id:string;nome:string}[]>([])
  const [horariosProfissional, setHorariosProfissional] = useState<{dia_semana:number;hora_inicio:string;hora_fim:string;ativo:boolean}[]>([])
  const [busca, setBusca]           = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modalAberto, setModalAberto]   = useState(false)
  const [abaModal, setAbaModal]     = useState<'dados'|'autoagenda'>('dados')
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Cliente | null>(null)
  const [form, setForm]             = useState(formVazio)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [modalHistorico, setModalHistorico] = useState(false)
  const [clienteHistorico, setClienteHistorico] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [histCarregando, setHistCarregando] = useState(false)
  const [histFiltroIni, setHistFiltroIni] = useState('')
  const [histFiltroFim, setHistFiltroFim] = useState('')

  // AutoAgenda
  const [autoAgendas, setAutoAgendas]   = useState<any[]>([])
  const [aaCarregando, setAaCarregando] = useState(false)
  const [aaSalvando, setAaSalvando]     = useState(false)
  const [aaForm, setAaForm] = useState({
    dia_semana: '1',
    horario: '09:00',
    profissional_id: '',
    servico_id: '',
  })

  const autoAgendaHabilitado = isMaster || empresaAtiva?.auto_agenda_habilitado === true

  const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()

    const [{ data: cls, error: errCls }, { data: pls }, { data: profs }, { data: srvs }] = await Promise.all([
      sb.from('clientes').select('id, nome, cpf, telefone, whatsapp, email, endereco, data_nascimento, observacoes, plano_id, status, created_at').eq('empresa_id', empresaAtiva.id).order('nome'),
      sb.from('planos').select('id, nome').eq('empresa_id', empresaAtiva.id),
      sb.from('profissionais').select('id, nome, servicos').eq('empresa_id', empresaAtiva.id).eq('status','ativo').order('nome'),
      sb.from('servicos').select('id, nome').eq('empresa_id', empresaAtiva.id).eq('status','ativo').order('nome'),
    ])

    if (errCls) { setCarregando(false); return }

    const planosMap: Record<string, string> = {}
    if (pls) pls.forEach((p: any) => { planosMap[p.id] = p.nome })

    setPlanos(pls || [])
    setProfissionais((profs || []).map((p: any) => ({ id: p.id, nome: p.nome, servicos: p.servicos || [] })))
    setServicos(srvs || [])
    setClientes((cls || []).map((c: any) => ({
      ...c,
      cpf:            c.cpf || '',
      telefone:       c.telefone || '',
      whatsapp:       c.whatsapp || '',
      email:          c.email || '',
      endereco:       c.endereco || '',
      data_nascimento: c.data_nascimento || '',
      observacoes:    c.observacoes || '',
      plano_id:       c.plano_id || '',
      plano_nome:     c.plano_id ? (planosMap[c.plano_id] || 'Plano') : 'Avulso',
    })))
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])
  useVisibilityRefresh(carregar)

  const filtrados = clientes.filter(c => {
    const buscaOk = c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
                    c.cpf?.includes(busca) || c.telefone?.includes(busca) ||
                    c.whatsapp?.includes(busca)
    const stOk    = filtroStatus === 'todos' || c.status === filtroStatus
    return buscaOk && stOk
  })

  async function abrirHistorico(c: any) {
    setClienteHistorico(c)
    setModalHistorico(true)
    setHistCarregando(true)
    const sb = createClient()
    const { data } = await sb
      .from('agendamentos')
      .select('id,data_inicio,status,valor,forma_pagamento,servico_id,prof_id,motivo_cancelamento,observacoes')
      .eq('empresa_id', empresaAtiva?.id || '')
      .eq('cliente_id', c.id)
      .order('data_inicio', { ascending: false })
    const servIds = Array.from(new Set((data||[]).map((a:any)=>a.servico_id).filter(Boolean)))
    const profIds  = Array.from(new Set((data||[]).map((a:any)=>a.prof_id).filter(Boolean)))
    const servMap: Record<string,string> = {}
    const profMap: Record<string,string> = {}
    if (servIds.length > 0) {
      const { data: s } = await sb.from('servicos').select('id,nome').in('id', servIds as string[])
      ;(s||[]).forEach((x:any)=>{ servMap[x.id]=x.nome })
    }
    if (profIds.length > 0) {
      const { data: p } = await sb.from('profissionais').select('id,nome').in('id', profIds as string[])
      ;(p||[]).forEach((x:any)=>{ profMap[x.id]=x.nome })
    }
    setHistorico((data||[]).map((a:any)=>({
      id: a.id,
      data: a.data_inicio ? a.data_inicio.slice(0,10) : '',
      hora: a.data_inicio ? a.data_inicio.slice(11,16) : '',
      status: a.status,
      valor: a.valor || 0,
      forma: a.forma_pagamento || '',
      servico: servMap[a.servico_id] || '--',
      profissional: profMap[a.prof_id] || '--',
      motivo: a.motivo_cancelamento || '',
      observacoes: a.observacoes || '',
    })))
    setHistCarregando(false)
  }

  function fecharHistorico() { setModalHistorico(false); setClienteHistorico(null); setHistorico([]); setHistFiltroIni(''); setHistFiltroFim('') }

  async function carregarAutoAgendas(clienteId: string) {
    if (!empresaAtiva?.id) return
    setAaCarregando(true)
    const sb = createClient()
    const { data } = await sb.from('auto_agenda').select('*').eq('empresa_id', empresaAtiva.id).eq('cliente_id', clienteId).order('dia_semana').order('horario')
    setAutoAgendas(data || [])
    setAaCarregando(false)
  }

  async function carregarHorariosProfissional(profId: string) {
    if (!profId) { setHorariosProfissional([]); return }
    const sb = createClient()
    const { data } = await sb
      .from('horarios_prof')
      .select('dia_semana, hora_inicio, hora_fim, ativo')
      .eq('profissional_id', profId)
    setHorariosProfissional(data || [])
  }

  async function adicionarAutoAgenda() {
    if (!selecionado?.id || !empresaAtiva?.id) return
    if (!aaForm.horario) return
    if (!aaForm.profissional_id) { alert('Selecione um profissional para continuar.'); return }
    setAaSalvando(true)
    const sb = createClient()

    const diaSelecionado = parseInt(aaForm.dia_semana)
    const profNome = profissionais.find(p => p.id === aaForm.profissional_id)?.nome || 'o profissional'

    // Verificar se o profissional trabalha no dia selecionado
    if (horariosProfissional.length > 0) {
      const horarioDia = horariosProfissional.find(h => h.dia_semana === diaSelecionado)
      const diaNome = DIAS_SEMANA[diaSelecionado]

      if (!horarioDia || !horarioDia.ativo) {
        alert(`⛔ Dia de descanso!\n\n${profNome} não trabalha na ${diaNome}.\n\nEscolha outro dia da semana.`)
        setAaSalvando(false)
        return
      }

      // Verificar se o horário está dentro do expediente
      const [hIni, mIni] = horarioDia.hora_inicio.split(':').map(Number)
      const [hFim, mFim] = horarioDia.hora_fim.split(':').map(Number)
      const [hSel, mSel] = aaForm.horario.split(':').map(Number)
      const minIni = hIni * 60 + mIni
      const minFim = hFim * 60 + mFim
      const minSel = hSel * 60 + mSel

      if (minSel < minIni || minSel >= minFim) {
        alert(`⛔ Horário fora do expediente!\n\n${profNome} trabalha na ${diaNome} das ${horarioDia.hora_inicio.slice(0,5)} às ${horarioDia.hora_fim.slice(0,5)}.\n\nEscolha um horário dentro deste intervalo.`)
        setAaSalvando(false)
        return
      }
    }

    // Verificar conflito com outro cliente no mesmo profissional/dia/horário (AutoAgenda)
    if (aaForm.profissional_id) {
      const { data: conflitoAA } = await sb
        .from('auto_agenda')
        .select('id, cliente_id, clientes!inner(nome)')
        .eq('empresa_id', empresaAtiva.id)
        .eq('profissional_id', aaForm.profissional_id)
        .eq('dia_semana', diaSelecionado)
        .eq('horario', aaForm.horario + ':00')
        .eq('ativo', true)
        .neq('cliente_id', selecionado.id)
        .maybeSingle()

      if (conflitoAA) {
        const nomeCliente = (conflitoAA as any).clientes?.nome || 'outro cliente'
        const diaNome = DIAS_SEMANA[diaSelecionado]
        alert(`⚠️ Conflito de AutoAgenda!\n\n${profNome} já tem AutoAgenda configurado para "${nomeCliente}" às ${aaForm.horario} toda ${diaNome}.\n\nEscolha outro horário ou outro profissional.`)
        setAaSalvando(false)
        return
      }

      // Verificar também agendamentos reais já marcados na agenda
      // para este profissional no mesmo dia da semana e horário (próximas 8 semanas)
      const horaSel = aaForm.horario // HH:MM
      const [hh, mm] = horaSel.split(':').map(Number)
      const minSel = hh * 60 + mm

      // Monta janela de busca: hoje até 8 semanas à frente
      const agoraBRT = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const fim8sem  = new Date(agoraBRT.getTime() + 56 * 24 * 60 * 60 * 1000)
      const dataIniStr = agoraBRT.toISOString().slice(0, 10)
      const dataFimStr = fim8sem.toISOString().slice(0, 10)

      const { data: agsExistentes } = await sb
        .from('agendamentos')
        .select('id, cliente_id, data_inicio, clientes!inner(nome)')
        .eq('empresa_id', empresaAtiva.id)
        .eq('prof_id', aaForm.profissional_id)
        .neq('status', 'cancelado')
        .gte('data_inicio', dataIniStr + 'T00:00:00')
        .lte('data_inicio', dataFimStr + 'T23:59:59')

      if (agsExistentes && agsExistentes.length > 0) {
        for (const ag of agsExistentes) {
          const agData = new Date(ag.data_inicio)
          // Converter para BRT para verificar dia da semana e horário corretos
          const agBRT = new Date(agData.getTime() - 3 * 60 * 60 * 1000)
          const agDiaSemana = agBRT.getUTCDay()
          const agMin = agBRT.getUTCHours() * 60 + agBRT.getUTCMinutes()

          // Mesmo dia da semana e mesma hora (±5 min de tolerância)?
          // Mas ignora se for do próprio cliente que está sendo editado
          if (agDiaSemana === diaSelecionado && Math.abs(agMin - minSel) <= 5 && ag.cliente_id !== selecionado.id) {
            const nomeCliente = (ag as any).clientes?.nome || 'outro cliente'
            const diaNome = DIAS_SEMANA[diaSelecionado]
            const dataFormatada = agBRT.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
            alert(`⚠️ Agenda já ocupada!\n\n${profNome} já tem um agendamento marcado para "${nomeCliente}" às ${horaSel} na ${diaNome} (ex: ${dataFormatada}).\n\nEste horário está ocupado neste dia da semana. Escolha outro horário ou outro profissional.`)
            setAaSalvando(false)
            return
          }
        }
      }
    }

    const { error } = await sb.from('auto_agenda').insert({
      empresa_id: empresaAtiva.id,
      cliente_id: selecionado.id,
      dia_semana: diaSelecionado,
      horario: aaForm.horario + ':00',
      profissional_id: aaForm.profissional_id || null,
      servico_id: aaForm.servico_id || null,
      ativo: true,
    })
    if (error) {
      if (error.code === '23505') alert('Já existe um AutoAgenda para este cliente neste dia/horário.')
      else alert('Erro ao adicionar: ' + error.message)
    } else {
      setAaForm({ dia_semana:'1', horario:'09:00', profissional_id:'', servico_id:'' })
      setHorariosProfissional([])
      await carregarAutoAgendas(selecionado.id)
    }
    setAaSalvando(false)
  }

  async function alternarAutoAgenda(id: string, ativo: boolean) {
    const sb = createClient()
    await sb.from('auto_agenda').update({ ativo: !ativo }).eq('id', id)
    if (selecionado?.id) await carregarAutoAgendas(selecionado.id)
  }

  async function excluirAutoAgenda(id: string) {
    if (!confirm('Remover este AutoAgenda? Os agendamentos já criados não serão afetados.')) return
    const sb = createClient()
    await sb.from('auto_agenda').delete().eq('id', id)
    if (selecionado?.id) await carregarAutoAgendas(selecionado.id)
  }

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro(''); setAbaModal('dados')
    setForm(formVazio); setAutoAgendas([])
    setModalAberto(true)
  }

  function abrirEdicao(c: Cliente) {
    setModoEdicao(true); setSelecionado(c); setErro(''); setAbaModal('dados')
    setForm({
      nome: c.nome, cpf: c.cpf, telefone: c.telefone, whatsapp: c.whatsapp,
      email: c.email, data_nascimento: c.data_nascimento, endereco: c.endereco,
      plano_id: c.plano_id, observacoes: c.observacoes, status: c.status,
    })
    carregarAutoAgendas(c.id)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false); setSelecionado(null); setErro(''); setAbaModal('dados')
    setAutoAgendas([])
  }

  async function salvar() {
    if (modoEdicao && !perm.alterar) return
    if (!perm.criar && !modoEdicao) return
    if (!form.nome.trim()) return setErro('Nome completo é obrigatório.')
    if (form.nome.trim().split(' ').length < 2) return setErro('Informe o nome completo (nome e sobrenome).')
    if (!form.data_nascimento) return setErro('Data de nascimento é obrigatória.')
    if (!form.whatsapp || form.whatsapp.replace(/\D/g,'').length < 10) return setErro('WhatsApp válido é obrigatório.')
    if (!form.status) return setErro('Status é obrigatório.')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErro('E-mail inválido.')
    if (!empresaAtiva?.id) return setErro('Empresa não identificada.')
    setSalvando(true); setErro('')
    const sb = createClient()

    const payload: Record<string, any> = {
      nome:            form.nome.trim(),
      cpf:             form.cpf || null,
      telefone:        form.telefone || null,
      whatsapp:        form.whatsapp || null,
      email:           form.email || null,
      data_nascimento: form.data_nascimento || null,
      endereco:        form.endereco || null,
      plano_id:        form.plano_id || null,
      observacoes:     form.observacoes || null,
      status:          form.status,
    }

    let error: any
    if (modoEdicao && selecionado) {
      const res = await sb.from('clientes').update(payload).eq('id', selecionado.id)
      error = res.error
    } else {
      const res = await sb.from('clientes').insert({ ...payload, empresa_id: empresaAtiva.id })
      error = res.error
    }

    if (error) {
      console.error('Erro ao salvar cliente:', error)
      setErro('Erro ao salvar: ' + error.message)
      setSalvando(false)
      return
    }

    await carregar()
    fecharModal()
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!perm.excluir) return
    if (!confirm('Excluir este cliente?')) return
    const sb = createClient()
    const { error } = await sb.from('clientes').delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    await carregar()
    fecharModal()
  }

  const f = (k: keyof typeof form) => (e: any) => { const v = e.target.value; const mascarados = ['telefone','whatsapp']; setForm(p => ({ ...p, [k]: mascarados.includes(String(k)) ? mascaraTel(v) : v })) }

  const ehLucas = usuario?.email === 'lucas@fortitude.com'

  function exportarClientesExcel() {
    const BOM = '\uFEFF'
    const SEP = ';'
    const NL  = '\r\n'
    const esc = (v: string) => {
      const s = String(v || '').replace(/\r?\n/g, ' ')
      return s.includes(SEP) || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const header = ['Nome','Email','Telefone','WhatsApp','Data Nascimento','Plano','Status','Endereco','Observacoes','Data Cadastro']
    const linhas = clientes.map(c => [
      c.nome || '',
      c.email || '',
      c.telefone || '',
      c.whatsapp || '',
      c.data_nascimento ? new Date(c.data_nascimento+'T12:00:00').toLocaleDateString('pt-BR') : '',
      c.plano_id ? (planos.find(p=>p.id===c.plano_id)?.nome || '') : '',
      c.status === 'ativo' ? 'Ativo' : c.status === 'inativo' ? 'Inativo' : (c.status || ''),
      c.endereco || '',
      c.observacoes || '',
      c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
    ].map(esc).join(SEP))
    const csv = BOM + header.map(esc).join(SEP) + NL + linhas.join(NL)
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const emp  = empresaAtiva?.nome?.replace(/\s+/g,'_') || 'empresa'
    const data = new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')
    a.href = url; a.download = `clientes_${emp}_${data}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding:'16px 12px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 12px 12px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Clientes</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{clientes.length} cadastrados{empresaAtiva ? ` · ${empresaAtiva.nome}` : ''}</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {ehLucas && (
            <button onClick={exportarClientesExcel}
              style={{ background:'#16a34a', color:'white', border:'none', borderRadius:'8px', padding:'9px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar Excel
            </button>
          )}
          {perm.criar && (
            <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
              + Novo cliente
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'18px', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:'200px', maxWidth:'300px' }}>
          <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}/>
        </div>
        <select style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {/* Tabela */}
      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
            <thead>
              <tr style={{ background:'#fafafa', borderBottom:'1px solid #f3f4f6' }}>
                {['Cliente','Contato','Plano','Status',''].map(col => (
                  <th key={col} style={{ padding:'12px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} style={{ borderBottom:'1px solid #f9fafb' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#fafafa' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent' }}>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'600', color:'#6366f1', flexShrink:0 }}>
                        {c.nome?.split(' ').map(n => n[0]).slice(0,2).join('')}
                      </div>
                      <div>
                        <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'1px' }}>{c.nome}</p>
                        <p style={{ fontSize:'12px', color:'#9ca3af' }}>{c.email || '--'}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    {c.whatsapp ? (
                      <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                        style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#16a34a', fontWeight:'500', textDecoration:'none' }}>
                        💬 {c.whatsapp}
                      </a>
                    ) : c.telefone ? (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#6b7280' }}>📞 {c.telefone}</span>
                    ) : <span style={{ fontSize:'13px', color:'#d1d5db' }}>--</span>}
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background: c.plano_id ? '#eef2ff' : '#f3f4f6', color: c.plano_id ? '#6366f1' : '#6b7280' }}>
                      {c.plano_nome}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background: c.status==='ativo'?'#ecfdf5':'#f9fafb', color: c.status==='ativo'?'#10b981':'#9ca3af' }}>
                      {c.status==='ativo'?'Ativo':'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    {perm.alterar && (
              <button onClick={() => abrirEdicao(c)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(99,102,241,0.15)' }} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff';el.style.boxShadow='0 3px 8px rgba(99,102,241,0.25)';el.style.transform='translateY(-1px)'}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.boxShadow='0 1px 3px rgba(99,102,241,0.15)';el.style.transform='translateY(0)'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>
              )}
                    <button onClick={() => abrirHistorico(c)} style={{ background:'white', border:'1.5px solid #d1fae5', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#059669', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(5,150,105,0.15)' }} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#f0fdf4'}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Historico
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'560px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 18px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao ? 'Editar cliente' : '+ Novo cliente'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px', color:'#6b7280' }}>×</button>
            </div>

            {/* Abas */}
            <div style={{ display:'flex', gap:'0', marginBottom:'20px', borderBottom:'2px solid #f3f4f6' }}>
              <button onClick={()=>setAbaModal('dados')} style={{ padding:'9px 18px', border:'none', background:'none', cursor:'pointer', fontSize:'13px', fontWeight:abaModal==='dados'?'700':'500', color:abaModal==='dados'?'#6366f1':'#9ca3af', borderBottom:abaModal==='dados'?'2.5px solid #6366f1':'2.5px solid transparent', marginBottom:'-2px' }}>
                Dados
              </button>
              {modoEdicao && autoAgendaHabilitado && (
                <button onClick={()=>setAbaModal('autoagenda')} style={{ padding:'9px 18px', border:'none', background:'none', cursor:'pointer', fontSize:'13px', fontWeight:abaModal==='autoagenda'?'700':'500', color:abaModal==='autoagenda'?'#0891b2':'#9ca3af', borderBottom:abaModal==='autoagenda'?'2.5px solid #0891b2':'2.5px solid transparent', marginBottom:'-2px', display:'flex', alignItems:'center', gap:'6px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>
                  AutoAgenda {autoAgendas.filter(a=>a.ativo).length > 0 && <span style={{ background:'#0891b2', color:'white', borderRadius:'99px', padding:'1px 7px', fontSize:'10px', fontWeight:'700' }}>{autoAgendas.filter(a=>a.ativo).length}</span>}
                </button>
              )}
            </div>

            {/* Aba Dados */}
            {abaModal === 'dados' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome completo *</label>
                    <input value={form.nome} onChange={f('nome')} style={inputStyle} placeholder="Nome do cliente"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>CPF</label>
                    <input value={form.cpf} onChange={f('cpf')} style={inputStyle} placeholder="000.000.000-00"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Data de nascimento</label>
                    <input type="date" value={form.data_nascimento} onChange={f('data_nascimento')} style={inputStyle}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                    <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>WhatsApp</label>
                    <input value={form.whatsapp} onChange={f('whatsapp')} style={inputStyle} placeholder="(11) 99999-0000"/>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail</label>
                    <input type="email" value={form.email} onChange={f('email')} style={inputStyle} placeholder="email@exemplo.com"/>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Endereço</label>
                    <input value={form.endereco} onChange={f('endereco')} style={inputStyle} placeholder="Rua, número, bairro"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Plano</label>
                    <select value={form.plano_id} onChange={f('plano_id')} style={{ ...inputStyle, padding:'9px 12px' }}>
                      <option value="">Sem plano (avulso)</option>
                      {planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                    <select value={form.status} onChange={f('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Observações</label>
                    <textarea rows={3} value={form.observacoes} onChange={f('observacoes')} style={{ ...inputStyle, resize:'none' }} placeholder="Informações adicionais..."/>
                  </div>
                </div>
                {erro && (
                  <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>
                    {erro}
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
                  {modoEdicao && selecionado
                    ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Excluir</button>
                    : <div/>}
                  <div style={{ display:'flex', gap:'10px' }}>
                    <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                    {(modoEdicao ? perm.alterar : perm.criar) && (
                      <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                        {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Salvar cliente'}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Aba AutoAgenda */}
            {abaModal === 'autoagenda' && (
              <div>
                <div style={{ background:'#ecfeff', border:'1px solid #a5f3fc', borderRadius:'12px', padding:'12px 14px', marginBottom:'18px', fontSize:'13px', color:'#0e7490' }}>
                  <b>Como funciona:</b> cadastre o dia da semana, horário, profissional e serviço. O sistema agendará automaticamente toda semana, inclusive com 1 dia de antecedência para não perder o horário.
                </div>

                {/* Formulário de novo AutoAgenda */}
                {perm.alterar && (
                  <div style={{ background:'#f8fafc', borderRadius:'14px', padding:'16px', marginBottom:'18px', border:'1px solid #f0f0f8' }}>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#374151', marginBottom:'12px' }}>Adicionar horário fixo</p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                      <div>
                        <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#6b7280', marginBottom:'5px' }}>Profissional *</label>
                        <select value={aaForm.profissional_id} onChange={e=>{ setAaForm(p=>({...p, profissional_id:e.target.value, servico_id:'', dia_semana:'1'})); carregarHorariosProfissional(e.target.value) }} style={{ ...inputStyle, padding:'8px 10px', fontSize:'13px' }}>
                          <option value="">Selecionar profissional</option>
                          {profissionais.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </div>
                      <div>{/* espaçador */}</div>
                      <div>
                        <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#6b7280', marginBottom:'5px' }}>Dia da semana</label>
                        <select value={aaForm.dia_semana} onChange={e=>setAaForm(p=>({...p,dia_semana:e.target.value}))} disabled={!aaForm.profissional_id} style={{ ...inputStyle, padding:'8px 10px', fontSize:'13px', background:!aaForm.profissional_id?'#f9fafb':'white' }}>
                          {DIAS_SEMANA.map((d,i)=>{
                            const hDia = horariosProfissional.find(h=>h.dia_semana===i)
                            const trabalhaNoDia = horariosProfissional.length === 0 || (hDia?.ativo === true)
                            return (
                              <option key={i} value={String(i)}>
                                {d}{!trabalhaNoDia ? ' — descanso' : hDia ? ` (${hDia.hora_inicio.slice(0,5)}–${hDia.hora_fim.slice(0,5)})` : ''}
                              </option>
                            )
                          })}
                        </select>
                        {aaForm.profissional_id && horariosProfissional.length > 0 && (() => {
                          const hDia = horariosProfissional.find(h => h.dia_semana === parseInt(aaForm.dia_semana))
                          if (!hDia || !hDia.ativo) return (
                            <p style={{ fontSize:'11px', color:'#dc2626', marginTop:'4px', fontWeight:'600' }}>⛔ Dia de descanso</p>
                          )
                          return (
                            <p style={{ fontSize:'11px', color:'#059669', marginTop:'4px' }}>
                              Expediente: {hDia.hora_inicio.slice(0,5)} às {hDia.hora_fim.slice(0,5)}
                            </p>
                          )
                        })()}
                      </div>
                      <div>
                        <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#6b7280', marginBottom:'5px' }}>Horário</label>
                        <input type="time" value={aaForm.horario} onChange={e=>setAaForm(p=>({...p,horario:e.target.value}))} disabled={!aaForm.profissional_id} style={{ ...inputStyle, padding:'8px 10px', fontSize:'13px', background:!aaForm.profissional_id?'#f9fafb':'white' }}/>
                        {aaForm.profissional_id && horariosProfissional.length > 0 && aaForm.horario && (() => {
                          const hDia = horariosProfissional.find(h => h.dia_semana === parseInt(aaForm.dia_semana))
                          if (!hDia || !hDia.ativo) return null
                          const [hIni, mIni] = hDia.hora_inicio.split(':').map(Number)
                          const [hFim, mFim] = hDia.hora_fim.split(':').map(Number)
                          const [hSel, mSel] = aaForm.horario.split(':').map(Number)
                          const minSel = hSel * 60 + mSel
                          if (minSel < hIni * 60 + mIni || minSel >= hFim * 60 + mFim) return (
                            <p style={{ fontSize:'11px', color:'#dc2626', marginTop:'4px', fontWeight:'600' }}>
                              ⛔ Fora do expediente ({hDia.hora_inicio.slice(0,5)}–{hDia.hora_fim.slice(0,5)})
                            </p>
                          )
                          return null
                        })()}
                      </div>
                      {/* Serviço só aparece após selecionar profissional */}
                      {aaForm.profissional_id && (() => {
                        const profSel = profissionais.find(p => p.id === aaForm.profissional_id)
                        const servicosDoProf = profSel?.servicos?.length
                          ? servicos.filter(s => profSel.servicos.includes(s.nome))
                          : servicos
                        return (
                          <div style={{ gridColumn:'1/-1' }}>
                            <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#6b7280', marginBottom:'5px' }}>
                              Serviço {profSel?.servicos?.length ? `(${profSel.nome})` : ''}
                            </label>
                            {servicosDoProf.length === 0 ? (
                              <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#92400e' }}>
                                Nenhum serviço vinculado a este profissional.
                              </div>
                            ) : (
                              <select value={aaForm.servico_id} onChange={e=>setAaForm(p=>({...p,servico_id:e.target.value}))} style={{ ...inputStyle, padding:'8px 10px', fontSize:'13px' }}>
                                <option value="">Nenhum</option>
                                {servicosDoProf.map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
                              </select>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                    <button onClick={adicionarAutoAgenda} disabled={aaSalvando || !aaForm.horario} style={{ width:'100%', background:aaSalvando?'#a5b4fc':'#0891b2', color:'white', border:'none', borderRadius:'10px', padding:'10px', fontSize:'13px', fontWeight:'700', cursor:aaSalvando?'not-allowed':'pointer' }}>
                      {aaSalvando ? 'Salvando...' : '+ Adicionar horário'}
                    </button>
                  </div>
                )}

                {/* Lista de AutoAgendas do cliente */}
                {aaCarregando ? (
                  <p style={{ textAlign:'center', color:'#9ca3af', padding:'20px', fontSize:'13px' }}>Carregando...</p>
                ) : autoAgendas.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'32px', color:'#9ca3af' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e5e7eb" strokeWidth="1.5" style={{ display:'block', margin:'0 auto 10px' }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p style={{ fontSize:'14px' }}>Nenhum horário automático cadastrado.</p>
                    <p style={{ fontSize:'12px', marginTop:'4px' }}>Adicione um horário fixo acima.</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {autoAgendas.map((aa: any) => {
                      const profNome = profissionais.find(p=>p.id===aa.profissional_id)?.nome || 'Qualquer'
                      const srvNome  = servicos.find(s=>s.id===aa.servico_id)?.nome || 'Nenhum'
                      const hora = (aa.horario||'').slice(0,5)
                      return (
                        <div key={aa.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', borderRadius:'12px', background: aa.ativo ? 'white' : '#f9fafb', border:`1px solid ${aa.ativo ? '#e0e7ff' : '#f0f0f0'}`, opacity: aa.ativo ? 1 : 0.7 }}>
                          <div style={{ width:'42px', height:'42px', borderRadius:'10px', background: aa.ativo ? '#ecfeff' : '#f3f4f6', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ fontSize:'10px', fontWeight:'700', color: aa.ativo ? '#0891b2' : '#9ca3af', textTransform:'uppercase' }}>{DIAS_SEMANA[aa.dia_semana]?.slice(0,3)}</span>
                            <span style={{ fontSize:'12px', fontWeight:'800', color: aa.ativo ? '#0e7490' : '#9ca3af' }}>{hora}</span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a2e', overflowWrap:'break-word' }}>{DIAS_SEMANA[aa.dia_semana]} às {hora}</p>
                            <p style={{ fontSize:'11.5px', color:'#6b7280' }}>{srvNome} · {profNome}</p>
                          </div>
                          {!aa.ativo && <span style={{ fontSize:'10px', fontWeight:'700', background:'#f3f4f6', color:'#9ca3af', borderRadius:'99px', padding:'2px 8px', whiteSpace:'nowrap' }}>Inativo</span>}
                          {perm.alterar && (
                            <button onClick={()=>alternarAutoAgenda(aa.id, aa.ativo)} title={aa.ativo?'Desativar':'Ativar'} style={{ background: aa.ativo ? '#ecfdf5' : '#f3f4f6', border:'none', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'11px', fontWeight:'600', color: aa.ativo ? '#059669' : '#9ca3af', whiteSpace:'nowrap' }}>
                              {aa.ativo ? 'Ativo' : 'Inativo'}
                            </button>
                          )}
                          {perm.alterar && (
                            <button onClick={()=>excluirAutoAgenda(aa.id)} title="Remover" style={{ background:'#fef2f2', border:'none', borderRadius:'8px', padding:'6px 8px', cursor:'pointer', color:'#ef4444', fontSize:'14px', flexShrink:0 }}>×</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div style={{ marginTop:'20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                  {(isMaster || empresaAtiva?.auto_agenda_habilitado) && (
                    <button onClick={async () => {
                      if (!confirm('Executar AutoAgenda agora? O sistema criará os agendamentos desta semana para este e todos os clientes com AutoAgenda ativo.')) return
                      try {
                        const res = await fetch('/api/cron/auto-agenda')
                        const json = await res.json()
                        alert(`✅ ${json.message}\n\nHoje (BRT): ${json.hoje_brt} (dia ${json.hoje_diasemana})\nAmanhã (BRT): ${json.amanha_brt}\nConfigs ativas: ${json.configs_ativas}\n\n${json.detalhes?.slice(0,5).join('\n') || ''}`)
                        if (selecionado?.id) await carregarAutoAgendas(selecionado.id)
                      } catch (e) {
                        alert('Erro ao executar: ' + String(e))
                      }
                    }} style={{ background:'#ecfeff', color:'#0891b2', border:'1px solid #a5f3fc', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
                      ▶ Executar agora
                    </button>
                  )}
                  <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', cursor:'pointer' }}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Historico do Cliente */}
      {modalHistorico && clienteHistorico && (
        <div onClick={fecharHistorico} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'680px', borderRadius:'20px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>
            {/* Header */}
            <div style={{ padding:'22px 24px 16px', borderBottom:'1px solid #f0f0f8', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'42px', height:'42px', borderRadius:'50%', background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color:'white', flexShrink:0 }}>
                  {clienteHistorico.nome?.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
                </div>
                <div>
                  <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a' }}>Historico - {clienteHistorico.nome}</h2>
                  <p style={{ fontSize:'12px', color:'#9ca3af' }}>{clienteHistorico.whatsapp || clienteHistorico.telefone || clienteHistorico.email || ''}</p>
                </div>
              </div>
              <button onClick={fecharHistorico} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'32px', height:'32px', cursor:'pointer', fontSize:'16px' }}>x</button>
            </div>
            {/* Filtro de periodo */}
            <div style={{ padding:'14px 24px', borderBottom:'1px solid #f5f5fb', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
              <span style={{ fontSize:'12px', color:'#6b7280', fontWeight:'600' }}>Periodo:</span>
              <input type="date" value={histFiltroIni} onChange={e=>setHistFiltroIni(e.target.value)} style={{ border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'6px 10px', fontSize:'13px', outline:'none' }}/>
              <span style={{ fontSize:'12px', color:'#9ca3af' }}>ate</span>
              <input type="date" value={histFiltroFim} onChange={e=>setHistFiltroFim(e.target.value)} style={{ border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'6px 10px', fontSize:'13px', outline:'none' }}/>
              <button onClick={()=>{setHistFiltroIni('');setHistFiltroFim('')}} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'6px 12px', fontSize:'12px', cursor:'pointer', color:'#6b7280' }}>Limpar</button>
              {(() => {
                const filt = historico.filter(h => {
                  if (histFiltroIni && h.data < histFiltroIni) return false
                  if (histFiltroFim && h.data > histFiltroFim) return false
                  return true
                })
                const total = filt.filter(h=>h.status==='fechado').reduce((s:number,h:any)=>s+(h.valor||0),0)
                return <span style={{ marginLeft:'auto', fontSize:'13px', fontWeight:'700', color:'#059669' }}>Total recebido: R$ {total.toFixed(2).replace('.',',')}</span>
              })()}
            </div>
            {/* Lista */}
            <div style={{ flex:1, overflowY:'auto', padding:'8px 24px 20px' }}>
              {histCarregando ? (
                <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div>
              ) : (() => {
                const filt = historico.filter(h => {
                  if (histFiltroIni && h.data < histFiltroIni) return false
                  if (histFiltroFim && h.data > histFiltroFim) return false
                  return true
                })
                if (filt.length === 0) return <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum atendimento encontrado.</div>
                return filt.map((h:any) => (
                  <div key={h.id} style={{ padding:'12px 14px', borderRadius:'12px', border:'1px solid #f0f0f8', marginBottom:'8px', background:h.status==='fechado'?'#f0fdf4':h.status==='cancelado'?'#fff1f2':'#f8faff' }}>
                    {/* Linha 1: hora/data + badge status */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <p style={{ fontSize:'13px', fontWeight:'700', color:'#374151', fontFamily:'monospace' }}>{h.hora}</p>
                        <p style={{ fontSize:'11px', color:'#9ca3af' }}>{h.data ? new Date(h.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : ''}</p>
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:'700', padding:'3px 8px', borderRadius:'99px', flexShrink:0, background:h.status==='fechado'?'#d1fae5':h.status==='cancelado'?'#ffe4e6':'#dbeafe', color:h.status==='fechado'?'#065f46':h.status==='cancelado'?'#be123c':'#1d4ed8' }}>
                        {h.status==='fechado'?'Finalizado':h.status==='cancelado'?'Cancelado':'Aberto'}
                      </span>
                    </div>
                    {/* Linha 2: servico + valor */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827' }}>{h.servico}</p>
                        <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'1px' }}>{h.profissional}</p>
                        {h.observacoes && (
                          <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'3px', fontStyle:'italic' }}>
                            {h.observacoes}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <p style={{ fontSize:'14px', fontWeight:'700', color:h.status==='fechado'?'#059669':'#9ca3af' }}>
                          {h.status==='fechado' ? 'R$ '+Number(h.valor).toFixed(2).replace('.',',') : '--'}
                        </p>
                        {h.forma && (
                          <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'2px', maxWidth:'120px', wordBreak:'break-word', textAlign:'right' }}>
                            {h.forma.split('+').join(' + ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
