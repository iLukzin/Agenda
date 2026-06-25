'use client'
import { useState, useEffect } from 'react'

type Props = { dataExpiracao: string }

function calcular(exp: Date) {
  const diff = exp.getTime() - Date.now()
  if (diff <= 0) return { dias:0, horas:0, minutos:0, segundos:0, expirado:true }
  const totalSeg = Math.floor(diff / 1000)
  const dias     = Math.floor(totalSeg / 86400)
  const horas    = Math.floor((totalSeg % 86400) / 3600)
  const minutos  = Math.floor((totalSeg % 3600) / 60)
  const segundos = totalSeg % 60
  return { dias, horas, minutos, segundos, expirado:false }
}

function pad(n: number) { return String(n).padStart(2,'0') }

export default function BannerTrial({ dataExpiracao }: Props) {
  const exp = new Date(dataExpiracao)
  const [tempo, setTempo] = useState(calcular(exp))

  useEffect(() => {
    const t = setInterval(() => setTempo(calcular(exp)), 1000)
    return () => clearInterval(t)
  }, [dataExpiracao])

  const urgente  = tempo.dias === 0
  const muitoUrgente = tempo.dias === 0 && tempo.horas < 6

  const bgGrad = muitoUrgente
    ? 'linear-gradient(135deg,#7f1d1d,#dc2626)'
    : urgente
    ? 'linear-gradient(135deg,#b91c1c,#ef4444)'
    : tempo.dias <= 1
    ? 'linear-gradient(135deg,#92400e,#d97706)'
    : 'linear-gradient(135deg,#1e40af,#2563eb)'

  return (
    <div style={{ background:bgGrad, padding:'10px 16px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', position:'relative', overflow:'hidden' }}>
      {/* Brilho decorativo */}
      <div style={{ position:'absolute', top:'-20px', right:'120px', width:'80px', height:'80px', background:'rgba(255,255,255,0.06)', borderRadius:'50%', pointerEvents:'none' }}/>

      {/* Ícone + textos */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:0 }}>
        <span style={{ fontSize:'18px', flexShrink:0 }}>
          {muitoUrgente ? '🚨' : urgente ? '⚠️' : tempo.dias <= 1 ? '⏳' : '🎉'}
        </span>
        <div style={{ minWidth:0 }}>
          <p style={{ color:'white', fontSize:'13px', fontWeight:'800', margin:'0 0 1px', letterSpacing:'-0.2px' }}>
            {muitoUrgente ? 'Acesso expira em breve!' : urgente ? 'Último dia de teste!' : `Período de teste — ${tempo.dias} dia${tempo.dias!==1?'s':''} restante${tempo.dias!==1?'s':''}`}
          </p>
          <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'11px', margin:0 }}>
            {muitoUrgente ? 'Entre em contato agora para não perder seus dados.' : urgente ? 'Contrate hoje para continuar usando.' : 'Aproveite todas as funcionalidades gratuitamente.'}
          </p>
        </div>
      </div>

      {/* Contador regressivo */}
      <div style={{ display:'flex', alignItems:'center', gap:'4px', flexShrink:0 }}>
        {/* Dias (só mostra se > 0) */}
        {tempo.dias > 0 && (
          <>
            <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:'8px', padding:'4px 8px', textAlign:'center', minWidth:'36px' }}>
              <p style={{ color:'white', fontSize:'16px', fontWeight:'900', margin:0, lineHeight:1, fontFamily:'monospace' }}>{pad(tempo.dias)}</p>
              <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'9px', margin:'1px 0 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>dias</p>
            </div>
            <span style={{ color:'rgba(255,255,255,0.5)', fontWeight:'700', fontSize:'14px' }}>:</span>
          </>
        )}
        {/* Horas */}
        <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:'8px', padding:'4px 8px', textAlign:'center', minWidth:'36px' }}>
          <p style={{ color:'white', fontSize:'16px', fontWeight:'900', margin:0, lineHeight:1, fontFamily:'monospace' }}>{pad(tempo.horas)}</p>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'9px', margin:'1px 0 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>hrs</p>
        </div>
        <span style={{ color:'rgba(255,255,255,0.5)', fontWeight:'700', fontSize:'14px' }}>:</span>
        {/* Minutos */}
        <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:'8px', padding:'4px 8px', textAlign:'center', minWidth:'36px' }}>
          <p style={{ color:'white', fontSize:'16px', fontWeight:'900', margin:0, lineHeight:1, fontFamily:'monospace' }}>{pad(tempo.minutos)}</p>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'9px', margin:'1px 0 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>min</p>
        </div>
        <span style={{ color:'rgba(255,255,255,0.5)', fontWeight:'700', fontSize:'14px' }}>:</span>
        {/* Segundos */}
        <div style={{ background:'rgba(0,0,0,0.3)', borderRadius:'8px', padding:'4px 8px', textAlign:'center', minWidth:'36px' }}>
          <p style={{ color:'white', fontSize:'16px', fontWeight:'900', margin:0, lineHeight:1, fontFamily:'monospace' }}>{pad(tempo.segundos)}</p>
          <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'9px', margin:'1px 0 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>seg</p>
        </div>
      </div>

      {/* Botão contratar */}
      <a href={`https://wa.me/5534988018483?text=${encodeURIComponent('Olá! Quero contratar o AgendaFortitude. Estou no período de teste.')}`}
        target="_blank" rel="noopener noreferrer"
        style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(255,255,255,0.2)', color:'white', borderRadius:'8px', padding:'8px 14px', textDecoration:'none', fontSize:'12px', fontWeight:'700', whiteSpace:'nowrap', flexShrink:0, border:'1px solid rgba(255,255,255,0.3)', backdropFilter:'blur(4px)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
        </svg>
        Contratar agora
      </a>
    </div>
  )
}
