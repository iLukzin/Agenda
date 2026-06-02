'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { corStatus, labelStatus, createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'
import { carregarConfigWpp, enviarMensagem, registrarEnvio, aplicarVariaveis, formatarNumero } from '@/lib/whatsapp'
import CalendarioAgenda from './CalendarioAgenda'
import { criarAgendamento, atualizarAgendamento } from '@/lib/api'

const HORA_INICIO = 7
const ALTURA_HORA = 80
const HORAS = Array.from({length:14}, (_,i) => (i+7).toString().padStart(2,'0') + ':00')

function hojeNoBrasil() {
  const str = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(str)
  d.setHours(0,0,0,0)
  return d
}
function inicioSemana(ref: Date) {
  const d = new Date(ref)
  d.setHours(0,0,0,0)
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return d
}
function addDias(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function toISO(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function isoParaDate(iso: string) { const [y,m,d] = iso.split('-').map(Number); return new Date(y,m-1,d) }
function isMesmoISO(a: Date, b: Date) { return toISO(a) === toISO(b) }
function nomeDiaCurto(d: Date) {
  return d.toLocaleDateString('pt-BR',{weekday:'short',timeZone:'America/Sao_Paulo'}).replace('.','').replace(/^\w/,c=>c.toUpperCase())
}
function numeroDia(d: Date) { return d.getDate() }
function labelDia(d: Date) {
  return d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'})
}
function labelPeriodoSemana(seg: Date) {
  const sab = addDias(seg, 5)
  const mI = seg.toLocaleDateString('pt-BR',{month:'short',timeZone:'America/Sao_Paulo'}).replace('.','')
  const mF = sab.toLocaleDateString('pt-BR',{month:'short',timeZone:'America/Sao_Paulo'}).replace('.','')
  if (mI === mF) return numeroDia(seg) + ' - ' + numeroDia(sab) + ' de ' + mI + ' ' + sab.getFullYear()
  return numeroDia(seg) + ' ' + mI + ' - ' + numeroDia(sab) + ' ' + mF + ' ' + sab.getFullYear()
}
function linhaHoraAtual() {
  const s = new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})
  const parts = s.split(':').map(Number)
  const h = parts[0], m = parts[1]
  if (h - HORA_INICIO < 0 || h - HORA_INICIO > 13) return null
  return (h - HORA_INICIO) * ALTURA_HORA + (m / 60) * ALTURA_HORA
}

type VisualizacaoTipo = 'semana' | 'dia' | 'periodo'
type AgendamentoLocal = {
  id: string; dataISO: string; horaInicio: number; duracao: number
  cliente: string; clienteId: string; servico: string; profissional: string
  cor: string; status: string; observacoes: string; forma_pagamento: string
  valor: number; motivoCancelamento?: string; planoId?: string; sessaoNumero?: number; sessaoTotal?: number; createdAt?: string
}
type HorarioDB = {
  profissional_id: string; dia_semana: number; hora_inicio: string; hora_fim: string
}
type SlotItem = { hora: number; min: number; label: string; disponivel: boolean; clienteOcupa: string | undefined }

const FORMAS_PAG = [
  {value:'',label:'Selecionar...'},
  {value:'dinheiro',label:'Dinheiro'},
  {value:'pix',label:'PIX'},
  {value:'cartao_credito',label:'Cartao de credito'},
  {value:'cartao_debito',label:'Cartao de debito'},
  {value:'transferencia',label:'Transferencia'},
  {value:'plano',label:'Plano mensal'},
]

function calcSlots(
  horario: HorarioDB | undefined,
  dataISO: string,
  profissional: string,
  clienteId: string,
  duracao: string,
  intervaloMin: number,
  agendamentos: AgendamentoLocal[],
  modoEdicao: boolean,
  selecionado: AgendamentoLocal | null
): SlotItem[] {
  if (!horario || !dataISO || !profissional) return []
  const partsIni = (horario.hora_inicio || '08:00').split(':').map(Number)
  const partsFim = (horario.hora_fim   || '18:00').split(':').map(Number)
  const inicioMin = partsIni[0] * 60 + partsIni[1]
  const fimMin    = partsFim[0] * 60 + partsFim[1]
  const durMin    = parseInt(duracao) || 60
  const result: SlotItem[] = []
  let min = inicioMin
  // Permite agendar no horario exato de fechamento (ex: ate as 21:00 inclusive)
  while (min - fimMin <= 0) {
    const hora  = Math.floor(min / 60)
    const resto = min % 60
    const label = String(hora).padStart(2,'0') + ':' + String(resto).padStart(2,'0')

    // Regra: bloquear somente pelo PROFISSIONAL selecionado no horario de inicio
    // Prof Y NAO e bloqueado pelo horario do Prof X
    const agDoProf = agendamentos.filter(ag => {
      if (ag.dataISO !== dataISO) return false
      if (ag.profissional !== profissional) return false
      if (modoEdicao && selecionado && ag.id === selecionado.id) return false
      return Math.round(ag.horaInicio * 60) === min
    })

    // Bloqueado se o profissional ja tem aberto ou finalizado neste horario
    const confProf = agDoProf.find(ag => ag.status !== 'cancelado')
    const conflito = confProf
    let clienteOcupa: string | undefined
    if (confProf) {
      clienteOcupa = confProf.cliente + (confProf.status === 'fechado' ? ' (finalizado)' : ' (aberto)')
    }

    result.push({ hora, min, label, disponivel: !conflito, clienteOcupa })
    min += intervaloMin
  }
  return result
}

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>{label}</label>
      {children}
    </div>
  )
}
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }
const selectStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }

function MiniCalendario({ dataSel, onChange, onFechar }: { dataSel: Date; onChange: (d: Date) => void; onFechar: () => void }) {
  const hoje = hojeNoBrasil()
  const [mes, setMes] = useState(new Date(dataSel.getFullYear(), dataSel.getMonth(), 1))
  const dow = new Date(mes.getFullYear(), mes.getMonth(), 1).getDay()
  const inicioOffset = dow === 0 ? 6 : dow - 1
  const inicio = addDias(new Date(mes.getFullYear(), mes.getMonth(), 1), -inicioOffset)
  const celulas = Array.from({length:42}, (_,i) => addDias(inicio, i))
  const nomeMes = mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).replace(/^\w/,c=>c.toUpperCase())
  return (
    <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:200, background:'white', borderRadius:'14px', border:'1px solid #e5e7eb', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', padding:'16px', width:'268px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <button onClick={()=>setMes(d=>new Date(d.getFullYear(),d.getMonth()-1,1))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'#6b7280', padding:'2px 8px' }}>{'<'}</button>
        <span style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a2e' }}>{nomeMes}</span>
        <button onClick={()=>setMes(d=>new Date(d.getFullYear(),d.getMonth()+1,1))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'#6b7280', padding:'2px 8px' }}>{'>'}</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:'4px' }}>
        {['S','T','Q','Q','S','S','D'].map((d,i) => <div key={i} style={{ textAlign:'center', fontSize:'10px', fontWeight:'600', color:'#9ca3af', padding:'3px 0' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'1px' }}>
        {celulas.map((data,i) => {
          const estesMes = data.getMonth() === mes.getMonth()
          const ehHoje = isMesmoISO(data, hoje)
          const ehSel = isMesmoISO(data, dataSel)
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

function ListaPeriodo({ agendamentos, onEditar }: { agendamentos: AgendamentoLocal[]; onEditar: (ag: AgendamentoLocal) => void }) {
  if (agendamentos.length === 0) return <div style={{ textAlign:'center', padding:'48px 0', color:'#9ca3af', fontSize:'14px' }}>Nenhum agendamento neste periodo.</div>
  const porData = agendamentos.reduce<Record<string,AgendamentoLocal[]>>((acc,ag) => {
    acc[ag.dataISO] = acc[ag.dataISO] || []
    acc[ag.dataISO].push(ag)
    return acc
  }, {})
  return (
    <div style={{ flex:1, overflowY:'auto', padding:'4px 2px' }}>
      {Object.keys(porData).sort().map(iso => {
        const data = isoParaDate(iso)
        const ehHoje = isMesmoISO(data, hojeNoBrasil())
        const ags = porData[iso].sort((a,b) => a.horaInicio - b.horaInicio)
        const lbl = data.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'})
        return (
          <div key={iso} style={{ marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
              <div style={{ padding:'3px 12px', borderRadius:'99px', fontSize:'12px', fontWeight:'600', background:ehHoje?'#6366f1':'#f3f4f6', color:ehHoje?'white':'#374151', textTransform:'capitalize' }}>{lbl}</div>
              <div style={{ flex:1, height:'1px', background:'#f0f0f8' }}/>
              <span style={{ fontSize:'12px', color:'#9ca3af' }}>{ags.length} agend.</span>
            </div>
            {ags.map(ag => {
              const hH = Math.floor(ag.horaInicio), hM = Math.round((ag.horaInicio - hH) * 60)
              const hora = String(hH).padStart(2,'0') + ':' + String(hM).padStart(2,'0')
              return (
                <div key={ag.id} onClick={()=>onEditar(ag)} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'white', borderRadius:'10px', border:'1px solid ' + ag.cor + '30', borderLeft:'4px solid ' + ag.cor, cursor:'pointer', marginBottom:'6px' }}>
                  <div style={{ width:'46px', textAlign:'center', flexShrink:0 }}>
                    <p style={{ fontSize:'15px', fontWeight:'700', color:ag.cor, fontFamily:'monospace' }}>{hora}</p>
                    <p style={{ fontSize:'10px', color:'#9ca3af' }}>{ag.duracao} min</p>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ag.cliente}</p>
                    <p style={{ fontSize:'12px', color:'#9ca3af' }}>{ag.servico}</p>
                  </div>
                  <span className={corStatus(ag.status)} style={{ fontSize:'11px', padding:'3px 10px', borderRadius:'99px', flexShrink:0 }}>{labelStatus(ag.status)}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
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
export default function AgendaPage() {
  const { empresaAtiva, usuario } = useEmpresa()
  const tipoAgenda = (empresaAtiva as any)?.tipo_agenda || 'grade'
  const hoje = useMemo(() => hojeNoBrasil(), [])

  const [agendamentos, setAgendamentos] = useState<AgendamentoLocal[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [horariosProfissional, setHorariosProfissional] = useState<HorarioDB[]>([])
  const [carregando, setCarregando] = useState(false)
  const [visualizacao, setVisualizacao] = useState<VisualizacaoTipo>('dia')
  const [semanaBase, setSemanaBase] = useState<Date>(() => inicioSemana(hojeNoBrasil()))
  const [diaAtivo, setDiaAtivo] = useState<Date>(() => hojeNoBrasil())
  const [calAberto, setCalAberto] = useState(false)
  const [periodoInicio, setPeriodoInicio] = useState(toISO(hojeNoBrasil()))
  const [periodoFim, setPeriodoFim] = useState(toISO(addDias(hojeNoBrasil(), 30)))
  const [filtroAberto, setFiltroAberto] = useState(false)
  const [filtroProfissional, setFiltroProfissional] = useState('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [selecionado, setSelecionado] = useState<AgendamentoLocal | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [enviandoWpp, setEnviandoWpp] = useState(false)
  const [statusWpp, setStatusWpp] = useState<'idle'|'ok'|'erro'>('idle')
  const [wppConectado, setWppConectado] = useState(false)
  const permWpp = usePermissao('agenda_wpp')
  const [erroForm, setErroForm] = useState<string[]>([])
  const [finalizando, setFinalizando] = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clienteSel, setClienteSel] = useState<any>(null)
  const [dropCliente, setDropCliente] = useState(false)
  const [modalNovoCliente, setModalNovoCliente] = useState(false)
  const [formNovoCliente, setFormNovoCliente] = useState({ nome:'', telefone:'', whatsapp:'', email:'' })
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [intervaloMin, setIntervaloMin] = useState(30)
  const [form, setForm] = useState({ clienteId:'', cliente:'', servico:'', profissional:'', dataISO:toISO(hojeNoBrasil()), horaInicio:'09:00', duracao:'60', status:'aberto', forma_pagamento:'', valor:'', observacoes:'', plano_id:'', usar_plano:false })
  const [planoCliente, setPlanoCliente] = useState<any>(null)
  const [sessaoPlano, setSessaoPlano]   = useState<any>(null)

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    // Nivel usuario e profissional com vinculo: filtrar so suas agendas
    const ehProf = (usuario?.nivel_acesso === 'profissional' || usuario?.nivel_acesso === 'usuario') && !!usuario?.profissional_id
    let qAgs = sb.from('agendamentos').select('id,data_inicio,created_at,status,valor,forma_pagamento,observacoes,cliente_id,servico_id,profissional_id,prof_id,motivo_cancelamento,sessao_numero,sessao_total').eq('empresa_id', empresaAtiva.id)
    if (ehProf && usuario.profissional_id) qAgs = qAgs.eq('prof_id', usuario.profissional_id)
    let qProfs = sb.from('profissionais').select('id,nome,cargo,cor,status,servicos').eq('empresa_id', empresaAtiva.id).eq('status', 'ativo')
    if (ehProf && usuario.profissional_id) qProfs = qProfs.eq('id', usuario.profissional_id)
    const [r1, r2, r3, r4, r5] = await Promise.all([
      qAgs.order('data_inicio'),
      sb.from('clientes').select('id,nome,telefone,whatsapp,plano_id').eq('empresa_id', empresaAtiva.id),
      qProfs.order('nome'),
      sb.from('servicos').select('id,nome,cor,duracao_min,valor,status').eq('empresa_id', empresaAtiva.id).eq('status', 'ativo').order('nome'),
      sb.from('horarios_prof').select('profissional_id,dia_semana,hora_inicio,hora_fim,ativo').eq('empresa_id', empresaAtiva.id).eq('ativo', true),
    ])
    const agsRaw = r1.data || []
    const clsRaw = r2.data || []
    const profsRaw = r3.data || []
    const servsRaw = r4.data || []
    const horsRaw = r5.data || []
    const cliMap: Record<string,string> = {}
    const profMap: Record<string,string> = {}
    const servNom: Record<string,string> = {}
    const servCor: Record<string,string> = {}
    const servDur: Record<string,number> = {}
    clsRaw.forEach((c: any) => { cliMap[c.id] = c.nome })
    profsRaw.forEach((p: any) => { profMap[p.id] = p.nome })
    servsRaw.forEach((s: any) => { servNom[s.id] = s.nome; servCor[s.id] = s.cor || '#6366f1'; servDur[s.id] = s.duracao_min || 60 })
    setHorariosProfissional(horsRaw as HorarioDB[])
    setClientes(clsRaw)
    setProfissionais(profsRaw)
    setServicos(servsRaw)
    setAgendamentos(agsRaw.map((a: any) => ({
      id: a.id,
      dataISO: a.data_inicio ? a.data_inicio.slice(0,10) : toISO(hojeNoBrasil()),
      horaInicio: a.data_inicio ? parseInt(a.data_inicio.slice(11,13)) + parseInt(a.data_inicio.slice(14,16)) / 60 : 0,
      duracao: servDur[a.servico_id] || 60,
      cliente: cliMap[a.cliente_id] || '',
      clienteId: a.cliente_id || '',
      servico: servNom[a.servico_id] || '',
      profissional: a.prof_id ? (profMap[a.prof_id] || '') : (profMap[a.profissional_id] || ''),
      cor: servCor[a.servico_id] || '#6366f1',
      status: a.status || '',
      observacoes: a.observacoes || '',
      forma_pagamento: a.forma_pagamento || '',
      valor: a.valor || 0,
      motivoCancelamento: a.motivo_cancelamento || undefined,
      planoId: !a.servico_id ? 'plano' : undefined,
      createdAt: a.created_at || a.data_inicio,
      sessaoNumero: a.sessao_numero || undefined,
      sessaoTotal: a.sessao_total || undefined,
    })))
    setCarregando(false)
  }, [empresaAtiva?.id, usuario?.nivel_acesso, usuario?.profissional_id])

  // Carregar dados iniciais
  // Ref estavel para o carregar - evita closure stale no Realtime
  const carregarRef = useRef(carregar)
  useEffect(() => { carregarRef.current = carregar }, [carregar])

  useEffect(() => { carregar() }, [carregar])

  // Verificar conexao WhatsApp (busca direto do banco, sem depender do contexto)
  useEffect(() => {
    if (!empresaAtiva?.id) return
    const sb2 = createClient()
    Promise.all([
      sb2.from('config_sistema').select('chave,valor').in('chave', ['evolution_api_url','evolution_api_key']),
      sb2.from('empresas').select('whatsapp_instancia,whatsapp_habilitado').eq('id', empresaAtiva.id).single(),
    ]).then(([cfg, emp]) => {
      if (!emp.data?.whatsapp_habilitado) return
      const cfgMap: Record<string,string> = {}
      if (cfg.data) cfg.data.forEach((c: any) => { cfgMap[c.chave] = c.valor || '' })
      const url = cfgMap['evolution_api_url']
      const key = cfgMap['evolution_api_key']
      const inst = emp.data?.whatsapp_instancia || ('emp-' + empresaAtiva.id.slice(0,8))
      if (!url || !key) return
      fetch(url.replace(/\/$/, '') + '/instance/connectionState/' + inst, { headers: { 'apikey': key } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (!d) return; const st = d?.instance?.state || d?.state || ''; if (st === 'open' || st === 'connected') setWppConectado(true) })
        .catch(() => {})
    }).catch(() => {})
  }, [empresaAtiva?.id])

  // Fechar modal com ESC
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (modalCancelar) { setModalCancelar(false); return }
        if (modalAberto) { fecharModal(); return }
        if (calAberto) { setCalAberto(false); return }
        if (filtroAberto) { setFiltroAberto(false); return }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modalAberto, modalCancelar, calAberto, filtroAberto])
  useVisibilityRefresh(carregar)

  // Realtime: canal separado que nao re-subscribe a cada render
  useEffect(() => {
    if (!empresaAtiva?.id) return
    const empresaId = empresaAtiva.id
    const sb = createClient()

    // Sem filter para garantir compatibilidade - filtramos no callback
    const channel = sb
      .channel('agenda-rt-' + empresaId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agendamentos',
      }, (payload: any) => {
        // Verificar se e da empresa correta antes de recarregar
        const rec = payload.new || payload.old
        if (!rec || rec.empresa_id === empresaId) {
          carregarRef.current()
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Conectado - agenda', empresaId)
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Erro no canal - tentando reconectar')
        }
      })

    return () => {
      console.log('[Realtime] Desconectando canal')
      sb.removeChannel(channel)
    }
  }, [empresaAtiva?.id]) // SEM carregar no dep - evita loop

  const diasSemana = useMemo(() => Array.from({length:7}, (_,i) => addDias(semanaBase, i)), [semanaBase])

  function semanaAnterior() { setSemanaBase(d => addDias(d, -7)) }
  function semanaSeguinte() { setSemanaBase(d => addDias(d, 7)) }
  function diaAnterior() { setDiaAtivo(d => { const n = addDias(d,-1); setSemanaBase(inicioSemana(n)); return n }) }
  function diaSeguinte() { setDiaAtivo(d => { const n = addDias(d,1); setSemanaBase(inicioSemana(n)); return n }) }
  function irParaHoje() { const h = hojeNoBrasil(); setSemanaBase(inicioSemana(h)); setDiaAtivo(h); setCalAberto(false) }
  function irParaData(d: Date) { setSemanaBase(inicioSemana(d)); setDiaAtivo(d); setCalAberto(false) }

  function abrirNovo() {
    const dataRef = visualizacao === 'dia' ? diaAtivo : hoje
    setModoEdicao(false); setSelecionado(null); setClienteSel(null); setBuscaCliente('')
    setPlanoCliente(null); setSessaoPlano(null)
    setIntervaloMin(30)
    setForm({ clienteId:'', cliente:'', servico:'', profissional:'', dataISO:toISO(dataRef), horaInicio:'09:00', duracao:'60', status:'aberto', forma_pagamento:'', valor:'', observacoes:'' })
    setModalAberto(true)
  }

  function abrirEdicao(ag: AgendamentoLocal) {
    setModoEdicao(true); setSelecionado(ag)
    const cl = clientes.find((c: any) => c.id === ag.clienteId) || null
    setClienteSel(cl); setBuscaCliente('')
    const hiH = Math.floor(ag.horaInicio), hiM = Math.round((ag.horaInicio - hiH) * 60)
    const ehPlano = !!ag.planoId
    setForm({ clienteId:ag.clienteId, cliente:ag.cliente, servico:ag.servico, profissional:ag.profissional, dataISO:ag.dataISO, horaInicio:String(hiH).padStart(2,'0') + ':' + String(hiM).padStart(2,'0'), duracao:String(ag.duracao), status:ag.status, forma_pagamento:ag.forma_pagamento, valor:String(ag.valor), observacoes:ag.observacoes, usar_plano:ehPlano, plano_id:ag.planoId||'' })
    setIntervaloMin(30); setModalAberto(true)
    // Carregar plano do cliente se for plano
    if (ehPlano && ag.clienteId) {
      // Edicao: carregar info do plano para exibicao sem recalcular valor
      const sb2 = createClient()
      Promise.all([
        sb2.from('clientes').select('plano_id').eq('id', ag.clienteId).single(),
        // Ordenar por created_at para pegar a ordem real de criacao
        sb2.from('agendamentos').select('id,created_at,sessao_numero,sessao_total').eq('cliente_id', ag.clienteId).is('servico_id', null).neq('status','cancelado').order('created_at', { ascending:true }),
      ]).then(([cliRes, agsRes]) => {
        if (cliRes.data?.plano_id) buscarPlanoCliente(ag.clienteId, cliRes.data.plano_id, true)
        const agsPlano = agsRes.data || []
        // Se ja tem sessao_numero salvo, usar ele
        if (ag.sessaoNumero && ag.sessaoTotal) {
          setSelecionado((prev: any) => prev ? ({ ...prev, sessaoNumero: ag.sessaoNumero, sessaoTotal: ag.sessaoTotal }) : prev)
          return
        }
        // Senao calcular pela posicao de criacao
        const posicao = agsPlano.findIndex((a: any) => a.id === ag.id)
        if (posicao >= 0) {
          const totalPlano = ag.sessaoTotal || agsPlano.length || 1
          const sessaoNoCiclo = (posicao % totalPlano) + 1
          setSelecionado((prev: any) => prev ? ({ ...prev, sessaoNumero: sessaoNoCiclo, sessaoTotal: totalPlano }) : prev)
        }
      })
    }
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setModoEdicao(false); setClienteSel(null); setBuscaCliente(''); setDropCliente(false); setModalCancelar(false); setMotivoCancelamento(''); setErroForm([]) }

  async function salvar() {
    // Validacao completa dos campos obrigatorios
    const erros: string[] = []
    if (!form.clienteId)    erros.push('Cliente e obrigatorio')
    if (!form.profissional) erros.push('Profissional e obrigatorio')
    if (!form.usar_plano && !form.servico) erros.push('Servico e obrigatorio')
    if (!form.dataISO)      erros.push('Data e obrigatoria')
    if (!form.horaInicio)   erros.push('Horario e obrigatorio')
    if (erros.length > 0) { setErroForm(erros); return }
    setErroForm([])
    if (!empresaAtiva?.id) return
    setSalvando(true)
    const parts = (form.horaInicio || '09:00').split(':').map(Number)
    const dataInicio = form.dataISO + 'T' + String(parts[0]).padStart(2,'0') + ':' + String(parts[1]).padStart(2,'0') + ':00'
    const srv = servicos.find((s: any) => s.nome === form.servico)
    const prof = profissionais.find((p: any) => p.nome === form.profissional)
    const dataFim = new Date(new Date(dataInicio).getTime() + parseInt(form.duracao) * 60000).toISOString()
    // Valor: na edicao manter o valor original; na criacao calcular pela sessao
    let valorFinal = parseFloat(form.valor) || 0
    if (!modoEdicao && form.usar_plano && planoCliente) {
      // Novo agendamento: calcular se e sessao de cobranca
      const ipSalvar = calcularSessaoPlano()
      valorFinal = ipSalvar.cobrar ? (parseFloat(planoCliente.valor_mensal||planoCliente.valor||'0') || 0) : 0
    }
    // Na edicao com plano: manter o valor original do agendamento (form.valor)
    const payload: any = { cliente_id:form.clienteId, servico_id:srv?.id||null, profissional_id:null, prof_id:prof?.id||null, data_inicio:dataInicio, data_fim:dataFim, tipo_cobranca:form.usar_plano?'plano':'avulso', valor:valorFinal, forma_pagamento:form.usar_plano?'plano':form.forma_pagamento||null, observacoes:form.observacoes||null }
    if (!modoEdicao) payload.status = 'aberto'
    let error: any
    if (modoEdicao && selecionado) { const res = await atualizarAgendamento(selecionado.id, payload); error = res.error }
    else { const res = await criarAgendamento(empresaAtiva.id, payload); error = res.error }
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    // Registrar sessao do plano
    if (!modoEdicao && form.usar_plano && planoCliente && empresaAtiva?.id) {
      const sb3 = createClient()
      const total = planoCliente.sessoes || planoCliente.sessoes_mes || 1
      // Contar agendamentos de plano ANTES deste (o recem criado ja esta no banco)
      // Ordenar por created_at e pegar o ultimo inserido = o recem criado
      const { data: agsExist } = await sb3.from('agendamentos')
        .select('id,created_at,sessao_numero')
        .eq('empresa_id', empresaAtiva.id)
        .eq('cliente_id', form.clienteId)
        .is('servico_id', null)
        .neq('status', 'cancelado')
        .order('created_at', { ascending:true })
      const lista = agsExist || []
      // O recem criado e o ultimo da lista
      const lastAg = lista[lista.length - 1]
      // Posicao na lista (0-based) = index do ultimo
      const posicao = lista.length - 1
      const sessaoNoCiclo = (posicao % total) + 1
      const cobrar = sessaoNoCiclo === 1
      const valorCorreto = cobrar ? (parseFloat(planoCliente.valor_mensal||planoCliente.valor||'0') || 0) : 0
      // Salvar sessao_numero, sessao_total e valor correto no agendamento recem criado
      if (lastAg?.id) {
        await sb3.from('agendamentos').update({
          sessao_numero: sessaoNoCiclo,
          sessao_total: total,
          valor: valorCorreto,
        }).eq('id', lastAg.id)
      }
      // Atualizar sessoes_utilizadas
      if (sessaoPlano?.id) {
        await sb3.from('cliente_plano_sessoes').update({ sessoes_utilizadas: lista.length }).eq('id', sessaoPlano.id)
      } else {
        await sb3.from('cliente_plano_sessoes').insert({ empresa_id:empresaAtiva.id, cliente_id:form.clienteId, plano_id:planoCliente.id, sessoes_utilizadas:1 })
      }
    }
    setSemanaBase(inicioSemana(isoParaDate(form.dataISO))); setDiaAtivo(isoParaDate(form.dataISO))
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function confirmarCancelamento() {
    if (!selecionado) return
    setCancelando(true)
    const sb2 = createClient()
    const { error } = await sb2.from('agendamentos').update({ status:'cancelado', motivo_cancelamento:motivoCancelamento||null }).eq('id', selecionado.id)
    if (error) { alert('Erro: ' + error.message); setCancelando(false); return }
    setCancelando(false); setModalCancelar(false)
    await carregar(); fecharModal()
  }

  function mascaraTel(v: string) {
    const d = v.replace(/\D/g,'').slice(0,11)
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'')
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'')
  }

  async function salvarNovoClienteInline() {
    if (!formNovoCliente.nome.trim() || !empresaAtiva?.id) return
    setSalvandoCliente(true)
    const sb2 = createClient()
    const { data, error } = await sb2.from('clientes').insert({
      empresa_id: empresaAtiva.id,
      nome: formNovoCliente.nome.trim(),
      telefone: formNovoCliente.telefone.trim() || null,
      whatsapp: formNovoCliente.whatsapp.trim() || null,
      email: formNovoCliente.email.trim() || null,
      status: 'ativo',
    }).select().single()
    setSalvandoCliente(false)
    if (error) { alert('Erro ao cadastrar: ' + error.message); return }
    // Adicionar na lista local e selecionar
    setClientes((prev: any[]) => [...prev, data].sort((a,b) => a.nome.localeCompare(b.nome)))
    setClienteSel(data)
    setForm(f => ({ ...f, clienteId: data.id, cliente: data.nome }))
    setBuscaCliente('')
    setDropCliente(false)
    setModalNovoCliente(false)
    setFormNovoCliente({ nome:'', telefone:'', whatsapp:'', email:'' })
    setErroForm([])
  }

  async function enviarConfirmacao() {
    if (!selecionado || !empresaAtiva?.id) return
    setEnviandoWpp(true); setStatusWpp('idle')
    const sb2 = createClient()
    // Buscar numero e config em paralelo
    const [cliRes, cfgRes, tmplRes] = await Promise.all([
      sb2.from('clientes').select('nome,whatsapp,telefone').eq('id', selecionado.clienteId).single(),
      sb2.from('config_sistema').select('chave,valor').in('chave', ['evolution_api_url','evolution_api_key']),
      sb2.from('mensagens_template').select('mensagem').eq('empresa_id', empresaAtiva.id).eq('tipo', 'confirmacao').eq('ativo', true).maybeSingle(),
    ])
    const cli = cliRes.data
    if (!cli) { setStatusWpp('erro'); setEnviandoWpp(false); return }
    const numero = cli.whatsapp || cli.telefone
    if (!numero) { alert('Cliente nao tem numero de WhatsApp cadastrado.'); setEnviandoWpp(false); return }
    // Buscar config Evolution API
    const cfgMap: Record<string,string> = {}
    if (cfgRes.data) cfgRes.data.forEach((c: any) => { cfgMap[c.chave] = c.valor || '' })
    const apiUrl = cfgMap['evolution_api_url']
    const apiKey = cfgMap['evolution_api_key']
    if (!apiUrl || !apiKey) { alert('Configure a Evolution API em Configuracoes > WhatsApp.'); setEnviandoWpp(false); return }
    // Buscar instancia da empresa
    const { data: empData } = await sb2.from('empresas').select('whatsapp_instancia').eq('id', empresaAtiva.id).single()
    const instancia = empData?.whatsapp_instancia || ('emp-' + empresaAtiva.id.slice(0,8))
    // Montar mensagem
    const templateMsg = tmplRes.data?.mensagem || 'Ola {{cliente}}! Confirmando seu horario em {{data}} as {{hora}} para {{servico}}. Pode confirmar?'
    // Formatar data e hora
    const [y,m,d] = selecionado.dataISO.split('-')
    const dataFmt = d + '/' + m + '/' + y
    const hh = Math.floor(selecionado.horaInicio), mm2 = Math.round((selecionado.horaInicio - hh) * 60)
    const horaFmt = String(hh).padStart(2,'0') + ':' + String(mm2).padStart(2,'0')
    const msg = aplicarVariaveis(templateMsg, { cliente: selecionado.cliente, empresa: empresaAtiva.nome||'', data: dataFmt, hora: horaFmt, servico: selecionado.servico||'' })
    // Formatar numero
    const digits = numero.replace(/\D/g,'')
    const numFmt = digits.startsWith('55') ? digits : '55' + digits
    // Enviar via Evolution API diretamente
    try {
      const res = await fetch(apiUrl.replace(/\/$/, '') + '/message/sendText/' + instancia, {
        method: 'POST',
        headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: numFmt, options:{ delay:1000, presence:'composing' }, text: msg }),
      })
      if (res.ok) {
        await registrarEnvio(empresaAtiva.id, { cliente_id: selecionado.clienteId, agendamento_id: selecionado.id, tipo: 'confirmacao', numero: numFmt, mensagem: msg, status: 'enviado' })
        setStatusWpp('ok'); setTimeout(() => setStatusWpp('idle'), 4000)
      } else {
        const errTxt = await res.text()
        alert('Erro ao enviar: ' + errTxt.slice(0,100))
        setStatusWpp('erro')
      }
    } catch (ex: any) {
      alert('Erro: ' + ex.message); setStatusWpp('erro')
    }
    setEnviandoWpp(false)
  }

  async function finalizar(id: string) {
    // Validar forma de pagamento antes de finalizar
    if (!form.forma_pagamento) {
      setErroForm(['Para finalizar e necessario informar a Forma de pagamento.'])
      return
    }
    if (!confirm('Finalizar este atendimento?')) return
    setFinalizando(true)
    const sb2 = createClient()
    // Salvar forma de pagamento e valor junto ao finalizar
    const updatePayload: any = { status:'fechado', forma_pagamento: form.forma_pagamento }
    if (form.valor) updatePayload.valor = parseFloat(form.valor) || 0
    const { error } = await sb2.from('agendamentos').update(updatePayload).eq('id', id)
    if (error) alert('Erro: ' + error.message)
    else { await carregar(); fecharModal() }
    setFinalizando(false)
  }

  const profSelecionado = profissionais.find((p: any) => p.nome === form.profissional)
  const servicosDoProf = profSelecionado
    ? (profSelecionado.servicos && profSelecionado.servicos.length > 0 ? servicos.filter((s: any) => profSelecionado.servicos.includes(s.nome)) : [])
    : servicos
  const diaSemanaForm = form.dataISO ? isoParaDate(form.dataISO).getDay() : -1
  const horarioDoDiaForm = profSelecionado ? horariosProfissional.find(h => h.profissional_id === profSelecionado.id && h.dia_semana === diaSemanaForm) : undefined
  const naoAtende = !!(profSelecionado && form.dataISO && !horarioDoDiaForm)
  const slotsDisponiveis = useMemo(() => calcSlots(horarioDoDiaForm, form.dataISO, form.profissional, form.clienteId, form.duracao, intervaloMin, agendamentos, modoEdicao, selecionado), [horarioDoDiaForm, form.dataISO, form.profissional, form.clienteId, form.duracao, intervaloMin, agendamentos, modoEdicao, selecionado])
  const slotSel = slotsDisponiveis.find(s => s.label === form.horaInicio)
  const btnBloqueado = (naoAtende && !!profSelecionado) || (!!slotSel && !slotSel.disponivel) || !form.profissional || !form.clienteId

  const diasParaMostrar = visualizacao === 'dia' ? [diaAtivo] : diasSemana
  const posLinha = linhaHoraAtual()

  const agsFiltrados = useMemo(() => {
    if (filtroProfissional === 'todos') return agendamentos
    return agendamentos.filter(a => a.profissional === filtroProfissional)
  }, [agendamentos, filtroProfissional])

  const agendamentosPeriodo = useMemo(() => {
    return agendamentos.filter(a => {
      const c1 = a.dataISO.localeCompare(periodoInicio)
      const c2 = a.dataISO.localeCompare(periodoFim)
      return c1 > -1 && c2 < 1
    }).sort((a,b) => a.dataISO.localeCompare(b.dataISO) || a.horaInicio - b.horaInicio)
  }, [agendamentos, periodoInicio, periodoFim])


  // Logica de sessoes do plano
  const calcularSessaoPlano = () => {
    if (!planoCliente) return { cobrar: true, sessaoAtual: 1, total: 1, utilizadas: 0 }
    const total = planoCliente.sessoes_mes || planoCliente.sessoes || 1
    // Contar agendamentos de plano existentes do cliente (nao cancelados)
    // O novo ainda nao foi criado, entao este e o proximo
    const agsPlano = agendamentos.filter(a => !a.servico && a.clienteId === form.clienteId && a.status !== 'cancelado')
    const utilizadas = agsPlano.length // quantos ja existem
    const proximaPosicao = utilizadas % total // posicao do proximo (0-based)
    const cobrar = proximaPosicao === 0 // cobra quando e inicio de ciclo
    const sessaoAtual = proximaPosicao + 1 // sessao do novo (1-based)
    return { cobrar, sessaoAtual, total, utilizadas }
  }
  const infoPlano = form.usar_plano && planoCliente ? calcularSessaoPlano() : null
  async function buscarPlanoCliente(clienteId: string, planoId: string, apenasExibir = false) {
    if (!empresaAtiva?.id) return
    const sb2 = createClient()
    const [r1, r2] = await Promise.all([
      sb2.from('planos').select('*').eq('id', planoId).single(),
      sb2.from('cliente_plano_sessoes').select('*').eq('cliente_id', clienteId).eq('plano_id', planoId).eq('empresa_id', empresaAtiva.id).maybeSingle(),
    ])
    if (r1.data) {
      setPlanoCliente(r1.data)
      setSessaoPlano(r2.data)
      if (!apenasExibir) {
        // Novo agendamento: nao alterar valor aqui, sera calculado no salvar()
        setForm(f => ({...f, usar_plano: true}))
      }
      // Na edicao (apenasExibir=true): nao altera valor, apenas mostra info do plano
    } else {
      setPlanoCliente(null)
      setSessaoPlano(null)
    }
  }

  const isBloqEdicao = modoEdicao && (selecionado?.status === 'fechado' || selecionado?.status === 'cancelado')

  const getLabelPeriodo = () => {
    if (!periodoInicio || !periodoFim) return 'Periodo'
    const ini = isoParaDate(periodoInicio).toLocaleDateString('pt-BR',{day:'numeric',month:'short',timeZone:'America/Sao_Paulo'})
    const fim = isoParaDate(periodoFim).toLocaleDateString('pt-BR',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Sao_Paulo'})
    return ini + ' - ' + fim
  }

  return (
    <div style={{ padding:'16px', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Vista Calendario */}
      {tipoAgenda === 'calendario' && (
        <div style={{ flex:1, overflow:'hidden' }}>
          <CalendarioAgenda
            agendamentos={agendamentos}
            profissionais={profissionais}
            onAbrirNovo={abrirNovo}
            onAbrirEdicao={abrirEdicao}
            filtroProfissional={filtroProfissional}
            setFiltroProfissional={setFiltroProfissional}
          />
        </div>
      )}
      {tipoAgenda === 'grade' && (<>
      {/* Cabecalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexShrink:0, flexWrap:'wrap', gap:'10px' }}>
        <div style={{ position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <div>
              <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px', lineHeight:1 }}>Agenda</h1>
            </div>
            <button onClick={()=>setCalAberto(c=>!c)}
              style={{ display:'flex', alignItems:'center', gap:'8px', background:'white', border:'1.5px solid #e0e7ff', borderRadius:'12px', padding:'7px 14px', cursor:'pointer', boxShadow:'0 1px 4px rgba(99,102,241,0.1)', transition:'all .15s' }}
              onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor='#6366f1';el.style.boxShadow='0 2px 8px rgba(99,102,241,0.2)'}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor='#e0e7ff';el.style.boxShadow='0 1px 4px rgba(99,102,241,0.1)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span style={{ fontSize:'13px', fontWeight:'600', color:'#4f46e5', textTransform:'capitalize', letterSpacing:'-0.2px', whiteSpace:'nowrap' }}>
                {visualizacao === 'periodo' ? getLabelPeriodo() : visualizacao === 'semana' ? labelPeriodoSemana(semanaBase) : labelDia(diaAtivo)}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
          {calAberto && (
            <><div onClick={()=>setCalAberto(false)} style={{ position:'fixed', inset:0, zIndex:199 }}/>
            <MiniCalendario dataSel={diaAtivo} onChange={d=>{irParaData(d);setVisualizacao('dia')}} onFechar={()=>setCalAberto(false)}/></>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={abrirNovo} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'10px', padding:'9px 20px', fontSize:'14px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'7px', boxShadow:'0 3px 10px rgba(99,102,241,0.4)', letterSpacing:'-0.2px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo agendamento
          </button>
          <div style={{ position:'relative' }}>
            <button onClick={()=>setFiltroAberto(f=>!f)} style={{ display:'flex', alignItems:'center', gap:'6px', background:'white', border:visualizacao==='periodo'?'1.5px solid #6366f1':'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 14px', cursor:'pointer', fontSize:'13px', fontWeight:'500', color:visualizacao==='periodo'?'#6366f1':'#374151' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Filtrar periodo
            </button>
            {filtroAberto && (
              <><div onClick={()=>setFiltroAberto(false)} style={{ position:'fixed', inset:0, zIndex:149 }}/>
              <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:'calc(100% + 8px)', right:0, zIndex:150, background:'white', borderRadius:'14px', border:'1px solid #e5e7eb', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', padding:'18px', width:'280px' }}>
                <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'14px' }}>Filtrar por periodo</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
                  <div><label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>Data inicial</label><input type="date" value={periodoInicio} onChange={e=>setPeriodoInicio(e.target.value)} style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/></div>
                  <div><label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>Data final</label><input type="date" value={periodoFim} onChange={e=>setPeriodoFim(e.target.value)} style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'12px' }}>
                  {[{label:'Hoje',ini:0,fim:0},{label:'7 dias',ini:0,fim:7},{label:'15 dias',ini:0,fim:15},{label:'30 dias',ini:0,fim:30}].map(at=>(
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
          {visualizacao !== 'periodo' && (
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              <button onClick={visualizacao==='semana'?semanaAnterior:diaAnterior}
                style={{ width:'36px', height:'36px', background:'white', border:'1.5px solid #e5e7eb', borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#374151', transition:'all .15s', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#f5f3ff';el.style.borderColor='#6366f1';el.style.color='#6366f1'}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.borderColor='#e5e7eb';el.style.color='#374151'}}
                title={visualizacao==='semana'?'Semana anterior':'Dia anterior'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button onClick={irParaHoje}
                style={{ height:'36px', padding:'0 14px', background:'#eef2ff', border:'1.5px solid #c7d2fe', borderRadius:'10px', cursor:'pointer', fontSize:'13px', fontWeight:'700', color:'#6366f1', transition:'all .15s', letterSpacing:'-0.2px' }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#6366f1';el.style.color='white'}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff';el.style.color='#6366f1'}}>
                Hoje
              </button>
              <button onClick={visualizacao==='semana'?semanaSeguinte:diaSeguinte}
                style={{ width:'36px', height:'36px', background:'white', border:'1.5px solid #e5e7eb', borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#374151', transition:'all .15s', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#f5f3ff';el.style.borderColor='#6366f1';el.style.color='#6366f1'}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.borderColor='#e5e7eb';el.style.color='#374151'}}
                title={visualizacao==='semana'?'Proxima semana':'Proximo dia'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          )}
          <div style={{ display:'flex', background:'#f3f4f6', borderRadius:'8px', padding:'3px' }}>
            {(['semana','dia'] as const).map(v=>(
              <button key={v} onClick={()=>setVisualizacao(v)} style={{ padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:'500', background:visualizacao===v?'white':'transparent', color:visualizacao===v?'#1a1a2e':'#9ca3af', boxShadow:visualizacao===v?'0 1px 3px rgba(0,0,0,0.1)':'none' }}>{v==='semana'?'Semana':'Dia'}</button>
            ))}
            {visualizacao === 'periodo' && <button style={{ padding:'5px 12px', borderRadius:'6px', border:'none', cursor:'default', fontSize:'12px', fontWeight:'600', background:'white', color:'#6366f1', boxShadow:'0 1px 3px rgba(0,0,0,0.1)' }}>Lista</button>}
          </div>

        </div>
      </div>

      {/* Filtro profissional */}
      {visualizacao !== 'periodo' && profissionais.length > 1 && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', flexShrink:0, overflowX:'auto', paddingBottom:'2px' }}>
          <span style={{ fontSize:'12px', color:'#9ca3af', flexShrink:0, fontWeight:'500' }}>Prof:</span>
          <button onClick={()=>setFiltroProfissional('todos')} style={{ flexShrink:0, padding:'5px 14px', borderRadius:'99px', border:filtroProfissional==='todos'?'1.5px solid #6366f1':'1px solid #e5e7eb', background:filtroProfissional==='todos'?'#6366f1':'white', color:filtroProfissional==='todos'?'white':'#374151', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>Todos</button>
          {profissionais.map((p: any) => (
            <button key={p.id} onClick={()=>setFiltroProfissional(filtroProfissional===p.nome?'todos':p.nome)} style={{ flexShrink:0, padding:'5px 14px', borderRadius:'99px', border:filtroProfissional===p.nome?'1.5px solid '+(p.cor||'#6366f1'):'1px solid #e5e7eb', background:filtroProfissional===p.nome?(p.cor||'#6366f1'):'white', color:filtroProfissional===p.nome?'white':'#374151', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {/* Dias da semana */}
      {visualizacao === 'semana' && (
        <div style={{ display:'flex', gap:'4px', marginBottom:'10px', flexShrink:0, overflowX:'auto', paddingBottom:'2px' }}>
          {diasSemana.map(data => {
            const ehHoje = isMesmoISO(data, hoje)
            return <button key={toISO(data)} onClick={()=>{setDiaAtivo(data);setVisualizacao('dia')}} style={{ flexShrink:0, padding:'6px 12px', borderRadius:'8px', border:ehHoje?'1.5px solid #6366f1':'1px solid #e5e7eb', background:ehHoje?'#6366f1':'white', color:ehHoje?'white':'#374151', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>{nomeDiaCurto(data)} {numeroDia(data)}</button>
          })}
        </div>
      )}

      {/* Vista periodo */}
      {visualizacao === 'periodo' && (
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', flexShrink:0, flexWrap:'wrap' }}>
            <span style={{ fontSize:'13px', color:'#6b7280' }}>{agendamentosPeriodo.length} agendamento{agendamentosPeriodo.length !== 1 ? 's' : ''}</span>
            <button onClick={()=>setVisualizacao('semana')} style={{ marginLeft:'auto', background:'#f3f4f6', border:'none', borderRadius:'6px', padding:'5px 12px', fontSize:'12px', cursor:'pointer', color:'#6b7280' }}>Voltar</button>
          </div>
          <ListaPeriodo agendamentos={agendamentosPeriodo} onEditar={abrirEdicao}/>
        </div>
      )}

      {/* Grade de horarios */}
      {visualizacao !== 'periodo' && (
        <div style={{ flex:1, overflow:'hidden', background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', borderBottom:'2px solid #f0f0f8', flexShrink:0, overflowX:'auto' }}>
            <div style={{ width:'60px', flexShrink:0 }}/>
            {diasParaMostrar.map(data => {
              const ehHoje = isMesmoISO(data, hoje)
              const dataKey = toISO(data)
              const profsNoDia = filtroProfissional !== 'todos' ? profissionais.filter((p: any) => p.nome === filtroProfissional) : profissionais.length > 0 ? profissionais : [{id:'__', nome:'', cor:'#6366f1'}]
              const nProfs = profsNoDia.length
              return (
                <div key={dataKey} style={{ flex:1, minWidth:(nProfs*110)+'px', borderLeft:'1px solid #f0f0f8', background:ehHoje?'#f8f9ff':'transparent' }}>
                  <div style={{ padding:'8px 0 6px', textAlign:'center', borderBottom:'1px solid #f0f0f8' }}>
                    <span style={{ fontSize:'11px', color:ehHoje?'#6366f1':'#9ca3af', fontWeight:'700', textTransform:'uppercase' }}>{nomeDiaCurto(data)}</span>
                    <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'26px', height:'26px', borderRadius:'50%', marginLeft:'6px', background:ehHoje?'#6366f1':'transparent', color:ehHoje?'white':'#1a1a2e', fontSize:'13px', fontWeight:'700' }}>{numeroDia(data)}</div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat('+nProfs+',1fr)', borderBottom:'1px solid #f0f0f8' }}>
                    {profsNoDia.map((p: any) => (
                      <div key={p.id} style={{ padding:'5px 4px', textAlign:'center', borderLeft:'1px solid #f3f4f6', background:(p.cor||'#6366f1')+'08' }}>
                        <span style={{ fontSize:'10px', fontWeight:'600', color:'#374151', overflow:'hidden', whiteSpace:'nowrap', display:'block', textOverflow:'ellipsis' }}>{p.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ flex:1, overflowY:'auto', overflowX:'auto' }}>
            <div style={{ display:'flex' }}>
              <div style={{ width:'60px', flexShrink:0 }}>
                {HORAS.map(hora => (
                  <div key={hora} style={{ height:ALTURA_HORA+'px', display:'flex', alignItems:'flex-start', paddingTop:'4px', justifyContent:'flex-end', paddingRight:'8px', boxSizing:'border-box' }}>
                    <span style={{ fontSize:'10px', color:'#9ca3af', fontFamily:'monospace', whiteSpace:'nowrap' }}>{hora}</span>
                  </div>
                ))}
              </div>
              {diasParaMostrar.map(data => {
                const dataKey = toISO(data), ehHoje = isMesmoISO(data, hoje)
                const profsNoDia = filtroProfissional !== 'todos' ? profissionais.filter((p: any) => p.nome === filtroProfissional) : profissionais.length > 0 ? profissionais : [{id:'__', nome:'', cor:'#6366f1'}]
                const nProfs = profsNoDia.length
                return (
                  <div key={dataKey} style={{ flex:1, minWidth:(nProfs*110)+'px', borderLeft:'1px solid #f0f0f8', display:'grid', gridTemplateColumns:'repeat('+nProfs+',1fr)', position:'relative', background:ehHoje?'#fafbff':'transparent' }}>
                    <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:1 }}>
                      {HORAS.map((_,hIdx) => <div key={hIdx} style={{ position:'absolute', top:(hIdx*ALTURA_HORA)+'px', left:0, right:0, borderTop:'1px solid #f3f4f6' }}/>)}
                      {ehHoje && posLinha !== null && (
                        <div style={{ position:'absolute', top:posLinha+'px', left:0, right:0, zIndex:3, display:'flex', alignItems:'center' }}>
                          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444', marginLeft:'-4px', flexShrink:0 }}/>
                          <div style={{ flex:1, height:'1.5px', background:'#ef4444' }}/>
                        </div>
                      )}
                    </div>
                    {profsNoDia.map((prof: any, profIdx: number) => {
                      const agsProf = (() => {
                            const todos = agsFiltrados.filter(a => a.dataISO === dataKey && a.profissional === prof.nome).sort((a,b) => a.horaInicio - b.horaInicio)
                            return todos.filter(ag => {
                              if (ag.status !== 'cancelado') return true
                              return !todos.some(o => o.id !== ag.id && o.status !== 'cancelado' && Math.abs(o.horaInicio - ag.horaInicio) < 0.02)
                            })
                          })()
                      return (
                        <div key={prof.id} style={{ position:'relative', height:(HORAS.length*ALTURA_HORA)+'px', borderLeft:profIdx>0?'1px solid #f0f0f8':'none', zIndex:2 }}>
                          {agsProf.map(ag => {
                            const isFinalizado = ag.status === 'fechado'
                            const isCancelado = ag.status === 'cancelado'
                            const isAberto = ag.status === 'aberto'
                            const bgBase = isFinalizado?'#ecfdf5':isCancelado?'#fff1f2':isAberto?'#eff6ff':ag.cor+'18'
                            const bgHover = isFinalizado?'#d1fae5':isCancelado?'#fecaca':isAberto?'#dbeafe':ag.cor+'35'
                            const borda = isFinalizado?'#10b981':isCancelado?'#f43f5e':isAberto?'#3b82f6':ag.cor
                            const textCor = isFinalizado?'#065f46':isCancelado?'#be123c':isAberto?'#1d4ed8':ag.cor
                            const dur = ag.duracao > 0 ? ag.duracao : 60
                            const altura = Math.max((dur/60)*ALTURA_HORA - 6, 44)
                            const topPx = (ag.horaInicio - HORA_INICIO) * ALTURA_HORA
                            const horaH = Math.floor(ag.horaInicio), horaM = Math.round((ag.horaInicio - horaH) * 60)
                            const hora = String(horaH).padStart(2,'0') + ':' + String(horaM).padStart(2,'0')
                            return (
                              <div key={ag.id} onClick={()=>abrirEdicao(ag)} style={{ position:'absolute', top:topPx+'px', left:'2px', right:'2px', height:altura+'px', background:bgBase, border:'1px solid '+borda+'40', borderLeft:'3px solid '+borda, borderRadius:'7px', padding:'4px 6px', cursor:'pointer', overflow:'hidden', transition:'background .12s', zIndex:4, boxSizing:'border-box' }}
                                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=bgHover}}
                                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=bgBase}}>
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2px' }}>
                                  <span style={{ fontSize:'10px', fontWeight:'800', color:textCor, fontFamily:'monospace', letterSpacing:'-0.3px' }}>{hora}</span>
                                  {isFinalizado && <span style={{ fontSize:'8px', fontWeight:'700', color:'#065f46', background:'#bbf7d0', borderRadius:'99px', padding:'1px 4px', flexShrink:0 }}>OK</span>}
                                  {isCancelado  && <span style={{ fontSize:'8px', fontWeight:'700', color:'#be123c', background:'#fecdd3', borderRadius:'99px', padding:'1px 4px', flexShrink:0 }}>X</span>}
                                </div>
                                <div style={{ fontSize:'10px', fontWeight:'600', color:textCor, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', lineHeight:'13px' }}>{ag.cliente}</div>
                              </div>
                            )
                          })}
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

      </>) /* fim grade */}

      {/* Modal novo cliente inline */}
      {modalNovoCliente && (
        <div onClick={()=>setModalNovoCliente(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'400px', borderRadius:'16px', padding:'22px 20px', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
              <h3 style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a' }}>Novo cliente</h3>
              <button onClick={()=>setModalNovoCliente(false)} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'28px', height:'28px', cursor:'pointer', fontSize:'14px' }}>x</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>Nome *</label>
                <input value={formNovoCliente.nome} onChange={e=>setFormNovoCliente(f=>({...f,nome:e.target.value}))} placeholder="Nome completo"
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box' as const }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>Telefone</label>
                <input value={formNovoCliente.telefone} onChange={e=>setFormNovoCliente(f=>({...f,telefone:mascaraTel(e.target.value)}))} placeholder="(34) 99999-9999" maxLength={15}
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box' as const }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>WhatsApp</label>
                <input value={formNovoCliente.whatsapp} onChange={e=>setFormNovoCliente(f=>({...f,whatsapp:mascaraTel(e.target.value)}))} placeholder="(34) 99999-9999" maxLength={15}
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box' as const }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>E-mail</label>
                <input value={formNovoCliente.email} onChange={e=>setFormNovoCliente(f=>({...f,email:e.target.value}))} placeholder="email@exemplo.com"
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box' as const }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px', marginTop:'18px' }}>
              <button onClick={()=>setModalNovoCliente(false)} style={{ flex:1, background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px', fontSize:'13px', cursor:'pointer' }}>Cancelar</button>
              <button onClick={salvarNovoClienteInline} disabled={!formNovoCliente.nome.trim()||salvandoCliente}
                style={{ flex:2, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'8px', padding:'10px', fontSize:'13px', fontWeight:'600', cursor:salvandoCliente?'not-allowed':'pointer' }}>
                {salvandoCliente ? 'Salvando...' : 'Cadastrar e selecionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cancelamento */}
      {modalCancelar && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div style={{ background:'white', borderRadius:'18px', padding:'28px 24px', maxWidth:'400px', width:'100%' }}>
            <h3 style={{ fontSize:'17px', fontWeight:'700', color:'#1a1a2e', marginBottom:'6px' }}>Cancelar agendamento?</h3>
            <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'16px' }}>Informe o motivo (opcional)</p>
            <textarea value={motivoCancelamento} onChange={e=>setMotivoCancelamento(e.target.value)} rows={3} style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'10px 12px', fontSize:'14px', outline:'none', resize:'none', boxSizing:'border-box', marginBottom:'16px' }}/>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={()=>setModalCancelar(false)} style={{ flex:1, background:'#f3f4f6', color:'#374151', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', cursor:'pointer' }}>Voltar</button>
              <button onClick={confirmarCancelamento} disabled={cancelando} style={{ flex:1, background:'#ef4444', color:'white', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>{cancelando?'Cancelando...':'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agendamento */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'560px', borderRadius:'20px', padding:'28px 24px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.25)', animation:'slideUp .25s ease both' }}>
            <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'Editar agendamento':'+ Novo agendamento'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>x</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px', pointerEvents:isBloqEdicao?'none':'auto', opacity:isBloqEdicao?0.7:1 }}>
              {/* Banner de status - finalizado */}
              {modoEdicao && selecionado?.status === 'fechado' && (
                <div style={{ borderRadius:'14px', overflow:'hidden', border:'1.5px solid #6ee7b7', boxShadow:'0 4px 16px rgba(16,185,129,0.12)' }}>
                  <div style={{ background:'linear-gradient(135deg,#059669,#10b981)', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'42px', height:'42px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0, backdropFilter:'blur(4px)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                      <p style={{ color:'white', fontWeight:'700', fontSize:'15px', letterSpacing:'-0.2px' }}>Atendimento Finalizado</p>
                      <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'12px', marginTop:'1px' }}>Registro encerrado com sucesso</p>
                    </div>
                    <div style={{ marginLeft:'auto', background:'rgba(255,255,255,0.15)', borderRadius:'99px', padding:'4px 12px' }}>
                      <span style={{ color:'white', fontSize:'11px', fontWeight:'700', letterSpacing:'0.05em', textTransform:'uppercase' }}>Fechado</span>
                    </div>
                  </div>
                  <div style={{ background:'#f0fdf4', padding:'12px 18px', display:'flex', gap:'20px', flexWrap:'wrap' }}>
                    <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Cliente</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>{selecionado.cliente}</p></div>
                    <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Servico</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>{selecionado.servico}</p></div>
                    <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Valor</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>R$ {Number(selecionado.valor).toFixed(2).replace('.',',')}</p></div>
                  </div>
                </div>
              )}
              {/* Banner de status - cancelado */}
              {modoEdicao && selecionado?.status === 'cancelado' && (
                <div style={{ borderRadius:'14px', overflow:'hidden', border:'1.5px solid #fda4af', boxShadow:'0 4px 16px rgba(244,63,94,0.12)' }}>
                  <div style={{ background:'linear-gradient(135deg,#e11d48,#f43f5e)', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'42px', height:'42px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                    <div>
                      <p style={{ color:'white', fontWeight:'700', fontSize:'15px', letterSpacing:'-0.2px' }}>Agendamento Cancelado</p>
                      <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'12px', marginTop:'1px' }}>Este horario foi liberado</p>
                    </div>
                    <div style={{ marginLeft:'auto', background:'rgba(255,255,255,0.15)', borderRadius:'99px', padding:'4px 12px' }}>
                      <span style={{ color:'white', fontSize:'11px', fontWeight:'700', letterSpacing:'0.05em', textTransform:'uppercase' }}>Cancelado</span>
                    </div>
                  </div>
                  <div style={{ background:'#fff1f2', padding:'12px 18px', display:'flex', flexDirection:'column', gap:'8px' }}>
                    <div style={{ display:'flex', gap:'20px', flexWrap:'wrap' }}>
                      <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Cliente</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#be123c' }}>{selecionado.cliente}</p></div>
                      <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Servico</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#be123c' }}>{selecionado.servico}</p></div>
                      <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Data</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#be123c' }}>{isoParaDate(selecionado.dataISO).toLocaleDateString('pt-BR')}</p></div>
                    </div>
                    {selecionado.motivoCancelamento && (
                      <div style={{ background:'#fecdd3', borderRadius:'8px', padding:'8px 12px', display:'flex', gap:'8px', alignItems:'flex-start' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#be123c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:'1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <div><p style={{ fontSize:'10px', color:'#9f1239', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'600', marginBottom:'2px' }}>Motivo</p><p style={{ fontSize:'12px', color:'#be123c' }}>{selecionado.motivoCancelamento}</p></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Banner de status - aberto */}
              {modoEdicao && selecionado?.status === 'aberto' && (
                <div style={{ borderRadius:'12px', background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1.5px solid #93c5fd', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 12px rgba(59,130,246,0.35)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <p style={{ fontWeight:'700', fontSize:'14px', color:'#1d4ed8', letterSpacing:'-0.2px' }}>Agendamento em Aberto</p>
                    <p style={{ fontSize:'12px', color:'#3b82f6', marginTop:'1px' }}>Aguardando atendimento</p>
                  </div>
                  <div style={{ marginLeft:'auto', background:'#3b82f6', borderRadius:'99px', padding:'4px 14px' }}>
                    <span style={{ color:'white', fontSize:'11px', fontWeight:'700', letterSpacing:'0.05em', textTransform:'uppercase' }}>Aberto</span>
                  </div>
                </div>
              )}
              {/* Busca cliente */}
              <div style={{ position:'relative' }}>
                <label style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                  <span style={{ fontSize:'13px', fontWeight:'500', color:'#374151' }}>Cliente *</span>
                  <button type="button" onClick={()=>setModalNovoCliente(true)} style={{ background:'none', border:'none', color:'#6366f1', fontSize:'12px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'3px', padding:0 }}>+ Novo cliente</button>
                </label>
                {clienteSel ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', background:'#eef2ff', borderRadius:'8px', border:'1.5px solid #6366f1' }}>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e' }}>{clienteSel.nome}</p>
                      <p style={{ fontSize:'12px', color:'#6b7280' }}>{clienteSel.whatsapp||clienteSel.telefone||''}</p>
                    </div>
                    <button type="button" onClick={()=>{setClienteSel(null);setBuscaCliente('');setForm(f=>({...f,clienteId:'',cliente:''}))}} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'18px' }}>x</button>
                  </div>
                ) : (
                  <>
                    <input value={buscaCliente} onChange={e=>{setBuscaCliente(e.target.value);setDropCliente(true)}} onFocus={()=>setDropCliente(true)} style={inputStyle} placeholder="Digite o nome do cliente..."/>
                    {dropCliente && (
                      <><div onClick={()=>setDropCliente(false)} style={{ position:'fixed', inset:0, zIndex:99 }}/>
                      <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'white', borderRadius:'10px', border:'1px solid #e5e7eb', boxShadow:'0 8px 24px rgba(0,0,0,0.1)', zIndex:100, maxHeight:'200px', overflowY:'auto' }}>
                        {clientes.filter((c: any) => c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())).length === 0 && buscaCliente.length > 0 && (
                          <div onClick={()=>{setModalNovoCliente(true);setFormNovoCliente(f=>({...f,nome:buscaCliente}));setDropCliente(false)}} style={{ padding:'12px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', color:'#6366f1', fontWeight:'600', fontSize:'13px' }}>
                            <span style={{ fontSize:'18px', lineHeight:1 }}>+</span> Cadastrar "{buscaCliente}"
                          </div>
                        )}
                        {clientes.filter((c: any) => c.nome?.toLowerCase().includes(buscaCliente.toLowerCase())).map((c: any) => (
                          <div key={c.id} onClick={()=>{setClienteSel(c);setForm(f=>({...f,clienteId:c.id,cliente:c.nome,plano_id:'',usar_plano:false,valor:''}));setBuscaCliente('');setDropCliente(false);setErroForm([]);
              if (c.plano_id) { buscarPlanoCliente(c.id, c.plano_id) } else { setPlanoCliente(null); setSessaoPlano(null) }}} style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f9fafb' }}
                            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='#f8f8fc'}}
                            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent'}}>
                            <p style={{ fontSize:'13px', fontWeight:'600', color:'#1a1a2e' }}>{c.nome}</p>
                            <p style={{ fontSize:'11px', color:'#9ca3af' }}>{c.whatsapp||c.telefone||''}</p>
                          </div>
                        ))}
                      </div></>
                    )}
                  </>
                )}
              </div>
              {/* Escolha: Plano ou Servico avulso */}
              {planoCliente && !modoEdicao && (
                <div>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Tipo de agendamento</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    {/* Opcao: Plano */}
                    <div onClick={() => setForm(f => { const usarP = true; const ip = calcularSessaoPlano(); return {...f, usar_plano:usarP, valor:ip.cobrar ? String(planoCliente.valor_mensal||planoCliente.valor||0) : '0', servico:''} })}
                      style={{ padding:'14px', borderRadius:'12px', cursor:'pointer', border:form.usar_plano?'2px solid #6366f1':'2px solid #e5e7eb', background:form.usar_plano?'#eef2ff':'white', transition:'all .15s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                        <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:form.usar_plano?'#6366f1':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={form.usar_plano?'white':'#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        </div>
                        <p style={{ fontSize:'12px', fontWeight:'700', color:form.usar_plano?'#4f46e5':'#374151' }}>Plano mensal</p>
                      </div>
                      <p style={{ fontSize:'12px', fontWeight:'600', color:form.usar_plano?'#4f46e5':'#6b7280', marginBottom:'2px' }}>{planoCliente.nome}</p>
                      <p style={{ fontSize:'11px', color:'#9ca3af' }}>{planoCliente.sessoes_mes || planoCliente.sessoes || planoCliente.sessoes_mes || 1} sessoes</p>
                      {modoEdicao && form.usar_plano && planoCliente && (
                  <div style={{ borderRadius:'12px', overflow:'hidden', border:'1.5px solid #bfdbfe' }}>
                    <div style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ flex:1 }}>
                        <p style={{ color:'white', fontWeight:'700', fontSize:'14px' }}>{planoCliente.nome}</p>
                        <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px', marginTop:'2px' }}>
                          {selecionado?.sessaoNumero ? ('Sessao ' + selecionado.sessaoNumero + ' de ' + (selecionado.sessaoTotal || planoCliente.sessoes || planoCliente.sessoes_mes || '?')) : 'Plano mensal'}
                          {sessaoPlano ? (' - ' + (sessaoPlano.sessoes_utilizadas || 0) + ' sessoes realizadas') : ''}
                        </p>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'10px', padding:'8px 14px', textAlign:'center' }}>
                        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'10px', textTransform:'uppercase' }}>Valor</p>
                        <p style={{ color:'white', fontSize:'18px', fontWeight:'800' }}>R$ {Number(form.valor||0).toFixed(2).replace('.',',')}</p>
                      </div>
                    </div>
                    <div style={{ background:'#eff6ff', padding:'8px 16px' }}>
                      <p style={{ fontSize:'11px', color:'#6b7280' }}>
                        {parseFloat(form.valor||'0') > 0 ? 'Sessao de cobranca (1ª do ciclo)' : 'Sessao inclusa no plano (gratuita)'}
                      </p>
                    </div>
                  </div>
                )}
                {!modoEdicao && form.usar_plano && infoPlano && (
                        <div style={{ marginTop:'8px', padding:'8px', background:'white', borderRadius:'8px', border:'1px solid #c7d2fe' }}>
                          <p style={{ fontSize:'11px', color:'#6b7280', marginBottom:'2px' }}>Sessao {infoPlano.sessaoAtual} de {infoPlano.total}</p>
                          <p style={{ fontSize:'13px', fontWeight:'700', color:infoPlano.cobrar?'#059669':'#6366f1' }}>
                            {infoPlano.cobrar ? 'Cobra: R$ ' + Number(planoCliente.valor_mensal||planoCliente.valor||0).toFixed(2).replace('.',',') : 'Inclusa no plano - sem cobranca'}
                          </p>
                        </div>
                      )}
                    </div>
                    {/* Opcao: Servico avulso */}
                    <div onClick={() => setForm(f => ({...f, usar_plano:false, valor:'', servico:''}))}
                      style={{ padding:'14px', borderRadius:'12px', cursor:'pointer', border:!form.usar_plano?'2px solid #6366f1':'2px solid #e5e7eb', background:!form.usar_plano?'#eef2ff':'white', transition:'all .15s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
                        <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:!form.usar_plano?'#6366f1':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={!form.usar_plano?'white':'#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </div>
                        <p style={{ fontSize:'12px', fontWeight:'700', color:!form.usar_plano?'#4f46e5':'#374151' }}>Servico avulso</p>
                      </div>
                      <p style={{ fontSize:'11px', color:'#9ca3af' }}>Cobrar por servico individual</p>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <InputField label="Profissional">
                  <select value={form.profissional} onChange={e=>setForm(f=>({...f,profissional:e.target.value,servico:'',horaInicio:'09:00'}))} style={selectStyle}>
                    <option value="">Selecione...</option>
                    {profissionais.map((p: any) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                </InputField>
                <InputField label="Servico">
                  {form.usar_plano ? (
                    <div style={{ padding:'10px 13px', background:'#f9fafb', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', color:'#9ca3af', display:'flex', alignItems:'center', gap:'6px' }}>
                      Incluso no plano mensal
                    </div>
                  ) : (
                    <select value={form.servico} onChange={e=>{const srv=servicosDoProf.find((s: any)=>s.nome===e.target.value);setForm(f=>({...f,servico:e.target.value,duracao:srv?.duracao_min?String(srv.duracao_min):f.duracao,valor:srv?.valor?String(srv.valor):f.valor}))}} style={{ ...selectStyle, background:!form.profissional?'#f9fafb':'white' }} disabled={!form.profissional}>
                      <option value="">{form.profissional?'Selecione...':'Selecione o profissional primeiro'}</option>
                      {servicosDoProf.map((s: any) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                    </select>
                  )}
                </InputField>

                {form.usar_plano && (
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Servico (opcional)</label>
                    <select value={form.servico} onChange={e=>setForm(f=>({...f,servico:e.target.value}))} style={{ ...selectStyle, background:'#f9fafb', color:'#9ca3af' }} disabled={true}>
                      <option value="">Nenhum servico especifico</option>
                      {servicosDoProf.map((s: any) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <InputField label="Data">
                  <input type="date" value={form.dataISO} onChange={e=>setForm(f=>({...f,dataISO:e.target.value,horaInicio:'09:00'}))} style={inputStyle}/>
                </InputField>
                <InputField label="Duracao (min)">
                  <select value={form.duracao} onChange={e=>setForm(f=>({...f,duracao:e.target.value}))} style={selectStyle}>
                    {[15,30,45,50,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </InputField>
              </div>
              {/* Slots de horario */}
              {form.dataISO && form.profissional && (
                <div>
                  {naoAtende ? (
                    <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'12px 14px', fontSize:'13px', color:'#92400e' }}>
                      {form.profissional} nao atende neste dia.
                    </div>
                  ) : slotsDisponiveis.length > 0 ? (
                    <div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                        <label style={{ fontSize:'13px', fontWeight:'500', color:'#374151' }}>Horario</label>
                        <div style={{ display:'flex', gap:'4px' }}>
                          {[15,30,60].map(min => (
                            <button key={min} onClick={()=>setIntervaloMin(min)} style={{ padding:'3px 8px', borderRadius:'6px', fontSize:'11px', border:intervaloMin===min?'1.5px solid #6366f1':'1px solid #e5e7eb', background:intervaloMin===min?'#eef2ff':'white', color:intervaloMin===min?'#6366f1':'#6b7280', cursor:'pointer' }}>{min}min</button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px' }}>
                        {slotsDisponiveis.map(slot => {
                          const estaSel = form.horaInicio === slot.label
                          return (
                            <button key={slot.label} type="button" disabled={!slot.disponivel} onClick={()=>setForm(f=>({...f,horaInicio:slot.label}))} style={{ padding:'8px 4px', borderRadius:'8px', fontSize:'12px', fontWeight:estaSel?'700':'400', cursor:slot.disponivel?'pointer':'not-allowed', border:estaSel?'2px solid #6366f1':!slot.disponivel?'1px solid #fca5a5':'1px solid #e5e7eb', background:!slot.disponivel?'#fee2e2':estaSel?'#6366f1':'white', color:!slot.disponivel?'#fca5a5':estaSel?'white':'#374151', textDecoration:!slot.disponivel?'line-through':'none' }}>
                              {slot.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
              {!form.usar_plano && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <InputField label="Valor (R$)">
                    <input type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} style={inputStyle} placeholder="0,00"/>
                  </InputField>
                  <InputField label="Forma de pagamento">
                    <select value={form.forma_pagamento} onChange={e=>setForm(f=>({...f,forma_pagamento:e.target.value}))} style={selectStyle}>
                      {FORMAS_PAG.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
                    </select>
                  </InputField>
                </div>
              )}
              {form.usar_plano && infoPlano && (
                <div style={{ borderRadius:'14px', overflow:'hidden', border:'1.5px solid '+(infoPlano.cobrar?'#6ee7b7':'#c7d2fe') }}>
                  <div style={{ background:infoPlano.cobrar?'linear-gradient(135deg,#059669,#10b981)':'linear-gradient(135deg,#6366f1,#4f46e5)', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {infoPlano.cobrar
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ color:'white', fontWeight:'700', fontSize:'15px', letterSpacing:'-0.2px' }}>
                        {infoPlano.cobrar ? 'Sessao cobrada - inicio do ciclo' : 'Sessao gratuita - inclusa no plano'}
                      </p>
                      <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'12px', marginTop:'2px' }}>
                        Sessao {infoPlano.sessaoAtual} de {infoPlano.total} - {infoPlano.utilizadas} sessoes ja realizadas
                      </p>
                    </div>
                    <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'12px', padding:'8px 14px', textAlign:'center', flexShrink:0 }}>
                      <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'10px', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Valor</p>
                      <p style={{ color:'white', fontSize:'20px', fontWeight:'800', letterSpacing:'-0.5px' }}>
                        {infoPlano.cobrar ? 'R$ ' + Number(planoCliente?.valor_mensal||planoCliente?.valor||0).toFixed(2).replace('.',',') : 'R$ 0,00'}
                      </p>
                    </div>
                  </div>
                  <div style={{ background:infoPlano.cobrar?'#f0fdf4':'#f5f3ff', padding:'10px 18px', display:'flex', gap:'20px', flexWrap:'wrap', alignItems:'center' }}>
                    <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Plano</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>{planoCliente?.nome}</p></div>
                    <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Sessoes do ciclo</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>{infoPlano.total} sessoes</p></div>
                    <p style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'auto' }}>Valor definido pelo plano</p>
                  </div>
                </div>
              )}
              <InputField label="Observacoes">
                <textarea rows={2} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} style={{ ...inputStyle, resize:'none' }} placeholder="Anotacoes..."/>
              </InputField>
            </div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'space-between', marginTop:'16px', flexWrap:'wrap' }}>
              {modoEdicao && selecionado && !isBloqEdicao ? (
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={()=>{setMotivoCancelamento('');setModalCancelar(true)}} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', cursor:'pointer' }}>Cancelar agend.</button>
                  {wppConectado && !permWpp.carregando && permWpp.visualizar && <button onClick={enviarConfirmacao} disabled={enviandoWpp} title="Enviar confirmacao via WhatsApp"
                    style={{ background:statusWpp==='ok'?'#dcfce7':statusWpp==='erro'?'#fef2f2':'#f0fdf4', color:statusWpp==='ok'?'#16a34a':statusWpp==='erro'?'#dc2626':'#16a34a', border:'1px solid '+(statusWpp==='ok'?'#86efac':statusWpp==='erro'?'#fca5a5':'#86efac'), borderRadius:'8px', padding:'9px 12px', fontSize:'13px', fontWeight:'600', cursor:enviandoWpp?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                    {enviandoWpp ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation:'spin .7s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                    ) : statusWpp === 'ok' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    )}
                    {enviandoWpp ? 'Enviando...' : statusWpp === 'ok' ? 'Enviado!' : 'Confirmar Wpp'}
                  </button>}
                  <button onClick={()=>finalizar(selecionado.id)} disabled={finalizando} style={{ background:'#ecfdf5', color:'#10b981', border:'1px solid #6ee7b7', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>{finalizando?'Finalizando...':'Finalizar'}</button>
                </div>
              ) : <div/>}
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', flex:1, minWidth:'160px' }}>
                {erroForm.length > 0 && (
                  <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'10px 14px' }}>
                    <p style={{ fontSize:'12px', fontWeight:'700', color:'#dc2626', marginBottom:'4px' }}>Preencha os campos obrigatorios:</p>
                    {erroForm.map((e,i) => (
                      <p key={i} style={{ fontSize:'12px', color:'#dc2626', display:'flex', alignItems:'center', gap:'4px' }}>
                        <span style={{ fontWeight:'700' }}>-</span> {e}
                      </p>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
                  <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Fechar</button>
                  {!isBloqEdicao && (
                    <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                      {salvando?'Salvando...':modoEdicao?'Salvar alteracoes':'Agendar'}
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
