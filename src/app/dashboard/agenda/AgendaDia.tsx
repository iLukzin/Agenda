'use client'
import { useState, useMemo, useRef, useEffect } from 'react'

type Ag = {
  id: string; dataISO: string; horaInicio: number; duracao: number
  cliente: string; clienteId: string; servico: string; profissional: string
  cor: string; status: string; observacoes: string; forma_pagamento: string
  valor: number; motivoCancelamento?: string
}
type HorarioDB = {
  profissional_id: string; dia_semana: number; hora_inicio: string; hora_fim: string; ativo: boolean
}
type Props = {
  agendamentos: Ag[]
  profissionais: any[]
  horariosProfissional?: HorarioDB[]
  onAbrirNovo?: () => void
  onAbrirEdicao: (ag: Ag) => void
  onCancelarRapido?: (ag: Ag) => void
  onFinalizarRapido?: (ag: Ag) => void
  onVerPagamentos?: (ag: Ag) => void
  onEnviarWpp?: (ag: Ag) => void
}

// Cores para cada profissional (mesma paleta do sistema, tons distintos)
const CORES_PROF = [
  { bg: '#d4e4bc', borda: '#8fb567', texto: '#3a5c1a', dark: '#4a7a22' }, // verde
  { bg: '#fef3c7', borda: '#f59e0b', texto: '#92400e', dark: '#b45309' }, // amarelo
  { bg: '#dbeafe', borda: '#3b82f6', texto: '#1e40af', dark: '#1d4ed8' }, // azul
  { bg: '#fce7f3', borda: '#ec4899', texto: '#9d174d', dark: '#be185d' }, // rosa
  { bg: '#d1fae5', borda: '#10b981', texto: '#065f46', dark: '#059669' }, // teal
  { bg: '#ede9fe', borda: '#8b5cf6', texto: '#4c1d95', dark: '#6d28d9' }, // roxo
  { bg: '#fee2e2', borda: '#ef4444', texto: '#991b1b', dark: '#dc2626' }, // vermelho
  { bg: '#fed7aa', borda: '#f97316', texto: '#9a3412', dark: '#ea580c' }, // laranja
]

function toISO(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function hojeNoBrasil() {
  const s = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(s); d.setHours(0,0,0,0); return d
}
function addDias(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function fmtHora(h: number) {
  const hh = Math.floor(h), mm = Math.round((h-hh)*60)
  return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0')
}
function fmtData(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit', timeZone:'America/Sao_Paulo' })
}
function nomeDiaSemana(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday:'long', timeZone:'America/Sao_Paulo' })
    .replace(/^\w/, c => c.toUpperCase())
}
function nomeMes(d: Date) {
  return d.toLocaleDateString('pt-BR', { month:'long', year:'numeric', timeZone:'America/Sao_Paulo' })
    .replace(/^\w/, c => c.toUpperCase())
}

const HORA_INI = 7  // grade começa às 07:00
const HORA_FIM = 21 // grade termina às 21:00
const PX_POR_MIN = 2.5 // pixels por minuto

const STATUS_LABEL: Record<string,string> = {
  aberto: 'Em aberto',
  fechado: 'Finalizado',
  cancelado: 'Cancelado',
}

export default function AgendaDia({ agendamentos, profissionais, horariosProfissional = [], onAbrirNovo, onAbrirEdicao, onCancelarRapido, onFinalizarRapido, onVerPagamentos, onEnviarWpp }: Props) {
  const hoje = hojeNoBrasil()
  const [diaSel, setDiaSel] = useState(hoje)
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [painelHorLivres, setPainelHorLivres] = useState(false)
  const [livresProfSel, setLivresProfSel] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const isoSel = toISO(diaSel)

  // Scroll automático para horário atual ao carregar
  useEffect(() => {
    if (scrollRef.current) {
      const agora = new Date()
      const hAtual = agora.getHours() + agora.getMinutes()/60
      const top = (hAtual - HORA_INI) * PX_POR_MIN * 60 - 80
      scrollRef.current.scrollTop = Math.max(0, top)
    }
  }, [])

  // Dias da semana atual
  const inicioSemana = useMemo(() => {
    const d = addDias(hoje, semanaOffset * 7)
    const dow = d.getDay()
    return addDias(d, -(dow === 0 ? 6 : dow - 1))
  }, [hoje, semanaOffset])

  const diasSemana = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDias(inicioSemana, i))
  , [inicioSemana])

  // Profissionais com cor atribuída
  const profsComCor = useMemo(() =>
    profissionais.map((p: any, i: number) => ({
      ...p,
      palette: CORES_PROF[i % CORES_PROF.length],
    }))
  , [profissionais])

  // Agendamentos do dia selecionado
  const agsDia = useMemo(() =>
    agendamentos.filter(ag => ag.dataISO === isoSel && ag.status !== 'cancelado')
  , [agendamentos, isoSel])

  // Horário de trabalho do dia selecionado por profissional
  const diaSemanaNum = diaSel.getDay()

  // Horas da grade (07 a 21)
  const horas = useMemo(() =>
    Array.from({ length: HORA_FIM - HORA_INI + 1 }, (_, i) => HORA_INI + i)
  , [])

  // Hora atual para linha vermelha
  const [horaAtual, setHoraAtual] = useState<number | null>(null)
  useEffect(() => {
    const upd = () => {
      const agora = new Date()
      const h = agora.getHours() + agora.getMinutes()/60 + agora.getSeconds()/3600
      setHoraAtual(toISO(hoje) === isoSel ? h : null)
    }
    upd()
    const t = setInterval(upd, 60000)
    return () => clearInterval(t)
  }, [isoSel, hoje])

  const totalAltura = (HORA_FIM - HORA_INI) * 60 * PX_POR_MIN

  // Largura de cada coluna de profissional
  const colWidth = Math.max(120, Math.floor(100 / Math.max(profsComCor.length, 1)))

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f8fafc', overflow:'hidden' }}>

      {/* ─── Header ─── */}
      <div style={{ background:'white', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>

        {/* Linha 1: navegação de dia/semana */}
        <div style={{ padding:'10px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
          {/* Setas de semana */}
          <button onClick={()=>{ setSemanaOffset(v=>v-1) }} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          {/* Dias da semana */}
          <div style={{ flex:1, display:'flex', gap:'4px', overflowX:'auto', scrollbarWidth:'none' }}>
            {diasSemana.map(dia => {
              const iso = toISO(dia)
              const isHoje = iso === toISO(hoje)
              const isSel = iso === isoSel
              const temAg = agendamentos.some(ag => ag.dataISO === iso && ag.status !== 'cancelado')
              return (
                <button key={iso} onClick={() => setDiaSel(dia)}
                  style={{ flex:1, minWidth:'40px', padding:'6px 4px', borderRadius:'10px', border: isSel ? '2px solid #3b82f6' : '1px solid transparent', background: isSel ? '#eff6ff' : isHoje ? '#f8fafc' : 'transparent', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                  <span style={{ fontSize:'10px', fontWeight:'600', color: isSel ? '#3b82f6' : '#94a3b8', textTransform:'uppercase' }}>
                    {dia.toLocaleDateString('pt-BR',{weekday:'short',timeZone:'America/Sao_Paulo'}).replace('.','').toUpperCase()}
                  </span>
                  <span style={{ fontSize:'17px', fontWeight:'800', color: isSel ? '#1d4ed8' : isHoje ? '#1e293b' : '#475569', width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background: isHoje && !isSel ? '#e2e8f0' : 'transparent' }}>
                    {dia.getDate()}
                  </span>
                  {temAg && <div style={{ width:'5px', height:'5px', borderRadius:'50%', background: isSel ? '#3b82f6' : '#94a3b8' }}/>}
                </button>
              )
            })}
          </div>

          <button onClick={()=>{ setSemanaOffset(v=>v+1) }} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          {semanaOffset !== 0 && (
            <button onClick={()=>{ setSemanaOffset(0); setDiaSel(hoje) }} style={{ padding:'5px 10px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', fontSize:'12px', color:'#3b82f6', fontWeight:'600', whiteSpace:'nowrap' }}>Hoje</button>
          )}
        </div>

        {/* Linha 2: profissionais + horários livres */}
        <div style={{ display:'flex', alignItems:'center', padding:'0 16px 10px', gap:'8px' }}>
          <div style={{ flex:1, display:'flex', gap:'6px', overflowX:'auto', scrollbarWidth:'none' }}>
            {profsComCor.map((p: any) => {
              const temHoje = (horariosProfissional||[]).some(h => h.profissional_id === p.id && h.dia_semana === diaSemanaNum && h.ativo)
              const qtdAgs = agsDia.filter(ag => ag.profissional === p.nome).length
              return (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 10px', borderRadius:'20px', background: p.palette.bg, border:`1.5px solid ${p.palette.borda}`, whiteSpace:'nowrap' }}>
                  <div style={{ width:'24px', height:'24px', borderRadius:'50%', background: p.palette.dark, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'800', color:'white', flexShrink:0 }}>
                    {p.nome.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize:'12px', fontWeight:'700', color: p.palette.texto, margin:0 }}>{p.nome}</p>
                    <p style={{ fontSize:'10px', color: p.palette.dark, margin:0 }}>
                      {!temHoje ? 'Folga' : qtdAgs === 0 ? 'Livre' : `${qtdAgs} agend.`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={()=>{ setPainelHorLivres(v=>!v); if (!livresProfSel && profissionais.length > 0) setLivresProfSel(profissionais[0].id) }}
            style={{ padding:'6px 12px', borderRadius:'8px', border:'1px solid #bfdbfe', background: painelHorLivres ? '#2563eb' : '#eff6ff', color: painelHorLivres ? 'white' : '#1d4ed8', fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, display:'flex', alignItems:'center', gap:'5px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Horários Livres
          </button>
        </div>
      </div>

      {/* ─── Grade de horários ─── */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {/* Header de colunas por profissional */}
        <div style={{ display:'flex', background:'white', borderBottom:'1px solid #e2e8f0', flexShrink:0, marginLeft:'52px', overflowX:'auto' }}>
          {profsComCor.map((p: any) => (
            <div key={p.id} style={{ minWidth:`${colWidth}px`, flex:1, padding:'8px 6px', textAlign:'center', borderRight:'1px solid #f1f5f9' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'50%', background: p.palette.dark, margin:'0 auto 3px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'800', color:'white' }}>
                {p.nome.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <p style={{ fontSize:'11px', fontWeight:'700', color:'#374151', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nome}</p>
            </div>
          ))}
        </div>

        {/* Área scrollável */}
        <div ref={scrollRef} style={{ flex:1, overflowY:'auto', overflowX:'auto', position:'relative' }}>
          <div style={{ display:'flex', minHeight:`${totalAltura}px` }}>

            {/* Coluna de horas */}
            <div style={{ width:'52px', flexShrink:0, position:'sticky', left:0, background:'white', zIndex:2, borderRight:'1px solid #e2e8f0' }}>
              {horas.map(h => (
                <div key={h} style={{ position:'absolute', top:`${(h - HORA_INI) * 60 * PX_POR_MIN}px`, right:'8px', lineHeight:1 }}>
                  <span style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'600' }}>{String(h).padStart(2,'0')}:00</span>
                </div>
              ))}
            </div>

            {/* Colunas por profissional */}
            <div style={{ flex:1, display:'flex', position:'relative', minWidth:`${profsComCor.length * colWidth}px` }}>

              {/* Linhas de hora (fundo) */}
              <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
                {horas.map(h => (
                  <div key={h} style={{ position:'absolute', top:`${(h - HORA_INI) * 60 * PX_POR_MIN}px`, left:0, right:0, borderTop:`1px solid ${h % 2 === 0 ? '#e2e8f0' : '#f1f5f9'}` }}/>
                ))}
                {/* Linha do horário atual */}
                {horaAtual && horaAtual >= HORA_INI && horaAtual <= HORA_FIM && (
                  <div style={{ position:'absolute', top:`${(horaAtual - HORA_INI) * 60 * PX_POR_MIN}px`, left:0, right:0, zIndex:10, display:'flex', alignItems:'center' }}>
                    <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:'#ef4444', flexShrink:0, marginLeft:'-5px' }}/>
                    <div style={{ flex:1, height:'2px', background:'#ef4444' }}/>
                  </div>
                )}
              </div>

              {/* Uma coluna por profissional */}
              {profsComCor.map((p: any, colIdx: number) => {
                const temHoje = (horariosProfissional||[]).some(h => h.profissional_id === p.id && h.dia_semana === diaSemanaNum && h.ativo)
                const horarioDia = (horariosProfissional||[]).find(h => h.profissional_id === p.id && h.dia_semana === diaSemanaNum && h.ativo)
                const agsProf = agsDia.filter(ag => ag.profissional === p.nome)

                return (
                  <div key={p.id} style={{ flex:1, minWidth:`${colWidth}px`, borderRight:'1px solid #f1f5f9', position:'relative', zIndex:1 }}>
                    {/* Fundo de folga */}
                    {!temHoje && (
                      <div style={{ position:'absolute', inset:0, background:'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 8px, #f1f5f9 8px, #f1f5f9 16px)', opacity:0.7, pointerEvents:'none' }}/>
                    )}

                    {/* Expediente do profissional (fundo claro) */}
                    {temHoje && horarioDia && (() => {
                      const [hI, mI] = horarioDia.hora_inicio.split(':').map(Number)
                      const [hF, mF] = horarioDia.hora_fim.split(':').map(Number)
                      const topPx = ((hI + mI/60) - HORA_INI) * 60 * PX_POR_MIN
                      const altPx = ((hF + mF/60) - (hI + mI/60)) * 60 * PX_POR_MIN
                      return (
                        <div style={{ position:'absolute', top:`${topPx}px`, left:0, right:0, height:`${altPx}px`, background: p.palette.bg, opacity:0.25, pointerEvents:'none' }}/>
                      )
                    })()}

                    {/* Agendamentos */}
                    {agsProf.map(ag => {
                      const topPx  = (ag.horaInicio - HORA_INI) * 60 * PX_POR_MIN
                      const altPx  = Math.max(ag.duracao * PX_POR_MIN, 30)
                      const isFin  = ag.status === 'fechado'
                      return (
                        <div key={ag.id}
                          onClick={() => onAbrirEdicao(ag)}
                          style={{ position:'absolute', top:`${topPx}px`, left:'3px', right:'3px', height:`${altPx}px`, background: isFin ? `${p.palette.dark}cc` : p.palette.bg, border:`1.5px solid ${p.palette.borda}`, borderRadius:'8px', cursor:'pointer', overflow:'hidden', padding:'4px 6px', zIndex:3,
                            boxShadow: isFin ? 'none' : '0 2px 6px rgba(0,0,0,0.08)',
                            opacity: isFin ? 0.8 : 1,
                          }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <p style={{ fontSize:'11px', fontWeight:'800', color: isFin ? 'white' : p.palette.texto, margin:0, lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                              {ag.horaInicio < 10 ? '0' : ''}{fmtHora(ag.horaInicio)} - {fmtHora(ag.horaInicio + ag.duracao/60)}
                            </p>
                            {isFin && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginLeft:'2px' }}><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </div>
                          <p style={{ fontSize:'11px', fontWeight:'700', color: isFin ? 'rgba(255,255,255,0.9)' : p.palette.texto, margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {ag.cliente}
                          </p>
                          {altPx > 45 && (
                            <p style={{ fontSize:'10px', color: isFin ? 'rgba(255,255,255,0.7)' : p.palette.dark, margin:'1px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {ag.servico}
                            </p>
                          )}
                          {isFin && altPx > 55 && (
                            <div style={{ position:'absolute', bottom:'3px', left:'4px', right:'4px', background:'rgba(255,255,255,0.2)', borderRadius:'4px', padding:'1px 5px' }}>
                              <span style={{ fontSize:'9px', color:'white', fontWeight:'700' }}>FINALIZADO</span>
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
      </div>

      {/* ─── Botão + Novo ─── */}
      {onAbrirNovo && (
        <button onClick={onAbrirNovo} style={{ position:'fixed', bottom:'24px', right:'24px', width:'52px', height:'52px', borderRadius:'50%', background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(29,78,216,0.4)', zIndex:50 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      )}

      {/* ─── Painel Horários Livres ─── */}
      {painelHorLivres && (
        <>
          <div onClick={()=>setPainelHorLivres(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.35)', zIndex:190, backdropFilter:'blur(2px)' }}/>
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:191, width:'min(96vw,580px)', maxHeight:'80vh', borderRadius:'20px', overflow:'hidden', boxShadow:'0 25px 80px rgba(29,78,216,0.22)', display:'flex', flexDirection:'column' }}>
            <div style={{ background:'linear-gradient(135deg,#1e40af,#2563eb,#3b82f6)', padding:'18px 20px', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'12px', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <h2 style={{ fontSize:'15px', fontWeight:'800', color:'white', margin:0 }}>Horários Livres</h2>
                    <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.7)', margin:0 }}>{nomeDiaSemana(diaSel)} · {diaSel.toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                <button onClick={()=>setPainelHorLivres(false)} style={{ width:'30px', height:'30px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <select value={livresProfSel} onChange={e=>setLivresProfSel(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.35)', borderRadius:'10px', padding:'7px 12px', fontSize:'13px', fontWeight:'600', color:'white', cursor:'pointer', outline:'none' }}>
                {profissionais.map((p:any) => <option key={p.id} value={p.id} style={{ color:'#1e3a5f' }}>{p.nome}</option>)}
              </select>
            </div>
            <div style={{ background:'#f0f6ff', overflowY:'auto', flex:1, padding:'16px' }}>
              {(() => {
                if (!livresProfSel) return null
                const prof = profsComCor.find((p:any) => p.id === livresProfSel)
                if (!prof) return null
                const intervalo = prof.intervalo_atendimento || 30
                const horario = (horariosProfissional||[]).find(h => h.profissional_id === prof.id && h.dia_semana === diaSemanaNum && h.ativo)
                if (!horario) return (
                  <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>
                    <p style={{ fontSize:'14px', fontWeight:'600' }}>{prof.nome} está de folga hoje.</p>
                  </div>
                )
                const [hI, mI] = horario.hora_inicio.split(':').map(Number)
                const [hF, mF] = horario.hora_fim.split(':').map(Number)
                const inicioMin = hI*60 + mI, fimMin = hF*60 + mF
                const slots: { min: number; livre: boolean; cliente?: string; status?: string }[] = []
                const agsProf = agsDia.filter(ag => ag.profissional === prof.nome)
                for (let min = inicioMin; min < fimMin; min += intervalo) {
                  const agNoSlot = agsProf.find(ag => Math.round(ag.horaInicio * 60) === min)
                  slots.push({ min, livre: !agNoSlot, cliente: agNoSlot?.cliente, status: agNoSlot?.status })
                }
                return (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                    {slots.map(s => {
                      const hh = String(Math.floor(s.min/60)).padStart(2,'0')
                      const mm = String(s.min%60).padStart(2,'0')
                      const isFin = s.status === 'fechado'
                      return (
                        <div key={s.min} style={{ padding:'8px 12px', borderRadius:'10px', background: s.livre ? 'white' : isFin ? '#dcfce7' : '#fff1f2', border:`1.5px solid ${s.livre ? '#bfdbfe' : isFin ? '#86efac' : '#fecdd3'}`, display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: s.livre ? '#22c55e' : isFin ? '#16a34a' : '#f87171', flexShrink:0 }}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'13px', fontWeight:'800', color: s.livre ? '#1d4ed8' : isFin ? '#15803d' : '#9ca3af', fontFamily:'monospace', margin:0 }}>{hh}:{mm}</p>
                            {!s.livre && <p style={{ fontSize:'10px', color: isFin ? '#16a34a' : '#e11d48', fontWeight:'600', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.cliente}{isFin ? ' ✓' : ''}</p>}
                          </div>
                          {s.livre && <span style={{ fontSize:'10px', color:'#22c55e', fontWeight:'700' }}>Livre</span>}
                        </div>
                      )
                    })}
                    {slots.length === 0 && <p style={{ gridColumn:'1/-1', textAlign:'center', color:'#94a3b8', padding:'20px' }}>Nenhum slot disponível.</p>}
                  </div>
                )
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
