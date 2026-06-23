'use client'
import { useState, useMemo } from 'react'

type Ag = {
  id: string; dataISO: string; horaInicio: number; duracao: number
  cliente: string; clienteId: string; servico: string; profissional: string
  cor: string; status: string; observacoes: string; forma_pagamento: string
  valor: number; motivoCancelamento?: string
}

type HorarioDB = {
  profissional_id: string; dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean
}

function toISO(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function hojeNoBrasil() {
  const str = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(str); d.setHours(0,0,0,0); return d
}
function addMes(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth()+n, 1) }
function nomeMes(d: Date) {
  return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'})
    .replace(/^\w/,c=>c.toUpperCase())
}
function addDias(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function isoParaDate(iso: string) {
  const [y,m,d] = iso.split('-').map(Number)
  return new Date(y, m-1, d)
}
function nomeDia(d: Date) {
  return d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})
}

type Props = {
  agendamentos: Ag[]
  profissionais: any[]
  horariosProfissional?: HorarioDB[]
  onAbrirNovo: (() => void) | undefined
  onAbrirEdicao: (ag: Ag) => void
  onCancelarRapido?: (ag: Ag) => void
  onFinalizarRapido?: (ag: Ag) => void
  onVerPagamentos?: (ag: Ag) => void
  onEnviarWpp?: (ag: Ag) => void
  filtroProfissional: string
  setFiltroProfissional: (v: string) => void
}

// Paleta azul
const AZUL        = '#2563eb'
const AZUL_DARK   = '#1d4ed8'
const AZUL_LIGHT  = '#dbeafe'
const AZUL_XLIGHT = '#eff6ff'

// Gera slots de 30 em 30 min entre hora_inicio e hora_fim
function gerarSlots(horaIni: string, horaFim: string, passo = 30): number[] {
  const [hI, mI] = horaIni.split(':').map(Number)
  const [hF, mF] = horaFim.split(':').map(Number)
  const inicio = hI * 60 + mI
  const fim    = hF * 60 + mF
  const slots: number[] = []
  for (let t = inicio; t < fim; t += passo) slots.push(t)
  return slots
}

function minParaHora(min: number) {
  return String(Math.floor(min/60)).padStart(2,'0') + ':' + String(min%60).padStart(2,'0')
}

export default function CalendarioAgenda({ agendamentos, profissionais, horariosProfissional = [], onAbrirNovo, onAbrirEdicao, onCancelarRapido, onFinalizarRapido, onVerPagamentos, onEnviarWpp, filtroProfissional, setFiltroProfissional }: Props) {
  const hoje = hojeNoBrasil()
  const [mesBase, setMesBase] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [diaSel, setDiaSel]   = useState<string>(toISO(hoje))
  const [filtroPanelAberto, setFiltroPanelAberto] = useState(false)
  const [filtroIni, setFiltroIni] = useState('')
  const [filtroFim, setFiltroFim] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos'|'aberto'|'fechado'|'cancelado'>('todos')

  // ── Horários Livres ──
  const [painelLivres, setPainelLivres] = useState(false)
  const [livresProfSel, setLivresProfSel] = useState('')
  const [livresSemana, setLivresSemana] = useState(0) // offset de semanas a partir de hoje

  // Calcula a semana a exibir
  const inicioSemana = useMemo(() => {
    const d = new Date(hoje)
    d.setDate(d.getDate() + livresSemana * 7)
    // Vai para a segunda-feira desta semana
    const dow = d.getDay() // 0=dom
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    return d
  }, [hoje, livresSemana])

  // Monta os 7 dias da semana selecionada
  const diasSemana = useMemo(() =>
    Array.from({length:7},(_,i) => addDias(inicioSemana, i))
  , [inicioSemana])

  // Calcula slots livres para cada dia
  const slotsLivresPorDia = useMemo(() => {
    if (!livresProfSel) return {}
    const prof = profissionais.find(p => p.id === livresProfSel)
    if (!prof) return {}

    const resultado: Record<string, { livre: number[]; ocupado: number[] }> = {}

    diasSemana.forEach(dia => {
      const iso = toISO(dia)
      const diaSemana = dia.getDay() // 0=dom

      // Horário de trabalho do profissional neste dia
      const horario = horariosProfissional.find(h =>
        h.profissional_id === prof.id && h.dia_semana === diaSemana && h.ativo
      )
      if (!horario) { resultado[iso] = { livre: [], ocupado: [] }; return }

      const todosSlots = gerarSlots(horario.hora_inicio, horario.hora_fim)

      // Agendamentos do profissional neste dia (excluindo cancelados)
      const agsNoDia = agendamentos.filter(a =>
        a.profissional === prof.nome &&
        a.dataISO === iso &&
        a.status !== 'cancelado'
      )

      // Marca slots ocupados (considera a duração do agendamento)
      const minOcupados = new Set<number>()
      agsNoDia.forEach(ag => {
        const inicioMin = Math.round(ag.horaInicio * 60)
        const fimMin    = inicioMin + ag.duracao
        for (let t = inicioMin; t < fimMin; t += 30) minOcupados.add(t)
      })

      const livre   = todosSlots.filter(s => !minOcupados.has(s))
      const ocupado = todosSlots.filter(s =>  minOcupados.has(s))
      resultado[iso] = { livre, ocupado }
    })
    return resultado
  }, [livresProfSel, diasSemana, profissionais, horariosProfissional, agendamentos])

  const labelSemana = useMemo(() => {
    const ini = inicioSemana
    const fim = addDias(ini, 6)
    return ini.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) + ' - ' + fim.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})
  }, [inicioSemana])

  const profSelecionadoNome = profissionais.find(p => p.id === livresProfSel)?.nome || ''
  const modoFiltro = !!(filtroIni || filtroFim)

  const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']

  // Celulas do calendario
  const celulas = useMemo(() => {
    const primeiro = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1)
    const dow = primeiro.getDay()
    const inicio = new Date(primeiro)
    inicio.setDate(inicio.getDate() - dow)
    return Array.from({length:42}, (_,i) => {
      const d = new Date(inicio); d.setDate(d.getDate() + i); return d
    })
  }, [mesBase])

  // Agendamentos filtrados por profissional
  const agsProfFiltrados = useMemo(() => {
    let ags = agendamentos
    if (filtroProfissional !== 'todos') ags = ags.filter(a => a.profissional === filtroProfissional)
    return ags
  }, [agendamentos, filtroProfissional])

  // Agendamentos filtrados por periodo (para destacar no calendario)
  const agsVisiveis = useMemo(() => {
    let ags = agsProfFiltrados
    if (filtroIni) ags = ags.filter(a => a.dataISO >= filtroIni)
    if (filtroFim) ags = ags.filter(a => a.dataISO <= filtroFim)
    return ags
  }, [agsProfFiltrados, filtroIni, filtroFim])

  // Agendamentos do dia selecionado (com filtro de status)
  const agsDia = useMemo(() => {
    let ags = agsProfFiltrados.filter(a => a.dataISO === diaSel)
    if (filtroStatus !== 'todos') ags = ags.filter(a => a.status === filtroStatus)
    return ags.sort((a,b) => a.horaInicio - b.horaInicio)
  }, [agsProfFiltrados, diaSel, filtroStatus])

  // Contagem por dia
  const contagemPorDia = useMemo(() => {
    const map: Record<string,number> = {}
    agsVisiveis.forEach(a => {
      if (a.status !== 'cancelado') map[a.dataISO] = (map[a.dataISO]||0) + 1
    })
    return map
  }, [agsVisiveis])

  // Label do filtro ativo
  const labelFiltro = useMemo(() => {
    if (!filtroIni && !filtroFim) return null
    const fmtDate = (iso: string) => {
      const [y,m,d] = iso.split('-').map(Number)
      return String(d).padStart(2,'0') + '/' + String(m).padStart(2,'0')
    }
    if (filtroIni && filtroFim) return fmtDate(filtroIni) + ' - ' + fmtDate(filtroFim)
    if (filtroIni) return 'A partir de ' + fmtDate(filtroIni)
    return 'Ate ' + fmtDate(filtroFim)
  }, [filtroIni, filtroFim])

  function fmtHora(h: number) {
    const hh = Math.floor(h), mm = Math.round((h-hh)*60)
    return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0')
  }

  function labelDia(iso: string) {
    const [y,m,d] = iso.split('-').map(Number)
    return new Date(y,m-1,d)
      .toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Sao_Paulo'})
      .replace(/^\w/,c=>c.toUpperCase())
  }

  function limparFiltro() { setFiltroIni(''); setFiltroFim(''); setFiltroPanelAberto(false) }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', borderRadius:'16px', overflow:'hidden', border:'1px solid #dbeafe', background:'white' }}>

      {/* Header azul */}
      <div style={{ background:'linear-gradient(135deg,'+AZUL_DARK+','+AZUL+')', padding:'14px 16px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
          {/* Navegacao mes */}
          <button onClick={()=>setMesBase(d=>addMes(d,-1))}
            style={{ width:'34px', height:'34px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ color:'white', fontSize:'17px', fontWeight:'700', letterSpacing:'-0.3px' }}>{nomeMes(mesBase)}</span>
          <button onClick={()=>setMesBase(d=>addMes(d,1))}
            style={{ width:'34px', height:'34px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Linha de acoes: Hoje + Filtro + Prof */}
        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
          <button onClick={()=>{setMesBase(new Date(hoje.getFullYear(),hoje.getMonth(),1));setDiaSel(toISO(hoje))}}
            style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'8px', padding:'5px 12px', cursor:'pointer', color:'white', fontSize:'12px', fontWeight:'600' }}>
            Hoje
          </button>

          {/* Botao filtro periodo */}
          <div style={{ position:'relative' }}>
            <button onClick={()=>setFiltroPanelAberto(v=>!v)}
              style={{ background:modoFiltro?'white':'rgba(255,255,255,0.15)', border:'1px solid '+(modoFiltro?AZUL:'rgba(255,255,255,0.3)'), borderRadius:'8px', padding:'5px 10px', cursor:'pointer', color:modoFiltro?AZUL:'white', fontSize:'12px', fontWeight:'600', display:'flex', alignItems:'center', gap:'5px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              {labelFiltro || 'Periodo'}
              {modoFiltro && (
                <span onClick={e=>{e.stopPropagation();limparFiltro()}} style={{ marginLeft:'2px', fontWeight:'700', fontSize:'13px' }}>x</span>
              )}
            </button>

            {filtroPanelAberto && (
              <>
                <div onClick={()=>setFiltroPanelAberto(false)} style={{ position:'fixed', inset:0, zIndex:98 }}/>
                <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:99, background:'white', borderRadius:'14px', border:'1px solid #e0e7ff', boxShadow:'0 8px 32px rgba(37,99,235,0.18)', padding:'18px', width:'260px' }}>
                  <p style={{ fontSize:'13px', fontWeight:'700', color:'#1d4ed8', marginBottom:'14px' }}>Filtrar por periodo</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'5px' }}>Data inicial</label>
                      <input type="date" value={filtroIni} onChange={e=>setFiltroIni(e.target.value)}
                        style={{ width:'100%', border:'1.5px solid #dbeafe', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' as const, color:'#1d4ed8' }}
                        onFocus={e=>{(e.target as HTMLInputElement).style.borderColor=AZUL}}
                        onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='#dbeafe'}}/>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'5px' }}>Data final</label>
                      <input type="date" value={filtroFim} onChange={e=>setFiltroFim(e.target.value)}
                        style={{ width:'100%', border:'1.5px solid #dbeafe', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' as const, color:'#1d4ed8' }}
                        onFocus={e=>{(e.target as HTMLInputElement).style.borderColor=AZUL}}
                        onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='#dbeafe'}}/>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'12px' }}>
                    {[{l:'Hoje',f:0,t:0},{l:'7 dias',f:0,t:6},{l:'15 dias',f:0,t:14},{l:'Mes',f:0,t:29}].map(at=>{
                      const ini = new Date(hoje); ini.setDate(ini.getDate()+at.f)
                      const fim = new Date(hoje); fim.setDate(fim.getDate()+at.t)
                      return (
                        <button key={at.l} onClick={()=>{setFiltroIni(toISO(ini));setFiltroFim(toISO(fim))}}
                          style={{ background:AZUL_XLIGHT, border:'1px solid '+AZUL_LIGHT, borderRadius:'7px', padding:'6px 4px', fontSize:'11px', fontWeight:'600', color:AZUL_DARK, cursor:'pointer' }}>
                          {at.l}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={()=>setFiltroPanelAberto(false)}
                      style={{ flex:1, background:AZUL, color:'white', border:'none', borderRadius:'8px', padding:'9px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
                      Aplicar
                    </button>
                    <button onClick={limparFiltro}
                      style={{ background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', cursor:'pointer' }}>
                      Limpar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Filtro profissional */}
          {profissionais.length > 1 && (
            <select value={filtroProfissional} onChange={e=>setFiltroProfissional(e.target.value)}
              style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'8px', padding:'5px 8px', fontSize:'12px', color:'white', cursor:'pointer', outline:'none', maxWidth:'130px' }}>
              <option value="todos" style={{ color:'#374151' }}>Todos</option>
              {profissionais.map((p: any) => <option key={p.id} value={p.nome} style={{ color:'#374151' }}>{p.nome}</option>)}
            </select>
          )}

          {/* Botão Horários Livres */}
          {profissionais.length > 0 && (
            <button onClick={()=>{ setPainelLivres(v=>!v); if(!livresProfSel && profissionais.length>0) setLivresProfSel(profissionais[0].id) }}
              style={{ marginLeft:'auto', background: painelLivres ? 'white' : 'rgba(255,255,255,0.18)', border:'1px solid '+(painelLivres ? AZUL_LIGHT : 'rgba(255,255,255,0.35)'), borderRadius:'8px', padding:'5px 11px', cursor:'pointer', color: painelLivres ? AZUL_DARK : 'white', fontSize:'12px', fontWeight:'700', display:'flex', alignItems:'center', gap:'5px', transition:'all .2s' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Horários Livres
            </button>
          )}
          <div style={{ display:'flex', gap:'4px', marginLeft:'auto' }}>
            {([
              { key:'todos',    label:'Todos',      bg:'rgba(255,255,255,0.2)',  cor:'white',   bgAtivo:'white',    corAtivo:AZUL     },
              { key:'aberto',   label:'Em aberto',  bg:'rgba(255,255,255,0.1)', cor:'#93c5fd', bgAtivo:'#dbeafe',  corAtivo:'#1d4ed8' },
              { key:'fechado',  label:'Finalizados', bg:'rgba(255,255,255,0.1)', cor:'#6ee7b7', bgAtivo:'#d1fae5',  corAtivo:'#065f46' },
              { key:'cancelado',label:'Cancelados', bg:'rgba(255,255,255,0.1)', cor:'#fca5a5', bgAtivo:'#fef2f2',  corAtivo:'#b91c1c' },
            ] as const).map(op => (
              <button key={op.key} onClick={()=>setFiltroStatus(op.key)}
                style={{ background:filtroStatus===op.key?op.bgAtivo:op.bg, border:`1px solid ${filtroStatus===op.key?op.corAtivo:'rgba(255,255,255,0.25)'}`, borderRadius:'7px', padding:'4px 9px', cursor:'pointer', color:filtroStatus===op.key?op.corAtivo:op.cor, fontSize:'11px', fontWeight:'700', transition:'all .15s', whiteSpace:'nowrap' }}>
                {op.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cabecalho dias da semana */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:AZUL_XLIGHT, borderBottom:'1px solid '+AZUL_LIGHT, flexShrink:0 }}>
        {DIAS_SEMANA.map(d => (
          <div key={d} style={{ textAlign:'center', padding:'7px 0', fontSize:'11px', fontWeight:'700', color:AZUL, letterSpacing:'0.03em' }}>{d}</div>
        ))}
      </div>

      {/* Grade do calendario */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', flexShrink:0, borderBottom:'2px solid '+AZUL_LIGHT }}>
        {celulas.map((data, i) => {
          const iso        = toISO(data)
          const estesMes   = data.getMonth() === mesBase.getMonth()
          const ehHoje     = iso === toISO(hoje)
          const ehSel      = iso === diaSel
          const count      = contagemPorDia[iso] || 0
          const noPeriodo  = modoFiltro && (!filtroIni || iso >= filtroIni) && (!filtroFim || iso <= filtroFim) && estesMes

          return (
            <div key={i} onClick={()=>setDiaSel(iso)}
              style={{ minHeight:'50px', padding:'4px 2px', borderRight:i%7!==6?'1px solid '+AZUL_LIGHT:'none', borderBottom:'1px solid '+AZUL_LIGHT, cursor:'pointer', background:ehSel?AZUL_LIGHT:noPeriodo?'#f0f9ff':'white', transition:'background .1s', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
              <span style={{ width:'26px', height:'26px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:ehHoje||ehSel?'700':'400', background:ehSel?AZUL:ehHoje?AZUL_LIGHT:'transparent', color:ehSel?'white':ehHoje?AZUL:estesMes?'#374151':'#d1d5db' }}>
                {data.getDate()}
              </span>
              {count > 0 && estesMes && (
                <div style={{ display:'flex', gap:'2px', flexWrap:'wrap', justifyContent:'center' }}>
                  {Array.from({length:Math.min(count,3)}).map((_,k) => (
                    <div key={k} style={{ width:'6px', height:'6px', borderRadius:'50%', background:ehSel?'white':AZUL, opacity:0.75 }}/>
                  ))}
                  {count > 3 && <span style={{ fontSize:'9px', color:ehSel?'white':AZUL, fontWeight:'700' }}>+{count-3}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Header do dia selecionado */}
      <div style={{ background:'linear-gradient(135deg,'+AZUL_DARK+','+AZUL+')', padding:'9px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <span style={{ color:'white', fontSize:'13px', fontWeight:'700', textTransform:'capitalize' }}>
          {labelDia(diaSel)}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          {filtroStatus !== 'todos' && (
            <span style={{ color:'rgba(255,255,255,0.9)', fontSize:'11px', background:'rgba(255,255,255,0.2)', borderRadius:'99px', padding:'2px 8px', fontWeight:'600' }}>
              {filtroStatus === 'aberto' ? 'Em aberto' : filtroStatus === 'fechado' ? 'Finalizados' : 'Cancelados'}
            </span>
          )}
          <span style={{ color:'rgba(255,255,255,0.75)', fontSize:'11px', background:'rgba(255,255,255,0.15)', borderRadius:'99px', padding:'2px 10px' }}>
            {agsDia.length} agend.
          </span>
        </div>
      </div>

      {/* Lista de horarios */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {agsDia.length === 0 ? (
          <div style={{ padding:'28px 20px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>
            <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:AZUL_XLIGHT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={AZUL_LIGHT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            {filtroStatus === 'todos' ? 'Nenhum agendamento neste dia' :
             filtroStatus === 'aberto' ? 'Nenhum agendamento em aberto' :
             filtroStatus === 'fechado' ? 'Nenhum agendamento finalizado' :
             'Nenhum agendamento cancelado'}
          </div>
        ) : (
          <div style={{ padding:'8px 12px', display:'flex', flexDirection:'column', gap:'7px' }}>
            {agsDia.map(ag => {
              const hora        = fmtHora(ag.horaInicio)
              const isFinalizado = ag.status === 'fechado'
              const isCancelado  = ag.status === 'cancelado'
              const borda = isFinalizado ? '#10b981' : isCancelado ? '#e11d48' : AZUL
              const bg    = isFinalizado ? '#f0fdf4' : isCancelado ? '#fff1f2' : AZUL_XLIGHT
              return (
                <div key={ag.id} onClick={()=>onAbrirEdicao(ag)}
                  style={{ display:'flex', flexDirection:'column', gap:'8px', padding:'11px 12px', borderRadius:'12px', background:bg, border:'1px solid '+(isFinalizado?'#bbf7d0':isCancelado?'#fecdd3':AZUL_LIGHT), borderLeft:'3px solid '+borda, cursor:'pointer', transition:'filter .1s' }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.filter='brightness(0.97)'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.filter='none'}}>
                  {/* Linha 1: hora + cliente + serviço */}
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'46px', textAlign:'center', flexShrink:0, background:'white', borderRadius:'8px', padding:'4px 3px', border:'1px solid '+(isFinalizado?'#bbf7d0':isCancelado?'#fecdd3':AZUL_LIGHT) }}>
                      <p style={{ fontSize:'13px', fontWeight:'800', color:isFinalizado?'#059669':isCancelado?'#e11d48':AZUL, fontFamily:'monospace', letterSpacing:'-0.5px' }}>{hora}</p>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'1px' }}>
                        <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:isFinalizado?'#10b981':isCancelado?'#e11d48':AZUL, flexShrink:0 }}/>
                        <p style={{ fontSize:'13px', fontWeight:'700', color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ag.cliente}</p>
                      </div>
                      <p style={{ fontSize:'11px', color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingLeft:'11px' }}>{ag.servico||ag.profissional}</p>
                    </div>
                    {/* Status icon */}
                    {isFinalizado && (
                      <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'#d1fae5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                    {isCancelado && (
                      <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'#ffe4e6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </div>
                    )}
                  </div>
                  {/* Linha 2: botões de ação */}
                  {!isFinalizado && !isCancelado && (onEnviarWpp || onCancelarRapido || onFinalizarRapido) && (
                    <div style={{ display:'flex', gap:'6px', paddingLeft:'56px' }} onClick={e=>e.stopPropagation()}>
                      {onEnviarWpp && (
                        <button onClick={e=>{ e.stopPropagation(); onEnviarWpp(ag) }} title="Enviar confirmação WhatsApp"
                          style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'7px', padding:'5px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', fontSize:'10px', fontWeight:'700', color:'#16a34a' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#16a34a">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.7 0-3.286-.467-4.641-1.28l-.333-.198-3.454.98.94-3.417-.216-.35A7.97 7.97 0 0 1 4 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/>
                          </svg>
                          WPP
                        </button>
                      )}
                      {onCancelarRapido && (
                        <button onClick={e=>{ e.stopPropagation(); onCancelarRapido(ag) }}
                          style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'7px', padding:'5px 10px', fontSize:'11px', fontWeight:'700', color:'#ef4444', cursor:'pointer' }}>
                          Cancelar
                        </button>
                      )}
                      {onFinalizarRapido && (
                        <button onClick={e=>{ e.stopPropagation(); onFinalizarRapido(ag) }}
                          style={{ background:'#ecfdf5', border:'1px solid #6ee7b7', borderRadius:'7px', padding:'5px 10px', fontSize:'11px', fontWeight:'700', color:'#059669', cursor:'pointer' }}>
                          Finalizar
                        </button>
                      )}
                    </div>
                  )}
                  {isFinalizado && onVerPagamentos && (
                    <div style={{ display:'flex', gap:'6px', paddingLeft:'56px' }}>
                      <button onClick={e=>{ e.stopPropagation(); onVerPagamentos(ag) }}
                        style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'7px', padding:'5px 10px', fontSize:'11px', fontWeight:'700', color:'#2563eb', cursor:'pointer' }}>
                        Ver pagamento
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Botao novo */}
      <div style={{ padding:'12px 16px', borderTop:'1px solid '+AZUL_LIGHT, display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
        {onAbrirNovo && (
        <button onClick={onAbrirNovo}
          style={{ width:'50px', height:'50px', borderRadius:'50%', background:'linear-gradient(135deg,'+AZUL_DARK+','+AZUL+')', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(37,99,235,0.35)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          PAINEL: Horários Livres
          ═══════════════════════════════════════════════════ */}
      {painelLivres && (
        <>
          {/* Overlay */}
          <div onClick={()=>setPainelLivres(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.35)', zIndex:190, backdropFilter:'blur(2px)' }}/>

          {/* Painel */}
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:191, width:'min(96vw, 720px)', maxHeight:'88vh', display:'flex', flexDirection:'column', borderRadius:'20px', overflow:'hidden', boxShadow:'0 25px 80px rgba(29,78,216,0.22), 0 0 0 1px rgba(37,99,235,0.12)' }}>

            {/* Header do painel */}
            <div style={{ background:'linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)', padding:'20px 22px 18px', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'12px', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <h2 style={{ fontSize:'17px', fontWeight:'800', color:'white', letterSpacing:'-0.3px', margin:0 }}>Horários Livres</h2>
                    <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.7)', margin:0 }}>Disponibilidade por profissional</p>
                  </div>
                </div>
                <button onClick={()=>setPainelLivres(false)} style={{ width:'32px', height:'32px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Controles: profissional + semana */}
              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                {/* Select profissional */}
                <select value={livresProfSel} onChange={e=>setLivresProfSel(e.target.value)}
                  style={{ background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.35)', borderRadius:'10px', padding:'7px 12px', fontSize:'13px', fontWeight:'600', color:'white', cursor:'pointer', outline:'none', flex:'1', minWidth:'140px' }}>
                  {profissionais.map((p:any) => <option key={p.id} value={p.id} style={{ color:'#1e3a5f' }}>{p.nome}</option>)}
                </select>

                {/* Navegação de semana */}
                <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(255,255,255,0.12)', borderRadius:'10px', padding:'4px 6px' }}>
                  <button onClick={()=>setLivresSemana(v=>v-1)} style={{ width:'28px', height:'28px', borderRadius:'7px', background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span style={{ fontSize:'12px', fontWeight:'600', color:'white', minWidth:'130px', textAlign:'center' }}>{labelSemana}</span>
                  <button onClick={()=>setLivresSemana(v=>v+1)} style={{ width:'28px', height:'28px', borderRadius:'7px', background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  {livresSemana !== 0 && (
                    <button onClick={()=>setLivresSemana(0)} style={{ background:'rgba(255,255,255,0.25)', border:'none', borderRadius:'7px', padding:'4px 8px', color:'white', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>Hoje</button>
                  )}
                </div>
              </div>
            </div>

            {/* Corpo do painel */}
            <div style={{ background:'#f0f6ff', overflowY:'auto', flex:1 }}>
              {!livresProfSel ? (
                <div style={{ textAlign:'center', padding:'48px 24px', color:'#94a3b8' }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.5" style={{ display:'block', margin:'0 auto 12px' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <p style={{ fontSize:'14px', fontWeight:'600', color:'#64748b' }}>Selecione um profissional</p>
                </div>
              ) : (
                <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'12px' }}>
                  {diasSemana.map(dia => {
                    const iso = toISO(dia)
                    const slots = slotsLivresPorDia[iso]
                    const isHoje = iso === toISO(hoje)
                    const isPast = dia < hoje
                    const totalLivres  = slots?.livre.length   ?? 0
                    const totalOcupado = slots?.ocupado.length ?? 0
                    const semExpediente = !slots || (totalLivres === 0 && totalOcupado === 0)

                    return (
                      <div key={iso} style={{ background: isHoje ? 'white' : isPast ? '#f8fafc' : 'white', borderRadius:'14px', border: isHoje ? '2px solid #2563eb' : '1px solid #dbeafe', overflow:'hidden', opacity: isPast ? 0.65 : 1, boxShadow: isHoje ? '0 4px 16px rgba(37,99,235,0.12)' : '0 1px 3px rgba(29,78,216,0.06)' }}>
                        {/* Header do dia */}
                        <div style={{ background: isHoje ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : '#eff6ff', padding:'10px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <p style={{ fontSize:'12px', fontWeight:'800', color: isHoje ? 'white' : '#1d4ed8', textTransform:'capitalize', margin:0 }}>
                              {dia.toLocaleDateString('pt-BR',{weekday:'short',timeZone:'America/Sao_Paulo'}).replace('.','').toUpperCase()}
                            </p>
                            <p style={{ fontSize:'18px', fontWeight:'800', color: isHoje ? 'white' : '#1e40af', lineHeight:1, margin:0 }}>
                              {dia.toLocaleDateString('pt-BR',{day:'2-digit',timeZone:'America/Sao_Paulo'})}
                            </p>
                          </div>
                          {!semExpediente && (
                            <div style={{ textAlign:'right' }}>
                              <p style={{ fontSize:'10px', color: isHoje ? 'rgba(255,255,255,0.8)' : '#60a5fa', margin:0, fontWeight:'600' }}>{totalLivres} livres</p>
                              {totalOcupado > 0 && <p style={{ fontSize:'10px', color: isHoje ? 'rgba(255,255,255,0.6)' : '#93c5fd', margin:0 }}>{totalOcupado} ocupados</p>}
                            </div>
                          )}
                        </div>

                        {/* Slots */}
                        <div style={{ padding:'10px 12px 12px', display:'flex', flexDirection:'column', gap:'4px', minHeight:'60px' }}>
                          {semExpediente ? (
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, paddingTop:'8px' }}>
                              <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'4px' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </div>
                              <p style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'600', textAlign:'center', margin:0 }}>Folga</p>
                            </div>
                          ) : (
                            <>
                              {/* Slots livres */}
                              {slots?.livre.map(min => (
                                <div key={min} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 8px', background:'#eff6ff', borderRadius:'7px', border:'1px solid #bfdbfe' }}>
                                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#22c55e', flexShrink:0 }}/>
                                  <span style={{ fontSize:'12px', fontWeight:'700', color:'#1d4ed8', fontFamily:'monospace' }}>{minParaHora(min)}</span>
                                  <span style={{ fontSize:'10px', color:'#60a5fa', marginLeft:'auto', fontWeight:'600' }}>livre</span>
                                </div>
                              ))}
                              {/* Slots ocupados */}
                              {slots?.ocupado.map(min => (
                                <div key={min} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 8px', background:'#f8fafc', borderRadius:'7px', border:'1px solid #e2e8f0', opacity:0.7 }}>
                                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#f87171', flexShrink:0 }}/>
                                  <span style={{ fontSize:'12px', fontWeight:'700', color:'#94a3b8', fontFamily:'monospace', textDecoration:'line-through' }}>{minParaHora(min)}</span>
                                  <span style={{ fontSize:'10px', color:'#f87171', marginLeft:'auto', fontWeight:'600' }}>ocupado</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div style={{ background:'white', padding:'12px 22px', borderTop:'1px solid #dbeafe', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#22c55e' }}/>
                  <span style={{ fontSize:'11px', color:'#64748b', fontWeight:'600' }}>Horário livre</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#f87171' }}/>
                  <span style={{ fontSize:'11px', color:'#64748b', fontWeight:'600' }}>Ocupado</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#94a3b8' }}/>
                  <span style={{ fontSize:'11px', color:'#64748b', fontWeight:'600' }}>Folga</span>
                </div>
              </div>
              {profSelecionadoNome && (
                <span style={{ fontSize:'12px', color:'#1d4ed8', fontWeight:'700', background:'#eff6ff', padding:'4px 10px', borderRadius:'99px', border:'1px solid #bfdbfe' }}>
                  {profSelecionadoNome}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
