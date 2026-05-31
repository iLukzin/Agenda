'use client'
import { useState, useMemo } from 'react'

type Ag = {
  id: string; dataISO: string; horaInicio: number; duracao: number
  cliente: string; clienteId: string; servico: string; profissional: string
  cor: string; status: string; observacoes: string; forma_pagamento: string
  valor: number; motivoCancelamento?: string
}

function toISO(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
}
function hojeNoBrasil() {
  const str = new Date().toLocaleString('en-US', { timeZone:'America/Sao_Paulo' })
  const d = new Date(str); d.setHours(0,0,0,0); return d
}
function addMes(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth()+n, 1) }
function nomeMes(d: Date) { return d.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).replace(/^\w/,c=>c.toUpperCase()) }

type Props = {
  agendamentos: Ag[]
  profissionais: any[]
  onAbrirNovo: () => void
  onAbrirEdicao: (ag: Ag) => void
  filtroProfissional: string
  setFiltroProfissional: (v: string) => void
}

export default function CalendarioAgenda({ agendamentos, profissionais, onAbrirNovo, onAbrirEdicao, filtroProfissional, setFiltroProfissional }: Props) {
  const hoje = hojeNoBrasil()
  const [mesBase, setMesBase]     = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [diaSel, setDiaSel]       = useState<string>(toISO(hoje))

  const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']

  // Celulas do calendario (42 = 6 semanas)
  const celulas = useMemo(() => {
    const primeiro = new Date(mesBase.getFullYear(), mesBase.getMonth(), 1)
    const dow = primeiro.getDay() // 0=dom
    const inicio = new Date(primeiro)
    inicio.setDate(inicio.getDate() - dow)
    return Array.from({length:42}, (_,i) => {
      const d = new Date(inicio)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [mesBase])

  // Agendamentos filtrados
  const agsFiltrados = useMemo(() => {
    if (filtroProfissional === 'todos') return agendamentos
    return agendamentos.filter(a => a.profissional === filtroProfissional)
  }, [agendamentos, filtroProfissional])

  // Agendamentos do dia selecionado
  const agsDia = useMemo(() => {
    return agsFiltrados
      .filter(a => a.dataISO === diaSel && a.status !== 'cancelado')
      .sort((a,b) => a.horaInicio - b.horaInicio)
  }, [agsFiltrados, diaSel])

  // Contagem por dia para pontos no calendario
  const contagemPorDia = useMemo(() => {
    const map: Record<string,number> = {}
    agsFiltrados.forEach(a => {
      if (a.status !== 'cancelado') map[a.dataISO] = (map[a.dataISO]||0) + 1
    })
    return map
  }, [agsFiltrados])

  const LARANJA = '#f97316'
  const COR_HEADER = LARANJA

  function fmtHora(h: number) {
    const hh = Math.floor(h), mm = Math.round((h-hh)*60)
    return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0')
  }

  function labelDia(iso: string) {
    const [y,m,d] = iso.split('-').map(Number)
    const dt = new Date(y,m-1,d)
    return dt.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Sao_Paulo'})
      .replace(/^\w/,c=>c.toUpperCase())
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:'0', borderRadius:'16px', overflow:'hidden', border:'1px solid #f0f0f8', background:'white' }}>

      {/* Header laranja com mes e navegacao */}
      <div style={{ background:COR_HEADER, padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <button onClick={()=>setMesBase(d=>addMes(d,-1))}
          style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ color:'white', fontSize:'18px', fontWeight:'700', letterSpacing:'-0.3px' }}>{nomeMes(mesBase)}</span>
          <button onClick={()=>{setMesBase(new Date(hoje.getFullYear(),hoje.getMonth(),1));setDiaSel(toISO(hoje))}}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'8px', padding:'4px 10px', cursor:'pointer', color:'white', fontSize:'12px', fontWeight:'600' }}>Hoje</button>
          <button onClick={()=>{}}
            style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'8px', padding:'4px 8px', cursor:'pointer', color:'white', display:'flex', alignItems:'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </button>
        </div>
        <button onClick={()=>setMesBase(d=>addMes(d,1))}
          style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Dias da semana */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'white', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
        {DIAS_SEMANA.map(d => (
          <div key={d} style={{ textAlign:'center', padding:'8px 0', fontSize:'12px', fontWeight:'600', color:'#9ca3af' }}>{d}</div>
        ))}
      </div>

      {/* Grade do calendario */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', flexShrink:0, borderBottom:'2px solid #f3f4f6' }}>
        {celulas.map((data, i) => {
          const iso = toISO(data)
          const estesMes = data.getMonth() === mesBase.getMonth()
          const ehHoje = toISO(data) === toISO(hoje)
          const ehSel  = iso === diaSel
          const count  = contagemPorDia[iso] || 0

          return (
            <div key={i} onClick={()=>setDiaSel(iso)}
              style={{ minHeight:'52px', padding:'4px 2px', borderRight:i%7!==6?'1px solid #f9fafb':'none', borderBottom:'1px solid #f9fafb', cursor:'pointer', background:ehSel?'#fff7ed':'white', transition:'background .1s', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}>
              <span style={{ width:'26px', height:'26px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:ehHoje||ehSel?'700':'400', background:ehSel?COR_HEADER:ehHoje?'#ffedd5':'transparent', color:ehSel?'white':ehHoje?COR_HEADER:estesMes?'#374151':'#d1d5db' }}>
                {data.getDate()}
              </span>
              {count > 0 && estesMes && (
                <div style={{ display:'flex', gap:'2px', flexWrap:'wrap', justifyContent:'center' }}>
                  {Array.from({length:Math.min(count,3)}).map((_,k) => (
                    <div key={k} style={{ width:'6px', height:'6px', borderRadius:'50%', background:ehSel?'white':COR_HEADER, opacity:0.8 }}/>
                  ))}
                  {count > 3 && <span style={{ fontSize:'9px', color:ehSel?'white':COR_HEADER, fontWeight:'700' }}>+{count-3}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lista de horarios do dia selecionado */}
      <div style={{ flex:1, overflowY:'auto', padding:'0' }}>
        <div style={{ background:COR_HEADER, padding:'10px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:'white', fontSize:'13px', fontWeight:'700', textTransform:'capitalize' }}>
            {labelDia(diaSel)}
          </span>
          <span style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px' }}>{agsDia.length} agend.</span>
        </div>

        {agsDia.length === 0 ? (
          <div style={{ padding:'32px 20px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>
            <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            Nenhum agendamento
          </div>
        ) : (
          <div style={{ padding:'8px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
            {agsDia.map(ag => {
              const hora = fmtHora(ag.horaInicio)
              const isFinalizado = ag.status === 'fechado'
              const borda = isFinalizado ? '#10b981' : '#3b82f6'
              const bg    = isFinalizado ? '#f0fdf4' : '#eff6ff'
              return (
                <div key={ag.id} onClick={()=>onAbrirEdicao(ag)}
                  style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', borderRadius:'12px', background:bg, border:'1px solid ' + borda + '30', borderLeft:'3px solid ' + borda, cursor:'pointer' }}>
                  <div style={{ width:'52px', textAlign:'center', flexShrink:0, background:'white', borderRadius:'8px', padding:'6px 4px' }}>
                    <p style={{ fontSize:'15px', fontWeight:'800', color:COR_HEADER, fontFamily:'monospace', letterSpacing:'-0.5px' }}>{hora}</p>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:isFinalizado?'#10b981':'#3b82f6', flexShrink:0 }}/>
                      <p style={{ fontSize:'14px', fontWeight:'700', color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ag.cliente}</p>
                    </div>
                    <p style={{ fontSize:'12px', color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ag.servico || ag.profissional}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Botao + flutuante */}
      <div style={{ padding:'14px 18px', borderTop:'1px solid #f3f4f6', display:'flex', justifyContent:'flex-end', flexShrink:0 }}>
        <button onClick={onAbrirNovo}
          style={{ width:'52px', height:'52px', borderRadius:'50%', background:COR_HEADER, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(249,115,22,0.4)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
  )
}
