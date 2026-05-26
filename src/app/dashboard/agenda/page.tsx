'use client'

import { useState, useMemo } from 'react'
import { corStatus, labelStatus } from '@/lib/supabase'
import {
  PROFISSIONAIS_CADASTRO, CLIENTES_CADASTRO,
  horarioDoDia, horariosDisponiveis,
  type Profissional, type ClienteCadastro,
} from '@/lib/dados'

const HORAS = Array.from({length: 14}, (_, i) => `${(i + 7).toString().padStart(2,'0')}:00`)
const HORA_INICIO = 7
const ALTURA_HORA = 60

// ── Helpers fuso Brasil ──────────────────────────────────────
function hojeNoBrasil(): Date {
  const str = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  const d = new Date(str)
  d.setHours(0, 0, 0, 0)
  return d
}

function inicioSemana(ref: Date): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return d
}

function addDias(data: Date, n: number): Date {
  const d = new Date(data)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(data: Date): string {
  const y = data.getFullYear()
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isoParaDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isMesmoISO(a: Date, b: Date): boolean {
  return toISO(a) === toISO(b)
}

function nomeDiaCurto(data: Date): string {
  return data.toLocaleDateString('pt-BR', { weekday:'short', timeZone:'America/Sao_Paulo' })
    .replace('.','').replace(/^\w/, c => c.toUpperCase())
}

function numeroDia(data: Date): number {
  return data.getDate()
}

function labelPeriodoSemana(seg: Date): string {
  const sab = addDias(seg, 5)
  const mesI = seg.toLocaleDateString('pt-BR', { month:'short', timeZone:'America/Sao_Paulo' }).replace('.','')
  const mesF = sab.toLocaleDateString('pt-BR', { month:'short', timeZone:'America/Sao_Paulo' }).replace('.','')
  const ano  = sab.getFullYear()
  return mesI === mesF
    ? `${numeroDia(seg)} – ${numeroDia(sab)} de ${mesI} ${ano}`
    : `${numeroDia(seg)} ${mesI} – ${numeroDia(sab)} ${mesF} ${ano}`
}

function labelDia(data: Date): string {
  return data.toLocaleDateString('pt-BR', {
    weekday:'long', day:'numeric', month:'long', year:'numeric',
    timeZone:'America/Sao_Paulo',
  })
}

function linhaHoraAtual(): number | null {
  const agora = new Date()
  const strBR = agora.toLocaleTimeString('pt-BR', { timeZone:'America/Sao_Paulo', hour:'2-digit', minute:'2-digit' })
  const [h, m] = strBR.split(':').map(Number)
  if (h < HORA_INICIO || h > HORA_INICIO + 13) return null
  return (h - HORA_INICIO) * ALTURA_HORA + (m / 60) * ALTURA_HORA
}



// ── Tipos ────────────────────────────────────────────────────
type Agendamento = {
  id: number
  dataISO: string
  horaInicio: number
  duracao: number
  cliente: string
  servico: string
  profissional: string
  cor: string
  status: string
  observacoes: string
  forma_pagamento: string
  valor: number
}

function seedAgendamentos(): Agendamento[] {
  const seg = inicioSemana(hojeNoBrasil())
  return [
    { id:1, dataISO:toISO(addDias(seg,0)), horaInicio:9,  duracao:60, cliente:'Maria Silva',    servico:'Consulta',    profissional:'Dr. Carlos', cor:'#6366f1', status:'confirmado',     observacoes:'',              forma_pagamento:'pix',            valor:150 },
    { id:2, dataISO:toISO(addDias(seg,0)), horaInicio:11, duracao:30, cliente:'João Santos',    servico:'Retorno',     profissional:'Dr. Carlos', cor:'#8b5cf6', status:'agendado',       observacoes:'Trazer exames',  forma_pagamento:'dinheiro',       valor:80  },
    { id:3, dataISO:toISO(addDias(seg,1)), horaInicio:10, duracao:90, cliente:'Ana Costa',      servico:'Avaliação',   profissional:'Dra. Ana', cor:'#06b6d4', status:'em_atendimento', observacoes:'',              forma_pagamento:'cartao_credito', valor:200 },
    { id:4, dataISO:toISO(addDias(seg,2)), horaInicio:14, duracao:50, cliente:'Pedro Oliveira', servico:'Sessão Ter.', profissional:'Dr. Carlos', cor:'#10b981', status:'confirmado',     observacoes:'',              forma_pagamento:'pix',            valor:120 },
    { id:5, dataISO:toISO(addDias(seg,3)), horaInicio:9,  duracao:60, cliente:'Lucia Ferreira', servico:'Consulta',    profissional:'Dra. Ana', cor:'#6366f1', status:'agendado',       observacoes:'',              forma_pagamento:'',               valor:150 },
    { id:6, dataISO:toISO(addDias(seg,4)), horaInicio:16, duracao:60, cliente:'Carlos Mendes',  servico:'Consulta',    profissional:'Dr. Carlos', cor:'#6366f1', status:'agendado',       observacoes:'',              forma_pagamento:'',               valor:150 },
    { id:7, dataISO:toISO(addDias(seg,5)), horaInicio:10, duracao:60, cliente:'Sofia Lima',     servico:'Avaliação',   profissional:'Dra. Ana', cor:'#06b6d4', status:'confirmado',     observacoes:'',              forma_pagamento:'pix',            valor:200 },
  ]
}

const SERVICOS      = ['Consulta','Retorno','Avaliação','Sessão Terapêutica']
// Nomes dos profissionais gerados dinamicamente de PROFISSIONAIS_CADASTRO
// Clientes e Profissionais importados de @/lib/dados
const FORMAS_PAG    = [
  { value:'',               label:'Selecionar...'    },
  { value:'dinheiro',       label:'Dinheiro'         },
  { value:'pix',            label:'PIX'              },
  { value:'cartao_credito', label:'Cartão de crédito'},
  { value:'cartao_debito',  label:'Cartão de débito' },
  { value:'transferencia',  label:'Transferência'    },
  { value:'plano',          label:'Plano mensal'     },
]

const inputStyle  = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }
const selectStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>{label}</label>
      {children}
    </div>
  )
}

// ── Mini calendário ──────────────────────────────────────────
function MiniCalendario({ dataSelecionada, onChange, onFechar }: {
  dataSelecionada: Date
  onChange: (d: Date) => void
  onFechar: () => void
}) {
  const hoje = hojeNoBrasil()
  const [mes, setMes] = useState(new Date(dataSelecionada.getFullYear(), dataSelecionada.getMonth(), 1))

  const inicioCal = (() => {
    const d = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const dow = d.getDay()
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    return d
  })()

  const celulas = Array.from({length:42}, (_, i) => addDias(inicioCal, i))
  const nomeMes = mes.toLocaleDateString('pt-BR', { month:'long', year:'numeric', timeZone:'America/Sao_Paulo' })
    .replace(/^\w/, c => c.toUpperCase())

  return (
    <div onClick={e => e.stopPropagation()}
      style={{ position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:200, background:'white', borderRadius:'14px', border:'1px solid #e5e7eb', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', padding:'16px', width:'268px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <button onClick={() => setMes(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'#6b7280', padding:'2px 8px' }}>‹</button>
        <span style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a2e' }}>{nomeMes}</span>
        <button onClick={() => setMes(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'#6b7280', padding:'2px 8px' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:'4px' }}>
        {['S','T','Q','Q','S','S','D'].map((d,i) => (
          <div key={i} style={{ textAlign:'center', fontSize:'10px', fontWeight:'600', color:'#9ca3af', padding:'3px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'1px' }}>
        {celulas.map((data, i) => {
          const estesMes = data.getMonth() === mes.getMonth()
          const ehHoje   = isMesmoISO(data, hoje)
          const ehSel    = isMesmoISO(data, dataSelecionada)
          return (
            <button key={i} onClick={() => { onChange(data); onFechar() }} style={{
              width:'34px', height:'34px', borderRadius:'50%', border:'none', cursor:'pointer',
              fontSize:'12px', fontWeight: ehSel||ehHoje ? '700':'400',
              background: ehSel ? '#6366f1' : ehHoje ? '#eef2ff' : 'transparent',
              color: ehSel ? 'white' : ehHoje ? '#6366f1' : estesMes ? '#1a1a2e' : '#d1d5db',
            }}>
              {numeroDia(data)}
            </button>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:'6px', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #f3f4f6' }}>
        <button onClick={() => { onChange(hoje); onFechar() }}
          style={{ flex:1, background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
          Hoje
        </button>
        <button onClick={onFechar}
          style={{ flex:1, background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'6px', padding:'6px', fontSize:'12px', cursor:'pointer' }}>
          Fechar
        </button>
      </div>
    </div>
  )
}

// ── Lista de agendamentos por período ────────────────────────
function ListaPeriodo({ agendamentos, onEditar }: {
  agendamentos: Agendamento[]
  onEditar: (ag: Agendamento) => void
}) {
  if (agendamentos.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af', fontSize:'14px' }}>
        Nenhum agendamento neste período.
      </div>
    )
  }

  // Agrupa por data
  const porData = agendamentos.reduce<Record<string, Agendamento[]>>((acc, ag) => {
    acc[ag.dataISO] = acc[ag.dataISO] || []
    acc[ag.dataISO].push(ag)
    return acc
  }, {})

  const datas = Object.keys(porData).sort()

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'4px 2px' }}>
      {datas.map(iso => {
        const data  = isoParaDate(iso)
        const label = data.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'America/Sao_Paulo' })
        const ags   = porData[iso].sort((a,b) => a.horaInicio - b.horaInicio)
        const ehHoje = isMesmoISO(data, hojeNoBrasil())
        return (
          <div key={iso} style={{ marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
              <div style={{
                padding:'3px 12px', borderRadius:'99px', fontSize:'12px', fontWeight:'600',
                background: ehHoje ? '#6366f1' : '#f3f4f6',
                color:      ehHoje ? 'white'   : '#374151',
                textTransform:'capitalize',
              }}>
                {label}
              </div>
              <div style={{ flex:1, height:'1px', background:'#f0f0f8' }}/>
              <span style={{ fontSize:'12px', color:'#9ca3af' }}>{ags.length} agend.</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {ags.map(ag => (
                <div key={ag.id} onClick={() => onEditar(ag)}
                  style={{
                    display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px',
                    background:'white', borderRadius:'10px', border:`1px solid ${ag.cor}30`,
                    borderLeft:`4px solid ${ag.cor}`, cursor:'pointer', transition:'all .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = ag.cor+'10' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white' }}
                >
                  <div style={{ width:'46px', textAlign:'center', flexShrink:0 }}>
                    <p style={{ fontSize:'15px', fontWeight:'700', color:ag.cor, fontFamily:'monospace' }}>
                      {String(ag.horaInicio).padStart(2,'0')}:00
                    </p>
                    <p style={{ fontSize:'10px', color:'#9ca3af' }}>{ag.duracao} min</p>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {ag.cliente}
                    </p>
                    <p style={{ fontSize:'12px', color:'#9ca3af' }}>{ag.servico}</p>
                  </div>
                  <span className={corStatus(ag.status)} style={{ fontSize:'11px', padding:'3px 10px', borderRadius:'99px', flexShrink:0 }}>
                    {labelStatus(ag.status)}
                  </span>
                  <span style={{ fontSize:'18px', color:'#d1d5db', flexShrink:0 }}>›</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────
export default function AgendaPage() {
  const hoje = useMemo(() => hojeNoBrasil(), [])

  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(seedAgendamentos)

  // Visualização: 'semana' | 'dia' | 'periodo'
  const [visualizacao, setVisualizacao] = useState<'semana'|'dia'|'periodo'>('semana')

  // Semana e dia ativos — sempre iniciam a partir de HOJE
  const [semanaBase, setSemanaBase] = useState<Date>(() => inicioSemana(hojeNoBrasil()))
  const [diaAtivo,   setDiaAtivo]   = useState<Date>(() => hojeNoBrasil())

  // Filtro por período
  const [periodoInicio, setPeriodoInicio] = useState<string>(toISO(hojeNoBrasil()))
  const [periodoFim,    setPeriodoFim]    = useState<string>(toISO(addDias(hojeNoBrasil(), 30)))
  const [filtroAberto,  setFiltroAberto]  = useState(false)

  // Calendário popup
  const [calAberto, setCalAberto] = useState(false)

  // Modal agendamento
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao,  setModoEdicao]  = useState(false)
  const [selecionado, setSelecionado] = useState<Agendamento | null>(null)
  const [form, setForm] = useState({
    cliente:'', clienteId:'', servico:SERVICOS[0], profissional:'',
    dataISO:toISO(hojeNoBrasil()), horaInicio:'09:00', duracao:'60',
    status:'agendado', forma_pagamento:'', valor:'', observacoes:'',
  })
  const [buscaCliente, setBuscaCliente]           = useState('')
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteCadastro | null>(null)
  const [dropClienteAberto, setDropClienteAberto]   = useState(false)

  // Dias da semana (seg→sáb, a partir de semanaBase = hoje ou posterior)
  const diasSemana = useMemo(() =>
    Array.from({length:6}, (_, i) => addDias(semanaBase, i)),
    [semanaBase]
  )

  // Agendamentos filtrados por período
  const agendamentosPeriodo = useMemo(() => {
    return agendamentos
      .filter(ag => ag.dataISO >= periodoInicio && ag.dataISO <= periodoFim)
      .sort((a,b) => a.dataISO.localeCompare(b.dataISO) || a.horaInicio - b.horaInicio)
  }, [agendamentos, periodoInicio, periodoFim])

  // ── Navegação — SÓ avança, não permite voltar além de hoje ──
  function semanaProxima() { setSemanaBase(d => addDias(d, 7)) }
  function semanaAnterior() {
    setSemanaBase(d => {
      const nova = addDias(d, -7)
      // não permite voltar antes da semana de hoje
      const semanaHoje = inicioSemana(hojeNoBrasil())
      return nova < semanaHoje ? semanaHoje : nova
    })
  }
  function diaSeguinte() {
    setDiaAtivo(d => {
      const novo = addDias(d, 1)
      setSemanaBase(inicioSemana(novo))
      return novo
    })
  }
  function diaAnterior() {
    setDiaAtivo(d => {
      const novo = addDias(d, -1)
      // não permite voltar antes de hoje
      const h = hojeNoBrasil()
      const final = novo < h ? h : novo
      setSemanaBase(inicioSemana(final))
      return final
    })
  }
  function irParaHoje() {
    const h = hojeNoBrasil()
    setSemanaBase(inicioSemana(h))
    setDiaAtivo(h)
    setCalAberto(false)
  }
  function irParaData(data: Date) {
    // Permite ir para qualquer data pelo calendário
    setSemanaBase(inicioSemana(data))
    setDiaAtivo(data)
    setCalAberto(false)
  }

  // ── Modais ──
  function abrirNovo() {
    const dataRef = visualizacao === 'dia' ? diaAtivo : hoje
    setModoEdicao(false); setSelecionado(null)
    setClienteSelecionado(null); setBuscaCliente('')
    setForm({
      cliente:'', clienteId:'', servico:SERVICOS[0], profissional:'',
      dataISO:toISO(dataRef), horaInicio:'09:00', duracao:'60',
      status:'agendado', forma_pagamento:'', valor:'', observacoes:'',
    })
    setModalAberto(true)
  }

  function abrirEdicao(ag: Agendamento) {
    setModoEdicao(true); setSelecionado(ag)
    const cad = CLIENTES_CADASTRO.find(c => c.nome === ag.cliente) || null
    setClienteSelecionado(cad)
    setBuscaCliente('')
    setForm({
      cliente:ag.cliente, clienteId:cad?.id||'', servico:ag.servico, profissional:ag.profissional||'',
      dataISO:ag.dataISO,
      horaInicio:`${String(ag.horaInicio).padStart(2,'0')}:00`,
      duracao:String(ag.duracao), status:ag.status,
      forma_pagamento:ag.forma_pagamento, valor:String(ag.valor),
      observacoes:ag.observacoes,
    })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setModoEdicao(false); setClienteSelecionado(null); setBuscaCliente(''); setDropClienteAberto(false) }

  function salvar() {
    const horaNum = parseInt(form.horaInicio.split(':')[0])
    const novaData = isoParaDate(form.dataISO)
    if (modoEdicao && selecionado) {
      setAgendamentos(prev => prev.map(a => a.id === selecionado.id ? {
        ...a, cliente:form.cliente, servico:form.servico, profissional:form.profissional,
        dataISO:form.dataISO, horaInicio:horaNum, duracao:parseInt(form.duracao), status:form.status,
        forma_pagamento:form.forma_pagamento, valor:parseFloat(form.valor)||a.valor,
        observacoes:form.observacoes,
      } : a))
    } else {
      setAgendamentos(prev => [...prev, {
        id:Date.now(), cliente:form.cliente, servico:form.servico,
        profissional:form.profissional,
        dataISO:form.dataISO, horaInicio:horaNum, duracao:parseInt(form.duracao),
        cor:'#6366f1', status:form.status, forma_pagamento:form.forma_pagamento,
        valor:parseFloat(form.valor)||0, observacoes:form.observacoes,
      }])
    }
    // Navega para a data salva
    setSemanaBase(inicioSemana(novaData))
    setDiaAtivo(novaData)
    if (visualizacao === 'periodo') setVisualizacao('semana')
    fecharModal()
  }

  function excluir(id: number) {
    if (confirm('Deseja cancelar este agendamento?')) {
      setAgendamentos(prev => prev.filter(a => a.id !== id))
      fecharModal()
    }
  }

  // ── Render ──
  const diasParaMostrar = visualizacao === 'dia' ? [diaAtivo] : diasSemana
  const colunas         = diasParaMostrar.length
  const posLinha        = linhaHoraAtual()

  const labelPeriodoFiltro = (() => {
    if (!periodoInicio || !periodoFim) return 'Período'
    const ini = isoParaDate(periodoInicio).toLocaleDateString('pt-BR', { day:'numeric', month:'short', timeZone:'America/Sao_Paulo' })
    const fim = isoParaDate(periodoFim).toLocaleDateString('pt-BR',    { day:'numeric', month:'short', year:'numeric', timeZone:'America/Sao_Paulo' })
    return `${ini} – ${fim}`
  })()

  return (
    <div style={{ padding:'16px', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Cabeçalho ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexShrink:0, flexWrap:'wrap', gap:'10px' }}>

        {/* Título clicável → calendário */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setCalAberto(c => !c)} style={{ background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0 }}>
            <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#1a1a2e', display:'flex', alignItems:'center', gap:'6px' }}>
              Agenda <span style={{ fontSize:'16px' }}>📅</span>
            </h1>
            <p style={{ fontSize:'13px', color:'#6366f1', fontWeight:'500', textTransform:'capitalize', textDecoration:'underline dotted' }}>
              {visualizacao === 'periodo'
                ? labelPeriodoFiltro
                : visualizacao === 'semana'
                  ? labelPeriodoSemana(semanaBase)
                  : labelDia(diaAtivo)}
            </p>
          </button>
          {calAberto && (
            <>
              <div onClick={() => setCalAberto(false)} style={{ position:'fixed', inset:0, zIndex:199 }}/>
              <MiniCalendario
                dataSelecionada={diaAtivo}
                onChange={d => { irParaData(d); setVisualizacao('dia') }}
                onFechar={() => setCalAberto(false)}
              />
            </>
          )}
        </div>

        {/* Controles */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>

          {/* Filtro por período */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setFiltroAberto(f => !f)} style={{
              display:'flex', alignItems:'center', gap:'6px', background:'white',
              border: visualizacao==='periodo' ? '1.5px solid #6366f1' : '1px solid #e5e7eb',
              borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'12px',
              fontWeight:'500', color: visualizacao==='periodo' ? '#6366f1' : '#374151',
            }}>
              🔍 Filtrar período
            </button>

            {filtroAberto && (
              <>
                <div onClick={() => setFiltroAberto(false)} style={{ position:'fixed', inset:0, zIndex:149 }}/>
                <div onClick={e => e.stopPropagation()} style={{
                  position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:150,
                  background:'white', borderRadius:'14px', border:'1px solid #e5e7eb',
                  boxShadow:'0 8px 30px rgba(0,0,0,0.12)', padding:'18px', width:'280px',
                }}>
                  <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'14px' }}>Filtrar por período</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
                    <div>
                      <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>Data inicial</label>
                      <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)}
                        style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>Data final</label>
                      <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
                        style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                    </div>
                  </div>
                  {/* Atalhos rápidos */}
                  <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'6px', fontWeight:'500' }}>ATALHOS</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'12px' }}>
                    {[
                      { label:'Hoje',           ini:0,  fim:0   },
                      { label:'Próx. 7 dias',   ini:0,  fim:7   },
                      { label:'Próx. 15 dias',  ini:0,  fim:15  },
                      { label:'Próx. 30 dias',  ini:0,  fim:30  },
                      { label:'Este mês',       ini:-hojeNoBrasil().getDate()+1, fim: new Date(hojeNoBrasil().getFullYear(), hojeNoBrasil().getMonth()+1, 0).getDate() - hojeNoBrasil().getDate() },
                      { label:'Próx. 3 meses',  ini:0,  fim:90  },
                    ].map(at => (
                      <button key={at.label} onClick={() => {
                        const h = hojeNoBrasil()
                        setPeriodoInicio(toISO(addDias(h, at.ini)))
                        setPeriodoFim(toISO(addDias(h, at.fim)))
                      }} style={{
                        background:'#f3f4f6', border:'none', borderRadius:'6px',
                        padding:'6px 8px', fontSize:'11px', fontWeight:'500',
                        color:'#374151', cursor:'pointer',
                      }}>
                        {at.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => {
                      setVisualizacao('periodo')
                      setFiltroAberto(false)
                    }} style={{ flex:1, background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
                      Ver agendamentos
                    </button>
                    <button onClick={() => {
                      setFiltroAberto(false)
                      if (visualizacao==='periodo') setVisualizacao('semana')
                    }} style={{ background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', cursor:'pointer' }}>
                      ✕
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Navegação (oculta na view período) */}
          {visualizacao !== 'periodo' && (
            <div style={{ display:'flex', gap:'4px' }}>
              <button onClick={visualizacao==='semana' ? semanaAnterior : diaAnterior}
                style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'16px' }}>‹</button>
              <button onClick={irParaHoje}
                style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', color:'#6366f1' }}>
                Hoje
              </button>
              <button onClick={visualizacao==='semana' ? semanaProxima : diaSeguinte}
                style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 10px', cursor:'pointer', fontSize:'16px' }}>›</button>
            </div>
          )}

          {/* Toggle Semana / Dia / (Período ativo) */}
          <div style={{ display:'flex', background:'#f3f4f6', borderRadius:'8px', padding:'3px' }}>
            {(['semana','dia'] as const).map(v => (
              <button key={v} onClick={() => setVisualizacao(v)} style={{
                padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'500',
                background: visualizacao===v ? 'white' : 'transparent',
                color:      visualizacao===v ? '#1a1a2e' : '#9ca3af',
                boxShadow:  visualizacao===v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>{v==='semana'?'Semana':'Dia'}</button>
            ))}
            {visualizacao === 'periodo' && (
              <button style={{ padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'default', fontSize:'12px', fontWeight:'600', background:'white', color:'#6366f1', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>
                Lista
              </button>
            )}
          </div>

          <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'7px 14px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>
            + Novo
          </button>
        </div>
      </div>

      {/* ── Seletor rápido de dias (semana) ── */}
      {visualizacao === 'semana' && (
        <div style={{ display:'flex', gap:'4px', marginBottom:'10px', flexShrink:0, overflowX:'auto', paddingBottom:'2px' }}>
          {diasSemana.map(data => {
            const ehHoje = isMesmoISO(data, hoje)
            return (
              <button key={toISO(data)} onClick={() => { setDiaAtivo(data); setVisualizacao('dia') }} style={{
                flexShrink:0, padding:'6px 12px', borderRadius:'8px',
                border:     ehHoje ? '1.5px solid #6366f1' : '1px solid #e5e7eb',
                background: ehHoje ? '#6366f1' : 'white',
                color:      ehHoje ? 'white'   : '#374151',
                fontSize:'12px', fontWeight:'500', cursor:'pointer',
              }}>
                {nomeDiaCurto(data)} {numeroDia(data)}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Vista lista por período ── */}
      {visualizacao === 'periodo' && (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', flexShrink:0, flexWrap:'wrap' }}>
            <span style={{ fontSize:'13px', color:'#6b7280' }}>
              {agendamentosPeriodo.length} agendamento{agendamentosPeriodo.length !== 1 ? 's' : ''} encontrado{agendamentosPeriodo.length !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize:'13px', color:'#9ca3af' }}>·</span>
            <span style={{ fontSize:'13px', color:'#9ca3af' }}>
              {isoParaDate(periodoInicio).toLocaleDateString('pt-BR', {day:'numeric',month:'short',timeZone:'America/Sao_Paulo'})} a {isoParaDate(periodoFim).toLocaleDateString('pt-BR', {day:'numeric',month:'short',year:'numeric',timeZone:'America/Sao_Paulo'})}
            </span>
            <button onClick={() => setVisualizacao('semana')} style={{ marginLeft:'auto', background:'#f3f4f6', border:'none', borderRadius:'6px', padding:'5px 12px', fontSize:'12px', cursor:'pointer', color:'#6b7280' }}>
              ← Voltar para agenda
            </button>
          </div>
          <ListaPeriodo agendamentos={agendamentosPeriodo} onEditar={abrirEdicao}/>
        </div>
      )}

      {/* ── Grade semana / dia ── */}
      {visualizacao !== 'periodo' && (
        <div style={{ flex:1, overflow:'hidden', background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', display:'flex', flexDirection:'column' }}>

          {/* Header colunas */}
          <div style={{ display:'grid', gridTemplateColumns:`60px repeat(${colunas},1fr)`, borderBottom:'1px solid #f0f0f8', flexShrink:0 }}>
            <div/>
            {diasParaMostrar.map(data => {
              const ehHoje = isMesmoISO(data, hoje)
              return (
                <div key={toISO(data)} style={{ padding:'10px 8px', textAlign:'center', borderLeft:'1px solid #f0f0f8', background: ehHoje?'#eef2ff':'transparent' }}>
                  <div style={{ fontSize:'11px', color:ehHoje?'#6366f1':'#9ca3af', fontWeight:'600', textTransform:'uppercase' }}>
                    {nomeDiaCurto(data)}
                  </div>
                  <div style={{
                    display:'inline-flex', alignItems:'center', justifyContent:'center',
                    width:'28px', height:'28px', borderRadius:'50%', marginTop:'3px',
                    background: ehHoje?'#6366f1':'transparent',
                    color:      ehHoje?'white':'#1a1a2e',
                    fontSize:'13px', fontWeight:'700',
                  }}>
                    {numeroDia(data)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Corpo */}
          <div style={{ flex:1, overflowY:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:`60px repeat(${colunas},1fr)` }}>
              <div>
                {HORAS.map(hora => (
                  <div key={hora} style={{ height:`${ALTURA_HORA}px`, display:'flex', alignItems:'flex-start', paddingTop:'4px', justifyContent:'flex-end', paddingRight:'10px' }}>
                    <span style={{ fontSize:'10px', color:'#9ca3af', fontFamily:'monospace' }}>{hora}</span>
                  </div>
                ))}
              </div>

              {diasParaMostrar.map(data => {
                const dataKey = toISO(data)
                const ehHoje  = isMesmoISO(data, hoje)
                const ags     = agendamentos.filter(a => a.dataISO === dataKey)
                return (
                  <div key={dataKey} style={{ borderLeft:'1px solid #f0f0f8', position:'relative', height:`${HORAS.length*ALTURA_HORA}px`, background:ehHoje?'#fafbff':'transparent' }}>
                    {HORAS.map((_,hIdx) => (
                      <div key={hIdx} style={{ position:'absolute', top:`${hIdx*ALTURA_HORA}px`, left:0, right:0, borderTop:'1px solid #f3f4f6' }}/>
                    ))}
                    {/* Linha horário atual */}
                    {ehHoje && posLinha !== null && (
                      <div style={{ position:'absolute', top:`${posLinha}px`, left:0, right:0, zIndex:10, pointerEvents:'none', display:'flex', alignItems:'center' }}>
                        <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444', marginLeft:'-4px', flexShrink:0 }}/>
                        <div style={{ flex:1, height:'1.5px', background:'#ef4444' }}/>
                      </div>
                    )}
                    {ags.map(ag => (
                      <div key={ag.id} onClick={() => abrirEdicao(ag)} style={{
                        position:'absolute',
                        top:`${(ag.horaInicio-HORA_INICIO)*ALTURA_HORA}px`,
                        left:'3px', right:'3px',
                        height:`${(ag.duracao/60)*ALTURA_HORA-4}px`,
                        background:  ag.cor+'20',
                        border:      `1px solid ${ag.cor}40`,
                        borderLeft:  `3px solid ${ag.cor}`,
                        borderRadius:'6px', padding:'5px 7px',
                        cursor:'pointer', overflow:'hidden', transition:'all .15s', zIndex:5,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = ag.cor+'35' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ag.cor+'20' }}>
                        <div style={{ fontSize:'11px', fontWeight:'600', color:ag.cor, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                          {String(ag.horaInicio).padStart(2,'0')}:00 — {ag.cliente}
                        </div>
                        <div style={{ fontSize:'10px', color:'#6b7280', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ag.servico}</div>
                        <span className={corStatus(ag.status)} style={{ display:'inline-block', fontSize:'10px', padding:'1px 6px', borderRadius:'99px', marginTop:'2px' }}>
                          {labelStatus(ag.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal criar / editar ── */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'540px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 18px' }}/>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>
                {modoEdicao ? '✏️ Editar agendamento' : '+ Novo agendamento'}
              </h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px' }}>✕</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* ── Busca de cliente do cadastro ── */}
              <div style={{ position:'relative' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>
                  Cliente *
                </label>

                {/* Cliente já selecionado */}
                {clienteSelecionado ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', background:'#eef2ff', borderRadius:'8px', border:'1.5px solid #6366f1' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#6366f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'white', flexShrink:0 }}>
                      {clienteSelecionado.nome.split(' ').slice(0,2).map((n:string) => n[0]).join('')}
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'1px' }}>{clienteSelecionado.nome}</p>
                      <p style={{ fontSize:'12px', color:'#6b7280' }}>
                        {clienteSelecionado.whatsapp || clienteSelecionado.telefone} · {clienteSelecionado.plano}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setClienteSelecionado(null); setBuscaCliente(''); setForm(f=>({...f,cliente:'',clienteId:''})) }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'18px', padding:'2px', flexShrink:0 }}
                      title="Trocar cliente"
                    >✕</button>
                  </div>
                ) : (
                  <>
                    {/* Campo de busca */}
                    <div style={{ position:'relative' }}>
                      <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:'14px' }}>🔍</span>
                      <input
                        value={buscaCliente}
                        onChange={e => {
                          setBuscaCliente(e.target.value)
                          setDropClienteAberto(true)
                          setForm(f=>({...f,cliente:e.target.value,clienteId:''}))
                        }}
                        onFocus={() => setDropClienteAberto(true)}
                        style={{ ...inputStyle, paddingLeft:'36px' }}
                        placeholder="Digite o nome do cliente..."
                      />
                    </div>

                    {/* Dropdown de resultados */}
                    {dropClienteAberto && (
                      <>
                        <div onClick={() => setDropClienteAberto(false)} style={{ position:'fixed', inset:0, zIndex:99 }}/>
                        <div style={{
                          position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
                          background:'white', borderRadius:'10px', border:'1px solid #e5e7eb',
                          boxShadow:'0 8px 24px rgba(0,0,0,0.1)', zIndex:100,
                          maxHeight:'220px', overflowY:'auto',
                        }}>
                          {(() => {
                            const filtrados = CLIENTES_CADASTRO.filter(c =>
                              c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
                              c.telefone.includes(buscaCliente) ||
                              c.whatsapp.includes(buscaCliente)
                            )
                            if (filtrados.length === 0) return (
                              <div style={{ padding:'16px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>
                                Nenhum cliente encontrado.<br/>
                                <span style={{ fontSize:'12px', color:'#d1d5db' }}>Cadastre o cliente primeiro.</span>
                              </div>
                            )
                            return filtrados.map(c => (
                              <div key={c.id}
                                onClick={() => {
                                  setClienteSelecionado(c)
                                  setForm(f=>({...f,cliente:c.nome,clienteId:c.id}))
                                  setBuscaCliente('')
                                  setDropClienteAberto(false)
                                }}
                                style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f9fafb', transition:'background .1s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#f8f8fc' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent' }}
                              >
                                <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', color:'#6366f1', flexShrink:0 }}>
                                  {c.nome.split(' ').slice(0,2).map((n:string) => n[0]).join('')}
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <p style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a2e', marginBottom:'1px' }}>{c.nome}</p>
                                  <p style={{ fontSize:'11px', color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                    {c.whatsapp ? `💬 ${c.whatsapp}` : `📞 ${c.telefone}`} · {c.plano}
                                  </p>
                                </div>
                                <span style={{ fontSize:'11px', background:'#eef2ff', color:'#6366f1', padding:'2px 8px', borderRadius:'99px', flexShrink:0, fontWeight:'500' }}>
                                  {c.plano === 'Avulso' ? 'Avulso' : 'Plano'}
                                </span>
                              </div>
                            ))
                          })()}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <InputField label="Serviço">
                  <select value={form.servico} onChange={e => setForm(f=>({...f,servico:e.target.value}))} style={selectStyle}>
                    {SERVICOS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </InputField>
                <InputField label="Profissional">
                  <select value={form.profissional} onChange={e => setForm(f=>({...f,profissional:e.target.value, horaInicio:'09:00'}))} style={selectStyle}>
                    <option value="">Selecione...</option>
                    {PROFISSIONAIS_CADASTRO.filter(p => p.status === 'ativo').map(p => (
                      <option key={p.id} value={p.nome}>{p.nome} — {p.especialidade}</option>
                    ))}
                  </select>
                </InputField>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <InputField label="Data">
                  <input type="date" value={form.dataISO} onChange={e => setForm(f=>({...f,dataISO:e.target.value, horaInicio:'09:00'}))} style={inputStyle}/>
                </InputField>
                <InputField label="Duração (min)">
                  <select value={form.duracao} onChange={e => setForm(f=>({...f,duracao:e.target.value}))} style={selectStyle}>
                    {[15,30,45,50,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </InputField>
              </div>

              {form.dataISO && (
                <div style={{ background:'#eef2ff', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', color:'#4338ca' }}>
                  📅 {isoParaDate(form.dataISO).toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                </div>
              )}

              {/* Seletor visual de horários com base no cadastro do profissional */}
              {form.dataISO && form.profissional && (() => {
                const profCad   = PROFISSIONAIS_CADASTRO.find(p => p.nome === form.profissional)
                const horarioDia = profCad ? horarioDoDia(profCad, form.dataISO) : null
                const slots     = profCad
                  ? horariosDisponiveis(profCad, form.dataISO, parseInt(form.duracao), agendamentos, modoEdicao && selecionado ? selecionado.id : undefined)
                  : []
                const horaSel   = parseInt(form.horaInicio.split(':')[0])
                const slotSel   = slots.find(s => s.hora === horaSel)
                const temConflito = slotSel && !slotSel.disponivel

                // Profissional não atende neste dia
                if (profCad && !horarioDia) {
                  return (
                    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'12px 14px', fontSize:'13px', color:'#92400e', display:'flex', gap:'8px', alignItems:'center' }}>
                      <span style={{ fontSize:'18px' }}>🚫</span>
                      <div>
                        <p style={{ fontWeight:'600', marginBottom:'2px' }}>{form.profissional} não atende neste dia</p>
                        <p style={{ fontSize:'12px', color:'#b45309' }}>
                          Dias disponíveis: {profCad.horarios.filter(h=>h.ativo).map(h=>['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][h.dia]).join(', ')}
                        </p>
                      </div>
                    </div>
                  )
                }

                if (slots.length === 0) return null

                return (
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                      <label style={{ fontSize:'13px', fontWeight:'500', color:'#374151' }}>
                        Horário de início
                      </label>
                      <span style={{ fontSize:'11px', color:'#9ca3af' }}>
                        {horarioDia?.inicio} – {horarioDia?.fim}
                        {' · '}
                        <span style={{ color:'#10b981', fontWeight:'500' }}>{slots.filter(s=>s.disponivel).length} disponíveis</span>
                        {slots.some(s=>!s.disponivel) && (
                          <span style={{ color:'#ef4444', fontWeight:'500' }}> · {slots.filter(s=>!s.disponivel).length} ocupados</span>
                        )}
                      </span>
                    </div>

                    {/* Legenda */}
                    <div style={{ display:'flex', gap:'12px', marginBottom:'8px' }}>
                      {[
                        { cor:'#6366f1', bg:'#eef2ff', label:'Selecionado' },
                        { cor:'#374151', bg:'white',   label:'Disponível'  },
                        { cor:'#fca5a5',bg:'#fee2e2',  label:'Ocupado'     },
                      ].map(l => (
                        <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                          <div style={{ width:'12px', height:'12px', borderRadius:'3px', background:l.bg, border:`1.5px solid ${l.cor}`, flexShrink:0 }}/>
                          <span style={{ fontSize:'10px', color:'#9ca3af' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Grid de horários disponíveis do profissional */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom: temConflito ? '10px' : '0' }}>
                      {slots.map(slot => {
                        const estaSel = horaSel === slot.hora
                        const agOcup  = !slot.disponivel
                          ? agendamentos.find(a =>
                              a.dataISO === form.dataISO &&
                              a.profissional === form.profissional &&
                              a.status !== 'cancelado' &&
                              a.id !== (modoEdicao && selecionado ? selecionado.id : -1) &&
                              slot.hora >= a.horaInicio &&
                              slot.hora < a.horaInicio + Math.ceil(a.duracao / 60)
                            )
                          : null

                        return (
                          <button
                            key={slot.hora}
                            type="button"
                            disabled={!slot.disponivel}
                            title={
                              !slot.disponivel && agOcup
                                ? `Ocupado: ${agOcup.cliente} (${String(agOcup.horaInicio).padStart(2,'0')}:00 – ${String(agOcup.horaInicio + Math.ceil(agOcup.duracao/60)).padStart(2,'0')}:00)`
                                : slot.horaStr
                            }
                            onClick={() => setForm(f => ({...f, horaInicio:slot.horaStr}))}
                            style={{
                              padding:'8px 4px',
                              borderRadius:'8px',
                              border: estaSel ? '2px solid #6366f1' : !slot.disponivel ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                              background: !slot.disponivel ? '#fee2e2' : estaSel ? '#6366f1' : 'white',
                              color: !slot.disponivel ? '#fca5a5' : estaSel ? 'white' : '#374151',
                              fontSize:'12px',
                              fontWeight: estaSel ? '700' : '400',
                              cursor: !slot.disponivel ? 'not-allowed' : 'pointer',
                              textDecoration: !slot.disponivel ? 'line-through' : 'none',
                              transition:'all .1s',
                              position:'relative',
                            }}
                          >
                            {slot.horaStr}
                            {!slot.disponivel && (
                              <span style={{ position:'absolute', top:'2px', right:'3px', fontSize:'9px' }}>🔒</span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Aviso de conflito */}
                    {temConflito && (() => {
                      const agConflito = agendamentos.find(a =>
                        a.dataISO === form.dataISO &&
                        a.profissional === form.profissional &&
                        a.status !== 'cancelado' &&
                        a.id !== (modoEdicao && selecionado ? selecionado.id : -1) &&
                        horaSel >= a.horaInicio &&
                        horaSel < a.horaInicio + Math.ceil(a.duracao / 60)
                      )
                      return agConflito ? (
                        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:'#dc2626', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                          <span style={{ fontSize:'16px', flexShrink:0 }}>⚠️</span>
                          <div>
                            <p style={{ fontWeight:'600', marginBottom:'2px' }}>Horário indisponível para {form.profissional}</p>
                            <p style={{ color:'#ef4444', fontSize:'12px' }}>
                              {agConflito.cliente} já está agendado das {String(agConflito.horaInicio).padStart(2,'0')}:00 às {String(agConflito.horaInicio + Math.ceil(agConflito.duracao/60)).padStart(2,'0')}:00. Escolha outro horário.
                            </p>
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                )
              })()}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <InputField label="Status">
                  <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))} style={selectStyle}>
                    <option value="agendado">Agendado</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="em_atendimento">Em atendimento</option>
                    <option value="finalizado">Finalizado</option>
                    <option value="cancelado">Cancelado</option>
                    <option value="nao_compareceu">Não compareceu</option>
                  </select>
                </InputField>
                <InputField label="Valor (R$)">
                  <input type="number" value={form.valor} onChange={e => setForm(f=>({...f,valor:e.target.value}))} style={inputStyle} placeholder="0,00"/>
                </InputField>
              </div>
              <InputField label="Forma de pagamento">
                <select value={form.forma_pagamento} onChange={e => setForm(f=>({...f,forma_pagamento:e.target.value}))} style={selectStyle}>
                  {FORMAS_PAG.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
                </select>
              </InputField>
              <InputField label="Observações">
                <textarea rows={2} value={form.observacoes} onChange={e => setForm(f=>({...f,observacoes:e.target.value}))}
                  style={{ ...inputStyle, resize:'none' }} placeholder="Anotações sobre o atendimento..."/>
              </InputField>

              <div style={{ display:'flex', gap:'10px', justifyContent:'space-between', marginTop:'4px' }}>
                {modoEdicao && selecionado
                  ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>
                      🗑 Cancelar agend.
                    </button>
                  : <div/>}
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Fechar</button>
                  {(() => {
                    const profCad    = PROFISSIONAIS_CADASTRO.find(p => p.nome === form.profissional)
                    const horaSel    = parseInt(form.horaInicio.split(':')[0])
                    const naoAtende  = profCad && form.dataISO ? !horarioDoDia(profCad, form.dataISO) : false
                    const slots      = profCad && form.dataISO
                      ? horariosDisponiveis(profCad, form.dataISO, parseInt(form.duracao), agendamentos, modoEdicao && selecionado ? selecionado.id : undefined)
                      : []
                    const slotSel    = slots.find(s => s.hora === horaSel)
                    const bloqueado  = naoAtende || (slotSel != null && !slotSel.disponivel) || !form.profissional || !form.cliente
                    return (
                      <button
                        onClick={bloqueado ? undefined : salvar}
                        disabled={bloqueado}
                        style={{
                          background: bloqueado ? '#d1d5db' : '#6366f1',
                          color: 'white', border:'none', borderRadius:'8px',
                          padding:'9px 18px', fontSize:'14px', fontWeight:'500',
                          cursor: bloqueado ? 'not-allowed' : 'pointer',
                        }}
                        title={naoAtende ? 'Profissional não atende neste dia' : slotSel && !slotSel.disponivel ? 'Escolha um horário disponível' : ''}
                      >
                        {naoAtende ? '🚫 Dia indisponível' : slotSel && !slotSel.disponivel ? '⚠️ Horário ocupado' : modoEdicao ? 'Salvar alterações' : 'Agendar'}
                      </button>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
