'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'

function toISO(d: Date) { return d.toISOString().slice(0,10) }
function hojeISO() { return toISO(new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}))) }
function primeiroDiaMes() { const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'})); return toISO(new Date(d.getFullYear(),d.getMonth(),1)) }
function formatMoeda(v: number) { return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2}) }

type ProfRel = {
  id: string; nome: string
  atendimentos: number; valor_total: number
  finalizados: number; cancelados: number; abertos: number
}

export default function RelProfissionalPage() {
  const { empresaAtiva } = useEmpresa()
  const perm = usePermissao('rel_profissional')
  const router = useRouter()
  const [ini, setIni] = useState(primeiroDiaMes())
  const [fim, setFim] = useState(hojeISO())
  const [dados, setDados] = useState<ProfRel[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!perm.carregando && !perm.visualizar) router.replace('/dashboard/agenda')
  }, [perm, router])

  const buscar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    // Buscar profissionais ativos (campo status, nao ativo)
    const { data: profs } = await sb.from('profissionais')
      .select('id,nome').eq('empresa_id', empresaAtiva.id).eq('status', 'ativo').order('nome')
    // Buscar todos agendamentos do periodo (prof_id OU profissional_id)
    const { data: ags } = await sb.from('agendamentos')
      .select('id,prof_id,profissional_id,status,valor')
      .eq('empresa_id', empresaAtiva.id)
      .gte('data_inicio', ini + 'T00:00:00')
      .lte('data_inicio', fim + 'T23:59:59')
    const lista = (profs || []).map((p: any) => {
      // Usar prof_id com fallback para profissional_id
      const mine = (ags || []).filter((a: any) =>
        (a.prof_id === p.id || a.profissional_id === p.id) && a.status !== 'cancelado'
      )
      const canc = (ags || []).filter((a: any) =>
        (a.prof_id === p.id || a.profissional_id === p.id) && a.status === 'cancelado'
      )
      const fin = mine.filter((a: any) => a.status === 'fechado')
      const abertos = mine.filter((a: any) => a.status !== 'fechado')
      return {
        id: p.id, nome: p.nome,
        atendimentos: mine.length,
        valor_total: fin.reduce((s: number, a: any) => s + (Number(a.valor)||0), 0),
        finalizados: fin.length,
        cancelados: canc.length,
        abertos: abertos.length,
      }
    }).filter(p => p.atendimentos > 0 || p.cancelados > 0)
      .sort((a, b) => b.valor_total - a.valor_total)
    setDados(lista)
    setCarregando(false)
  }, [empresaAtiva?.id, ini, fim])

  useEffect(() => { buscar() }, [buscar])

  const totalAtend = dados.reduce((s, p) => s + p.atendimentos, 0)
  const totalValor = dados.reduce((s, p) => s + p.valor_total, 0)
  const melhor = dados[0]

  if (perm.carregando) return null

  const inp = { border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', outline:'none' }

  return (
    <div style={{ padding:'16px', maxWidth:'900px', margin:'0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>Relatorio por Profissional</h1>
        <p style={{ fontSize:'13px', color:'#6b7280' }}>Desempenho e atendimentos por profissional no periodo</p>
      </div>

      {/* Filtro de periodo */}
      <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', marginBottom:'20px', flexWrap:'wrap' }}>
        <div>
          <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>De</label>
          <input type="date" value={ini} onChange={e=>setIni(e.target.value)} style={inp}/>
        </div>
        <div>
          <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>Ate</label>
          <input type="date" value={fim} onChange={e=>setFim(e.target.value)} style={inp}/>
        </div>
        <button onClick={buscar} disabled={carregando} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
          {carregando ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {/* Cards de resumo */}
      {dados.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'12px', marginBottom:'20px' }}>
          {[
            { label:'Total atendimentos', valor: totalAtend + ' atend.', cor:'#6366f1', bg:'#eef2ff' },
            { label:'Faturamento total', valor: formatMoeda(totalValor), cor:'#059669', bg:'#ecfdf5' },
            { label:'Profissionais ativos', valor: dados.length + ' prof.', cor:'#2563eb', bg:'#eff6ff' },
            { label:'Ticket medio', valor: formatMoeda(totalAtend > 0 ? totalValor/totalAtend : 0), cor:'#d97706', bg:'#fffbeb' },
          ].map((c, i) => (
            <div key={i} style={{ background:c.bg, borderRadius:'12px', padding:'14px 16px', border:`1px solid ${c.cor}22` }}>
              <p style={{ fontSize:'11px', color:'#6b7280', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>{c.label}</p>
              <p style={{ fontSize:'20px', fontWeight:'800', color:c.cor }}>{c.valor}</p>
            </div>
          ))}
        </div>
      )}

      {/* Melhor profissional */}
      {melhor && (
        <div style={{ background:'linear-gradient(135deg,#f59e0b,#d97706)', borderRadius:'14px', padding:'16px 20px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'16px' }}>
          <div style={{ fontSize:'32px' }}>🏆</div>
          <div>
            <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.05em' }}>Melhor profissional do periodo</p>
            <p style={{ color:'white', fontSize:'18px', fontWeight:'800', marginTop:'2px' }}>{melhor.nome}</p>
            <p style={{ color:'rgba(255,255,255,0.85)', fontSize:'13px', marginTop:'2px' }}>
              {melhor.finalizados} atendimentos finalizados — {formatMoeda(melhor.valor_total)}
            </p>
          </div>
        </div>
      )}

      {/* Tabela/Cards de ranking */}
      {carregando ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div>
      ) : dados.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', background:'#f9fafb', borderRadius:'12px' }}>
          <p style={{ fontSize:'16px', marginBottom:'8px' }}>Nenhum dado no periodo</p>
          <p style={{ fontSize:'13px' }}>Tente selecionar outro intervalo de datas</p>
        </div>
      ) : (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', overflow:'hidden' }}>
          {/* Header tabela */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:'8px', padding:'12px 16px', background:'#f8faff', borderBottom:'1px solid #f0f0f8' }}>
            {['Profissional','Atend.','Finaliz.','Cancelad.','Faturamento'].map((h,i) => (
              <p key={i} style={{ fontSize:'11px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.04em', textAlign: i > 0 ? 'center' : 'left' }}>{h}</p>
            ))}
          </div>
          {dados.map((p, idx) => (
            <div key={p.id} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:'8px', padding:'14px 16px', borderBottom:'1px solid #f9f9fc', alignItems:'center', background: idx === 0 ? '#fffbeb' : 'white' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'28px', height:'28px', borderRadius:'50%', background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7c3a' : '#e0e7ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'800', color: idx < 3 ? 'white' : '#6366f1', flexShrink:0 }}>
                  {idx + 1}
                </div>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827' }}>{p.nome}</p>
                  <p style={{ fontSize:'11px', color:'#9ca3af' }}>{p.abertos} em aberto</p>
                </div>
              </div>
              <p style={{ fontSize:'14px', fontWeight:'600', color:'#374151', textAlign:'center' }}>{p.atendimentos}</p>
              <p style={{ fontSize:'14px', fontWeight:'600', color:'#059669', textAlign:'center' }}>{p.finalizados}</p>
              <p style={{ fontSize:'14px', fontWeight:'600', color:'#dc2626', textAlign:'center' }}>{p.cancelados}</p>
              <p style={{ fontSize:'14px', fontWeight:'700', color:'#111827', textAlign:'center' }}>{formatMoeda(p.valor_total)}</p>
            </div>
          ))}
          {/* Total */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:'8px', padding:'14px 16px', background:'#f8faff', borderTop:'2px solid #e0e7ff' }}>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#374151' }}>TOTAL</p>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#374151', textAlign:'center' }}>{totalAtend}</p>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#059669', textAlign:'center' }}>{dados.reduce((s,p)=>s+p.finalizados,0)}</p>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#dc2626', textAlign:'center' }}>{dados.reduce((s,p)=>s+p.cancelados,0)}</p>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#6366f1', textAlign:'center' }}>{formatMoeda(totalValor)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
