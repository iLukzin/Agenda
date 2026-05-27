'use client'
// v13

import { useState, useMemo, useEffect, useCallback } from 'react'
import { corStatus, labelStatus, createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import {
  criarAgendamento, atualizarAgendamento, excluirAgendamento,
} from '@/lib/api'

const HORA_INICIO = 7
const ALTURA_HORA = 60
const HORAS = Array.from({length:14}, (_,i) => (i+7).toString().padStart(2,'0') + ':00')

// -- Helpers fuso Brasil --------------------------------------
function hojeNoBrasil(): Date {
  const str = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(str); d.setHours(0,0,0,0); return d
}
function inicioSemana(ref: Date): Date {
  const d = new Date(ref); d.setHours(0,0,0,0)
  const dow = d.getDay(); d.setDate(d.getDate()-(dow===0?6:dow-1)); return d
}
function addDias(d: Date, n: number): Date { const r=new Date(d); r.setDate(r.getDate()+n); return r }
function toISO(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function isoParaDate(iso: string): Date { const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d) }
function isMesmoISO(a: Date, b: Date): boolean { return toISO(a)===toISO(b) }
function nomeDiaCurto(d: Date): string {
  return d.toLocaleDateString('pt-BR',{weekday:'short',timeZone:'America/Sao_Paulo'})
    .replace('.','').replace(/^\w/,c=>c.toUpperCase())
}
function numeroDia(d: Date): number { return d.getDate() }
function labelPeriodoSemana(seg: Date): string {
  const sab=addDias(seg,5)
  const mI=seg.toLocaleDateString('pt-BR',{month:'short',timeZone:'America/Sao_Paulo'}).replace('.','')
  const mF=sab.toLocaleDateString('pt-BR',{month:'short',timeZone:'America/Sao_Paulo'}).replace('.','')
  return mI===mF
    ? numeroDia(seg) + ' - ' + numeroDia(sab) + ' de ' + mI + ' ' + sab.getFullYear()
    : numeroDia(seg) + ' ' + mI + ' - ' + numeroDia(sab) + ' ' + mF + ' ' + sab.getFullYear()
}
function labelDia(d: Date): string {
  return d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'})
}
function linhaHoraAtual(): number|null {
  const s=new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})
  const [h,m]=s.split(':').map(Number)
  if(h<HORA_INICIO||h>HORA_INICIO+13) return null
  return (h-HORA_INICIO)*ALTURA_HORA+(m/60)*ALTURA_HORA
}

type AgendamentoLocal = {
  id: string; dataISO: string; horaInicio: number; duracao: number
  cliente: string; clienteId: string; servico: string; profissional: string
  cor: string; status: string; observacoes: string; forma_pagamento: string; valor: number
  motivoCancelamento?: string
}

type HorarioDB = {
  profissional_id: string; dia_semana: number; hora_inicio: string; hora_fim: string
}

const FORMAS_PAG = [
  {value:'',label:'Selecionar...'},{value:'dinheiro',label:'Dinheiro'},
  {value:'pix',label:'PIX'},{value:'cartao_credito',label:'Cartão de crédito'},
  {value:'cartao_debito',label:'Cartão de débito'},{value:'transferencia',label:'Transferência'},
  {value:'plano',label:'Plano mensal'},
]

function InputField({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>{label}</label>
      {children}
    </div>
  )
}
const inputStyle  = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }
const selectStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }

// -- Mini calendário ------------------------------------------
function MiniCalendario({ dataSel, onChange, onFechar }: { dataSel:Date; onChange:(d:Date)=>void; onFechar:()=>void }) {
  const hoje = hojeNoBrasil()
  const [mes, setMes] = useState(new Date(dataSel.getFullYear(), dataSel.getMonth(), 1))
  const inicio = (() => { const d=new Date(mes.getFullYear(),mes.getMonth(),1); const dow=d.getDay(); d.setDate(d.getDate()-(dow===0?6:dow-1)); return d })()
  const celulas = Array.from({length:42},(_,i)=>addDias(inicio,i))
  const nomeMes = mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).replace(/^\w/,c=>c.toUpperCase())
  return (
    <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:200, background:'white', borderRadius:'14px', border:'1px solid #e5e7eb', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', padding:'16px', width:'268px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <button onClick={()=>setMes(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'#6b7280', padding:'2px 8px' }}><</button>
        <span style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a2e' }}>{nomeMes}</span>
        <button onClick={()=>setMes(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'#6b7280', padding:'2px 8px' }}>></button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:'4px' }}>
        {['S','T','Q','Q','S','S','D'].map((d,i)=><div key={i} style={{ textAlign:'center', fontSize:'10px', fontWeight:'600', color:'#9ca3af', padding:'3px 0' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'1px' }}>
        {celulas.map((data,i)=>{
          const estesMes=data.getMonth()===mes.getMonth(), ehHoje=isMesmoISO(data,hoje), ehSel=isMesmoISO(data,dataSel)
          return <button key={i} onClick={()=>{onChange(data);onFechar()}} style={{ width:'34px', height:'34px', borderRadius:'50%', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:ehSel||ehHoje?'700':'400', background:ehSel?'#6366f1':ehHoje?'#eef2ff':'transparent', color:ehSel?'white':ehHoje?'#6366f1':estesMes?'#1a1a2e':'#d1d5db' }}>{numeroDia(data)}</button>
        })}
      </div>
      <div style={{ display:'flex', gap:'6px', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #f3f4f6' }}>
        <button onClick={()=>{onChange(hoje);onFechar()}} style={{ flex:1, background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Hoje</button>
        <button onClick={onFechar} style={{ flex:1, background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'6px', padding:'6px', fontSize:'12px', cursor:'pointer' }}>Fechar</button>
      </div>
    </div>
  )
}

// -- Vista lista período --------------------------------------
function ListaPeriodo({ agendamentos, onEditar }: { agendamentos:AgendamentoLocal[]; onEditar:(ag:AgendamentoLocal)=>void }) {
  if (agendamentos.length===0) return <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af', fontSize:'14px' }}>Nenhum agendamento neste período.</div>
  const porData = agendamentos.reduce<Record<string,AgendamentoLocal[]>>((acc,ag)=>{
    acc[ag.dataISO]=acc[ag.dataISO]||[]; acc[ag.dataISO].push(ag); return acc
  },{})
  return (
    <div style={{ flex:1, overflowY:'auto', padding:'4px 2px' }}>
      {Object.keys(porData).sort().map(iso=>{
        const data=isoParaDate(iso), ehHoje=isMesmoISO(data,hojeNoBrasil())
        const ags=porData[iso].sort((a,b)=>a.horaInicio-b.horaInicio)
        const label=data.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'})
        return (
          <div key={iso} style={{ marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
              <div style={{ padding:'3px 12px', borderRadius:'99px', fontSize:'12px', fontWeight:'600', background:ehHoje?'#6366f1':'#f3f4f6', color:ehHoje?'white':'#374151', textTransform:'capitalize' }}>{label}</div>
              <div style={{ flex:1, height:'1px', background:'#f0f0f8' }}/>
              <span style={{ fontSize:'12px', color:'#9ca3af' }}>{ags.length} agend.</span>
            </div>
            {ags.map(ag=>(
              <div key={ag.id} onClick={()=>onEditar(ag)}
                style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'white', borderRadius:'10px', border:`1px solid ${ag.cor}30`, borderLeft:`4px solid ${ag.cor}`, cursor:'pointer', marginBottom:'6px', transition:'all .15s' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=ag.cor+'10'}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='white'}}>
                <div style={{ width:'46px', textAlign:'center', flexShrink:0 }}>
                  <p style={{ fontSize:'15px', fontWeight:'700', color:ag.cor, fontFamily:'monospace' }}>{String(ag.horaInicio).padStart(2,'0')}:00</p>
                  <p style={{ fontSize:'10px', color:'#9ca3af' }}>{ag.duracao} min</p>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ag.cliente}</p>
                  <p style={{ fontSize:'12px', color:'#9ca3af' }}>{ag.servico}</p>
                </div>
                <span className={corStatus(ag.status)} style={{ fontSize:'11px', padding:'3px 10px', borderRadius:'99px', flexShrink:0 }}>{labelStatus(ag.status)}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// -- Componente principal -------------------------------------
export default function AgendaPage() {
  const { empresaAtiva } = useEmpresa()
  const hoje = useMemo(()=>hojeNoBrasil(),[])

  const [agendamentos, setAgendamentos]   = useState<AgendamentoLocal[]>([])
  const [clientes, setClientes]           = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [servicos, setServicos]           = useState<any[]>([])
  const [horariosProfissional, setHorariosProfissional] = useState<HorarioDB[]>([])
  const [statusList, setStatusList] = useState<{id:string;nome:string;cor:string;icone:string}[]>([])
  const [carregando, setCarregando]       = useState(false)

  const [visualizacao, setVisualizacao]   = useState<'semana'|'dia'|'periodo'>('semana')
  const [semanaBase, setSemanaBase]       = useState<Date>(()=>inicioSemana(hojeNoBrasil()))
  const [diaAtivo, setDiaAtivo]           = useState<Date>(()=>hojeNoBrasil())
  const [calAberto, setCalAberto]         = useState(false)
  const [periodoInicio, setPeriodoInicio] = useState(toISO(hojeNoBrasil()))
  const [periodoFim, setPeriodoFim]       = useState(toISO(addDias(hojeNoBrasil(),30)))
  const [filtroAberto, setFiltroAberto]   = useState(false)

  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<AgendamentoLocal|null>(null)
  const [salvando, setSalvando]         = useState(false)
  const [finalizando, setFinalizando]     = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [cancelando, setCancelando]       = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clienteSel, setClienteSel]     = useState<any>(null)
  const [dropCliente, setDropCliente]   = useState(false)
  const [intervaloMin, setIntervaloMin] = useState(30)

  const [form, setForm] = useState({
    clienteId:'', cliente:'', servico:'', profissional:'',
    dataISO:toISO(hojeNoBrasil()), horaInicio:'09:00', duracao:'60',
    status:'agendado', forma_pagamento:'', valor:'', observacoes:'',
  })

  // -- Carrega dados ------------------------------------------
  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()

    // Busca tudo em paralelo com queries simples (sem join aninhado)
    const [
      { data: agsRaw,  error: errAgs },
      { data: clsRaw },
      { data: profsRaw },
      { data: servsRaw },
      { data: sts },
      { data: hors },
    ] = await Promise.all([
      sb.from('agendamentos')
        .select('id, data_inicio, status, valor, forma_pagamento, observacoes, cliente_id, servico_id, profissional_id, prof_id, motivo_cancelamento')
        .eq('empresa_id', empresaAtiva.id)
        .order('data_inicio'),
      sb.from('clientes')
        .select('id, nome, telefone, whatsapp')
        .eq('empresa_id', empresaAtiva.id),
      sb.from('profissionais')
        .select('id, nome, cargo, cor, status')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'ativo')
        .order('nome'),
      sb.from('servicos')
        .select('id, nome, cor, duracao_min, valor, status')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'ativo')
        .order('nome'),
      sb.from('status_agendamento')
        .select('id, nome, cor, icone')
        .eq('empresa_id', empresaAtiva.id)
        .order('ordem'),
      sb.from('horarios_prof')
        .select('profissional_id, dia_semana, hora_inicio, hora_fim, ativo')
        .eq('empresa_id', empresaAtiva.id)
        .eq('ativo', true),
    ])

    if (errAgs) console.error('[Agenda] Erro ao buscar agendamentos:', errAgs)

    // Mapas para join manual
    const cliMap:  Record<string,string> = {}
    const profMap: Record<string,string> = {}
    const servNom: Record<string,string> = {}
    const servCor: Record<string,string> = {}
    const servDur: Record<string,number> = {}

    ;(clsRaw   || []).forEach((c: any) => { cliMap[c.id]  = c.nome })
    ;(profsRaw || []).forEach((p: any) => { profMap[p.id] = p.nome })
    const servVal: Record<string,number> = {}
    ;(servsRaw || []).forEach((s: any) => {
      servNom[s.id] = s.nome
      servCor[s.id] = s.cor || '#6366f1'
      servDur[s.id] = s.duracao_min || 60
      servVal[s.id] = s.valor || 0
    })

    setStatusList(sts || [])
    setHorariosProfissional((hors || []) as HorarioDB[])
    setClientes(clsRaw || [])
    setProfissionais(profsRaw || [])
    setServicos(servsRaw || [])

    const mapped = (agsRaw || []).map((a: any) => {
      const dataISO  = a.data_inicio ? a.data_inicio.slice(0, 10) : toISO(hojeNoBrasil())
      const horaNum  = a.data_inicio ? parseInt(a.data_inicio.slice(11, 13)) : 0
      return {
        id:              a.id,
        dataISO,
        horaInicio:      horaNum,
        duracao:         servDur[a.servico_id]  || 60,
        cliente:         cliMap[a.cliente_id]   || '',
        clienteId:       a.cliente_id           || '',
        servico:         servNom[a.servico_id]  || '',
        profissional:    profMap[a.profissional_id] || '',
        cor:             servCor[a.servico_id]  || '#6366f1',
        status:          a.status              || '',
        observacoes:     a.observacoes         || '',
        forma_pagamento: a.forma_pagamento     || '',
        valor:               a.valor               || 0,
        motivoCancelamento:  a.motivo_cancelamento || undefined,
      }
    })

    setAgendamentos(mapped)
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  const diasSemana = useMemo(()=>Array.from({length:6},(_,i)=>addDias(semanaBase,i)),[semanaBase])

  // -- Navegação ----------------------------------------------
  function semanaAnterior() { setSemanaBase(d=>{const n=addDias(d,-7);const h=inicioSemana(hojeNoBrasil());return n<h?h:n}) }
  function semanaSeguinte() { setSemanaBase(d=>addDias(d,7)) }
  function diaAnterior()    { setDiaAtivo(d=>{const n=addDias(d,-1);const h=hojeNoBrasil();const f=n<h?h:n;setSemanaBase(inicioSemana(f));return f}) }
  function diaSeguinte()    { setDiaAtivo(d=>{const n=addDias(d,1);setSemanaBase(inicioSemana(n));return n}) }
  function irParaHoje()     { const h=hojeNoBrasil();setSemanaBase(inicioSemana(h));setDiaAtivo(h);setCalAberto(false) }
  function irParaData(d: Date) { setSemanaBase(inicioSemana(d));setDiaAtivo(d);setCalAberto(false) }

  // -- Modal --------------------------------------------------
  function abrirNovo() {
    const dataRef = visualizacao==='dia'?diaAtivo:hoje
    setModoEdicao(false); setSelecionado(null); setClienteSel(null); setBuscaCliente('')
    setIntervaloMin(30)
    // Não pré-seleciona serviço nem profissional -- usuário escolhe
    setForm({ clienteId:'', cliente:'', servico:'', profissional:'', dataISO:toISO(dataRef), horaInicio:'09:00', duracao:'60', status:'aberto', forma_pagamento:'', valor:'', observacoes:'' })
    setModalAberto(true)
  }

  function abrirEdicao(ag: AgendamentoLocal) {
    setModoEdicao(true); setSelecionado(ag)
    const cl = clientes.find((c:any) => c.id === ag.clienteId) || null
    setClienteSel(cl); setBuscaCliente('')
    // Preenche todos os campos com os dados reais do agendamento
    setForm({
      clienteId:       ag.clienteId,
      cliente:         ag.cliente,
      servico:         ag.servico,
      profissional:    ag.profissional,
      dataISO:         ag.dataISO,
      horaInicio:      String(ag.horaInicio).padStart(2,'0') + ':00',
      duracao:         String(ag.duracao),
      status:          ag.status,
      forma_pagamento: ag.forma_pagamento,
      valor:           String(ag.valor),
      observacoes:     ag.observacoes,
    })
    setIntervaloMin(30)
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setModoEdicao(false); setClienteSel(null); setBuscaCliente(''); setDropCliente(false); setModalCancelar(false); setMotivoCancelamento('') }

  async function salvar() {
    if (!form.clienteId || !form.profissional || !form.servico) return
    if (!empresaAtiva?.id) return
    setSalvando(true)
    const [h, m] = form.horaInicio.split(':').map(Number)
    const dataInicio = form.dataISO + 'T' + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':00'
    const servico = servicos.find((s: any)=>s.nome===form.servico)
    const prof    = profissionais.find((p: any)=>p.nome===form.profissional)
    const dataFim = new Date(new Date(dataInicio).getTime() + parseInt(form.duracao)*60000).toISOString()
    const payload = {
      cliente_id:      form.clienteId,
      servico_id:      servico?.id || null,
      profissional_id: null,          // removido FK para usuarios
      prof_id:         prof?.id || null, // FK para tabela profissionais
      data_inicio:     dataInicio,
      data_fim:        dataFim,
      status:          'aberto',      // sempre abre como 'aberto'
      tipo_cobranca:   'avulso',
      valor:           parseFloat(form.valor)||0,
      forma_pagamento: form.forma_pagamento||null,
      observacoes:     form.observacoes||null,
    }
    let error: any
    if (modoEdicao && selecionado) {
      ({ error } = await atualizarAgendamento(selecionado.id, payload))
    } else {
      ({ error } = await criarAgendamento(empresaAtiva.id, payload))
    }
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    const novaData = isoParaDate(form.dataISO)
    setSemanaBase(inicioSemana(novaData)); setDiaAtivo(novaData)
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function excluir(id: string) {
    // Abre modal de cancelamento em vez de window.confirm
    setMotivoCancelamento('')
    setModalCancelar(true)
  }

  async function confirmarCancelamento() {
    if (!selecionado) return
    setCancelando(true)
    const sb2 = createClient()
    const { error } = await sb2.from('agendamentos').update({
      status: 'cancelado',
      motivo_cancelamento: motivoCancelamento || null,
    }).eq('id', selecionado.id)
    if (error) { alert('Erro: ' + error.message); setCancelando(false); return }
    setCancelando(false)
    setModalCancelar(false)
    await carregar()
    fecharModal()
  }

  async function finalizar(id: string) {
    if (!confirm('Finalizar este atendimento? Não será possível alterar depois.')) return
    setFinalizando(true)
    const sb2 = createClient()
    const { error } = await sb2.from('agendamentos').update({ status:'fechado' }).eq('id', id)
    if (error) { alert('Erro: ' + error.message) }
    else {
      await carregar()
      fecharModal()
    }
    setFinalizando(false)
  }

  // -- Lógica de horários -------------------------------------
  const profSelecionado = profissionais.find((p: any) => p.nome === form.profissional)
  const diaSemanaForm   = form.dataISO ? isoParaDate(form.dataISO).getDay() : -1

  const horarioDoDiaForm: HorarioDB | undefined = profSelecionado ? horariosProfissional.find(h => h.profissional_id === profSelecionado.id && h.dia_semana === diaSemanaForm) : undefined

  const naoAtende = !!(profSelecionado && form.dataISO && !horarioDoDiaForm)

  const slotsDisponiveis = useMemo(() => {
    if (!horarioDoDiaForm || !form.dataISO || !profSelecionado) return []
    const slots: { hora:number; min:number; label:string; disponivel:boolean; clienteOcupa?:string }[] = []
    const [hIni, mIni] = horarioDoDiaForm.hora_inicio.split(':').map(Number)
    const [hFim, mFim] = horarioDoDiaForm.hora_fim.split(':').map(Number)
    const inicioMin = hIni*60 + mIni
    const fimMin    = hFim*60 + mFim
    const durMin    = parseInt(form.duracao) || 60
    for (let min = inicioMin; min + durMin <= fimMin; min += intervaloMin) {
      const hora  = Math.floor(min / 60)
      const resto = min % 60
      const label = String(hora).padStart(2,'0') + ':' + String(resto).padStart(2,'0')
      const conflito = agendamentos.find(ag => {
        if (ag.dataISO !== form.dataISO) return false
        if (ag.profissional !== form.profissional) return false
        // Ignora cancelados e finalizados (finalizados liberam o horário visualmente)
        if (ag.status === 'cancelado' || ag.status === 'cancelado') return false
        if (modoEdicao && selecionado && ag.id === selecionado.id) return false
        // Bloqueia apenas sobreposição real -- não mais agFimMin, usa só duracao do ag existente
        const agInicioMin = ag.horaInicio * 60
        const agFimMin    = agInicioMin + ag.duracao  // duração real do agendamento existente
        const slotFimMin  = min + durMin
        // Sobreposição: slot começa antes do fim do existente E termina depois do início
        return min < agFimMin && slotFimMin > agInicioMin
      })
      slots.push({ hora, min, label, disponivel:!conflito, clienteOcupa:conflito?.cliente })
    }
    return slots
  }, [horarioDoDiaForm, form.dataISO, form.profissional, form.duracao, intervaloMin, agendamentos, modoEdicao, selecionado])

  const horaSel    = form.horaInicio
  const slotSel    = slotsDisponiveis.find(s => s.label === horaSel)
  const btnBloqueado = ((naoAtende && !!profSelecionado) || (slotSel != null && !slotSel.disponivel) || !form.profissional || !form.clienteId)

  const diasParaMostrar = visualizacao==='dia'?[diaAtivo]:diasSemana
  const colunas         = diasParaMostrar.length
  const posLinha        = linhaHoraAtual()

  const agendamentosPeriodo = useMemo(()=>agendamentos.filter(a=>a.dataISO>=periodoInicio&&a.dataISO<=periodoFim).sort((a,b)=>a.dataISO.localeCompare(b.dataISO)||a.horaInicio-b.horaInicio),[agendamentos,periodoInicio,periodoFim])

  const labelPeriodoFiltro = (!periodoInicio || !periodoFim) ? 'Período' : (isoParaDate(periodoInicio).toLocaleDateString('pt-BR',{day:'numeric',month:'short',timeZone:'America/Sao_Paulo'}) + ' - ' + isoParaDate(periodoFim).toLocaleDateString('pt-BR',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Sao_Paulo'}))

  return (
    <div style={{ padding:'16px', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexShrink:0, flexWrap:'wrap', gap:'10px' }}>
        <div style={{ position:'relative' }}>
          <button onClick={()=>setCalAberto(c=>!c)} style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0 }}>
            <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#1a1a2e', display:'flex', alignItems:'center', gap:'6px' }}>Agenda <span style={{ fontSize:'16px' }}>📅</span></h1>
            <p style={{ fontSize:'13px', color:'#6366f1', fontWeight:'500', textTransform:'capitalize', textDecoration:'underline dotted' }}>
              {visualizacao==='periodo'?labelPeriodoFiltro:visualizacao==='semana'?labelPeriodoSemana(semanaBase):labelDia(diaAtivo)}
            </p>
          </button>
          {calAberto && (
            <><div onClick={()=>setCalAberto(false)} style={{ position:'fixed', inset:0, zIndex:199 }}/>
            <MiniCalendario dataSel={diaAtivo} onChange={d=>{irParaData(d);setVisualizacao('dia')}} onFechar={()=>setCalAberto(false)}/></>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          {/* Filtro período */}
          <div style={{ position:'relative' }}>
            <button onClick={()=>setFiltroAberto(f=>!f)} style={{ display:'flex', alignItems:'center', gap:'6px', background:'white', border:visualizacao==='periodo'?'1.5px solid #6366f1':'1px solid #e5e7eb', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'12px', fontWeight:'500', color:visualizacao==='periodo'?'#6366f1':'#374151' }}>
              🔍 Filtrar período
            </button>
            {filtroAberto && (
              <><div onClick={()=>setFiltroAberto(false)} style={{ position:'fixed', inset:0, zIndex:149 }}/>
              <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:150, background:'white', borderRadius:'14px', border:'1px solid #e5e7eb', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', padding:'18px', width:'280px' }}>
                <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'14px' }}>Filtrar por período</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
                  <div><label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>Data inicial</label><input type="date" value={periodoInicio} onChange={e=>setPeriodoInicio(e.target.value)} style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/></div>
                  <div><label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>Data final</label><input type="date" value={periodoFim} onChange={e=>setPeriodoFim(e.target.value)} style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/></div>
                </div>
                <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'6px', fontWeight:'500' }}>ATALHOS</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'12px' }}>
                  {[{label:'Hoje',ini:0,fim:0},{label:'7 dias',ini:0,fim:7},{label:'15 dias',ini:0,fim:15},{label:'30 dias',ini:0,fim:30},{label:'3 meses',ini:0,fim:90}].map(at=>(
                    <button key={at.label} onClick={()=>{const h=hojeNoBrasil();setPeriodoInicio(toISO(addDias(h,at.ini)));setPeriodoFim(toISO(addDias(h,at.fim)))}} style={{ background:'#f3f4f6', border:'none', borderRadius:'6px', padding:'6px 8px', fontSize:'11px', fontWeight:'500', color:'#374151', cursor:'pointer' }}>{at.label}</button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={()=>{setVisualizacao('periodo');setFiltroAberto(false)}} style={{ flex:1, background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>Ver agendamentos</button>
                  <button onClick={()=>{setFiltroAberto(false);if(visualizacao==='periodo')setVisualizacao('semana')}} style={{ background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', cursor:'pointer' }}>x</button>
                </div>
              </div></>
            )}
          </div>

          {visualizacao!=='periodo' && (
            <div style={{ display:'flex', gap:'4px' }}>
              <button onClick={visualizacao==='semana'?semanaAnterior:diaAnterior} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'16px' }}><</button>
              <button onClick={irParaHoje} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', color:'#6366f1' }}>Hoje</button>
              <button onClick={visualizacao==='semana'?semanaSeguinte:diaSeguinte} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'16px' }}>></button>
            </div>
          )}

          <div style={{ display:'flex', background:'#f3f4f6', borderRadius:'8px', padding:'3px' }}>
            {(['semana','dia'] as const).map(v=>(
              <button key={v} onClick={()=>setVisualizacao(v)} style={{ padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'500', background:visualizacao===v?'white':'transparent', color:visualizacao===v?'#1a1a2e':'#9ca3af', boxShadow:visualizacao===v?'0 1px 3px rgba(0,0,0,0.1)':'none' }}>{v==='semana'?'Semana':'Dia'}</button>
            ))}
            {visualizacao==='periodo' && <button style={{ padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'default', fontSize:'12px', fontWeight:'600', background:'white', color:'#6366f1', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>Lista</button>}
          </div>

          <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'7px 14px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>+ Novo</button>
        </div>
      </div>

      {/* Seletor rápido dias */}
      {visualizacao==='semana' && (
        <div style={{ display:'flex', gap:'4px', marginBottom:'10px', flexShrink:0, overflowX:'auto', paddingBottom:'2px' }}>
          {diasSemana.map(data=>{
            const ehHoje=isMesmoISO(data,hoje)
            return <button key={toISO(data)} onClick={()=>{setDiaAtivo(data);setVisualizacao('dia')}} style={{ flexShrink:0, padding:'6px 12px', borderRadius:'8px', border:ehHoje?'1.5px solid #6366f1':'1px solid #e5e7eb', background:ehHoje?'#6366f1':'white', color:ehHoje?'white':'#374151', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>{nomeDiaCurto(data)} {numeroDia(data)}</button>
          })}
        </div>
      )}

      {/* Lista período */}
      {visualizacao==='periodo' && (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', flexShrink:0, flexWrap:'wrap' }}>
            <span style={{ fontSize:'13px', color:'#6b7280' }}>{agendamentosPeriodo.length} agendamento{agendamentosPeriodo.length!==1?'s':''}</span>
            <button onClick={()=>setVisualizacao('semana')} style={{ marginLeft:'auto', background:'#f3f4f6', border:'none', borderRadius:'6px', padding:'5px 12px', fontSize:'12px', cursor:'pointer', color:'#6b7280' }}><- Voltar</button>
          </div>
          <ListaPeriodo agendamentos={agendamentosPeriodo} onEditar={abrirEdicao}/>
        </div>
      )}

      {/* Grade semana/dia */}
      {visualizacao!=='periodo' && (
        <div style={{ flex:1, overflow:'hidden', background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'grid', gridTemplateColumns:`60px repeat(${colunas},1fr)`, borderBottom:'1px solid #f0f0f8', flexShrink:0 }}>
            <div/>
            {diasParaMostrar.map(data=>{
              const ehHoje=isMesmoISO(data,hoje)
              return (
                <div key={toISO(data)} style={{ padding:'10px 8px', textAlign:'center', borderLeft:'1px solid #f0f0f8', background:ehHoje?'#eef2ff':'transparent' }}>
                  <div style={{ fontSize:'11px', color:ehHoje?'#6366f1':'#9ca3af', fontWeight:'600', textTransform:'uppercase' }}>{nomeDiaCurto(data)}</div>
                  <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'28px', height:'28px', borderRadius:'50%', marginTop:'3px', background:ehHoje?'#6366f1':'transparent', color:ehHoje?'white':'#1a1a2e', fontSize:'13px', fontWeight:'700' }}>{numeroDia(data)}</div>
                </div>
              )
            })}
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:`60px repeat(${colunas},1fr)` }}>
              <div>
                {HORAS.map(hora=>(
                  <div key={hora} style={{ height:`${ALTURA_HORA}px`, display:'flex', alignItems:'flex-start', paddingTop:'4px', justifyContent:'flex-end', paddingRight:'10px' }}>
                    <span style={{ fontSize:'10px', color:'#9ca3af', fontFamily:'monospace' }}>{hora}</span>
                  </div>
                ))}
              </div>
              {diasParaMostrar.map(data=>{
                const dataKey=toISO(data), ehHoje=isMesmoISO(data,hoje)
                const ags=agendamentos.filter(a=>a.dataISO===dataKey)
                return (
                  <div key={dataKey} style={{ borderLeft:'1px solid #f0f0f8', position:'relative', height:`${HORAS.length*ALTURA_HORA}px`, background:ehHoje?'#fafbff':'transparent' }}>
                    {HORAS.map((_,hIdx)=><div key={hIdx} style={{ position:'absolute', top:`${hIdx*ALTURA_HORA}px`, left:0, right:0, borderTop:'1px solid #f3f4f6' }}/>)}
                    {ehHoje&&posLinha!==null&&(
                      <div style={{ position:'absolute', top:`${posLinha}px`, left:0, right:0, zIndex:10, pointerEvents:'none', display:'flex', alignItems:'center' }}>
                        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444', marginLeft:'-4px', flexShrink:0 }}/>
                        <div style={{ flex:1, height:'1.5px', background:'#ef4444' }}/>
                      </div>
                    )}
                    {ags.map(ag=>{
                      const isFinalizado = ag.status === 'fechado'
                      const isCancelado  = ag.status === 'cancelado'
                      const bgBase  = isFinalizado ? '#ecfdf5' : isCancelado ? '#fef2f2' : ag.cor+'18'
                      const bgHover = isFinalizado ? '#d1fae5' : isCancelado ? '#fecaca' : ag.cor+'35'
                      const borda   = isFinalizado ? '#10b981' : isCancelado ? '#ef4444' : ag.cor
                      const textCor = isFinalizado ? '#065f46' : isCancelado ? '#991b1b' : ag.cor
                      const altura  = Math.max((ag.duracao/60)*ALTURA_HORA - 4, 22)
                      const hora    = String(ag.horaInicio).padStart(2,'0') + ':00'
                      return (
                        <div key={ag.id} onClick={()=>abrirEdicao(ag)}
                          style={{ position:'absolute', top:`${(ag.horaInicio-HORA_INICIO)*ALTURA_HORA}px`, left:'3px', right:'3px', height:`${altura}px`, background:bgBase, border:`1px solid ${borda}30`, borderLeft:`3px solid ${borda}`, borderRadius:'8px', padding:'4px 7px', cursor:'pointer', overflow:'hidden', transition:'background .15s', zIndex:5, opacity:isCancelado?0.75:1 }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=bgHover}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=bgBase}}>

                          {/* Linha 1: hora + ícone de status */}
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'4px' }}>
                            <span style={{ fontSize:'10px', fontWeight:'700', color:textCor, fontFamily:'monospace', flexShrink:0 }}>{hora}</span>
                            {isFinalizado && (
                              <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:'#10b981', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                <span style={{ color:'white', fontSize:'8px', fontWeight:'900', lineHeight:1 }}>v</span>
                              </div>
                            )}
                            {isCancelado && (
                              <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                                <span style={{ color:'white', fontSize:'9px', fontWeight:'900', lineHeight:1 }}>x</span>
                              </div>
                            )}
                          </div>

                          {/* Linha 2: cliente */}
                          <div style={{ fontSize:'11px', fontWeight:'600', color:textCor, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', marginTop:'1px' }}>
                            {ag.cliente}
                          </div>

                          {/* Linha 3: serviço (só se tiver espaço) */}
                          {altura >= 44 && (
                            <div style={{ fontSize:'10px', color:isFinalizado?'#6b7280':isCancelado?'#9ca3af':'#6b7280', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                              {ag.servico}
                            </div>
                          )}

                          {/* Linha 4: badge de status especial */}
                          {altura >= 60 && (isFinalizado || isCancelado) && (
                            <div style={{ marginTop:'2px', display:'inline-flex', alignItems:'center', gap:'3px', background:isFinalizado?'#10b981':'#ef4444', borderRadius:'99px', padding:'1px 6px' }}>
                              <span style={{ fontSize:'9px', fontWeight:'700', color:'white' }}>
                                {isFinalizado ? 'v Finalizado' : 'x Cancelado'}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de cancelamento */}
      {modalCancelar && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'white', borderRadius:'18px', padding:'28px 24px', maxWidth:'400px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign:'center', marginBottom:'20px' }}>
              <div style={{ width:'52px', height:'52px', borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:'24px' }}>🚫</div>
              <h3 style={{ fontSize:'17px', fontWeight:'700', color:'#1a1a2e', marginBottom:'6px' }}>Cancelar agendamento?</h3>
              <p style={{ fontSize:'13px', color:'#9ca3af' }}>Informe o motivo do cancelamento (opcional)</p>
            </div>
            <textarea
              value={motivoCancelamento}
              onChange={e => setMotivoCancelamento(e.target.value)}
              placeholder="Ex: Cliente solicitou cancelamento, imprevisto..."
              rows={3}
              style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'10px 12px', fontSize:'14px', outline:'none', resize:'none', boxSizing:'border-box', marginBottom:'16px' }}
            />
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={()=>setModalCancelar(false)} style={{ flex:1, background:'#f3f4f6', color:'#374151', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', cursor:'pointer', fontWeight:'500' }}>
                Voltar
              </button>
              <button onClick={confirmarCancelamento} disabled={cancelando} style={{ flex:1, background:cancelando?'#fca5a5':'#ef4444', color:'white', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', fontWeight:'600', cursor:cancelando?'not-allowed':'pointer' }}>
                {cancelando ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'540px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 18px' }}/>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'edit Editar agendamento':'+ Novo agendamento'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px' }}>x</button>
            </div>


            <div style={{ display:'flex', flexDirection:'column', gap:'14px', opacity: modoEdicao && (selecionado?.status === 'fechado' || selecionado?.status === 'cancelado') ? 0.85 : 1, pointerEvents: modoEdicao && (selecionado?.status === 'fechado' || selecionado?.status === 'cancelado') ? 'none' : undefined }}>
              {/* Aviso somente leitura */}
              {modoEdicao && (selecionado?.status === 'fechado' || selecionado?.status === 'cancelado') && (
                <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#6b7280', display:'flex', alignItems:'center', gap:'8px', pointerEvents:'none', opacity:1 }}>
                  <span>🔒</span>
                  <span>Este agendamento está <b>{selecionado?.status === 'fechado' ? 'finalizado' : 'cancelado'}</b> -- somente visualização.</span>
                </div>
              )}
              {/* Busca cliente */}
              <div style={{ position:'relative' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cliente *</label>
                {clienteSel ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', background:'#eef2ff', borderRadius:'8px', border:'1.5px solid #6366f1' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'white', flexShrink:0 }}>
                      {clienteSel.nome?.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'1px' }}>{clienteSel.nome}</p>
                      <p style={{ fontSize:'12px', color:'#6b7280' }}>{clienteSel.whatsapp||clienteSel.telefone||''}</p>
                    </div>
                    <button type="button" onClick={()=>{setClienteSel(null);setBuscaCliente('');setForm(f=>({...f,clienteId:'',cliente:''}))}} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'18px' }}>x</button>
                  </div>
                ) : (
                  <>
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
                      <input value={buscaCliente} onChange={e=>{setBuscaCliente(e.target.value);setDropCliente(true)}} onFocus={()=>setDropCliente(true)} style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Digite o nome do cliente..."/>
                    </div>
                    {dropCliente && (
                      <><div onClick={()=>setDropCliente(false)} style={{ position:'fixed', inset:0, zIndex:99 }}/>
                      <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'white', borderRadius:'10px', border:'1px solid #e5e7eb', boxShadow:'0 8px 24px rgba(0,0,0,0.1)', zIndex:100, maxHeight:'200px', overflowY:'auto' }}>
                        {clientes.filter((c: any)=>c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())).map((c: any)=>(
                          <div key={c.id} onClick={()=>{setClienteSel(c);setForm(f=>({...f,clienteId:c.id,cliente:c.nome}));setBuscaCliente('');setDropCliente(false)}}
                            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f9fafb' }}
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='#f8f8fc'}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent'}}>
                            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', color:'#6366f1', flexShrink:0 }}>
                              {c.nome?.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
                            </div>
                            <div>
                              <p style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a2e', marginBottom:'1px' }}>{c.nome}</p>
                              <p style={{ fontSize:'11px', color:'#9ca3af' }}>{c.whatsapp?`💬 ${c.whatsapp}`:c.telefone?`📞 ${c.telefone}`:''}</p>
                            </div>
                          </div>
                        ))}
                        {clientes.filter((c: any)=>c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())).length===0 && (
                          <div style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>Nenhum cliente encontrado.</div>
                        )}
                      </div></>
                    )}
                  </>
                )}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <InputField label="Serviço">
                  <select value={form.servico} onChange={e=>{
                    const nome = e.target.value
                    const serv = servicos.find((s:any) => s.nome === nome)
                    setForm(f=>({
                      ...f,
                      servico: nome,
                      duracao: serv?.duracao_min ? String(serv.duracao_min) : f.duracao,
                      valor:   serv?.valor ? String(serv.valor) : f.valor,
                    }))
                  }} style={selectStyle}>
                    <option value="">Selecione o serviço...</option>
                    {servicos.length === 0 ? (
                      <option disabled value="">-- Cadastre serviços primeiro --</option>
                    ) : servicos.map((s: any)=>(
                      <option key={s.id} value={s.nome}>
                        {s.nome}{s.duracao_min ? ' ('+s.duracao_min+'min)' : ''}{s.valor ? ' -- R$ '+Number(s.valor).toFixed(2).replace('.',',') : ''}
                      </option>
                    ))}
                  </select>
                </InputField>
                <InputField label="Profissional">
                  <select value={form.profissional} onChange={e=>setForm(f=>({...f,profissional:e.target.value,horaInicio:'09:00'}))} style={selectStyle}>
                    <option value="">Selecione o profissional...</option>
                    {profissionais.length === 0 ? (
                      <option disabled value="">-- Cadastre profissionais primeiro --</option>
                    ) : profissionais.map((p: any)=>(
                      <option key={p.id} value={p.nome}>{p.nome}{p.cargo ? ' -- '+p.cargo : ''}</option>
                    ))}
                  </select>
                </InputField>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <InputField label="Data">
                  <input type="date" value={form.dataISO} onChange={e=>setForm(f=>({...f,dataISO:e.target.value,horaInicio:'09:00'}))} style={inputStyle}/>
                </InputField>
                <InputField label="Duração (min)">
                  <select value={form.duracao} onChange={e=>setForm(f=>({...f,duracao:e.target.value}))} style={selectStyle}>
                    {[15,30,45,50,60,90,120].map(d=><option key={d} value={d}>{d} min</option>)}
                  </select>
                </InputField>
              </div>

              {form.dataISO && (
                <div style={{ background:'#eef2ff', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', color:'#4338ca' }}>
                  📅 {isoParaDate(form.dataISO).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                </div>
              )}

              {/* Seletor de horários */}
              {form.dataISO && form.profissional && (
                <div>
                  {naoAtende ? (
                    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'12px 14px', fontSize:'13px', color:'#92400e', display:'flex', gap:'8px', alignItems:'center' }}>
                      <span style={{ fontSize:'18px' }}>🚫</span>
                      <div>
                        <p style={{ fontWeight:'600', marginBottom:'2px' }}>{form.profissional} não atende neste dia</p>
                        <p style={{ fontSize:'12px', color:'#b45309' }}>Configure os horários na tela de Profissionais.</p>
                      </div>
                    </div>
                  ) : slotsDisponiveis.length > 0 ? (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px', flexWrap:'wrap', gap:'8px' }}>
                        <div>
                          <label style={{ fontSize:'13px', fontWeight:'500', color:'#374151' }}>Horário de início</label>
                          {horarioDoDiaForm && (
                            <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'8px' }}>
                              {horarioDoDiaForm.hora_inicio} - {horarioDoDiaForm.hora_fim}
                              {' . '}<span style={{ color:'#10b981', fontWeight:'500' }}>{slotsDisponiveis.filter(s=>s.disponivel).length} disponíveis</span>
                              {slotsDisponiveis.some(s=>!s.disponivel)&&<span style={{ color:'#ef4444', fontWeight:'500' }}> . {slotsDisponiveis.filter(s=>!s.disponivel).length} ocupados</span>}
                            </span>
                          )}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ fontSize:'11px', color:'#9ca3af' }}>Intervalo:</span>
                          {[15,30,60].map(min=>(
                            <button key={min} onClick={()=>setIntervaloMin(min)} style={{ padding:'3px 8px', borderRadius:'6px', fontSize:'11px', fontWeight:'500', border:intervaloMin===min?'1.5px solid #6366f1':'1px solid #e5e7eb', background:intervaloMin===min?'#eef2ff':'white', color:intervaloMin===min?'#6366f1':'#6b7280', cursor:'pointer' }}>{min}min</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px' }}>
                        {slotsDisponiveis.map(slot=>{
                          const estaSel = horaSel===slot.label
                          return (
                            <button key={slot.label} type="button" disabled={!slot.disponivel}
                              title={!slot.disponivel?`Ocupado: ${slot.clienteOcupa}`:slot.label}
                              onClick={()=>setForm(f=>({...f,horaInicio:slot.label}))}
                              style={{ padding:'8px 4px', borderRadius:'8px', fontSize:'12px', fontWeight:estaSel?'700':'400', cursor:slot.disponivel?'pointer':'not-allowed', border:estaSel?'2px solid #6366f1':!slot.disponivel?'1px solid #fca5a5':'1px solid #e5e7eb', background:!slot.disponivel?'#fee2e2':estaSel?'#6366f1':'white', color:!slot.disponivel?'#fca5a5':estaSel?'white':'#374151', textDecoration:!slot.disponivel?'line-through':'none', position:'relative' }}>
                              {slot.label}
                              {!slot.disponivel&&<span style={{ position:'absolute', top:'2px', right:'3px', fontSize:'9px' }}>🔒</span>}
                            </button>
                          )
                        })}
                      </div>
                      {slotSel&&!slotSel.disponivel&&(
                        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 12px', marginTop:'8px', fontSize:'13px', color:'#dc2626', display:'flex', gap:'8px', alignItems:'center' }}>
                          <span>!</span><p>{slotSel.clienteOcupa} já está agendado neste horário.</p>
                        </div>
                      )}
                    </div>
                  ) : profSelecionado ? (
                    <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'12px', fontSize:'13px', color:'#9ca3af', textAlign:'center' }}>
                      Sem horários cadastrados para este dia.<br/>
                      <span style={{ fontSize:'12px' }}>Configure em Profissionais -> Horários.</span>
                    </div>
                  ) : null}
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <InputField label="Status">
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={selectStyle} disabled={true}>
                    <option value="aberto">📅 Aberto</option>
                    <option value="fechado">[OK] Fechado</option>
                    <option value="cancelado">[X] Cancelado</option>
                  </select>
                </InputField>
                <InputField label="Valor (R$)">
                  <input type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} style={inputStyle} placeholder="0,00"/>
                </InputField>
              </div>

              <InputField label="Forma de pagamento">
                <select value={form.forma_pagamento} onChange={e=>setForm(f=>({...f,forma_pagamento:e.target.value}))} style={selectStyle}>
                  {FORMAS_PAG.map(fp=><option key={fp.value} value={fp.value}>{fp.label}</option>)}
                </select>
              </InputField>

              <InputField label="Observações">
                <textarea rows={2} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} style={{ ...inputStyle, resize:'none' }} placeholder="Anotações..."/>
              </InputField>

              {/* Banner de status especial */}
              {modoEdicao && selecionado?.status === 'fechado' && (
                <div style={{ borderRadius:'12px', overflow:'hidden', border:'1px solid #6ee7b7' }}>
                  <div style={{ background:'linear-gradient(135deg, #10b981, #059669)', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>[OK]</div>
                    <div>
                      <p style={{ color:'white', fontWeight:'700', fontSize:'15px', marginBottom:'2px' }}>Atendimento Finalizado</p>
                      <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px' }}>Este agendamento foi concluído e não pode ser alterado.</p>
                    </div>
                  </div>
                  <div style={{ background:'#f0fdf4', padding:'10px 18px', display:'flex', gap:'16px' }}>
                    <div><p style={{ fontSize:'11px', color:'#9ca3af' }}>Cliente</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>{selecionado.cliente}</p></div>
                    <div><p style={{ fontSize:'11px', color:'#9ca3af' }}>Serviço</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>{selecionado.servico}</p></div>
                    <div><p style={{ fontSize:'11px', color:'#9ca3af' }}>Valor</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>R$ {Number(selecionado.valor).toFixed(2).replace('.',',')}</p></div>
                  </div>
                </div>
              )}
              {modoEdicao && selecionado?.status === 'cancelado' && (
                <div style={{ borderRadius:'12px', overflow:'hidden', border:'1px solid #fca5a5' }}>
                  <div style={{ background:'linear-gradient(135deg, #ef4444, #dc2626)', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>🚫</div>
                    <div>
                      <p style={{ color:'white', fontWeight:'700', fontSize:'15px', marginBottom:'2px' }}>Agendamento Cancelado</p>
                      <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px' }}>Este agendamento foi cancelado e não pode ser alterado.</p>
                    </div>
                  </div>
                  <div style={{ background:'#fef2f2', padding:'12px 18px', display:'flex', flexDirection:'column', gap:'8px' }}>
                    <div style={{ display:'flex', gap:'16px' }}>
                      <div><p style={{ fontSize:'11px', color:'#9ca3af' }}>Cliente</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#991b1b' }}>{selecionado.cliente}</p></div>
                      <div><p style={{ fontSize:'11px', color:'#9ca3af' }}>Serviço</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#991b1b' }}>{selecionado.servico}</p></div>
                      <div><p style={{ fontSize:'11px', color:'#9ca3af' }}>Data</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#991b1b' }}>{isoParaDate(selecionado.dataISO).toLocaleDateString('pt-BR')}</p></div>
                    </div>
                    {(selecionado as any).motivoCancelamento && (
                      <div style={{ background:'#fee2e2', borderRadius:'8px', padding:'8px 12px' }}>
                        <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Motivo do cancelamento</p>
                        <p style={{ fontSize:'13px', color:'#991b1b', fontStyle:'italic' }}>"{(selecionado as any).motivoCancelamento}"</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

              <div style={{ display:'flex', gap:'10px', justifyContent:'space-between', marginTop:'4px', flexWrap:'wrap' }}>
                {modoEdicao && selecionado && (selecionado.status !== 'fechado' && selecionado.status !== 'cancelado') ? (
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={()=>excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', cursor:'pointer' }}>
                      🚫 Cancelar
                    </button>
                    <button onClick={()=>finalizar(selecionado.id)} disabled={finalizando} style={{ background:'#ecfdf5', color:'#10b981', border:'1px solid #6ee7b7', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
                      {finalizando ? 'Finalizando...' : '[OK] Finalizar atendimento'}
                    </button>
                  </div>
                ) : <div/>}
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Fechar</button>
                  {(!modoEdicao || (modoEdicao && selecionado?.status !== 'fechado' && selecionado?.status !== 'cancelado')) && (
                    <button onClick={btnBloqueado?undefined:salvar} disabled={btnBloqueado||salvando}
                      style={{ background:btnBloqueado||salvando?'#d1d5db':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:btnBloqueado||salvando?'not-allowed':'pointer' }}>
                      {salvando?'Salvando...':naoAtende&&profSelecionado?'🚫 Dia indisponível':slotSel&&!slotSel.disponivel?'! Horário ocupado':modoEdicao?'Salvar alterações':'Agendar'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
