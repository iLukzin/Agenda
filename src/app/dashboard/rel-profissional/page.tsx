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

function exportarPDFGenerico(titulo: string, periodo: string, headers: string[], linhas: (string|number)[][], extraInfo?: string) {
  const linhasHtml = linhas.map(linha => `<tr>${linha.map((c,i)=>`<td style="${i>0 && typeof c!=='string'?'text-align:right;':''}">${c}</td>`).join('')}</tr>`).join('')
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a2e; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .sub { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f4f5fb; text-align: left; padding: 8px 10px; font-size: 11px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
      td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
      @media print { body { padding: 10px; } }
    </style>
    </head><body>
      <h1>${titulo} - AgendaFortitude</h1>
      <p class="sub">Período: ${periodo} · Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
      ${extraInfo ? `<p class="sub">${extraInfo}</p>` : ''}
      <table>
        <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${linhasHtml}</tbody>
      </table>
    </body></html>
  `
  const win = window.open('', '_blank')
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return }
  win.document.write(html)
  win.document.close()
  win.onload = () => { win.print() }
}

export default function RelProfissionalPage() {
  const { empresaAtiva } = useEmpresa()
  const perm = usePermissao('rel_profissional')
  const router = useRouter()
  const [aba, setAba] = useState<'profissional'|'forma_pag'|'mensal'|'agenda_status'>('profissional')
  const [filtroStatusAgenda, setFiltroStatusAgenda] = useState<'todos'|'aberto'|'fechado'|'cancelado'>('todos')
  const [ini, setIni] = useState(primeiroDiaMes())
  const [fim, setFim] = useState(hojeISO())
  const [profFiltro, setProfFiltro] = useState('todos')
  const [carregando, setCarregando] = useState(false)
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [agendamentos, setAgendamentos] = useState<any[]>([])

  useEffect(() => { if (!perm.carregando && !perm.visualizar) router.replace('/dashboard/agenda') }, [perm, router])

  const buscar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    const [r1, r2, r3] = await Promise.all([
      sb.from('profissionais').select('id,nome').eq('empresa_id', empresaAtiva.id).eq('status','ativo').order('nome'),
      sb.from('agendamentos').select('id,prof_id,profissional_id,cliente_id,status,valor,forma_pagamento,pagamentos,data_inicio,motivo_cancelamento').eq('empresa_id', empresaAtiva.id).gte('data_inicio', ini+'T00:00:00').lte('data_inicio', fim+'T23:59:59'),
      sb.from('clientes').select('id,nome').eq('empresa_id', empresaAtiva.id),
    ])
    setProfissionais(r1.data || [])
    setClientes(r3.data || [])
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

  // Relatório 4: Agenda por status
  const profMap: Record<string,string> = {}
  profissionais.forEach((p:any)=>{ profMap[p.id]=p.nome })
  const cliMap: Record<string,string> = {}
  clientes.forEach((c:any)=>{ cliMap[c.id]=c.nome })

  const STATUS_LABEL: Record<string,string> = { aberto:'Em aberto', fechado:'Finalizado', cancelado:'Cancelado' }
  const STATUS_CORES: Record<string,{bg:string,cor:string,badge:string}> = {
    aberto:    { bg:'#eff6ff', cor:'#2563eb', badge:'#dbeafe' },
    fechado:   { bg:'#ecfdf5', cor:'#059669', badge:'#d1fae5' },
    cancelado: { bg:'#fef2f2', cor:'#ef4444', badge:'#fee2e2' },
  }

  function getAgendaStatus() {
    return agendamentos
      .filter((a:any) => filtroStatusAgenda==='todos' ? true : a.status===filtroStatusAgenda)
      .map((a:any) => {
        const dtUTC = a.data_inicio ? new Date(a.data_inicio) : null
        const dtBRT = dtUTC ? new Date(dtUTC.getTime() - 3*60*60*1000) : null
        return {
          id: a.id,
          dataLabel: dtBRT ? dtBRT.toLocaleDateString('pt-BR',{timeZone:'UTC'}) : '-',
          horaLabel: dtBRT ? dtBRT.toLocaleTimeString('pt-BR',{timeZone:'UTC',hour:'2-digit',minute:'2-digit'}) : '-',
          dataOrd: dtBRT ? dtBRT.toISOString() : '',
          cliente: cliMap[a.cliente_id] || '-',
          profissional: profMap[a.prof_id || a.profissional_id] || '-',
          status: a.status,
          motivo: a.motivo_cancelamento || '',
        }
      })
      .sort((x:any,y:any) => x.dataOrd < y.dataOrd ? -1 : x.dataOrd > y.dataOrd ? 1 : 0)
  }
  const agendaStatusDados = getAgendaStatus()
  const contAberto = agendamentos.filter((a:any)=>a.status==='aberto').length
  const contFechado = agendamentos.filter((a:any)=>a.status==='fechado').length
  const contCancelado = agendamentos.filter((a:any)=>a.status==='cancelado').length

  const abaStyle = (a: string) => ({ padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:'600' as const, cursor:'pointer' as const, border:'none', background:aba===a?'#6366f1':'transparent', color:aba===a?'white':'#6b7280', transition:'all .15s' })

  return (
    <div style={{ padding:'16px', maxWidth:'960px', margin:'0 auto' }}>
      <div style={{ marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>Relatórios</h1>
          <p style={{ fontSize:'13px', color:'#6b7280' }}>Análise de atendimentos, faturamento e formas de pagamento</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
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
          } else if (aba === 'mensal') {
            const header = ['Mes', ...todasFormas.map(f => FORMAS_LABEL[f]||f), 'Total']
            const linhas = meses.map(mes => {
              const [ano, m] = mes.split('-')
              const nomeMes = new Date(Number(ano),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
              const totalMes = Object.values(mesMap[mes]).reduce((s,f)=>s+f.valor,0)
              return [nomeMes, ...todasFormas.map(f => mesMap[mes][f]?.valor ? mesMap[mes][f].valor.toFixed(2).replace('.',',') : '0,00'), totalMes.toFixed(2).replace('.',',')]
            })
            const totRow = ['TOTAL', ...todasFormas.map(f => meses.reduce((s,mes)=>s+(mesMap[mes][f]?.valor||0),0).toFixed(2).replace('.',',')), meses.reduce((s,mes)=>s+Object.values(mesMap[mes]).reduce((ss,f)=>ss+f.valor,0),0).toFixed(2).replace('.',',')]
            exportarCSV('relatorio-mensal-' + periodo, [['Periodo: ' + periodo], [], header, ...linhas, totRow])
          } else {
            const header = ['Data','Hora','Cliente','Profissional','Status','Motivo Cancelamento']
            const linhas = agendaStatusDados.map(a => [a.dataLabel, a.horaLabel, a.cliente, a.profissional, STATUS_LABEL[a.status]||a.status, a.motivo])
            exportarCSV('relatorio-agenda-status-' + periodo, [['Periodo: ' + periodo], ['Filtro de status: ' + (filtroStatusAgenda==='todos'?'Todos':STATUS_LABEL[filtroStatusAgenda])], [], header, ...linhas])
          }
        }} style={{ display:'flex', alignItems:'center', gap:'6px', background:'#059669', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Excel
        </button>
        <button onClick={()=>{
          const periodo = ini + ' a ' + fim
          if (aba === 'profissional') {
            const headers = ['Profissional','Finalizados','Abertos','Cancelados','Faturamento','Ticket Médio']
            const linhas = dadosProf.map(p => [p.nome, p.fin, p.aber, p.canc, formatMoeda(p.fat), formatMoeda(p.fin>0?p.fat/p.fin:0)])
            exportarPDFGenerico('Relatório por Profissional', periodo, headers, linhas)
          } else if (aba === 'forma_pag') {
            const headers = ['Profissional','Forma de Pagamento','Qtd','Valor','%']
            const linhas: (string|number)[][] = []
            formasPorProf.forEach(({ prof, formas, totalValor: tv }) => {
              formas.forEach(([forma, dados]) => linhas.push([prof.nome, FORMAS_LABEL[forma]||forma, dados.qtd, formatMoeda(dados.valor), tv>0?(dados.valor/tv*100).toFixed(1)+'%':'0%']))
            })
            exportarPDFGenerico('Relatório Profissional x Pagamento', periodo, headers, linhas)
          } else if (aba === 'mensal') {
            const headers = ['Mês', ...todasFormas.map(f=>FORMAS_LABEL[f]||f), 'Total']
            const linhas = meses.map(mes => {
              const [ano,m] = mes.split('-')
              const nomeMes = new Date(Number(ano),Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
              const totalMes = Object.values(mesMap[mes]).reduce((s,f)=>s+f.valor,0)
              return [nomeMes, ...todasFormas.map(f=>formatMoeda(mesMap[mes][f]?.valor||0)), formatMoeda(totalMes)]
            })
            exportarPDFGenerico('Relatório Mensal por Pagamento', periodo, headers, linhas)
          } else {
            const headers = ['Data','Hora','Cliente','Profissional','Status','Motivo Cancelamento']
            const linhas = agendaStatusDados.map(a => [a.dataLabel, a.horaLabel, a.cliente, a.profissional, STATUS_LABEL[a.status]||a.status, a.motivo || '-'])
            const filtroTxt = 'Filtro de status: ' + (filtroStatusAgenda==='todos'?'Todos':STATUS_LABEL[filtroStatusAgenda]) + ` · ${agendaStatusDados.length} agendamento(s)`
            exportarPDFGenerico('Relatório Agenda por Status', periodo, headers, linhas, filtroTxt)
          }
        }} style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF
        </button>
        </div>
      </div>
      <div style={{ display:'flex', gap:'4px', background:'#f8fafc', borderRadius:'10px', padding:'4px', marginBottom:'20px', flexWrap:'wrap' }}>
        <button onClick={()=>setAba('profissional')} style={abaStyle('profissional')}>Por Profissional</button>
        <button onClick={()=>setAba('forma_pag')} style={abaStyle('forma_pag')}>Profissional × Pagamento</button>
        <button onClick={()=>setAba('mensal')} style={abaStyle('mensal')}>Mensal por Pagamento</button>
        <button onClick={()=>setAba('agenda_status')} style={abaStyle('agenda_status')}>Agenda por Status</button>
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

      {/* ABA 4: Agenda por Status */}
      {aba==='agenda_status' && (
        <div>
          {/* Cards de resumo */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:'10px', marginBottom:'16px' }}>
            <div style={{ background:'#eff6ff', borderRadius:'12px', padding:'14px 16px', border:'1px solid #2563eb22' }}>
              <p style={{ fontSize:'11px', color:'#6b7280', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>Em aberto</p>
              <p style={{ fontSize:'18px', fontWeight:'800', color:'#2563eb' }}>{contAberto}</p>
            </div>
            <div style={{ background:'#ecfdf5', borderRadius:'12px', padding:'14px 16px', border:'1px solid #05966922' }}>
              <p style={{ fontSize:'11px', color:'#6b7280', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>Finalizados</p>
              <p style={{ fontSize:'18px', fontWeight:'800', color:'#059669' }}>{contFechado}</p>
            </div>
            <div style={{ background:'#fef2f2', borderRadius:'12px', padding:'14px 16px', border:'1px solid #ef444422' }}>
              <p style={{ fontSize:'11px', color:'#6b7280', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>Cancelados</p>
              <p style={{ fontSize:'18px', fontWeight:'800', color:'#ef4444' }}>{contCancelado}</p>
            </div>
            <div style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', borderRadius:'12px', padding:'14px 16px' }}>
              <p style={{ fontSize:'11px', fontWeight:'700', color:'rgba(255,255,255,0.8)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'6px' }}>Total no Período</p>
              <p style={{ fontSize:'18px', fontWeight:'800', color:'white' }}>{agendamentos.length}</p>
            </div>
          </div>

          {/* Filtro por status */}
          <div style={{ display:'flex', gap:'6px', marginBottom:'16px', overflowX:'auto' }}>
            {([
              { key:'todos', label:'Todos' },
              { key:'aberto', label:'Em aberto' },
              { key:'fechado', label:'Finalizados' },
              { key:'cancelado', label:'Cancelados' },
            ] as const).map(op => (
              <button key={op.key} onClick={()=>setFiltroStatusAgenda(op.key)}
                style={{ background:filtroStatusAgenda===op.key?'#6366f1':'white', color:filtroStatusAgenda===op.key?'white':'#6b7280', border:'1px solid '+(filtroStatusAgenda===op.key?'#6366f1':'#e5e7eb'), borderRadius:'8px', padding:'9px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                {op.label}
              </button>
            ))}
          </div>

          {agendaStatusDados.length===0 && !carregando && (
            <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Nenhum agendamento no período</div>
          )}

          {agendaStatusDados.length>0 && (
            <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f0', overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px', minWidth:'620px' }}>
                <thead><tr style={{ background:'#f8fafc' }}>
                  {['Data','Hora','Cliente','Profissional','Status','Motivo do Cancelamento'].map(h=>
                    <th key={h} style={{ padding:'12px 14px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.03em', borderBottom:'2px solid #e5e7eb' }}>{h}</th>
                  )}
                </tr></thead>
                <tbody>
                  {agendaStatusDados.map((a,i) => {
                    const c = STATUS_CORES[a.status] || STATUS_CORES.aberto
                    return (
                      <tr key={a.id} style={{ borderBottom:'1px solid #f3f4f6', background:i%2===0?'white':'#fafafa' }}>
                        <td style={{ padding:'12px 14px', whiteSpace:'nowrap', color:'#374151' }}>{a.dataLabel}</td>
                        <td style={{ padding:'12px 14px', whiteSpace:'nowrap', color:'#374151', fontFamily:'monospace' }}>{a.horaLabel}</td>
                        <td style={{ padding:'12px 14px', fontWeight:'600', color:'#111827' }}>{a.cliente}</td>
                        <td style={{ padding:'12px 14px', color:'#374151' }}>{a.profissional}</td>
                        <td style={{ padding:'12px 14px' }}>
                          <span style={{ background:c.badge, color:c.cor, padding:'3px 10px', borderRadius:'99px', fontWeight:'700', fontSize:'11px' }}>{STATUS_LABEL[a.status]||a.status}</span>
                        </td>
                        <td style={{ padding:'12px 14px', color:'#6b7280', maxWidth:'220px', overflowWrap:'break-word' }}>{a.status==='cancelado' ? (a.motivo || '—') : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
