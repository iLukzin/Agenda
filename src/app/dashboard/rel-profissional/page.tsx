'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'

function toISO(d: Date) { return d.toISOString().slice(0,10) }
function hojeISO() { return toISO(new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'}))) }
function primeiroDiaMes() { const d = new Date(new Date().toLocaleString('en-US',{timeZone:'America/Sao_Paulo'})); return toISO(new Date(d.getFullYear(),d.getMonth(),1)) }
function formatMoeda(v: number) { return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) }
function labelForma(f: string) {
  const m: Record<string,string> = { dinheiro:'Dinheiro', pix:'PIX', cartao_credito:'Cartão Crédito', cartao_debito:'Cartão Débito', transferencia:'Transferência', plano:'Plano Mensal' }
  if (!f) return 'Não informado'
  if (f.includes('+')) return f.split('+').map((x:string) => m[x]||x).join(' + ')
  return m[f] || f
}
const FORMAS_LABEL: Record<string,string> = { dinheiro:'Dinheiro', pix:'PIX', cartao_credito:'Cartão Crédito', cartao_debito:'Cartão Débito', transferencia:'Transferência', plano:'Plano Mensal' }
const FORMAS_CORES: Record<string,{bg:string,cor:string,icon:string}> = {
  dinheiro:    { bg:'#ecfdf5', cor:'#059669', icon:'💵' },
  pix:         { bg:'#eff6ff', cor:'#2563eb', icon:'📱' },
  cartao_credito: { bg:'#faf5ff', cor:'#7c3aed', icon:'💳' },
  cartao_debito:  { bg:'#fdf4ff', cor:'#a21caf', icon:'💳' },
  transferencia:  { bg:'#fff7ed', cor:'#ea580c', icon:'🏦' },
  plano:       { bg:'#f0fdf4', cor:'#16a34a', icon:'📋' },
  outro:       { bg:'#f8fafc', cor:'#64748b', icon:'💰' },
}
const inp = { border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', outline:'none' as const, background:'white' }

function exportarCSV(nomeArquivo: string, linhas: string[][]) {
  const bom = '\uFEFF'
  const sep = '\n'
  const csv = bom + linhas.map(linha => linha.map(cell => '"' + String(cell).replace(/"/g,'""') + '"').join(';')).join(sep)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nomeArquivo + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function RelProfissionalPage() {
  const { empresaAtiva } = useEmpresa()
  const perm = usePermissao('rel_profissional')
  const router = useRouter()
  const [aba, setAba] = useState<'profissional'|'forma_pag'|'mensal'>('profissional')
  const [ini, setIni] = useState(primeiroDiaMes())
  const [fim, setFim] = useState(hojeISO())
  const [profFiltro, setProfFiltro] = useState('todos')
  const [carregando, setCarregando] = useState(false)
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [agendamentos, setAgendamentos] = useState<any[]>([])

  useEffect(() => { if (!perm.carregando && !perm.visualizar) router.replace('/dashboard/agenda') }, [perm, router])

  const buscar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    const [r1, r2] = await Promise.all([
      sb.from('profissionais').select('id,nome').eq('empresa_id', empresaAtiva.id).eq('status','ativo').order('nome'),
      sb.from('agendamentos').select('id,prof_id,profissional_id,status,valor,forma_pagamento,pagamentos,data_inicio').eq('empresa_id', empresaAtiva.id).gte('data_inicio', ini+'T00:00:00').lte('data_inicio', fim+'T23:59:59')
    ])
    setProfissionais(r1.data || [])
    setAgendamentos((r2.data || []).map((a: any) => ({ ...a, pagamentosArr: (() => { try { return a.pagamentos ? JSON.parse(a.pagamentos) : null } catch { return null } })() })))
    setCarregando(false)
  }, [empresaAtiva?.id, ini, fim])

  useEffect(() => { buscar() }, [buscar])
  if (perm.carregando) return null

  // Relatório 1: Por Profissional
  const dadosProf = profissionais.map((p: any) => {
    const mine = agendamentos.filter((a: any) => a.prof_id===p.id || a.profissional_id===p.id)
    const fin  = mine.filter((a: any) => a.status==='fechado')
    const canc = mine.filter((a: any) => a.status==='cancelado')
    const aber = mine.filter((a: any) => a.status==='aberto')
    return { id:p.id, nome:p.nome, fin:fin.length, canc:canc.length, aber:aber.length, fat:fin.reduce((s: number,a: any)=>s+(Number(a.valor)||0),0) }
  }).filter(p=>p.fin>0||p.canc>0).sort((a,b)=>b.fat-a.fat)
  const totalFat = dadosProf.reduce((s,p)=>s+p.fat,0)
  const totalFin = dadosProf.reduce((s,p)=>s+p.fin,0)

  // Relatório 2: Por Profissional × Forma
  function getFormasPorProf() {
    const profs = profFiltro==='todos' ? profissionais : profissionais.filter((p: any)=>p.id===profFiltro)
    return profs.map((p: any) => {
      const fin = agendamentos.filter((a: any)=>(a.prof_id===p.id||a.profissional_id===p.id)&&a.status==='fechado')
      const formaMap: Record<string,{qtd:number,valor:number}> = {}
      fin.forEach((a: any) => {
        const pags = a.pagamentosArr
        if (pags && pags.length>0) {
          pags.forEach((pg: any) => { const f=pg.forma||'outro'; if(!formaMap[f])formaMap[f]={qtd:0,valor:0}; formaMap[f].qtd++; formaMap[f].valor+=Number(pg.valor)||0 })
        } else {
          const f = a.forma_pagamento||'outro'
          if (f.includes('+')) { f.split('+').forEach((pt: string)=>{ const p2=pt.trim(); if(!formaMap[p2])formaMap[p2]={qtd:0,valor:0}; formaMap[p2].qtd++; formaMap[p2].valor+=(Number(a.valor)||0)/f.split('+').length }) }
          else { if(!formaMap[f])formaMap[f]={qtd:0,valor:0}; formaMap[f].qtd++; formaMap[f].valor+=Number(a.valor)||0 }
        }
      })
      return { prof:p, formas:Object.entries(formaMap).sort((a,b)=>b[1].valor-a[1].valor), totalFin:fin.length, totalValor:fin.reduce((s: number,a: any)=>s+(Number(a.valor)||0),0) }
    }).filter(p=>p.totalFin>0)
  }

  // Relatório 3: Mensal
  function getMensal() {
    const mesMap: Record<string,Record<string,{qtd:number,valor:number}>> = {}
    agendamentos.filter((a: any)=>a.status==='fechado').forEach((a: any) => {
      const mes = a.data_inicio?.slice(0,7)||'desconhecido'
      if (!mesMap[mes]) mesMap[mes]={}
      const pags = a.pagamentosArr
      if (pags&&pags.length>0) {
        pags.forEach((pg: any)=>{ const f=pg.forma||'outro'; if(!mesMap[mes][f])mesMap[mes][f]={qtd:0,valor:0}; mesMap[mes][f].qtd++; mesMap[mes][f].valor+=Number(pg.valor)||0 })
      } else {
        const f=a.forma_pagamento||'outro'
        if(f.includes('+')){ f.split('+').forEach((pt: string)=>{ const p2=pt.trim(); if(!mesMap[mes][p2])mesMap[mes][p2]={qtd:0,valor:0}; mesMap[mes][p2].qtd++; mesMap[mes][p2].valor+=(Number(a.valor)||0)/f.split('+').length }) }
        else { if(!mesMap[mes][f])mesMap[mes][f]={qtd:0,valor:0}; mesMap[mes][f].qtd++; mesMap[mes][f].valor+=Number(a.valor)||0 }
      }
    })
    const formas = Array.from(new Set(Object.values(mesMap).flatMap(m=>Object.keys(m)))).sort()
    return { mesMap, meses:Object.keys(mesMap).sort(), todasFormas:formas }
  }

  const formasPorProf = getFormasPorProf()
  const { mesMap, meses, todasFormas } = getMensal()
  const abaStyle = (a: string) => ({ padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'600' as const, cursor:'pointer' as const, border:'none', background:aba===a?'#6366f1':'transparent', color:aba===a?'white':'#6b7280', transition:'all .15s' })

  return (
    <div style={{ padding:'16px', maxWidth:'960px', margin:'0 auto' }}>
      <div style={{ marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>Relatórios</h1>
          <p style={{ fontSize:'13px', color:'#6b7280' }}>Análise de atendimentos, faturamento e formas de pagamento</p>
        </div>
        <button onClick={()=>{
          const periodo = ini + ' a ' + fim
          if (aba === 'profissional') {
            const header = ['Profissional','Finalizados','Abertos','Cancelados','Faturamento (R$)','Ticket Medio (R$)']
            const linhas = dadosProf.map(p => [p.nome, p.fin, p.aber, p.canc, p.fat.toFixed(2).replace('.',','), (p.fin>0?p.fat/p.fin:0).toFixed(2).replace('.',',')])
            linhas.push(['TOTAL', dadosProf.reduce((s,p)=>s+p.fin,0), dadosProf.reduce((s,p)=>s+p.aber,0), dadosProf.reduce((s,p)=>s+p.canc,0), totalFat.toFixed(2).replace('.',','), (totalFin>0?totalFat/totalFin:0).toFixed(2).replace('.',',')])
            exportarCSV('relatorio-profissional-' + periodo, [['Periodo: ' + periodo], [], header, ...linhas])
          } else if (aba === 'forma_pag') {
            const header = ['Profissional','Forma de Pagamento','Qtd Pagamentos','Valor (R$)','%']
            const linhas: string[][] = []
            formasPorProf.forEach(({ prof, formas, totalValor: tv }) => {
              formas.forEach(([forma, dados]) => {
                linhas.push([prof.nome, FORMAS_LABEL[forma]||forma, String(dados.qtd), dados.valor.toFixed(2).replace('.',','), tv>0?(dados.valor/tv*100).toFixed(1)+'%':'0%'])
              })
            })
            exportarCSV('relatorio-pagamentos-' + periodo, [['Periodo: ' + periodo], [], header, ...linhas])
          } else {
            const header = ['Mes', ...todasFormas.map(f => FORMAS_LABEL[f]||f), 'Total']
            const linhas = meses.map(mes => {
              const [ano, m] = mes.split('-')
              const nomeMes = new Date(Number(ano),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
              const totalMes = Object.values(mesMap[mes]).reduce((s,f)=>s+f.valor,0)
              return [nomeMes, ...todasFormas.map(f => mesMap[mes][f]?.valor ? mesMap[mes][f].valor.toFixed(2).replace('.',',') : '0,00'), totalMes.toFixed(2).replace('.',',')]
            })
            const totRow = ['TOTAL', ...todasFormas.map(f => meses.reduce((s,mes)=>s+(mesMap[mes][f]?.valor||0),0).toFixed(2).replace('.',',')), meses.reduce((s,mes)=>s+Object.values(mesMap[mes]).reduce((ss,f)=>ss+f.valor,0),0).toFixed(2).replace('.',',')]
            exportarCSV('relatorio-mensal-' + periodo, [['Periodo: ' + periodo], [], header, ...linhas, totRow])
          }
        }} style={{ display:'flex', alignItems:'center', gap:'6px', background:'#059669', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
      </div>
      <div style={{ display:'flex', gap:'4px', background:'#f8fafc', borderRadius:'10px', padding:'4px', marginBottom:'20px', flexWrap:'wrap' }}>
        <button onClick={()=>setAba('profissional')} style={abaStyle('profissional')}>Por Profissional</button>
        <button onClick={()=>setAba('forma_pag')} style={abaStyle('forma_pag')}>Profissional × Pagamento</button>
        <button onClick={()=>setAba('mensal')} style={abaStyle('mensal')}>Mensal por Pagamento</button>
      </div>
      <div style={{ display:'flex', gap:'12px', alignItems:'flex-end', marginBottom:'20px', flexWrap:'wrap', background:'#f8fafc', borderRadius:'12px', padding:'14px' }}>
        <div><label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:'#6b7280', marginBottom:'4px' }}>DE</label><input type="date" value={ini} onChange={e=>setIni(e.target.value)} style={inp}/></div>
        <div><label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:'#6b7280', marginBottom:'4px' }}>ATÉ</label><input type="date" value={fim} onChange={e=>setFim(e.target.value)} style={inp}/></div>
        {aba==='forma_pag' && <div><label style={{ display:'block', fontSize:'11px', fontWeight:'600', color:'#6b7280', marginBottom:'4px' }}>PROFISSIONAL</label><select value={profFiltro} onChange={e=>setProfFiltro(e.target.value)} style={inp}><option value="todos">Todos</option>{profissionais.map((p: any)=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>}
        <button onClick={buscar} disabled={carregando} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>{carregando?'Buscando...':'🔍 Buscar'}</button>
      </div>

      {/* ABA 1 */}
      {aba==='profissional' && (
        <div>
          {dadosProf.length>0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'10px', marginBottom:'20px' }}>
              {[{label:'Faturamento',valor:formatMoeda(totalFat),cor:'#059669',bg:'#ecfdf5'},{label:'Atendimentos',valor:totalFin+' finalizados',cor:'#6366f1',bg:'#eef2ff'},{label:'Profissionais',valor:dadosProf.length+' ativos',cor:'#2563eb',bg:'#eff6ff'},{label:'Ticket Médio',valor:formatMoeda(totalFin>0?totalFat/totalFin:0),cor:'#d97706',bg:'#fffbeb'}].map((c,i)=>(
                <div key={i} style={{ background:c.bg, borderRadius:'12px', padding:'14px 16px', border:`1px solid ${c.cor}22` }}>
                  <p style={{ fontSize:'11px', color:'#6b7280', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>{c.label}</p>
                  <p style={{ fontSize:'18px', fontWeight:'800', color:c.cor }}>{c.valor}</p>
                </div>
              ))}
            </div>
          )}
          {dadosProf.length===0&&!carregando&&<div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Nenhum dado no período</div>}
          {dadosProf.length>0 && (
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f0', overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  {['Profissional','Finalizados','Abertos','Cancelados','Faturamento','Ticket Médio'].map(h=><th key={h} style={{ padding:'12px 14px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.03em', borderBottom:'2px solid #e5e7eb' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {dadosProf.map((p,i)=>(
                    <tr key={p.id} style={{ borderBottom:'1px solid #f3f4f6', background:i%2===0?'white':'#fafafa' }}>
                      <td style={{ padding:'12px 14px', fontWeight:'600', color:'#111827' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'11px', fontWeight:'700', flexShrink:0 }}>{p.nome.charAt(0)}</div>
                          {p.nome}
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px' }}><span style={{ background:'#ecfdf5', color:'#059669', padding:'3px 8px', borderRadius:'6px', fontWeight:'600', fontSize:'12px' }}>{p.fin}</span></td>
                      <td style={{ padding:'12px 14px' }}><span style={{ background:'#eff6ff', color:'#2563eb', padding:'3px 8px', borderRadius:'6px', fontWeight:'600', fontSize:'12px' }}>{p.aber}</span></td>
                      <td style={{ padding:'12px 14px' }}><span style={{ background:'#fef2f2', color:'#ef4444', padding:'3px 8px', borderRadius:'6px', fontWeight:'600', fontSize:'12px' }}>{p.canc}</span></td>
                      <td style={{ padding:'12px 14px', fontWeight:'700', color:'#059669', fontSize:'14px' }}>{formatMoeda(p.fat)}</td>
                      <td style={{ padding:'12px 14px', color:'#6b7280' }}>{formatMoeda(p.fin>0?p.fat/p.fin:0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background:'#f0fdf4', borderTop:'2px solid #6ee7b7' }}>
                  <td style={{ padding:'12px 14px', fontWeight:'700', color:'#065f46' }}>TOTAL</td>
                  <td style={{ padding:'12px 14px', fontWeight:'700', color:'#059669' }}>{dadosProf.reduce((s,p)=>s+p.fin,0)}</td>
                  <td style={{ padding:'12px 14px', fontWeight:'700', color:'#2563eb' }}>{dadosProf.reduce((s,p)=>s+p.aber,0)}</td>
                  <td style={{ padding:'12px 14px', fontWeight:'700', color:'#ef4444' }}>{dadosProf.reduce((s,p)=>s+p.canc,0)}</td>
                  <td style={{ padding:'12px 14px', fontWeight:'800', color:'#059669', fontSize:'15px' }}>{formatMoeda(totalFat)}</td>
                  <td style={{ padding:'12px 14px', fontWeight:'700', color:'#6b7280' }}>{formatMoeda(totalFin>0?totalFat/totalFin:0)}</td>
                </tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA 2 */}
      {aba==='forma_pag' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {formasPorProf.length===0&&!carregando&&<div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Nenhum atendimento finalizado no período</div>}
          {formasPorProf.map(({ prof, formas, totalFin: tf, totalValor: tv }) => (
            <div key={prof.id} style={{ background:'white', borderRadius:'14px', border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <div style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'14px', fontWeight:'700' }}>{prof.nome.charAt(0)}</div>
                  <div><p style={{ color:'white', fontWeight:'700', fontSize:'15px' }}>{prof.nome}</p><p style={{ color:'rgba(255,255,255,0.7)', fontSize:'12px' }}>{tf} atendimento{tf!==1?'s':''} finalizado{tf!==1?'s':''}</p></div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:'10px', padding:'8px 14px', textAlign:'center' }}>
                  <p style={{ color:'rgba(255,255,255,0.7)', fontSize:'10px', textTransform:'uppercase' }}>Total</p>
                  <p style={{ color:'white', fontSize:'18px', fontWeight:'800' }}>{formatMoeda(tv)}</p>
                </div>
              </div>
              <div style={{ padding:'16px', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:'10px' }}>
                {formas.map(([forma, dados]) => {
                  const c = FORMAS_CORES[forma]||FORMAS_CORES.outro
                  const pct = tv>0?(dados.valor/tv*100):0
                  return (
                    <div key={forma} style={{ background:c.bg, borderRadius:'10px', padding:'12px', border:`1px solid ${c.cor}22` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                        <span style={{ fontSize:'18px' }}>{c.icon}</span>
                        <p style={{ fontSize:'12px', fontWeight:'700', color:c.cor }}>{FORMAS_LABEL[forma]||labelForma(forma)}</p>
                      </div>
                      <p style={{ fontSize:'18px', fontWeight:'800', color:c.cor, marginBottom:'4px' }}>{formatMoeda(dados.valor)}</p>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'11px', color:'#6b7280' }}>{dados.qtd} pgto{dados.qtd!==1?'s':''}</span>
                        <span style={{ fontSize:'11px', fontWeight:'600', color:c.cor, background:'rgba(255,255,255,0.6)', padding:'1px 6px', borderRadius:'4px' }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ marginTop:'6px', background:'rgba(255,255,255,0.5)', borderRadius:'99px', height:'4px', overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:c.cor, borderRadius:'99px' }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA 3 */}
      {aba==='mensal' && (
        <div>
          {meses.length===0&&!carregando&&<div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Nenhum atendimento finalizado no período</div>}
          {meses.length>0 && <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:'10px', marginBottom:'20px' }}>
              {todasFormas.map(forma => {
                const c = FORMAS_CORES[forma]||FORMAS_CORES.outro
                const tot = meses.reduce((s,mes)=>s+(mesMap[mes][forma]?.valor||0),0)
                const qtd = meses.reduce((s,mes)=>s+(mesMap[mes][forma]?.qtd||0),0)
                if(tot===0) return null
                return (
                  <div key={forma} style={{ background:c.bg, borderRadius:'12px', padding:'14px 16px', border:`1px solid ${c.cor}22` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px' }}>
                      <span>{c.icon}</span>
                      <p style={{ fontSize:'11px', fontWeight:'700', color:c.cor, textTransform:'uppercase', letterSpacing:'0.04em' }}>{FORMAS_LABEL[forma]||forma}</p>
                    </div>
                    <p style={{ fontSize:'18px', fontWeight:'800', color:c.cor, marginBottom:'2px' }}>{formatMoeda(tot)}</p>
                    <p style={{ fontSize:'11px', color:'#6b7280' }}>{qtd} pagamento{qtd!==1?'s':''}</p>
                  </div>
                )
              })}
              <div style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', borderRadius:'12px', padding:'14px 16px' }}>
                <p style={{ fontSize:'11px', fontWeight:'700', color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>Total Geral</p>
                <p style={{ fontSize:'18px', fontWeight:'800', color:'white', marginBottom:'2px' }}>{formatMoeda(meses.reduce((s,mes)=>s+Object.values(mesMap[mes]).reduce((ss,f)=>ss+f.valor,0),0))}</p>
                <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.7)' }}>{meses.reduce((s,mes)=>s+Object.values(mesMap[mes]).reduce((ss,f)=>ss+f.qtd,0),0)} pagamentos</p>
              </div>
            </div>
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #e5e7eb', overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px', minWidth:'500px' }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  <th style={{ padding:'12px 14px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.03em', borderBottom:'2px solid #e5e7eb' }}>Mês</th>
                  {todasFormas.map(f=>{ const c=FORMAS_CORES[f]||FORMAS_CORES.outro; return <th key={f} style={{ padding:'12px 14px', textAlign:'right', fontWeight:'600', color:c.cor, fontSize:'12px', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' }}>{c.icon} {FORMAS_LABEL[f]||f}</th> })}
                  <th style={{ padding:'12px 14px', textAlign:'right', fontWeight:'700', color:'#059669', fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.03em', borderBottom:'2px solid #e5e7eb' }}>Total</th>
                </tr></thead>
                <tbody>
                  {meses.map((mes,i)=>{
                    const [ano,m] = mes.split('-')
                    const nomeMes = new Date(Number(ano),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
                    const totalMes = Object.values(mesMap[mes]).reduce((s,f)=>s+f.valor,0)
                    return (
                      <tr key={mes} style={{ borderBottom:'1px solid #f3f4f6', background:i%2===0?'white':'#fafafa' }}>
                        <td style={{ padding:'12px 14px', fontWeight:'600', color:'#111827', whiteSpace:'nowrap', textTransform:'capitalize' }}>{nomeMes}</td>
                        {todasFormas.map(f=>{ const c=FORMAS_CORES[f]||FORMAS_CORES.outro; const v=mesMap[mes][f]?.valor||0; return <td key={f} style={{ padding:'12px 14px', textAlign:'right', color:v>0?c.cor:'#d1d5db', fontWeight:v>0?'600':'400' }}>{v>0?formatMoeda(v):'—'}</td> })}
                        <td style={{ padding:'12px 14px', textAlign:'right', fontWeight:'800', color:'#059669', fontSize:'14px' }}>{formatMoeda(totalMes)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot><tr style={{ background:'#f0fdf4', borderTop:'2px solid #6ee7b7' }}>
                  <td style={{ padding:'12px 14px', fontWeight:'700', color:'#065f46' }}>TOTAL</td>
                  {todasFormas.map(f=>{ const c=FORMAS_CORES[f]||FORMAS_CORES.outro; const tot=meses.reduce((s,mes)=>s+(mesMap[mes][f]?.valor||0),0); return <td key={f} style={{ padding:'12px 14px', textAlign:'right', fontWeight:'800', color:c.cor, fontSize:'13px' }}>{tot>0?formatMoeda(tot):'—'}</td> })}
                  <td style={{ padding:'12px 14px', textAlign:'right', fontWeight:'800', color:'#059669', fontSize:'15px' }}>{formatMoeda(meses.reduce((s,mes)=>s+Object.values(mesMap[mes]).reduce((ss,f)=>ss+f.valor,0),0))}</td>
                </tr></tfoot>
              </table>
            </div>
          </>}
        </div>
      )}
    </div>
  )
}
