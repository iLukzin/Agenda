'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

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

const DIAS_PT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Converte hex → HSL
function hexToHSL(hex: string): [number, number, number] {
  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255
  const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2
  if(max===min) return [0,0,Math.round(l*100)]
  const d=max-min, s=l>0.5?d/(2-max-min):d/(max+min)
  let h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4
  return [Math.round(h*60),Math.round(s*100),Math.round(l*100)]
}

// Gera paleta completa a partir da cor hex cadastrada no profissional
function paletaFromHex(hex: string) {
  const h=(hex||'#6366f1').trim().toLowerCase()
  if(h==='#ffffff'||h==='#fff')
    return { bg:'#f1f5f9', borda:'#94a3b8', texto:'#0f172a', dark:'#475569', textoBlocos:'#0f172a' }
  try {
    const [hue,sat]=hexToHSL(h)
    const s=Math.min(sat,90)
    return {
      bg:          `hsl(${hue},${Math.max(s,55)}%,82%)`,
      borda:       `hsl(${hue},${s}%,42%)`,
      texto:       '#000000',
      dark:        `hsl(${hue},${s}%,25%)`,
      textoBlocos: '#000000',
    }
  } catch {
    return { bg:'#dbeafe', borda:'#3b82f6', texto:'#000000', dark:'#1d4ed8', textoBlocos:'#000000' }
  }
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function hojeNoBrasil() {
  const s = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(s); d.setHours(0,0,0,0); return d
}
function addDias(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function addMes(d: Date, n: number)  { return new Date(d.getFullYear(), d.getMonth()+n, 1) }
function fmtHora(h: number) {
  const hh = Math.floor(h), mm = Math.round((h-hh)*60)
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
}

const HORA_INI   = 7
const HORA_FIM   = 21
const PX_POR_MIN = 2.5

export default function AgendaDia({ agendamentos, profissionais, horariosProfissional=[], onAbrirNovo, onAbrirEdicao, onCancelarRapido, onFinalizarRapido, onVerPagamentos, onEnviarWpp }: Props) {
  const hoje       = useMemo(() => hojeNoBrasil(), [])
  const [diaSel, setDiaSel]           = useState(hoje)
  const [miniCalAberto, setMiniCalAberto] = useState(false)
  const [mesBase, setMesBase]         = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [painelLivres, setPainelLivres] = useState(false)
  const [livresProfSel, setLivresProfSel] = useState('')
  const [agAtivo, setAgAtivo]   = useState<string|null>(null)
  const [popupPos, setPopupPos] = useState<{top:number; left:number; width:number}>({top:0, left:0, width:220})
  const agRefs      = useRef<Record<string, HTMLDivElement|null>>({})
  const scrollRef   = useRef<HTMLDivElement>(null)
  const calRef      = useRef<HTMLDivElement>(null)

  const isoSel       = toISO(diaSel)
  const isoHoje      = toISO(hoje)
  const isHoje       = isoSel === isoHoje
  const diaSemanaNum = diaSel.getDay()

  // Scroll para hora atual ao montar
  useEffect(() => {
    if (scrollRef.current) {
      const agora = new Date()
      const hAtual = agora.getHours() + agora.getMinutes()/60
      scrollRef.current.scrollTop = Math.max(0, (hAtual - HORA_INI) * 60 * PX_POR_MIN - 80)
    }
  }, [])

  // Fecha popup ao scrollar (qualquer direção) ou clicar fora
  useEffect(() => {
    if (!agAtivo) return
    const fechar = () => setAgAtivo(null)
    const fnClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-popup-ag]')) fechar()
    }
    const el = scrollRef.current
    document.addEventListener('mousedown', fnClick)
    el?.addEventListener('scroll', fechar, { passive: true })
    return () => {
      document.removeEventListener('mousedown', fnClick)
      el?.removeEventListener('scroll', fechar)
    }
  }, [agAtivo])

  // Fecha mini-calendário ao clicar fora
  useEffect(() => {
    if (!miniCalAberto) return
    const fn = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setMiniCalAberto(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [miniCalAberto])

  // Hora atual (linha vermelha)
  const [horaAtual, setHoraAtual] = useState<number|null>(null)
  useEffect(() => {
    const upd = () => {
      const n = new Date()
      setHoraAtual(isHoje ? n.getHours() + n.getMinutes()/60 : null)
    }
    upd()
    const t = setInterval(upd, 30000)
    return () => clearInterval(t)
  }, [isHoje])

  // Profissionais com paleta de cor
  const profsComCor = useMemo(() =>
    profissionais.map((p: any) => ({ ...p, palette: paletaFromHex(p.cor || '#6366f1') }))
  , [profissionais])

  // Agendamentos do dia
  const agsDia = useMemo(() =>
    agendamentos.filter(ag => ag.dataISO === isoSel && ag.status !== 'cancelado')
  , [agendamentos, isoSel])

  // Horário de expediente geral (menor início / maior fim entre todos profissionais hoje)
  const expedienteGeral = useMemo(() => {
    const hs = (horariosProfissional||[]).filter(h => h.dia_semana === diaSemanaNum && h.ativo)
    if (!hs.length) return null
    const inicia = hs.map(h => h.hora_inicio).sort()[0]
    const termina = hs.map(h => h.hora_fim).sort().reverse()[0]
    return `${inicia.slice(0,5)} - ${termina.slice(0,5)}`
  }, [horariosProfissional, diaSemanaNum])

  // Label do dia — "Hoje" se for hoje, senão data curta
  const labelDia = useMemo(() => {
    if (isHoje) return 'Hoje'
    const amanha = toISO(addDias(hoje, 1))
    if (isoSel === amanha) return 'Amanhã'
    return diaSel.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'short', timeZone:'America/Sao_Paulo' })
      .replace(/^\w/, c => c.toUpperCase())
  }, [isHoje, isoSel, hoje, diaSel])

  // Mini calendário — dias do mês
  const diasMes = useMemo(() => {
    const ano = mesBase.getFullYear(), mes = mesBase.getMonth()
    const primeiroDia = new Date(ano, mes, 1).getDay()
    const totalDias   = new Date(ano, mes+1, 0).getDate()
    const cells: (Date|null)[] = Array(primeiroDia).fill(null)
    for (let d=1; d<=totalDias; d++) cells.push(new Date(ano, mes, d))
    return cells
  }, [mesBase])

  const horas        = useMemo(() => Array.from({length: HORA_FIM - HORA_INI + 1}, (_, i) => HORA_INI+i), [])
  const totalAltura  = (HORA_FIM - HORA_INI) * 60 * PX_POR_MIN
  // Largura mínima por coluna — no mobile usa a largura disponível dividida por profissionais
  const COL_MIN = 110
  const headerScrollRef = useRef<HTMLDivElement>(null)

  // Sincroniza scroll horizontal entre header de colunas e grade
  function onGradeScroll(e: React.UIEvent<HTMLDivElement>) {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft
    }
  }

  function abrirPopup(e: React.MouseEvent, agId: string) {
    e.stopPropagation()
    if (agAtivo === agId) { setAgAtivo(null); return }
    const el = agRefs.current[agId]
    if (!el) { setAgAtivo(agId); return }

    const rect  = el.getBoundingClientRect()
    const vw    = window.innerWidth
    const vh    = window.innerHeight
    const isMob = vw < 520
    const popW  = isMob ? Math.min(200, vw - 24) : 210
    const popH  = 220 // altura estimada

    // Vertical: prefere abaixo, inverte se não couber
    const abaixo = rect.bottom + 6
    const acima  = rect.top - popH - 6
    let top = (abaixo + popH <= vh || rect.top < popH) ? abaixo : acima
    top = Math.max(8, Math.min(top, vh - popH - 8))

    // Horizontal: centraliza no bloco; mobile centraliza na tela
    let left = isMob
      ? (vw - popW) / 2
      : Math.max(8, Math.min(rect.left + rect.width / 2 - popW / 2, vw - popW - 8))

    setPopupPos({ top, left, width: popW })
    setAgAtivo(agId)
  }

  function selDia(d: Date) { setDiaSel(d); setMiniCalAberto(false) }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#f8fafc', overflow:'hidden' }}>

      {/* ══════════════════ HEADER SUTIL ══════════════════ */}
      <div style={{ background:'white', flexShrink:0 }}>

        {/* Linha superior — label dia + mini-cal trigger + ações */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px 0' }}>

          {/* Clique → abre mini-cal */}
          <div ref={calRef} style={{ position:'relative' }}>
            <button onClick={()=>setMiniCalAberto(v=>!v)}
              style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', cursor:'pointer', padding:'4px 6px', borderRadius:'8px' }}>
              <span style={{ fontSize:'20px', fontWeight:'800', color:'#1e293b', letterSpacing:'-0.5px' }}>{labelDia}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: miniCalAberto ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {!isHoje && (
              <span style={{ fontSize:'12px', color:'#94a3b8', paddingLeft:'6px' }}>
                {diaSel.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'})}
              </span>
            )}
            {expedienteGeral && (
              <p style={{ fontSize:'12px', color:'#94a3b8', margin:'0 0 0 6px', paddingTop:'1px' }}>{expedienteGeral}</p>
            )}

            {/* ── Mini calendário dropdown ── */}
            {miniCalAberto && (
              <div style={{ position:'absolute', top:'calc(100% + 8px)', left:0, zIndex:300, background:'white', borderRadius:'16px', boxShadow:'0 8px 40px rgba(15,23,42,0.18)', padding:'16px', width:'280px', border:'1px solid #e2e8f0' }}>
                {/* Cabeçalho do mês */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                  <button onClick={()=>setMesBase(addMes(mesBase,-1))} style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <span style={{ fontSize:'14px', fontWeight:'700', color:'#1e293b' }}>
                    {MESES_PT[mesBase.getMonth()]} {mesBase.getFullYear()}
                  </span>
                  <button onClick={()=>setMesBase(addMes(mesBase,1))} style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>

                {/* Dias da semana */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'6px' }}>
                  {DIAS_PT.map(d => (
                    <div key={d} style={{ textAlign:'center', fontSize:'10px', fontWeight:'700', color:'#94a3b8', padding:'4px 0' }}>{d}</div>
                  ))}
                </div>

                {/* Células */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
                  {diasMes.map((d, i) => {
                    if (!d) return <div key={i}/>
                    const iso    = toISO(d)
                    const isHj   = iso === isoHoje
                    const isSel  = iso === isoSel
                    const temAg  = agendamentos.some(ag => ag.dataISO === iso && ag.status !== 'cancelado')
                    return (
                      <button key={i} onClick={()=>selDia(d)}
                        style={{ padding:'5px 2px', borderRadius:'8px', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px',
                          background: isSel ? '#2563eb' : isHj ? '#eff6ff' : 'transparent',
                        }}>
                        <span style={{ fontSize:'13px', fontWeight: isHj||isSel ? '800' : '500', color: isSel ? 'white' : isHj ? '#2563eb' : '#374151' }}>{d.getDate()}</span>
                        {temAg && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background: isSel ? 'rgba(255,255,255,0.7)' : '#2563eb' }}/>}
                      </button>
                    )
                  })}
                </div>

                {/* Botão Hoje */}
                <div style={{ marginTop:'12px', display:'flex', justifyContent:'center' }}>
                  <button onClick={()=>{ selDia(hoje); setMesBase(new Date(hoje.getFullYear(), hoje.getMonth(), 1)) }}
                    style={{ padding:'6px 20px', borderRadius:'20px', border:'1px solid #2563eb', background: isHoje ? '#2563eb' : 'white', color: isHoje ? 'white' : '#2563eb', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                    Hoje
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botão Horários Livres */}
          {profissionais.length > 0 && (
            <button onClick={()=>{ setPainelLivres(v=>!v); if(!livresProfSel&&profissionais.length>0) setLivresProfSel(profissionais[0].id) }}
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'20px', border:`1.5px solid ${painelLivres?'#2563eb':'#e2e8f0'}`, background: painelLivres?'#2563eb':'white', color: painelLivres?'white':'#64748b', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Horários livres
            </button>
          )}
        </div>

        {/* Faixa de chips — profissionais */}
        <div style={{ display:'flex', gap:'8px', padding:'10px 16px 12px', overflowX:'auto', scrollbarWidth:'none' }}>
          {profsComCor.map((p: any) => {
            const temHoje = (horariosProfissional||[]).some(h => h.profissional_id===p.id && h.dia_semana===diaSemanaNum && h.ativo)
            const qtdAgs  = agsDia.filter(ag => ag.profissional===p.nome).length
            const label   = !temHoje ? 'Folga' : qtdAgs===0 ? 'Livre' : `${qtdAgs} ag.`
            return (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 10px 5px 6px', borderRadius:'20px', background:p.palette.bg, border:`1.5px solid ${p.palette.borda}`, whiteSpace:'nowrap', flexShrink:0 }}>
                <div style={{ width:'22px', height:'22px', borderRadius:'50%', background: p.cor || p.palette.dark, border:`1.5px solid ${p.palette.borda}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'800', color: (p.cor||'#000')==='#ffffff'?'#334155':'white' }}>
                  {p.nome.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize:'11px', fontWeight:'700', color:p.palette.texto, margin:0, lineHeight:1.2 }}>{p.nome}</p>
                  <p style={{ fontSize:'10px', color:p.palette.dark, margin:0, lineHeight:1.2 }}>{label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Header de colunas — scroll sincronizado com a grade */}
        <div style={{ display:'flex', borderTop:'1px solid #f1f5f9' }}>
          {/* Espaço da coluna de horas */}
          <div style={{ width:'52px', flexShrink:0, borderRight:'1px solid #e2e8f0', borderBottom:'1px solid #e2e8f0' }}/>
          {/* Colunas de profissionais com overflow oculto e scroll sync */}
          <div ref={headerScrollRef} style={{ flex:1, display:'flex', overflowX:'hidden' }}>
            {profsComCor.map((p: any) => (
              <div key={p.id} style={{ flex:1, minWidth:`${COL_MIN}px`, padding:'6px 8px', textAlign:'center', borderRight:'1px solid #f1f5f9', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
                <div style={{ width:'26px', height:'26px', borderRadius:'50%', background: p.cor || p.palette.dark, border:`1.5px solid ${p.palette.borda}`, margin:'0 auto 2px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'800', color: (p.cor||'#000')==='#ffffff'?'#334155':'white' }}>
                  {p.nome.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                </div>
                <p style={{ fontSize:'10px', fontWeight:'700', color:'#374151', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nome.split(' ')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════ GRADE ══════════════════ */}
      <div ref={scrollRef} onScroll={onGradeScroll} style={{ flex:1, overflowY:'auto', overflowX:'auto', position:'relative', WebkitOverflowScrolling:'touch' } as React.CSSProperties}>
        <div style={{ display:'flex', minHeight:`${totalAltura}px`, minWidth:`${profsComCor.length * COL_MIN + 52}px` }}>

          {/* Coluna de horas */}
          <div style={{ width:'52px', flexShrink:0, position:'sticky', left:0, background:'white', zIndex:2, borderRight:'1px solid #e2e8f0' }}>
            {horas.map(h => (
              <div key={h} style={{ position:'absolute', top:`${(h-HORA_INI)*60*PX_POR_MIN}px`, right:'8px' }}>
                <span style={{ fontSize:'10px', color:'#cbd5e1', fontWeight:'600' }}>{String(h).padStart(2,'0')}:00</span>
              </div>
            ))}
          </div>

          {/* Colunas de profissionais */}
          <div style={{ flex:1, display:'flex', position:'relative', minWidth:`${profsComCor.length * COL_MIN}px` }}>

            {/* Grade de fundo */}
            <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
              {horas.map(h => (
                <div key={h} style={{ position:'absolute', top:`${(h-HORA_INI)*60*PX_POR_MIN}px`, left:0, right:0,
                  borderTop:`1px solid ${h%1===0 ? '#f1f5f9' : '#f8fafc'}` }}/>
              ))}
              {/* Linha hora atual */}
              {horaAtual && horaAtual>=HORA_INI && horaAtual<=HORA_FIM && (
                <div style={{ position:'absolute', top:`${(horaAtual-HORA_INI)*60*PX_POR_MIN}px`, left:0, right:0, zIndex:10, display:'flex', alignItems:'center' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#ef4444', flexShrink:0, marginLeft:'-4px' }}/>
                  <div style={{ flex:1, height:'1.5px', background:'#ef4444', opacity:0.7 }}/>
                </div>
              )}
            </div>

            {profsComCor.map((p: any) => {
              const temHoje  = (horariosProfissional||[]).some(h => h.profissional_id===p.id && h.dia_semana===diaSemanaNum && h.ativo)
              const horarioDia = (horariosProfissional||[]).find(h => h.profissional_id===p.id && h.dia_semana===diaSemanaNum && h.ativo)
              const agsProf  = agsDia.filter(ag => ag.profissional===p.nome)

              return (
                <div key={p.id} style={{ flex:1, minWidth:`${COL_MIN}px`, borderRight:'1px solid #f1f5f9', position:'relative', zIndex:1 }}>
                  {/* Folga */}
                  {!temHoje && (
                    <div style={{ position:'absolute', inset:0, background:'repeating-linear-gradient(45deg,#f8fafc,#f8fafc 6px,#f1f5f9 6px,#f1f5f9 12px)', pointerEvents:'none', opacity:0.8 }}/>
                  )}
                  {/* Fundo de expediente — cinza neutro bem suave, não usa cor do profissional */}
                  {temHoje && horarioDia && (() => {
                    const [hI,mI] = horarioDia.hora_inicio.split(':').map(Number)
                    const [hF,mF] = horarioDia.hora_fim.split(':').map(Number)
                    const topPx = ((hI+mI/60)-HORA_INI)*60*PX_POR_MIN
                    const altPx = ((hF+mF/60)-(hI+mI/60))*60*PX_POR_MIN
                    return <div style={{ position:'absolute', top:`${topPx}px`, left:0, right:0, height:`${altPx}px`, background:'#f8fafc', pointerEvents:'none' }}/>
                  })()}
                  {/* Agendamentos */}
                  {agsProf.map(ag => {
                    const topPx  = (ag.horaInicio-HORA_INI)*60*PX_POR_MIN
                    const altPx  = Math.max(ag.duracao*PX_POR_MIN, 28)
                    const isFin  = ag.status==='fechado'
                    const isCanc = ag.status==='cancelado'
                    const popupAberto = agAtivo === ag.id
                    // Cor de fundo do card: usa a cor hex real do profissional com boa saturação
                    const [hue,sat] = hexToHSL(p.cor||'#6366f1')
                    const cardBg = isCanc ? '#e2e8f0'
                      : isFin   ? p.palette.dark
                      : (p.cor||'#6366f1').toLowerCase()==='#ffffff' ? '#e2e8f0'
                      : `hsl(${hue},${Math.max(sat,60)}%,75%)`
                    const cardBorda = (p.cor||'#6366f1').toLowerCase()==='#ffffff' ? '#94a3b8'
                      : `hsl(${hue},${Math.max(sat,60)}%,45%)`
                    return (
                      <div key={ag.id}
                        data-popup-ag="true"
                        ref={el => { agRefs.current[ag.id] = el }}
                        style={{ position:'absolute', top:`${topPx}px`, left:'3px', right:'3px', zIndex: popupAberto ? 20 : 3 }}>
                        {/* Bloco do agendamento */}
                        <div onClick={e => abrirPopup(e, ag.id)}
                          style={{ height:`${altPx}px`,
                            background: cardBg,
                            border:`1.5px solid ${cardBorda}`,
                            borderLeft:`4px solid ${cardBorda}`,
                            borderRadius:'6px', cursor:'pointer', overflow:'hidden', padding:'3px 5px',
                            boxShadow: popupAberto ? `0 0 0 2px ${cardBorda}` : '0 1px 4px rgba(0,0,0,0.12)',
                            opacity: isCanc ? 0.6 : 1,
                          }}>
                          {/* Linha 1: horário + serviço na mesma linha */}
                          <div style={{ display:'flex', alignItems:'center', gap:'4px', justifyContent:'space-between' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'4px', minWidth:0, flex:1 }}>
                              <span style={{ fontSize:'11px', fontWeight:'900',
                                color: isFin ? 'white' : '#000000',
                                fontFamily:'monospace', flexShrink:0,
                                textShadow: isFin ? 'none' : '0 0 1px rgba(0,0,0,0.3)' }}>
                                {fmtHora(ag.horaInicio)}
                              </span>
                              {ag.servico && (
                                <span style={{ fontSize:'10px', fontWeight:'700',
                                  color: isFin ? 'rgba(255,255,255,0.85)' : '#1a1a1a',
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                                  textShadow: isFin ? 'none' : '0 0 1px rgba(0,0,0,0.2)' }}>
                                  · {ag.servico}
                                </span>
                              )}
                            </div>
                            {isFin && (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" style={{ flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </div>
                          {/* Linha 2: nome do cliente */}
                          <p style={{ fontSize:'12px', fontWeight:'900',
                            color: isFin ? 'white' : '#000000',
                            margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                            textShadow: isFin ? 'none' : '0 0 1px rgba(0,0,0,0.3)',
                            letterSpacing:'-0.2px' }}>
                            {ag.cliente}
                          </p>
                        </div>

                        {/* Popup compacto — position:fixed com posição calculada */}
                        {popupAberto && (
                          <div data-popup-ag="true" onClick={e=>e.stopPropagation()}
                            style={{ position:'fixed', top:`${popupPos.top}px`, left:`${popupPos.left}px`, width:`${popupPos.width}px`, zIndex:9999,
                              background:'white', borderRadius:'12px', border:'1px solid #e2e8f0',
                              boxShadow:'0 6px 24px rgba(15,23,42,0.16)', overflow:'hidden' }}>

                            {/* Topo colorido com info */}
                            <div style={{ background: isFin?'#f0fdf4':isCanc?'#f8fafc':'#eff6ff', padding:'8px 10px', borderBottom:'1px solid #f1f5f9' }}>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                                <p style={{ fontSize:'12px', fontWeight:'700', color:'#1e293b', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'75%' }}>{ag.cliente}</p>
                                <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'99px',
                                  background: isFin?'#dcfce7':isCanc?'#f1f5f9':'#fef9c3',
                                  color:      isFin?'#15803d':isCanc?'#64748b':'#92400e',
                                  flexShrink:0 }}>
                                  {isFin?'Finalizado':isCanc?'Cancelado':'Em aberto'}
                                </span>
                              </div>
                              <p style={{ fontSize:'10px', color:'#64748b', margin:'2px 0 0' }}>{fmtHora(ag.horaInicio)}{ag.servico ? ` · ${ag.servico}` : ''}</p>
                            </div>

                            {/* Botões compactos */}
                            <div style={{ padding:'6px' }}>
                              <button onClick={e=>{ e.stopPropagation(); setAgAtivo(null); onAbrirEdicao(ag) }}
                                style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%', background:'none', border:'none', borderRadius:'7px', padding:'7px 8px', fontSize:'12px', fontWeight:'600', color:'#374151', cursor:'pointer', textAlign:'left' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Editar agendamento
                              </button>

                              {!isFin && !isCanc && (<>
                                {onEnviarWpp && (
                                  <button onClick={e=>{ e.stopPropagation(); setAgAtivo(null); onEnviarWpp(ag) }}
                                    style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%', background:'none', border:'none', borderRadius:'7px', padding:'7px 8px', fontSize:'12px', fontWeight:'600', color:'#16a34a', cursor:'pointer', textAlign:'left' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                                    WhatsApp
                                  </button>
                                )}
                                {onFinalizarRapido && (
                                  <button onClick={e=>{ e.stopPropagation(); setAgAtivo(null); onFinalizarRapido(ag) }}
                                    style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%', background:'none', border:'none', borderRadius:'7px', padding:'7px 8px', fontSize:'12px', fontWeight:'700', color:'#059669', cursor:'pointer', textAlign:'left' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    Finalizar
                                  </button>
                                )}
                                {onCancelarRapido && (
                                  <button onClick={e=>{ e.stopPropagation(); setAgAtivo(null); onCancelarRapido(ag) }}
                                    style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%', background:'none', border:'none', borderRadius:'7px', padding:'7px 8px', fontSize:'12px', fontWeight:'700', color:'#ef4444', cursor:'pointer', textAlign:'left' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    Cancelar
                                  </button>
                                )}
                              </>)}

                              {isFin && onVerPagamentos && (
                                <button onClick={e=>{ e.stopPropagation(); setAgAtivo(null); onVerPagamentos(ag) }}
                                  style={{ display:'flex', alignItems:'center', gap:'6px', width:'100%', background:'none', border:'none', borderRadius:'7px', padding:'7px 8px', fontSize:'12px', fontWeight:'700', color:'#2563eb', cursor:'pointer', textAlign:'left' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                  Ver pagamento
                                </button>
                              )}

                              <div style={{ height:'1px', background:'#f1f5f9', margin:'4px 0' }}/>
                              <button onClick={e=>{ e.stopPropagation(); setAgAtivo(null) }}
                                style={{ width:'100%', background:'none', border:'none', borderRadius:'7px', padding:'5px 8px', fontSize:'11px', color:'#94a3b8', cursor:'pointer' }}>
                                Fechar
                              </button>
                            </div>
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

      {/* ══════════════════ BOTÃO + NOVO ══════════════════ */}
      {onAbrirNovo && (
        <button onClick={onAbrirNovo}
          style={{ position:'fixed', bottom:'24px', right:'24px', width:'50px', height:'50px', borderRadius:'50%', background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(29,78,216,0.4)', zIndex:50 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      )}

      {/* ══════════════════ PAINEL HORÁRIOS LIVRES ══════════════════ */}
      {painelLivres && (
        <>
          <div onClick={()=>setPainelLivres(false)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.3)', zIndex:190, backdropFilter:'blur(2px)' }}/>
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:191, width:'min(96vw,520px)', maxHeight:'80vh', borderRadius:'20px', overflow:'hidden', boxShadow:'0 20px 60px rgba(29,78,216,0.2)', display:'flex', flexDirection:'column' }}>
            <div style={{ background:'linear-gradient(135deg,#1e40af,#2563eb)', padding:'16px 18px', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <h2 style={{ fontSize:'14px', fontWeight:'800', color:'white', margin:0 }}>Horários Livres</h2>
                  <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.7)' }}>· {labelDia}</span>
                </div>
                <button onClick={()=>setPainelLivres(false)} style={{ width:'26px', height:'26px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <select value={livresProfSel} onChange={e=>setLivresProfSel(e.target.value)}
                style={{ width:'100%', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'10px', padding:'7px 10px', fontSize:'13px', fontWeight:'600', color:'white', cursor:'pointer', outline:'none' }}>
                {profissionais.map((p:any)=><option key={p.id} value={p.id} style={{ color:'#1e293b' }}>{p.nome}</option>)}
              </select>
            </div>
            <div style={{ background:'#f0f6ff', overflowY:'auto', flex:1, padding:'14px' }}>
              {(() => {
                if (!livresProfSel) return null
                const prof = profsComCor.find((p:any)=>p.id===livresProfSel)
                if (!prof) return null
                const intervalo = prof.intervalo_atendimento || 30
                const horario   = (horariosProfissional||[]).find(h=>h.profissional_id===prof.id&&h.dia_semana===diaSemanaNum&&h.ativo)
                if (!horario) return <p style={{ textAlign:'center', color:'#94a3b8', padding:'24px' }}>Folga hoje.</p>
                const [hI,mI] = horario.hora_inicio.split(':').map(Number)
                const [hF,mF] = horario.hora_fim.split(':').map(Number)
                const slots: {min:number; livre:boolean; cliente?:string; status?:string}[] = []
                const agsProf = agsDia.filter(ag=>ag.profissional===prof.nome)
                for (let min=hI*60+mI; min<hF*60+mF; min+=intervalo) {
                  const ag = agsProf.find(a=>Math.round(a.horaInicio*60)===min)
                  slots.push({min, livre:!ag, cliente:ag?.cliente, status:ag?.status})
                }
                return (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px' }}>
                    {slots.map(s => {
                      const hh=String(Math.floor(s.min/60)).padStart(2,'0'), mm=String(s.min%60).padStart(2,'0')
                      const fin=s.status==='fechado'
                      return (
                        <div key={s.min} style={{ padding:'7px 10px', borderRadius:'10px', background:s.livre?'white':fin?'#dcfce7':'#fff1f2', border:`1.5px solid ${s.livre?'#bfdbfe':fin?'#86efac':'#fecdd3'}`, display:'flex', alignItems:'center', gap:'7px' }}>
                          <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:s.livre?'#22c55e':fin?'#16a34a':'#f87171', flexShrink:0 }}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'13px', fontWeight:'800', color:s.livre?'#1d4ed8':fin?'#15803d':'#9ca3af', fontFamily:'monospace', margin:0 }}>{hh}:{mm}</p>
                            {!s.livre && <p style={{ fontSize:'10px', color:fin?'#16a34a':'#e11d48', fontWeight:'600', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.cliente}{fin?' ✓':''}</p>}
                          </div>
                          {s.livre && <span style={{ fontSize:'10px', color:'#22c55e', fontWeight:'700' }}>Livre</span>}
                        </div>
                      )
                    })}
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
