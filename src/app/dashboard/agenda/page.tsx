'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { corStatus, labelStatus, createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'
import { carregarConfigWpp, enviarMensagem, registrarEnvio, aplicarVariaveis, formatarNumero } from '@/lib/whatsapp'
import CalendarioAgenda from './CalendarioAgenda'
import AgendaDia from './AgendaDia'
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


type AgendamentoLocal = {
  id: string; dataISO: string; horaInicio: number; duracao: number
  cliente: string; clienteId: string; servico: string; profissional: string
  cor: string; status: string; observacoes: string; forma_pagamento: string; pagamentos?: Array<{forma:string;valor:number}>; pagamentos?: Array<{forma:string;valor:number}>
  valor: number; desconto?: number; valor_bruto?: number; motivoCancelamento?: string; planoId?: string; sessaoNumero?: number; sessaoTotal?: number; createdAt?: string
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
  const bloquearValor = (usuario as any)?.bloquear_edicao_valor !== false // padrão: bloqueado
  const hoje = useMemo(() => hojeNoBrasil(), [])

  const [agendamentos, setAgendamentos] = useState<AgendamentoLocal[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [horariosProfissional, setHorariosProfissional] = useState<HorarioDB[]>([])
  const [carregando, setCarregando] = useState(false)
  const [diaAtivo, setDiaAtivo] = useState<Date>(() => hojeNoBrasil())
  const [periodoInicio, setPeriodoInicio] = useState(toISO(hojeNoBrasil()))
  const [periodoFim, setPeriodoFim] = useState(toISO(addDias(hojeNoBrasil(), 30)))
  const [filtroProfissional, setFiltroProfissional] = useState('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [selecionado, setSelecionado] = useState<AgendamentoLocal | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [enviandoWpp, setEnviandoWpp] = useState(false)
  const [statusWpp, setStatusWpp] = useState<'idle'|'ok'|'erro'>('idle')
  const [wppConectado, setWppConectado] = useState(false)
  const [sessaoEdicao, setSessaoEdicao] = useState<{num:number;total:number;valor:number}|null>(null)
  const permWpp = usePermissao('agenda_wpp')
  const perm = usePermissao('agenda')
  const permClientes = usePermissao('clientes')
  const [erroForm, setErroForm] = useState<string[]>([])
  const [finalizando, setFinalizando] = useState(false)
  const [modalCancelar, setModalCancelar] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [agRapido, setAgRapido] = useState<any>(null)
  const [cancelando, setCancelando] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clienteSel, setClienteSel] = useState<any>(null)
  const [dropCliente, setDropCliente] = useState(false)
  const [modalNovoCliente, setModalNovoCliente] = useState(false)
  const [formNovoCliente, setFormNovoCliente] = useState({ nome:'', telefone:'', whatsapp:'', email:'' })
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [intervaloMin, setIntervaloMin] = useState(30)
  const [form, setForm] = useState({ clienteId:'', cliente:'', servico:'', profissional:'', dataISO:toISO(hojeNoBrasil()), horaInicio:'', duracao:'60', status:'aberto', forma_pagamento:'', valor:'', observacoes:'', plano_id:'', usar_plano:false })
  const [pagamentos, setPagamentos] = useState<Array<{forma:string;valor:string}>>([])
  const [modalFinalizar, setModalFinalizar] = useState(false)
  const [descontoFin, setDescontoFin] = useState('')
  const [verPagamentos, setVerPagamentos] = useState(false)
  const [agVerPag, setAgVerPag] = useState<any>(null)
  const [desconto, setDesconto] = useState('')
  const [modalDesconto, setModalDesconto] = useState(false)
  const [valorOriginal, setValorOriginal] = useState('')
  const [planoCliente, setPlanoCliente] = useState<any>(null)
  const [sessaoPlano, setSessaoPlano]   = useState<any>(null)

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    // Filtrar por profissional_id do usuario logado (do contexto) se vinculado
    const profIdVinculado = (usuario as any)?.profissional_id || null
    const ehProf = !!profIdVinculado
    let qAgs = sb.from('agendamentos').select('id,data_inicio,created_at,status,valor,desconto,valor_bruto,forma_pagamento,pagamentos,observacoes,cliente_id,servico_id,profissional_id,prof_id,motivo_cancelamento,sessao_numero,sessao_total').eq('empresa_id', empresaAtiva.id)
    if (ehProf) qAgs = qAgs.eq('prof_id', profIdVinculado)
    let qProfs = sb.from('profissionais').select('id,nome,cargo,cor,status,servicos,intervalo_atendimento').eq('empresa_id', empresaAtiva.id).eq('status', 'ativo')
    if (ehProf) qProfs = qProfs.eq('id', profIdVinculado)
    const [r1, r2, r3, r4, r5] = await Promise.all([
      qAgs.order('data_inicio'),
      sb.from('clientes').select('id,nome,telefone,whatsapp,plano_id').eq('empresa_id', empresaAtiva.id).eq('status','ativo').order('nome'),
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
    setAgendamentos(agsRaw.map((a: any) => {
      // Converter data_inicio de UTC para BRT (UTC-3)
      const dtUTC = a.data_inicio ? new Date(a.data_inicio) : null
      const dtBRT = dtUTC ? new Date(dtUTC.getTime() - 3 * 60 * 60 * 1000) : null
      const dataISO = dtBRT ? toISO(dtBRT) : toISO(hojeNoBrasil())
      const horaInicio = dtBRT ? dtBRT.getUTCHours() + dtBRT.getUTCMinutes() / 60 : 0
      return {
      id: a.id,
      dataISO,
      horaInicio,
      duracao: servDur[a.servico_id] || 60,
      cliente: cliMap[a.cliente_id] || '',
      clienteId: a.cliente_id || '',
      servico: servNom[a.servico_id] || '',
      profissional: a.prof_id ? (profMap[a.prof_id] || '') : (profMap[a.profissional_id] || ''),
      cor: servCor[a.servico_id] || '#6366f1',
      status: a.status || '',
      observacoes: a.observacoes || '',
      forma_pagamento: a.forma_pagamento || '',
      pagamentos: (() => { try { if (a.pagamentos === null || a.pagamentos === undefined) return null; const p = JSON.parse(a.pagamentos); return Array.isArray(p) ? p : null } catch { return null } })(),
      valor: a.valor || 0,
      desconto: a.desconto || 0,
      valor_bruto: a.valor_bruto || a.valor || 0,
      motivoCancelamento: a.motivo_cancelamento || undefined,
      planoId: !a.servico_id ? 'plano' : undefined,
      createdAt: a.created_at || a.data_inicio,
      sessaoNumero: a.sessao_numero || undefined,
      sessaoTotal: a.sessao_total || undefined,
      }
    }))
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
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modalAberto, modalCancelar])
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


  function diaAnterior() { setDiaAtivo(d => addDias(d,-1)) }
  function diaSeguinte() { setDiaAtivo(d => addDias(d,1)) }
  function irParaHoje() { const h = hojeNoBrasil(); setDiaAtivo(h) }
  function irParaData(d: Date) { setDiaAtivo(d) }

  function abrirNovo() {
    const dataRef = diaAtivo
    setModoEdicao(false); setSelecionado(null); setClienteSel(null); setBuscaCliente('')
    setPlanoCliente(null); setSessaoPlano(null)
    setIntervaloMin(30)
    setForm({ clienteId:'', cliente:'', servico:'', profissional:'', dataISO:toISO(dataRef), horaInicio:'', duracao:'60', status:'aberto', forma_pagamento:'', valor:'', observacoes:'' })
    setDesconto(''); setValorOriginal(''); setModalDesconto(false); setPagamentos([])
    setModalAberto(true)
  }

  function abrirEdicao(ag: AgendamentoLocal) {
    setModoEdicao(true); setSelecionado(ag)
    const cl = clientes.find((c: any) => c.id === ag.clienteId) || null
    setClienteSel(cl); setBuscaCliente('')
    const hiH = Math.floor(ag.horaInicio), hiM = Math.round((ag.horaInicio - hiH) * 60)
    const ehPlano = !!ag.planoId
    const vBruto = ag.valor_bruto && ag.valor_bruto > 0 ? ag.valor_bruto : ag.valor
    // form.valor = valor real do agendamento (ag.valor), não valor_bruto
    // valorOriginal = valor_bruto (preço cheio sem desconto, referência para o desconto)
    const vReal = ag.valor && ag.valor > 0 ? ag.valor : vBruto
    setForm({ clienteId:ag.clienteId, cliente:ag.cliente, servico:ag.servico, profissional:ag.profissional, dataISO:ag.dataISO, horaInicio:String(hiH).padStart(2,'0') + ':' + String(hiM).padStart(2,'0'), duracao:String(ag.duracao), status:ag.status, forma_pagamento:ag.forma_pagamento, valor:String(vReal), observacoes:ag.observacoes, usar_plano:ehPlano, plano_id:ag.planoId||'' })
    setValorOriginal(String(vBruto))
    setDesconto(ag.desconto && ag.desconto > 0 ? String(ag.desconto) : '')
    // Carregar pagamentos do banco
    try {
      // ag.pagamentos já vem parseado do mapeamento (JSON.parse feito no carregar)
      const pagsArr = Array.isArray(ag.pagamentos) ? ag.pagamentos : null
      if (pagsArr !== null && pagsArr.length > 0) {
        // Tem pagamentos salvos - carregar
        setPagamentos(pagsArr.map((p: any) => ({ forma: String(p.forma || ''), valor: String(p.valor || '') })))
      } else if (pagsArr !== null && pagsArr.length === 0) {
        // Campo pagamentos existe mas está vazio - usuário removeu tudo
        setPagamentos([])
        setForm(f => ({ ...f, forma_pagamento: '' }))
      } else {
        // Campo pagamentos nunca foi usado (null/undefined) - usar fallback
        setPagamentos([])
        // Não criar linha automática - deixar o usuário usar o select simples
      }
    } catch { setPagamentos([]) }

    const profDesteAg = profissionais.find((p:any) => p.nome === ag.profissional)
    setIntervaloMin(profDesteAg?.intervalo_atendimento || 30); setModalAberto(true)
    // Carregar plano do cliente se for plano
    if (ehPlano && ag.clienteId) {
      // Buscar dados do agendamento diretamente do banco para exibicao correta
      const sbEdit = createClient()
      ;(async () => {
        const [cliRes, agRes] = await Promise.all([
          sbEdit.from('clientes').select('plano_id').eq('id', ag.clienteId).single(),
          sbEdit.from('agendamentos').select('sessao_numero,sessao_total,valor').eq('id', ag.id).single(),
        ])
        const planoId = cliRes.data?.plano_id
        if (planoId) buscarPlanoCliente(ag.clienteId, planoId, true)
        // Usar dados salvos no banco - fonte de verdade
        const numSessao = agRes.data?.sessao_numero || 1
        const totalSessoes = agRes.data?.sessao_total || 4
        const valorReal = Number(agRes.data?.valor ?? ag.valor ?? 0)
        setSessaoEdicao({ num: numSessao, total: totalSessoes, valor: valorReal })
        setForm((f: any) => ({ ...f, valor: String(valorReal) }))
      })()
    }
  }

  function fecharModal() {
    setSessaoEdicao(null); setModalAberto(false); setSelecionado(null); setModoEdicao(false); setClienteSel(null); setBuscaCliente(''); setDropCliente(false); setModalCancelar(false); setMotivoCancelamento(''); setErroForm([]); setPagamentos([]); setDesconto(''); setValorOriginal(''); setModalDesconto(false); setModalFinalizar(false); setVerPagamentos(false); setDescontoFin('') }

  async function salvar() {
    // Validacao completa dos campos obrigatorios
    const erros: string[] = []
    if (!form.clienteId)    erros.push('Cliente e obrigatorio')
    if (!form.profissional) erros.push('Profissional e obrigatorio')
    if (!form.usar_plano && !form.servico) erros.push('Servico e obrigatorio')
    if (!form.dataISO)      erros.push('Data e obrigatoria')
    if (!form.horaInicio) {
      erros.push('Selecione um horario para o agendamento')
    } else {
      const slotEscolhido = slotsDisponiveis.find((s: any) => s.label === form.horaInicio)
      if (!modoEdicao && slotsDisponiveis.length > 0 && !slotEscolhido) {
        erros.push('Selecione um horario valido clicando em um dos horarios disponiveis')
      }
      if (!modoEdicao && slotEscolhido && !slotEscolhido.disponivel) {
        erros.push('O horario ' + form.horaInicio + ' nao esta disponivel. Escolha outro horario')
      }
    }
    // Validar pagamentos ao salvar
    const pagsPreenchidos = pagamentos.filter(p => p.forma && parseFloat(p.valor) > 0)
    if (pagsPreenchidos.length > 0) {
      // Se informou pagamentos, o total deve fechar exato com o valor do serviço - desconto
      const descontoNumVal2 = parseFloat(desconto) || 0
      const valorTotalPag2 = pagsPreenchidos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0)
      const valorEsperado2 = Math.max(0, (parseFloat(form.valor) || 0) - descontoNumVal2)
      const diff2 = valorEsperado2 - valorTotalPag2
      if (diff2 > 0.01) {
        erros.push('Forma de pagamento: faltam R$ ' + diff2.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ' para fechar o total de R$ ' + valorEsperado2.toLocaleString('pt-BR', {minimumFractionDigits:2}) + '. Ajuste ou remova as formas de pagamento.')
      } else if (diff2 < -0.01) {
        erros.push('Forma de pagamento: o total excede em R$ ' + Math.abs(diff2).toLocaleString('pt-BR', {minimumFractionDigits:2}) + ' o valor do servico (R$ ' + valorEsperado2.toLocaleString('pt-BR', {minimumFractionDigits:2}) + '). Ajuste os valores.')
      }
    }
    // Se não informou nenhuma forma de pagamento (pagamentos vazio E form.forma_pagamento vazio) → permite salvar
    if (erros.length > 0) { setErroForm(erros); return }
    setErroForm([])
    if (!empresaAtiva?.id) return
    setSalvando(true)
    const parts = (form.horaInicio || '09:00').split(':').map(Number)
    // Montar data/hora local BRT e converter para UTC (-3h)
    const dataLocalBRT = new Date(form.dataISO + 'T' + String(parts[0]).padStart(2,'0') + ':' + String(parts[1]).padStart(2,'0') + ':00-03:00')
    const dataInicio = dataLocalBRT.toISOString()
    const srv = servicos.find((s: any) => s.nome === form.servico)
    const prof = profissionais.find((p: any) => p.nome === form.profissional)
    const dataFim = new Date(new Date(dataInicio).getTime() + parseInt(form.duracao) * 60000).toISOString()
    // Valor: na edicao manter o valor original; na criacao calcular pela sessao
    const descontoVal = parseFloat(desconto) || 0
    let valorFinal = Math.max(0, (parseFloat(form.valor) || 0) - descontoVal)
    let sessaoParaSalvar = 0
    let totalParaSalvar = 0
    if (!modoEdicao && form.usar_plano && planoCliente && empresaAtiva?.id) {
      // Contar agendamentos de plano ANTES de criar (para saber qual sera a sessao do novo)
      const sbCount = createClient()
      const { count: countAntes } = await sbCount.from('agendamentos')
        .select('id', { count:'exact', head:true })
        .eq('empresa_id', empresaAtiva.id)
        .eq('cliente_id', form.clienteId)
        .is('servico_id', null)
        .neq('status', 'cancelado')
      const total = planoCliente.sessoes_mes || 1
      const posicao = countAntes || 0  // 0 para o 1o, 1 para o 2o...
      const sessao = (posicao % total) + 1
      const cobrar = sessao === 1
      valorFinal = cobrar ? (parseFloat(planoCliente.valor_mensal||planoCliente.valor||'0') || 0) : 0
      sessaoParaSalvar = sessao
      totalParaSalvar = total
    }
    // Na edicao com podeEditarValorDireto: valor_bruto = o valor editado pelo usuário
    // Nos demais casos: valor_bruto = valorOriginal (preço cheio do serviço)
    const valorBruto = podeEditarValorDireto
      ? (parseFloat(form.valor) || valorFinal)
      : (parseFloat(valorOriginal || form.valor) || valorFinal)
    const pagsValidos = pagamentos.filter(p => p.forma && parseFloat(p.valor) > 0)
    // Se o usuário usou o sistema de múltiplos pagamentos (mesmo que tenha removido tudo),
    // não usar form.forma_pagamento como fallback - gravar null para limpar
    const pagsUsados = pagamentos.length >= 0  // sempre true - indica que o sistema foi usado
    const formaResumida = pagsValidos.length > 0
      ? pagsValidos.map(p => p.forma).join('+')
      : (form.usar_plano ? 'plano' : (pagamentos.length === 0 && !form.forma_pagamento ? null : form.forma_pagamento || null))
    const pagsJSON = pagsValidos.length > 0 ? JSON.stringify(pagsValidos.map(p => ({ forma: p.forma, valor: parseFloat(p.valor) }))) : (pagsValidos.length === 0 ? null : null)
    const payload: any = { cliente_id:form.clienteId, servico_id:srv?.id||null, profissional_id:null, prof_id:prof?.id||null, data_inicio:dataInicio, data_fim:dataFim, tipo_cobranca:form.usar_plano?'plano':'avulso', valor:valorFinal, valor_bruto:valorBruto, desconto:descontoVal>0?descontoVal:null, forma_pagamento:formaResumida, pagamentos:pagsJSON, sessao_numero:sessaoParaSalvar||null, sessao_total:totalParaSalvar||null, observacoes:form.observacoes||null }
    if (!modoEdicao) payload.status = 'aberto'
    let error: any
    if (modoEdicao && selecionado) { const res = await atualizarAgendamento(selecionado.id, payload); error = res.error }
    else { const res = await criarAgendamento(empresaAtiva.id, payload); error = res.error }
    if (error) { alert('Erro: ' + error.message); setSalvando(false); return }
    // Atualizar contador de sessoes do plano
    if (!modoEdicao && form.usar_plano && planoCliente && empresaAtiva?.id) {
      const sb3 = createClient()
      const { count: totalAgs } = await sb3.from('agendamentos')
        .select('id', { count:'exact', head:true })
        .eq('empresa_id', empresaAtiva.id)
        .eq('cliente_id', form.clienteId)
        .is('servico_id', null)
        .neq('status', 'cancelado')
      if (sessaoPlano?.id) {
        await sb3.from('cliente_plano_sessoes').update({ sessoes_utilizadas: totalAgs || 1 }).eq('id', sessaoPlano.id)
      } else {
        await sb3.from('cliente_plano_sessoes').insert({ empresa_id:empresaAtiva.id, cliente_id:form.clienteId, plano_id:planoCliente.id, sessoes_utilizadas:1 })
      }
    }
    setDiaAtivo(isoParaDate(form.dataISO))
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function confirmarCancelamento() {
    const agId = agRapido?.id || selecionado?.id
    if (!agId) return
    setCancelando(true)
    const sb2 = createClient()
    const { error } = await sb2.from('agendamentos').update({ status:'cancelado', motivo_cancelamento:motivoCancelamento||null }).eq('id', agId)
    if (error) { alert('Erro: ' + error.message); setCancelando(false); return }
    setCancelando(false); setModalCancelar(false); setMotivoCancelamento(''); setAgRapido(null)
    await carregar()
    if (!agRapido) fecharModal()
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

  // Finaliza sem exigir forma de pagamento (quando flag empresaAtiva.finalizar_sem_pagamento = true)
  async function finalizarDireto(id: string) {
    if (!confirm('Finalizar este atendimento?')) return
    setFinalizando(true)
    const sb2 = createClient()

    // Busca o agendamento atual do banco como base
    const { data: agAtual } = await sb2
      .from('agendamentos')
      .select('valor, valor_bruto, desconto')
      .eq('id', id)
      .single()

    // Prioridade do valor:
    // 1. Se o usuário pode editar o valor diretamente (podeEditarValorDireto) E
    //    está no modal de edição (não agRapido), usa o valor da tela (form.valor)
    // 2. Se veio do botão rápido (agRapido), usa o valor do agRapido
    // 3. Caso contrário, preserva o valor que está no banco
    let valorFinal: number | null
    let valorBruto: number | null
    const descontoFinal = agAtual?.desconto ?? null

    if (!agRapido && podeEditarValorDireto && form.valor !== '' && form.valor !== undefined) {
      // Usuário editou o valor manualmente na tela — usa esse valor
      valorFinal = parseFloat(form.valor) || 0
      valorBruto = valorFinal  // sem desconto neste fluxo, valor bruto = valor final
    } else if (agRapido) {
      // Botão rápido — usa o valor do agendamento já carregado na lista
      valorFinal = agRapido.valor ?? agAtual?.valor ?? null
      valorBruto = agAtual?.valor_bruto ?? valorFinal
    } else {
      // Modal de edição sem permissão de editar valor — preserva o que está no banco
      valorFinal = agAtual?.valor ?? null
      valorBruto = agAtual?.valor_bruto ?? valorFinal
    }

    const { error } = await sb2.from('agendamentos').update({
      status:      'fechado',
      valor:       valorFinal,
      valor_bruto: valorBruto,
      desconto:    descontoFinal,
    }).eq('id', id)

    if (error) alert('Erro: ' + error.message)
    else {
      await carregar()
      setModalFinalizar(false); setAgRapido(null)
      if (!agRapido) fecharModal()
    }
    setFinalizando(false)
  }

  async function finalizar(id: string) {
    // Se veio do botão rápido, usar o valor do agRapido
    const valorBase = agRapido ? agRapido.valor : (parseFloat(form.valor) || 0)
    const descontoFinVal = parseFloat(descontoFin || desconto) || 0
    const valorEsperadoFin = Math.max(0, valorBase - descontoFinVal)
    const pagsAtivos = pagamentos.filter(p => p.forma && parseFloat(p.valor) > 0)
    const totalPagoFin = pagsAtivos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0)
    const temPagamento = pagsAtivos.length > 0 || !!form.forma_pagamento

    if (!temPagamento) {
      setErroForm(['Para finalizar e necessario informar a Forma de pagamento.'])
      return
    }
    if (pagsAtivos.length > 0) {
      const diffFin = valorEsperadoFin - totalPagoFin
      if (diffFin > 0.01) {
        setErroForm(['Para finalizar: faltam R$ ' + diffFin.toLocaleString('pt-BR', {minimumFractionDigits:2}) + ' para fechar o total de R$ ' + valorEsperadoFin.toLocaleString('pt-BR', {minimumFractionDigits:2}) + '. Ajuste os valores informados.'])
        return
      }
      if (diffFin < -0.01) {
        setErroForm(['Para finalizar: o total dos pagamentos excede em R$ ' + Math.abs(diffFin).toLocaleString('pt-BR', {minimumFractionDigits:2}) + ' o valor do servico (R$ ' + valorEsperadoFin.toLocaleString('pt-BR', {minimumFractionDigits:2}) + '). Ajuste os valores.'])
        return
      }
    }
    if (!confirm('Finalizar este atendimento?')) return
    setFinalizando(true)
    const sb2 = createClient()
    const valorFinalFinalizar = valorEsperadoFin
    const valorBrutoFinalizar = valorBase
    const pagsFinValidos = pagamentos.filter(p => p.forma && parseFloat(p.valor) > 0)
    const formaFinResumida = pagsFinValidos.length > 0
      ? pagsFinValidos.map(p => p.forma).join('+')
      : (pagamentos.length === 0 ? form.forma_pagamento || null : form.forma_pagamento || null)
    const pagsFinJSON = pagsFinValidos.length > 0 ? JSON.stringify(pagsFinValidos.map(p => ({ forma: p.forma, valor: parseFloat(p.valor) }))) : null
    const updatePayload: any = {
      status: 'fechado',
      forma_pagamento: formaFinResumida,
      pagamentos: pagsFinJSON,
      valor: valorFinalFinalizar,
      valor_bruto: valorBrutoFinalizar,
      desconto: descontoFinVal > 0 ? descontoFinVal : null,
    }
    const { error } = await sb2.from('agendamentos').update(updatePayload).eq('id', id)
    if (error) alert('Erro: ' + error.message)
    else {
      await carregar()
      setModalFinalizar(false); setPagamentos([]); setDescontoFin(''); setAgRapido(null)
      if (!agRapido) fecharModal()
    }
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
    const total = planoCliente.sessoes_mes || 1
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
        setForm(f => ({...f, usar_plano: true}))
      }
      return r1.data
    } else {
      setPlanoCliente(null)
      setSessaoPlano(null)
    }
  }

  const isBloqEdicao = modoEdicao && (selecionado?.status === 'fechado' || selecionado?.status === 'cancelado')

  // Regra: empresa com "finalizar sem pagamento" ativo E usuário com
  // "bloquear edição de valor" DESMARCADO (false) → pode editar o valor no modo edição
  const podeEditarValorDireto = modoEdicao
    && empresaAtiva?.finalizar_sem_pagamento === true
    && (usuario as any)?.bloquear_edicao_valor === false

  // Valor efetivamente bloqueado: considera a regra acima
  const valorEfBloqueado = podeEditarValorDireto ? false : bloquearValor

  const getLabelPeriodo = () => {
    if (!periodoInicio || !periodoFim) return 'Periodo'
    const ini = isoParaDate(periodoInicio).toLocaleDateString('pt-BR',{day:'numeric',month:'short',timeZone:'America/Sao_Paulo'})
    const fim = isoParaDate(periodoFim).toLocaleDateString('pt-BR',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Sao_Paulo'})
    return ini + ' - ' + fim
  }

  // Props compartilhadas pelos dois modelos de agenda
  const agendaProps = {
    agendamentos,
    profissionais,
    horariosProfissional,
    onAbrirNovo: perm.criar ? abrirNovo : undefined,
    onAbrirEdicao: abrirEdicao,
    onCancelarRapido: (usuario as any)?.permitir_cancelar !== false ? (ag: any) => {
      setAgRapido(ag); setMotivoCancelamento(''); setModalCancelar(true)
    } : undefined,
    onFinalizarRapido: (usuario as any)?.permitir_finalizar !== false ? (ag: any) => {
      if (empresaAtiva?.finalizar_sem_pagamento) {
        setAgRapido(ag); finalizarDireto(ag.id)
      } else {
        setAgRapido(ag); setPagamentos([]); setDescontoFin(''); setErroForm([]); setModalFinalizar(true)
      }
    } : undefined,
    onVerPagamentos: (usuario as any)?.permitir_ver_pagamento !== false && !empresaAtiva?.finalizar_sem_pagamento ? (ag: any) => { setAgVerPag(ag); setVerPagamentos(true) } : undefined,
  }

  const onEnviarWppFn = wppConectado && (usuario as any)?.permitir_enviar_wpp !== false ? async (ag: any) => {
            if (!confirm(`Enviar confirmação de WhatsApp para ${ag.cliente}?`)) return
            const sb = createClient()
            const { data: cli } = await sb.from('clientes').select('nome,whatsapp,telefone').eq('id', ag.clienteId).single()
            const fone = cli?.whatsapp || cli?.telefone
            if (!fone) { alert('Cliente sem número de WhatsApp cadastrado.'); return }
            const { data: emp } = await sb.from('empresas').select('nome,whatsapp_instancia').eq('id', empresaAtiva?.id || '').single()
            const { data: tmpl } = await sb.from('mensagens_template').select('mensagem').eq('empresa_id', empresaAtiva?.id || '').eq('tipo','confirmacao').eq('ativo',true).single()
            const dtBRT = new Date(new Date(ag.dataISO + 'T' + String(Math.floor(ag.horaInicio)).padStart(2,'0') + ':' + String(Math.round((ag.horaInicio % 1)*60)).padStart(2,'0') + ':00+00:00'))
            const dataStr = dtBRT.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'})
            const horaStr = dtBRT.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})
            let msg = tmpl?.mensagem || `Olá {{cliente}}! Lembrando do seu horário:\n*Data:* {{data}}\n*Hora:* {{hora}}\n*Serviço:* {{servico}}`
            msg = msg.replace(/{{cliente}}/g,ag.cliente).replace(/{{data}}/g,dataStr).replace(/{{hora}}/g,horaStr).replace(/{{servico}}/g,ag.servico||'').replace(/{{empresa}}/g,emp?.nome||'')
            const instancia = emp?.whatsapp_instancia || ('emp-'+(empresaAtiva?.id||'').slice(0,8))
            const { data: cfgs } = await sb.from('config_sistema').select('chave,valor').in('chave',['evolution_api_url','evolution_api_key'])
            const cfgMap: Record<string,string> = {}; if (cfgs) cfgs.forEach((c:any)=>{ cfgMap[c.chave]=c.valor||'' })
            const numero = fone.replace(/\D/g,''); const numeroFinal = numero.startsWith('55')?numero:'55'+numero
            try {
              const res = await fetch(cfgMap['evolution_api_url'].replace(/\/$/,'')+'/message/sendText/'+instancia, { method:'POST', headers:{'apikey':cfgMap['evolution_api_key'],'Content-Type':'application/json'}, body:JSON.stringify({number:numeroFinal,text:msg}) })
              if (res.ok) { alert('Mensagem enviada com sucesso!') }
              else { alert('Erro ao enviar mensagem.') }
            } catch { alert('Erro ao conectar com a API do WhatsApp.') }
  } : undefined

  const tipoAgenda = empresaAtiva?.tipo_agenda || 'grade'

  return (
    <div style={{ padding: tipoAgenda === 'dia' ? '0' : '16px', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ flex:1, overflow:'hidden' }}>
        {tipoAgenda === 'dia' ? (
          <AgendaDia
            {...agendaProps}
            onEnviarWpp={onEnviarWppFn}
          />
        ) : (
          <CalendarioAgenda
            {...agendaProps}
            onEnviarWpp={onEnviarWppFn}
            filtroProfissional={filtroProfissional}
            setFiltroProfissional={setFiltroProfissional}
          />
        )}
      </div>

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
            <h3 style={{ fontSize:'17px', fontWeight:'700', color:'#1a1a2e', marginBottom:'4px' }}>Cancelar agendamento?</h3>
            {(agRapido || selecionado) && <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'4px' }}>{agRapido?.cliente || selecionado?.cliente}</p>}
            <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'16px' }}>Informe o motivo (opcional)</p>
            <textarea value={motivoCancelamento} onChange={e=>setMotivoCancelamento(e.target.value)} rows={3} style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'10px', padding:'10px 12px', fontSize:'14px', outline:'none', resize:'none', boxSizing:'border-box', marginBottom:'16px' }}/>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={()=>{ setModalCancelar(false); setAgRapido(null); setMotivoCancelamento('') }} style={{ flex:1, background:'#f3f4f6', color:'#374151', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', cursor:'pointer' }}>Voltar</button>
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
                  <div style={{ background:'#f0fdf4', padding:'12px 18px', display:'flex', gap:'20px', flexWrap:'wrap', alignItems:'center' }}>
                    <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Cliente</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>{selecionado.cliente}</p></div>
                    <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Servico</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>{selecionado.servico}</p></div>
                    <div><p style={{ fontSize:'10px', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>Valor</p><p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>R$ {Number(selecionado.valor).toFixed(2).replace('.',',')}</p></div>
                    {(usuario as any)?.permitir_ver_pagamento !== false && !empresaAtiva?.finalizar_sem_pagamento && (
                      <button onClick={()=>setVerPagamentos(true)}
                        style={{ marginLeft:'auto', background:'#dcfce7', border:'1px solid #86efac', borderRadius:'8px', color:'#059669', fontSize:'12px', fontWeight:'700', cursor:'pointer', padding:'5px 12px', display:'flex', alignItems:'center', gap:'5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                        Ver pagamento
                      </button>
                    )}
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
                  <button type="button" onClick={()=>setModalNovoCliente(true)} style={{ background:'none', border:'none', color:'#6366f1', fontSize:'12px', fontWeight:'600', cursor:'pointer', display: permClientes.criar ? 'flex' : 'none', alignItems:'center', gap:'3px', padding:0 }}>+ Novo cliente</button>
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
              {planoCliente && (
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
                      <p style={{ fontSize:'11px', color:'#9ca3af' }}>{planoCliente.sessoes_mes_mes || 1} sessoes</p>
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
                    <div onClick={() => { setForm(f => ({...f, usar_plano:false, valor:'', servico:''})); if (modoEdicao) setSessaoEdicao(null) }}
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
                  <select value={form.profissional} onChange={e=>{
                    const profNome = e.target.value
                    const prof = profissionais.find((p:any) => p.nome === profNome)
                    if (prof?.intervalo_atendimento) setIntervaloMin(prof.intervalo_atendimento)
                    setForm(f=>({...f,profissional:profNome,servico:'',horaInicio:''}))
                  }} style={selectStyle}>
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
                    <select value={form.servico} onChange={e=>{const srv=servicosDoProf.find((s: any)=>s.nome===e.target.value);const vSrv=srv?.valor?String(srv.valor):form.valor;setValorOriginal(vSrv);setDesconto('');setForm(f=>({...f,servico:e.target.value,duracao:srv?.duracao_min?String(srv.duracao_min):f.duracao,valor:vSrv}))}} style={{ ...selectStyle, background:!form.profissional?'#f9fafb':'white' }} disabled={!form.profissional}>
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
                  <input type="date" value={form.dataISO} onChange={e=>setForm(f=>({...f,dataISO:e.target.value,horaInicio:''}))}
                    className="agenda-date-input"/>
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
                        <label style={{ fontSize:'13px', fontWeight:'600', color: !form.horaInicio ? '#ef4444' : '#374151' }}>{form.horaInicio ? 'Horario' : '* Selecione um horario'}</label>
                        <span style={{ fontSize:'11px', color:'#6366f1', background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'6px', padding:'3px 8px', fontWeight:'600' }}>
                          Intervalo: {intervaloMin}min
                        </span>
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
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                    <label style={{ fontSize:'13px', fontWeight:'500', color:'#374151' }}>
                      {podeEditarValorDireto ? 'Valor (R$) — editável' : 'Valor (R$)'}
                    </label>
                    {!valorEfBloqueado && form.valor && parseFloat(form.valor) > 0 && (usuario as any)?.permitir_desconto === true && (
                      <button type="button" onClick={()=>{ setValorOriginal(form.valor); setModalDesconto(true) }}
                        style={{ fontSize:'11px', fontWeight:'600', color:'#6366f1', background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'6px', padding:'2px 8px', cursor:'pointer' }}>
                        % Desconto
                      </button>
                    )}
                  </div>
                  <input type="number" value={form.valor} onChange={e=>{ if(!valorEfBloqueado) setForm(f=>({...f,valor:e.target.value})) }} readOnly={valorEfBloqueado}
                    style={{ opacity:valorEfBloqueado?0.6:1, cursor:valorEfBloqueado?'not-allowed':'text', ...inputStyle }} placeholder="0,00"/>
                  {parseFloat(desconto) > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
                      <span style={{ fontSize:'11px', color:'#6b7280' }}>Desc: R$ {parseFloat(desconto).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                      <span style={{ fontSize:'12px', fontWeight:'700', color:'#059669' }}>Total: R$ {Math.max(0,(parseFloat(form.valor)||0)-parseFloat(desconto)).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                    </div>
                  )}
                  {podeEditarValorDireto && (
                    <p style={{ fontSize:'11px', color:'#059669', marginTop:'4px' }}>Edite o valor e clique em Salvar para aplicar.</p>
                  )}
                </div>
              )}
              {!modoEdicao && form.usar_plano && infoPlano && (
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
                {modoEdicao && form.usar_plano && planoCliente && (
                  <div style={{ borderRadius:'12px', overflow:'hidden', border:'1.5px solid #bfdbfe' }}>
                    <div style={{ background:'linear-gradient(135deg,#2563eb,#1d4ed8)', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
                      <div style={{ flex:1 }}>
                        <p style={{ color:'white', fontWeight:'700', fontSize:'14px' }}>{planoCliente.nome}</p>
                        <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px', marginTop:'2px' }}>
                          {sessaoEdicao ? ('Sessao ' + sessaoEdicao.num + ' de ' + sessaoEdicao.total + (sessaoEdicao.num === 1 ? ' - Cobranca do plano' : ' - Sessao inclusa')) : 'Plano mensal'}
                        </p>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'10px', padding:'8px 14px', textAlign:'center' }}>
                        <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'10px', textTransform:'uppercase' as const }}>Valor</p>
                        <p style={{ color:'white', fontSize:'18px', fontWeight:'800' }}>
                          {'R$ ' + (sessaoEdicao ? sessaoEdicao.valor : Number(form.valor||0)).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                        </p>
                      </div>
                    </div>
                    <div style={{ background: sessaoEdicao?.num === 1 ? '#eff6ff' : '#f0fdf4', padding:'8px 16px' }}>
                      <p style={{ fontSize:'11px', color: sessaoEdicao?.num === 1 ? '#1d4ed8' : '#16a34a', fontWeight:'600' }}>
                        {sessaoEdicao?.num === 1 ? 'Cobrar o valor do plano nesta sessao' : 'Sessao gratuita - inclusa no plano'}
                      </p>
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
                  {(usuario as any)?.permitir_cancelar !== false && <button onClick={()=>{setMotivoCancelamento('');setModalCancelar(true)}} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', cursor:'pointer' }}>Cancelar agend.</button>}
                  {wppConectado && !permWpp.carregando && permWpp.visualizar && (usuario as any)?.permitir_enviar_wpp !== false && <button onClick={enviarConfirmacao} disabled={enviandoWpp} title="Enviar confirmacao via WhatsApp"
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
                  {(usuario as any)?.permitir_finalizar !== false && <button onClick={()=>{
                    if (empresaAtiva?.finalizar_sem_pagamento) {
                      finalizarDireto(selecionado!.id)
                    } else {
                      setPagamentos([]); setDescontoFin(''); setModalFinalizar(true)
                    }
                  }} style={{ background:'#ecfdf5', color:'#10b981', border:'1px solid #6ee7b7', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>Finalizar</button>}
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

      {/* Modal Finalizar */}
      {modalFinalizar && (agRapido || selecionado) && (
        <div onClick={()=>{ setModalFinalizar(false); setAgRapido(null); setPagamentos([]); setDescontoFin(''); setErroForm([]) }} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'420px', overflow:'hidden', boxShadow:'0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ background:'linear-gradient(135deg,#059669,#10b981)', padding:'20px 24px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ color:'white', fontWeight:'800', fontSize:'17px' }}>Finalizar atendimento</p>
                  <p style={{ color:'rgba(255,255,255,0.85)', fontSize:'13px', marginTop:'2px' }}>
                    {agRapido?.cliente || selecionado?.cliente}
                  </p>
                  <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'13px', marginTop:'2px' }}>
                    {(() => {
                      const dFin = parseFloat(descontoFin || desconto) || 0
                      const valorRef = agRapido ? agRapido.valor : (parseFloat(form.valor)||0)
                      const total = Math.max(0, valorRef - dFin)
                      return `Total a receber: R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}`
                    })()}
                  </p>
                </div>
                <button onClick={()=>{ setModalFinalizar(false); setAgRapido(null); setPagamentos([]); setDescontoFin(''); setErroForm([]) }} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:'32px', height:'32px', color:'white', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>x</button>
              </div>
            </div>
            <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'10px' }}>
              {/* Campo de desconto */}
              {(usuario as any)?.permitir_desconto === true && (
                <div style={{ background:'#fafafa', borderRadius:'12px', padding:'12px 14px', border:'1px solid #e5e7eb' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                    <label style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>Desconto (R$)</label>
                    <span style={{ fontSize:'12px', color:'#6b7280' }}>
                      Valor bruto: R$ {(agRapido ? agRapido.valor : (parseFloat(form.valor)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <input type="number" value={descontoFin} placeholder="0,00" min="0"
                      max={agRapido ? agRapido.valor : (parseFloat(form.valor)||0)}
                      onChange={e=>{ const v=parseFloat(e.target.value)||0; const max=agRapido?agRapido.valor:(parseFloat(form.valor)||0); if(v<=max) { setDescontoFin(e.target.value); setPagamentos([]) } }}
                      style={{ flex:1, border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }}/>
                    {descontoFin && parseFloat(descontoFin)>0 && (
                      <button onClick={()=>{ setDescontoFin(''); setPagamentos([]) }}
                        style={{ background:'#fef2f2', border:'none', borderRadius:'8px', padding:'9px 10px', color:'#ef4444', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                        Remover
                      </button>
                    )}
                  </div>
                  {descontoFin && parseFloat(descontoFin)>0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px' }}>
                      <span style={{ fontSize:'11px', color:'#6b7280' }}>- Desconto: R$ {parseFloat(descontoFin).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                      <span style={{ fontSize:'13px', fontWeight:'700', color:'#059669' }}>
                        Total: R$ {Math.max(0,(agRapido?agRapido.valor:(parseFloat(form.valor)||0))-parseFloat(descontoFin)).toLocaleString('pt-BR',{minimumFractionDigits:2})}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {pagamentos.map((pag, idx) => {
                const descontoNM = parseFloat(descontoFin || desconto) || 0
                const valorRefM = agRapido ? agRapido.valor : (parseFloat(form.valor)||0)
                const valTotalM = Math.max(0, valorRefM - descontoNM)
                const somaAntM = pagamentos.slice(0,idx).reduce((s,p)=>s+(parseFloat(p.valor)||0),0)
                const restanteM = Math.max(0, valTotalM - somaAntM)
                const isUltM = idx === pagamentos.length - 1
                return (
                  <div key={idx} style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <select value={pag.forma} onChange={e=>setPagamentos(ps=>ps.map((p,i)=>i===idx?{...p,forma:e.target.value}:p))}
                      style={{ flex:2, border:'1.5px solid #e5e7eb', borderRadius:'10px', padding:'10px 12px', fontSize:'13px', outline:'none', background:'white' }}>
                      {FORMAS_PAG.filter(fp=>fp.value).map(fp=><option key={fp.value} value={fp.value}>{fp.label}</option>)}
                    </select>
                    <div style={{ flex:1, position:'relative' }}>
                      <input type="number" value={pag.valor}
                        placeholder={isUltM && pagamentos.length>1 ? restanteM.toFixed(2) : '0,00'}
                        onChange={e=>setPagamentos(ps=>ps.map((p,ii)=>ii===idx?{...p,valor:e.target.value}:p))}
                        style={{ width:'100%', border:`1.5px solid ${isUltM&&pagamentos.length>1&&!pag.valor?'#6ee7b7':'#e5e7eb'}`, borderRadius:'10px', padding:'10px 12px', fontSize:'13px', outline:'none', background:isUltM&&pagamentos.length>1&&!pag.valor?'#f0fdf4':'white' }}/>
                      {isUltM && pagamentos.length>1 && !pag.valor && restanteM>0 && (
                        <button type="button" onClick={()=>setPagamentos(ps=>ps.map((p,ii)=>ii===idx?{...p,valor:String(restanteM)}:p))}
                          style={{ position:'absolute', right:'6px', top:'50%', transform:'translateY(-50%)', background:'#059669', color:'white', border:'none', borderRadius:'6px', fontSize:'10px', fontWeight:'700', padding:'3px 6px', cursor:'pointer' }}>
                          ok {restanteM.toLocaleString('pt-BR',{minimumFractionDigits:2})}
                        </button>
                      )}
                    </div>
                    <button type="button" onClick={()=>setPagamentos(ps=>ps.filter((_,i)=>i!==idx))}
                      style={{ background:'#fef2f2', border:'none', borderRadius:'8px', color:'#ef4444', cursor:'pointer', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>x</button>
                  </div>
                )
              })}
              <button type="button" onClick={()=>{
                  const dNM2 = parseFloat(descontoFin || desconto)||0
                  const valorRefBtn = agRapido ? agRapido.valor : (parseFloat(form.valor)||0)
                  const vTM2 = Math.max(0, valorRefBtn - dNM2)
                  if (pagamentos.length===0) { setPagamentos([{forma:'dinheiro',valor:String(vTM2)}]) }
                  else {
                    const semUltM2=pagamentos.slice(0,-1)
                    const ultM2=pagamentos[pagamentos.length-1]
                    const somaM2=semUltM2.reduce((s,p)=>s+(parseFloat(p.valor)||0),0)
                    const restM2=Math.max(0,vTM2-somaM2)
                    setPagamentos([...semUltM2,{...ultM2,valor:''},{forma:'dinheiro',valor:String(restM2)}])
                  }
                }}
                style={{ border:'2px dashed #d1d5db', background:'transparent', borderRadius:'10px', padding:'10px', fontSize:'13px', color:'#6b7280', cursor:'pointer', fontWeight:'600' }}>
                + Adicionar forma de pagamento
              </button>
              {pagamentos.length > 0 && (()=>{
                const dN6 = parseFloat(descontoFin || desconto)||0
                const valorRefConf = agRapido ? agRapido.valor : (parseFloat(form.valor)||0)
                const vB6 = Math.max(0, valorRefConf - dN6)
                const tP6 = pagamentos.reduce((s,p)=>s+(parseFloat(p.valor)||0),0)
                const df6 = vB6 - tP6
                return (
                  <div style={{ padding:'10px 14px', borderRadius:'10px', background:Math.abs(df6)<0.01?'#f0fdf4':df6>0?'#fffbeb':'#fef2f2', border:`1px solid ${Math.abs(df6)<0.01?'#6ee7b7':df6>0?'#fde68a':'#fecaca'}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'12px', color:'#6b7280' }}>Pago: R$ {tP6.toLocaleString('pt-BR',{minimumFractionDigits:2})} / Total: R$ {vB6.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                    {Math.abs(df6)<0.01 && <span style={{ fontSize:'12px', color:'#059669', fontWeight:'700' }}>✓ Confirmado</span>}
                    {df6>0.01 && <span style={{ fontSize:'12px', color:'#d97706', fontWeight:'700' }}>Falta R$ {df6.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                    {df6<-0.01 && <span style={{ fontSize:'12px', color:'#ef4444', fontWeight:'700' }}>Excede R$ {Math.abs(df6).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>}
                  </div>
                )
              })()}
              {erroForm.length > 0 && (
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'10px 14px' }}>
                  {erroForm.map((e,i)=><p key={i} style={{ fontSize:'12px', color:'#dc2626' }}>- {e}</p>)}
                </div>
              )}
              <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
                <button onClick={()=>setModalFinalizar(false)} style={{ flex:1, padding:'11px', border:'1px solid #e5e7eb', borderRadius:'10px', background:'white', fontSize:'14px', cursor:'pointer', color:'#6b7280' }}>Cancelar</button>
                <button onClick={()=>finalizar(agRapido?.id || selecionado!.id)} disabled={finalizando}
                  style={{ flex:2, padding:'11px', border:'none', borderRadius:'10px', background:finalizando?'#a7f3d0':'linear-gradient(135deg,#059669,#10b981)', color:'white', fontSize:'14px', fontWeight:'700', cursor:finalizando?'not-allowed':'pointer' }}>
                  {finalizando ? 'Finalizando...' : 'Confirmar e Finalizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Pagamentos */}
      {verPagamentos && (agVerPag || selecionado) && (() => {
        const ag = agVerPag || selecionado
        const fechar = () => { setVerPagamentos(false); setAgVerPag(null) }
        const fLabel: Record<string,string> = {dinheiro:'Dinheiro',pix:'PIX',cartao_credito:'Cartão Crédito',cartao_debito:'Cartão Débito',transferencia:'Transferência',plano:'Plano Mensal'}
        const fBg: Record<string,string> = {dinheiro:'#ecfdf5',pix:'#eff6ff',cartao_credito:'#faf5ff',cartao_debito:'#fdf4ff',transferencia:'#fff7ed',plano:'#f0fdf4'}
        const fCor: Record<string,string> = {dinheiro:'#059669',pix:'#2563eb',cartao_credito:'#7c3aed',cartao_debito:'#a21caf',transferencia:'#ea580c',plano:'#16a34a'}
        const pags: any[] = Array.isArray(ag.pagamentos) ? ag.pagamentos : []
        return (
          <div onClick={fechar} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'380px', overflow:'hidden', boxShadow:'0 25px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ background:'linear-gradient(135deg,#1d4ed8,#2563eb)', padding:'18px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ color:'white', fontWeight:'800', fontSize:'16px' }}>Forma de pagamento</p>
                  <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px', marginTop:'2px' }}>{ag.cliente}</p>
                </div>
                <button onClick={fechar} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', width:'30px', height:'30px', color:'white', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>x</button>
              </div>
              <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:'10px' }}>
                {pags.length > 0 ? (
                  <>
                    {pags.map((p: any, i: number) => {
                      const bg = fBg[p.forma]||'#f8fafc'
                      const cor = fCor[p.forma]||'#374151'
                      return (
                        <div key={i} style={{ background:bg, borderRadius:'12px', padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', border:`1px solid ${cor}22` }}>
                          <div>
                            <p style={{ fontSize:'13px', fontWeight:'700', color:cor }}>{fLabel[p.forma]||p.forma}</p>
                            <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'2px' }}>Parcela {i+1} de {pags.length}</p>
                          </div>
                          <p style={{ fontSize:'18px', fontWeight:'800', color:cor }}>R$ {Number(p.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
                        </div>
                      )
                    })}
                    <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:'10px', display:'flex', flexDirection:'column', gap:'4px' }}>
                      {ag.desconto > 0 && <>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span style={{ fontSize:'12px', color:'#6b7280' }}>Valor bruto</span>
                          <span style={{ fontSize:'13px', color:'#6b7280' }}>R$ {Number(ag.valor_bruto || ag.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span style={{ fontSize:'12px', color:'#6b7280' }}>Desconto</span>
                          <span style={{ fontSize:'13px', color:'#ef4444' }}>- R$ {Number(ag.desconto).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                        </div>
                      </>}
                      <div style={{ display:'flex', justifyContent:'space-between', borderTop: ag.desconto > 0 ? '1px solid #f3f4f6' : 'none', paddingTop: ag.desconto > 0 ? '6px' : '0', marginTop: ag.desconto > 0 ? '2px' : '0' }}>
                        <span style={{ fontSize:'13px', color:'#6b7280', fontWeight:'600' }}>Total recebido</span>
                        <span style={{ fontSize:'16px', fontWeight:'800', color:'#059669' }}>R$ {Number(ag.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign:'center', padding:'20px', color:'#9ca3af' }}>
                    <p style={{ fontSize:'13px' }}>Nenhum registro detalhado</p>
                    {ag.forma_pagamento && <p style={{ fontSize:'12px', marginTop:'4px', color:'#6b7280' }}>{ag.forma_pagamento}</p>}
                  </div>
                )}
                <button onClick={fechar} style={{ padding:'10px', border:'none', borderRadius:'10px', background:'#f3f4f6', fontSize:'13px', cursor:'pointer', fontWeight:'600', color:'#374151' }}>Fechar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
