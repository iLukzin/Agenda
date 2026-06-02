// BUILD: 1779992105
'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { usePermissao } from '@/hooks/usePermissao'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/supabase'

type Lancamento = {
  id: string; tipo: 'receita'|'despesa'; descricao: string
  valor: number; data_vencimento: string; data_pagamento: string|null
  status: 'pago'|'pendente'|'cancelado'; categoria: string
  forma_pagamento: string|null; cliente_id: string|null; cliente_nome: string
  origem: 'manual'|'agendamento'
}
type AgFinalizado = {
  id: string; data_inicio: string; valor: number; cliente: string; servico: string
}

const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }
const CATEGORIAS_REC = ['Consultas','Avaliações','Planos','Sessões','Outros']
const CATEGORIAS_DES = ['Aluguel','Salários','Material','Software','Marketing','Outros']
const FORMAS = ['','Dinheiro','PIX','Cartão de crédito','Cartão de débito','Transferência','Plano']

function padISO(n: number) { return String(n).padStart(2,'0') }
function hojeISO() { const d=new Date(); return `${d.getFullYear()}-${padISO(d.getMonth()+1)}-${padISO(d.getDate())}` }
function inicioMes(){ const d=new Date(); return `${d.getFullYear()}-${padISO(d.getMonth()+1)}-01` }
function fimMes()   { const d=new Date(); const f=new Date(d.getFullYear(),d.getMonth()+1,0); return `${f.getFullYear()}-${padISO(f.getMonth()+1)}-${padISO(f.getDate())}` }
function inicioAno(){ const d=new Date(); return `${d.getFullYear()}-01-01` }
function fimAno()   { const d=new Date(); return `${d.getFullYear()}-12-31` }


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
export default function FinanceiroPage() {
  const perm = usePermissao('financeiro')

    if (!perm.visualizar && !perm.carregando) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'12px' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <p style={{ fontSize:'16px', fontWeight:'700', color:'#374151' }}>Acesso nao permitido</p>
        <p style={{ fontSize:'13px', color:'#9ca3af' }}>Voce nao tem permissao para acessar esta tela.</p>
      </div>
    )

  const { empresaAtiva } = useEmpresa()
  const [lancamentos, setLancamentos]   = useState<Lancamento[]>([])
  const [agsFinalizados, setAgsFinalizados] = useState<AgFinalizado[]>([])
  const [clientes, setClientes]         = useState<{id:string;nome:string}[]>([])
  const [carregando, setCarregando]     = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [aba, setAba]   = useState<'lancamentos'|'agendamentos'|'relatorio'>('lancamentos')
  const [tipo, setTipo] = useState<'todos'|'receita'|'despesa'>('todos')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Lancamento|null>(null)
  const [erro, setErro]                 = useState('')

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<'hoje'|'mes'|'ano'|'periodo'>('mes')
  const [periodoIni, setPeriodoIni] = useState(inicioMes())
  const [periodoFim, setPeriodoFim] = useState(fimMes())

  const [form, setForm] = useState({
    tipo: 'receita' as 'receita'|'despesa',
    descricao:'', valor:'', categoria:'Consultas',
    data_vencimento:hojeISO(), data_pagamento:'',
    status:'pendente' as 'pago'|'pendente', forma_pagamento:'', cliente_id:'',
  })

  // Atualizar período quando tipo muda
  useEffect(() => {
    if (filtroTipo==='hoje')   { setPeriodoIni(hojeISO());   setPeriodoFim(hojeISO()) }
    if (filtroTipo==='mes')    { setPeriodoIni(inicioMes()); setPeriodoFim(fimMes()) }
    if (filtroTipo==='ano')    { setPeriodoIni(inicioAno()); setPeriodoFim(fimAno()) }
  }, [filtroTipo])

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()

    const [{ data: lans }, { data: ags }, { data: cls }] = await Promise.all([
      sb.from('lancamentos')
        .select('id,tipo,descricao,valor,data_vencimento,data_pagamento,status,categoria,forma_pagamento,cliente_id,origem')
        .eq('empresa_id', empresaAtiva.id)
        .gte('data_vencimento', periodoIni)
        .lte('data_vencimento', periodoFim)
        .order('data_vencimento', { ascending:false }),
      sb.from('agendamentos')
        .select('id,data_inicio,valor,status,cliente_id,servico_id')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'fechado')
        .gte('data_inicio', periodoIni+'T00:00:00')
        .lte('data_inicio', periodoFim+'T23:59:59')
        .order('data_inicio', { ascending:false }),
      sb.from('clientes').select('id,nome').eq('empresa_id', empresaAtiva.id).order('nome'),
    ])

    const cliMap:  Record<string,string> = {}
    const servMap: Record<string,string> = {}
    ;(cls||[]).forEach((c:any) => { cliMap[c.id] = c.nome })
    setClientes(cls||[])

    if (ags && ags.length > 0) {
      const servIds = Array.from(new Set(ags.map((a:any) => a.servico_id).filter(Boolean)))
      if (servIds.length > 0) {
        const { data: servs } = await sb.from('servicos').select('id,nome').in('id', servIds as string[])
        ;(servs||[]).forEach((s:any) => { servMap[s.id] = s.nome })
      }
    }

    setLancamentos((lans||[]).map((l:any) => ({
      ...l, cliente_nome: l.cliente_id?(cliMap[l.cliente_id]||''):'', origem:l.origem||'manual',
    })))
    setAgsFinalizados((ags||[]).map((a:any) => ({
      id:a.id, data_inicio:a.data_inicio, valor:a.valor||0,
      cliente:cliMap[a.cliente_id]||'--', servico:servMap[a.servico_id]||'--',
    })))
    setCarregando(false)
  }, [empresaAtiva?.id, periodoIni, periodoFim])

  useEffect(() => { carregar() }, [carregar])
  useVisibilityRefresh(carregar)

  // Totais
  const receitasLanc = lancamentos.filter(l=>l.tipo==='receita'&&l.status==='pago').reduce((s,l)=>s+l.valor,0)
  const receitasAgs  = agsFinalizados.reduce((s,a)=>s+a.valor,0)
  const totalReceitas = receitasLanc + receitasAgs
  const totalDespesas = lancamentos.filter(l=>l.tipo==='despesa'&&l.status==='pago').reduce((s,l)=>s+l.valor,0)
  const totalPendentes= lancamentos.filter(l=>l.status==='pendente').reduce((s,l)=>s+l.valor,0)
  const lucro         = totalReceitas - totalDespesas

  const filtrados = useMemo(()=>
    lancamentos.filter(l => tipo==='todos' || l.tipo===tipo),
    [lancamentos, tipo]
  )

  // -- Modal -----------------------------------------------------
  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro('')
    setForm({ tipo:'receita', descricao:'', valor:'', categoria:'Consultas', data_vencimento:hojeISO(), data_pagamento:'', status:'pendente', forma_pagamento:'', cliente_id:'' })
    setModalAberto(true)
  }
  function abrirEdicao(l: Lancamento) {
    if (l.origem==='agendamento') return
    setModoEdicao(true); setSelecionado(l); setErro('')
    setForm({ tipo:l.tipo, descricao:l.descricao, valor:String(l.valor), categoria:l.categoria, data_vencimento:l.data_vencimento, data_pagamento:l.data_pagamento||'', status:l.status==='pago'?'pago':'pendente', forma_pagamento:l.forma_pagamento||'', cliente_id:l.cliente_id||'' })
    setModalAberto(true)
  }
  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.descricao.trim()||!form.valor) return setErro('Descrição e valor são obrigatórios.')
    if (!empresaAtiva?.id) return
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = { tipo:form.tipo, descricao:form.descricao.trim(), valor:parseFloat(form.valor)||0, categoria:form.categoria, data_vencimento:form.data_vencimento, data_pagamento:form.data_pagamento||null, status:form.status, forma_pagamento:form.forma_pagamento||null, cliente_id:form.cliente_id||null, origem:'manual' }
    let error:any
    if (modoEdicao&&selecionado) { const r=await sb.from('lancamentos').update(payload).eq('id',selecionado.id); error=r.error }
    else { const r=await sb.from('lancamentos').insert({...payload,empresa_id:empresaAtiva.id}); error=r.error }
    if (error) { setErro('Erro: '+error.message); setSalvando(false); return }
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function excluir(id:string) {
    if (!confirm('Excluir este lançamento?')) return
    const sb=createClient(); await sb.from('lancamentos').delete().eq('id',id)
    await carregar(); fecharModal()
  }

  async function marcarPago(l:Lancamento) {
    const sb=createClient()
    await sb.from('lancamentos').update({status:'pago',data_pagamento:hojeISO()}).eq('id',l.id)
    await carregar()
  }

  // -- Exportar Excel ---------------------------------------------
  function exportarExcel() {
    const rows = [
      ['Tipo','Descrição','Categoria','Vencimento','Pagamento','Valor','Status','Cliente'],
      ...filtrados.map(l=>[
        l.tipo==='receita'?'Receita':'Despesa',
        l.descricao, l.categoria, l.data_vencimento,
        l.data_pagamento||'', l.valor.toFixed(2),
        l.status==='pago'?'Pago':'Pendente', l.cliente_nome||'',
      ]),
    ]
    const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
    const bom  = '\uFEFF'
    const blob = new Blob([bom+csv], { type:'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=`financeiro_${periodoIni}_${periodoFim}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // -- Exportar PDF -----------------------------------------------
  function exportarPDF() {
    const win = window.open('','_blank','width=900,height=700')
    if (!win) return
    const label = filtroTipo==='hoje'?'Hoje':filtroTipo==='mes'?'Este mês':filtroTipo==='ano'?'Este ano':`${periodoIni} a ${periodoFim}`
    const linhas = filtrados.map(l=>`
      <tr>
        <td>${l.tipo==='receita'?'↑ Receita':'↓ Despesa'}</td>
        <td>${l.descricao}</td>
        <td>${l.categoria}</td>
        <td>${new Date(l.data_vencimento+'T12:00:00').toLocaleDateString('pt-BR')}</td>
        <td style="text-align:right;color:${l.tipo==='receita'?'#10b981':'#ef4444'};font-weight:600">
          ${l.tipo==='receita'?'+':'-'} R$ ${l.valor.toFixed(2).replace('.',',')}
        </td>
        <td><span style="padding:2px 8px;border-radius:99px;background:${l.status==='pago'?'#ecfdf5':'#fffbeb'};color:${l.status==='pago'?'#10b981':'#f59e0b'}">${l.status==='pago'?'Pago':'Pendente'}</span></td>
      </tr>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Financeiro</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#1a1a2e}h1{font-size:20px;margin-bottom:4px}
    .sub{color:#9ca3af;font-size:13px;margin-bottom:20px}
    .cards{display:flex;gap:16px;margin-bottom:20px}
    .card{background:#f8f8fc;border-radius:8px;padding:12px 16px;flex:1}
    .card p{font-size:11px;color:#9ca3af;margin:0 0 4px}
    .card b{font-size:18px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f3f4f6;padding:10px 12px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase}
    td{padding:10px 12px;border-bottom:1px solid #f3f4f6}
    @media print{button{display:none}}</style></head><body>
    <h1>Relatório Financeiro</h1>
    <p class="sub">Período: ${label} &nbsp;|&nbsp; Exportado em ${new Date().toLocaleDateString('pt-BR')}</p>
    <div class="cards">
      <div class="card"><p>Receitas</p><b style="color:#10b981">R$ ${totalReceitas.toFixed(2).replace('.',',')}</b></div>
      <div class="card"><p>Despesas</p><b style="color:#ef4444">R$ ${totalDespesas.toFixed(2).replace('.',',')}</b></div>
      <div class="card"><p>Lucro</p><b style="color:${lucro>=0?'#6366f1':'#ef4444'}">R$ ${lucro.toFixed(2).replace('.',',')}</b></div>
      <div class="card"><p>Pendentes</p><b style="color:#f59e0b">R$ ${totalPendentes.toFixed(2).replace('.',',')}</b></div>
    </div>
    <table><thead><tr><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
    <tbody>${linhas}</tbody></table>
    <br><button onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
    </body></html>`)
    win.document.close()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({...p, [k]: e.target.value}))

  const labelPeriodo = filtroTipo==='hoje'?'Hoje':filtroTipo==='mes'?'Este mês':filtroTipo==='ano'?`Ano ${new Date().getFullYear()}`:`${new Date(periodoIni+'T12:00:00').toLocaleDateString('pt-BR')} - ${new Date(periodoFim+'T12:00:00').toLocaleDateString('pt-BR')}`

  return (
    <div style={{ padding:'24px 16px' }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Financeiro</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{labelPeriodo}</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={exportarExcel} style={{ background:'#ecfdf5', color:'#10b981', border:'1px solid #6ee7b7', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>
            📊 Excel
          </button>
          <button onClick={exportarPDF} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fca5a5', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>
            📄 PDF
          </button>
          <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
            + Novo lançamento
          </button>
        </div>
      </div>

      {/* Filtros de período */}
      <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'16px 18px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'13px', fontWeight:'500', color:'#374151' }}>Período:</span>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {[['hoje','Hoje'],['mes','Este mês'],['ano','Este ano'],['periodo','Personalizado']].map(([v,l])=>(
            <button key={v} onClick={()=>setFiltroTipo(v as any)} style={{ padding:'6px 14px', borderRadius:'99px', fontSize:'13px', fontWeight:'500', cursor:'pointer', border:filtroTipo===v?'1.5px solid #6366f1':'1px solid #e5e7eb', background:filtroTipo===v?'#eef2ff':'white', color:filtroTipo===v?'#6366f1':'#6b7280' }}>{l}</button>
          ))}
        </div>
        {filtroTipo==='periodo' && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            <input type="date" value={periodoIni} onChange={e=>setPeriodoIni(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'7px 10px', fontSize:'13px', outline:'none' }}/>
            <span style={{ fontSize:'13px', color:'#9ca3af' }}>até</span>
            <input type="date" value={periodoFim} onChange={e=>setPeriodoFim(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'7px 10px', fontSize:'13px', outline:'none' }}/>
          </div>
        )}
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'14px', marginBottom:'20px' }}>
        {[
          { label:'Receitas pagas',  v:totalReceitas,  cor:'#10b981', bg:'#ecfdf5', ic:'?', sub:'lançamentos + agend.' },
          { label:'Despesas pagas',  v:totalDespesas,  cor:'#ef4444', bg:'#fef2f2', ic:'↓', sub:'do período'          },
          { label:'Lucro líquido',   v:lucro,          cor:lucro>=0?'#6366f1':'#ef4444', bg:'#eef2ff', ic:'*', sub:'receitas ? despesas' },
          { label:'A receber/pagar', v:totalPendentes, cor:'#f59e0b', bg:'#fffbeb', ic:'◷', sub:'pendentes'           },
        ].map(c=>(
          <div key={c.label} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'16px 18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <p style={{ fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{c.label}</p>
              <span style={{ width:'28px', height:'28px', borderRadius:'8px', background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', color:c.cor, fontWeight:'700' }}>{c.ic}</span>
            </div>
            <p style={{ fontSize:'20px', fontWeight:'700', color:c.cor }}>{formatarMoeda(c.v)}</p>
            <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'2px' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', marginBottom:'16px', borderBottom:'2px solid #f3f4f6', overflowX:'auto' }}>
        {[['lancamentos','💳 Lançamentos'],['agendamentos','📅 Atendimentos finalizados'],['relatorio','📊 Resumo']].map(([v,l])=>(
          <button key={v} onClick={()=>setAba(v as any)} style={{ padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontSize:'13px', fontWeight:aba===v?'600':'400', color:aba===v?'#6366f1':'#9ca3af', borderBottom:aba===v?'2px solid #6366f1':'2px solid transparent', marginBottom:'-2px', whiteSpace:'nowrap' }}>{l}</button>
        ))}
      </div>

      {/* Lançamentos */}
      {aba==='lancamentos' && (
        <>
          <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
            {[['todos','Todos'],['receita','Receitas'],['despesa','Despesas']].map(([v,l])=>(
              <button key={v} onClick={()=>setTipo(v as any)} style={{ padding:'6px 16px', borderRadius:'99px', fontSize:'13px', fontWeight:'500', cursor:'pointer', border:tipo===v?'1px solid #6366f1':'1px solid #e5e7eb', background:tipo===v?'#eef2ff':'white', color:tipo===v?'#6366f1':'#6b7280' }}>{l}</button>
            ))}
            <span style={{ marginLeft:'auto', fontSize:'13px', color:'#9ca3af', alignSelf:'center' }}>{filtrados.length} lançamento{filtrados.length!==1?'s':''}</span>
          </div>

          {carregando ? <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {filtrados.map(l=>(
                <div key={l.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:l.tipo==='receita'?'#ecfdf5':'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0, color:l.tipo==='receita'?'#10b981':'#ef4444', fontWeight:'700' }}>
                    {l.tipo==='receita'?'↑':'↓'}
                  </div>
                  <div style={{ flex:1, minWidth:'140px' }}>
                    <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'2px' }}>{l.descricao}</p>
                    <p style={{ fontSize:'12px', color:'#9ca3af' }}>
                      {l.categoria}{l.cliente_nome?' . '+l.cliente_nome:''}{l.origem==='agendamento'?' . 🗓':''}
                    </p>
                  </div>
                  <div style={{ textAlign:'right', minWidth:'80px' }}>
                    <p style={{ fontSize:'15px', fontWeight:'700', color:l.tipo==='receita'?'#10b981':'#ef4444' }}>
                      {l.tipo==='receita'?'+':'-'}{formatarMoeda(l.valor)}
                    </p>
                    <p style={{ fontSize:'11px', color:'#9ca3af' }}>{new Date(l.data_vencimento+'T12:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:l.status==='pago'?'#ecfdf5':'#fffbeb', color:l.status==='pago'?'#10b981':'#f59e0b' }}>
                    {l.status==='pago'?'Pago':'Pendente'}
                  </span>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    {l.status==='pendente' && <button onClick={()=>marcarPago(l)} style={{ background:'#ecfdf5', color:'#10b981', border:'none', borderRadius:'6px', padding:'5px 10px', fontSize:'12px', cursor:'pointer' }} title="Marcar pago">Ativar</button>}
                    {l.origem!=='agendamento' && <>
                      <button onClick={()=>abrirEdicao(l)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'5px 10px', fontSize:'12px', cursor:'pointer' }}>edit</button>
                      <button onClick={()=>excluir(l.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'5px 10px', fontSize:'12px', cursor:'pointer' }}>🗑</button>
                    </>}
                  </div>
                </div>
              ))}
              {filtrados.length===0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum lançamento no período selecionado.</div>}
            </div>
          )}
        </>
      )}

      {/* Agendamentos finalizados */}
      {aba==='agendamentos' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'12px 16px', marginBottom:'8px', fontSize:'13px', color:'#4338ca' }}>
            [v] Total de atendimentos fechados no período: <b>{formatarMoeda(receitasAgs)}</b>
          </div>
          {carregando ? <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div>
          : agsFinalizados.map(a=>(
            <div key={a.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#ecfdf5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>[v]</div>
              <div style={{ flex:1, minWidth:'140px' }}>
                <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'2px' }}>{a.cliente}</p>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>{a.servico} . {a.data_inicio.slice(0,10).split('-').reverse().join('/')} às {a.data_inicio.slice(11,16)}</p>
              </div>
              <p style={{ fontSize:'15px', fontWeight:'700', color:'#10b981' }}>+{formatarMoeda(a.valor)}</p>
            </div>
          ))}
          {agsFinalizados.length===0&&!carregando && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum atendimento finalizado no período.</div>}
        </div>
      )}

      {/* Resumo */}
      {aba==='relatorio' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'20px' }}>Resumo -- {labelPeriodo}</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {[
              { label:'Receitas de lançamentos (pagos)',    v:receitasLanc,  cor:'#10b981', bold:false },
              { label:'Receitas de atendimentos fechados',  v:receitasAgs,   cor:'#10b981', bold:false },
              { label:'Total de receitas',                  v:totalReceitas, cor:'#10b981', bold:true  },
              { label:'Total de despesas pagas',            v:totalDespesas, cor:'#ef4444', bold:false },
              { label:'Lucro líquido',                      v:lucro,         cor:lucro>=0?'#6366f1':'#ef4444', bold:true },
              { label:'Pendentes (a receber/pagar)',         v:totalPendentes,cor:'#f59e0b', bold:false },
            ].map(row=>(
              <div key={row.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderRadius:'8px', background:row.bold?'#f8f8fc':'transparent', borderBottom:row.bold?'none':'1px solid #f9fafb' }}>
                <span style={{ fontSize:'14px', fontWeight:row.bold?'600':'400', color:'#374151' }}>{row.label}</span>
                <span style={{ fontSize:'15px', fontWeight:row.bold?'700':'500', color:row.cor }}>{formatarMoeda(row.v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal lançamento */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'edit Editar lançamento':'+ Novo lançamento'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>x</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
              {(['receita','despesa'] as const).map(t=>(
                <div key={t} onClick={()=>setForm(p=>({...p,tipo:t,categoria:t==='receita'?'Consultas':'Aluguel'}))}
                  style={{ padding:'12px', borderRadius:'10px', textAlign:'center', cursor:'pointer', border:`2px solid ${form.tipo===t?(t==='receita'?'#10b981':'#ef4444'):'#e5e7eb'}`, background:form.tipo===t?(t==='receita'?'#ecfdf5':'#fef2f2'):'white' }}>
                  <p style={{ fontSize:'20px', marginBottom:'3px' }}>{t==='receita'?'↑':'↓'}</p>
                  <p style={{ fontSize:'14px', fontWeight:'600', color:form.tipo===t?(t==='receita'?'#10b981':'#ef4444'):'#6b7280' }}>{t==='receita'?'Receita':'Despesa'}</p>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Descrição *</label>
                <input value={form.descricao} onChange={f('descricao')} style={inputStyle} placeholder="Ex: Consulta João Silva"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Valor (R$) *</label>
                  <input type="number" value={form.valor} onChange={f('valor')} style={inputStyle} placeholder="0,00"/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Categoria</label>
                  <select value={form.categoria} onChange={f('categoria')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    {(form.tipo==='receita'?CATEGORIAS_REC:CATEGORIAS_DES).map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Vencimento</label>
                  <input type="date" value={form.data_vencimento} onChange={f('data_vencimento')} style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Data pagamento</label>
                  <input type="date" value={form.data_pagamento} onChange={e=>setForm(p=>({...p,data_pagamento:e.target.value,status:e.target.value?'pago':'pendente'}))} style={inputStyle}/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                  <select value={form.status} onChange={f('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Forma de pagamento</label>
                  <select value={form.forma_pagamento} onChange={f('forma_pagamento')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    {FORMAS.map(fp=><option key={fp} value={fp}>{fp||'Selecionar...'}</option>)}
                  </select>
                </div>
              </div>
              {form.tipo==='receita' && (
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cliente (opcional)</label>
                  <select value={form.cliente_id} onChange={f('cliente_id')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="">Sem cliente</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
            </div>

            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao&&selecionado
                ? <button onClick={()=>excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando?'Salvando...':modoEdicao?'Salvar':'Lançar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
