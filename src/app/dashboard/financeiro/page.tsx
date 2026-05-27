'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'
import { formatarMoeda } from '@/lib/supabase'

type Lancamento = {
  id: string; tipo: 'receita'|'despesa'; descricao: string
  valor: number; data_vencimento: string; data_pagamento: string|null
  status: 'pago'|'pendente'|'cancelado'; categoria: string
  forma_pagamento: string|null; cliente_id: string|null; cliente_nome: string
  origem: 'manual'|'agendamento'; agendamento_id: string|null
}

type AgFinalizado = {
  id: string; data_inicio: string; valor: number; status: string
  cliente: string; servico: string
}

const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }
const CATEGORIAS_REC = ['Consultas','Avaliações','Planos','Sessões','Outros']
const CATEGORIAS_DES = ['Aluguel','Salários','Material','Software','Marketing','Outros']
const FORMAS = ['','Dinheiro','PIX','Cartão de crédito','Cartão de débito','Transferência','Plano']

function hojeISO() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function inicioMes() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function fimMes() {
  const d = new Date(); const f = new Date(d.getFullYear(), d.getMonth()+1, 0)
  return `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}`
}

export default function FinanceiroPage() {
  const { empresaAtiva } = useEmpresa()
  const [lancamentos, setLancamentos]   = useState<Lancamento[]>([])
  const [agsFinalizados, setAgsFinalizados] = useState<AgFinalizado[]>([])
  const [carregando, setCarregando]     = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [aba, setAba]   = useState<'lancamentos'|'agendamentos'|'relatorio'>('lancamentos')
  const [tipo, setTipo] = useState<'todos'|'receita'|'despesa'>('todos')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Lancamento|null>(null)
  const [erro, setErro]                 = useState('')
  const [clientes, setClientes]         = useState<{id:string;nome:string}[]>([])
  const [form, setForm] = useState({
    tipo: 'receita' as 'receita'|'despesa',
    descricao: '', valor: '', categoria: 'Consultas',
    data_vencimento: hojeISO(), data_pagamento: '',
    status: 'pendente' as 'pago'|'pendente', forma_pagamento: '',
    cliente_id: '',
  })

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    const ini = inicioMes()
    const fim = fimMes()

    const [{ data: lans }, { data: ags }, { data: cls }] = await Promise.all([
      sb.from('lancamentos')
        .select('id, tipo, descricao, valor, data_vencimento, data_pagamento, status, categoria, forma_pagamento, cliente_id, origem, agendamento_id')
        .eq('empresa_id', empresaAtiva.id)
        .gte('data_vencimento', ini)
        .lte('data_vencimento', fim)
        .order('data_vencimento', { ascending: false }),
      sb.from('agendamentos')
        .select('id, data_inicio, valor, status, cliente_id, servico_id')
        .eq('empresa_id', empresaAtiva.id)
        .eq('status', 'Finalizado')
        .gte('data_inicio', ini + 'T00:00:00')
        .lte('data_inicio', fim + 'T23:59:59')
        .order('data_inicio', { ascending: false }),
      sb.from('clientes')
        .select('id, nome')
        .eq('empresa_id', empresaAtiva.id)
        .order('nome'),
    ])

    // Maps para join
    const cliMap:  Record<string,string> = {}
    const servMap: Record<string,string> = {}
    ;(cls || []).forEach((c: any) => { cliMap[c.id] = c.nome })
    setClientes(cls || [])

    // Busca nomes de serviços para os agendamentos
    if (ags && ags.length > 0) {
      const servIds = Array.from(new Set(ags.map((a: any) => a.servico_id).filter(Boolean)))
      if (servIds.length > 0) {
        const { data: servs } = await sb.from('servicos').select('id, nome').in('id', servIds as string[])
        ;(servs || []).forEach((s: any) => { servMap[s.id] = s.nome })
      }
    }

    setLancamentos((lans || []).map((l: any) => ({
      ...l,
      cliente_nome: l.cliente_id ? (cliMap[l.cliente_id] || '') : '',
      origem: l.origem || 'manual',
    })))

    setAgsFinalizados((ags || []).map((a: any) => ({
      id:          a.id,
      data_inicio: a.data_inicio,
      valor:       a.valor || 0,
      status:      a.status,
      cliente:     cliMap[a.cliente_id] || '—',
      servico:     servMap[a.servico_id] || '—',
    })))

    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  // ── Totais ──────────────────────────────────────────────────
  const receitasLancamentos = lancamentos
    .filter(l => l.tipo==='receita' && l.status==='pago')
    .reduce((s,l) => s + l.valor, 0)

  const receitasAgendamentos = agsFinalizados.reduce((s,a) => s + a.valor, 0)

  const totalReceitas  = receitasLancamentos + receitasAgendamentos
  const totalDespesas  = lancamentos.filter(l=>l.tipo==='despesa'&&l.status==='pago').reduce((s,l)=>s+l.valor,0)
  const totalPendentes = lancamentos.filter(l=>l.status==='pendente').reduce((s,l)=>s+l.valor,0)
  const lucro          = totalReceitas - totalDespesas

  // ── Modal ────────────────────────────────────────────────────
  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro('')
    setForm({ tipo:'receita', descricao:'', valor:'', categoria:'Consultas', data_vencimento:hojeISO(), data_pagamento:'', status:'pendente', forma_pagamento:'', cliente_id:'' })
    setModalAberto(true)
  }

  function abrirEdicao(l: Lancamento) {
    if (l.origem === 'agendamento') return // Não edita lançamentos de agendamento
    setModoEdicao(true); setSelecionado(l); setErro('')
    setForm({ tipo:l.tipo, descricao:l.descricao, valor:String(l.valor), categoria:l.categoria, data_vencimento:l.data_vencimento, data_pagamento:l.data_pagamento||'', status:(l.status === 'pago' ? 'pago' : 'pendente') as 'pago'|'pendente', forma_pagamento:l.forma_pagamento||'', cliente_id:l.cliente_id||'' })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.descricao.trim() || !form.valor) return setErro('Descrição e valor são obrigatórios.')
    if (!empresaAtiva?.id) return
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = {
      tipo:             form.tipo,
      descricao:        form.descricao.trim(),
      valor:            parseFloat(form.valor) || 0,
      categoria:        form.categoria,
      data_vencimento:  form.data_vencimento,
      data_pagamento:   form.data_pagamento || null,
      status:           form.status,
      forma_pagamento:  form.forma_pagamento || null,
      cliente_id:       form.cliente_id || null,
      origem:           'manual',
    }
    let error: any
    if (modoEdicao && selecionado) {
      const res = await sb.from('lancamentos').update(payload).eq('id', selecionado.id)
      error = res.error
    } else {
      const res = await sb.from('lancamentos').insert({ ...payload, empresa_id: empresaAtiva.id })
      error = res.error
    }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    const sb = createClient()
    await sb.from('lancamentos').delete().eq('id', id)
    await carregar(); fecharModal()
  }

  async function marcarPago(l: Lancamento) {
    const sb = createClient()
    await sb.from('lancamentos').update({ status:'pago', data_pagamento: hojeISO() }).eq('id', l.id)
    await carregar()
  }

  const filtrados = lancamentos.filter(l => tipo==='todos' || l.tipo===tipo)

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({...p, [k]: e.target.value}))

  return (
    <div style={{ padding:'24px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Financeiro</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>
            {new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).replace(/^\w/,c=>c.toUpperCase())}
          </p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo lançamento
        </button>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Receitas pagas',  valor:totalReceitas,  corText:'#10b981', bg:'#ecfdf5', icone:'↑', sub:'lançamentos + agend.' },
          { label:'Despesas pagas',  valor:totalDespesas,  corText:'#ef4444', bg:'#fef2f2', icone:'↓', sub:'do mês atual'         },
          { label:'Lucro líquido',   valor:lucro,          corText:lucro>=0?'#6366f1':'#ef4444', bg:'#eef2ff', icone:'◈', sub:'receitas − despesas' },
          { label:'A receber/pagar', valor:totalPendentes, corText:'#f59e0b', bg:'#fffbeb', icone:'⏳', sub:'pendentes'           },
        ].map(c => (
          <div key={c.label} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'18px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <p style={{ fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{c.label}</p>
              <span style={{ width:'28px', height:'28px', borderRadius:'8px', background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', color:c.corText, fontWeight:'700' }}>{c.icone}</span>
            </div>
            <p style={{ fontSize:'20px', fontWeight:'700', color:c.corText }}>{formatarMoeda(c.valor)}</p>
            <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'2px' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', marginBottom:'20px', borderBottom:'2px solid #f3f4f6', overflowX:'auto' }}>
        {[['lancamentos','💳 Lançamentos'],['agendamentos','📅 Agendamentos finalizados'],['relatorio','📊 Resumo']].map(([v,l]) => (
          <button key={v} onClick={()=>setAba(v as any)} style={{ padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontSize:'13px', fontWeight:aba===v?'600':'400', color:aba===v?'#6366f1':'#9ca3af', borderBottom:aba===v?'2px solid #6366f1':'2px solid transparent', marginBottom:'-2px', whiteSpace:'nowrap' }}>{l}</button>
        ))}
      </div>

      {/* Lançamentos manuais */}
      {aba === 'lancamentos' && (
        <>
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap' }}>
            {[['todos','Todos'],['receita','Receitas'],['despesa','Despesas']].map(([v,l]) => (
              <button key={v} onClick={()=>setTipo(v as any)} style={{ padding:'6px 16px', borderRadius:'99px', fontSize:'13px', fontWeight:'500', cursor:'pointer', border:tipo===v?'1px solid #6366f1':'1px solid #e5e7eb', background:tipo===v?'#eef2ff':'white', color:tipo===v?'#6366f1':'#6b7280' }}>{l}</button>
            ))}
          </div>

          {carregando ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {filtrados.map(l => (
                <div key={l.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:l.tipo==='receita'?'#ecfdf5':'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>
                    {l.tipo==='receita'?'↑':'↓'}
                  </div>
                  <div style={{ flex:1, minWidth:'150px' }}>
                    <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'2px' }}>{l.descricao}</p>
                    <p style={{ fontSize:'12px', color:'#9ca3af' }}>
                      {l.categoria}
                      {l.cliente_nome ? ` · ${l.cliente_nome}` : ''}
                      {l.origem==='agendamento' ? ' · 🗓 Agendamento' : ''}
                    </p>
                  </div>
                  <div style={{ textAlign:'right', minWidth:'80px' }}>
                    <p style={{ fontSize:'15px', fontWeight:'700', color:l.tipo==='receita'?'#10b981':'#ef4444' }}>
                      {l.tipo==='receita'?'+':'-'}{formatarMoeda(l.valor)}
                    </p>
                    <p style={{ fontSize:'11px', color:'#9ca3af' }}>
                      {new Date(l.data_vencimento+'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:l.status==='pago'?'#ecfdf5':l.status==='cancelado'?'#f9fafb':'#fffbeb', color:l.status==='pago'?'#10b981':l.status==='cancelado'?'#9ca3af':'#f59e0b' }}>
                    {l.status==='pago'?'Pago':l.status==='cancelado'?'Cancelado':'Pendente'}
                  </span>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    {l.status==='pendente' && (
                      <button onClick={()=>marcarPago(l)} style={{ background:'#ecfdf5', color:'#10b981', border:'none', borderRadius:'6px', padding:'5px 10px', fontSize:'12px', cursor:'pointer' }} title="Marcar como pago">✓</button>
                    )}
                    {l.origem!=='agendamento' && (
                      <>
                        <button onClick={()=>abrirEdicao(l)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'5px 10px', fontSize:'12px', cursor:'pointer' }}>✏️</button>
                        <button onClick={()=>excluir(l.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'5px 10px', fontSize:'12px', cursor:'pointer' }}>🗑</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filtrados.length === 0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum lançamento neste período.</div>}
            </div>
          )}
        </>
      )}

      {/* Agendamentos finalizados */}
      {aba === 'agendamentos' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'12px 16px', marginBottom:'8px', fontSize:'13px', color:'#4338ca' }}>
            📅 Agendamentos finalizados somam automaticamente nas receitas. Total do mês: <b>{formatarMoeda(receitasAgendamentos)}</b>
          </div>
          {carregando ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div>
          ) : agsFinalizados.map(a => (
            <div key={a.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#ecfdf5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>✅</div>
              <div style={{ flex:1, minWidth:'150px' }}>
                <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'2px' }}>{a.cliente}</p>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>
                  {a.servico} · {new Date(a.data_inicio).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'America/Sao_Paulo'})} às {a.data_inicio.slice(11,16)}
                </p>
              </div>
              <p style={{ fontSize:'15px', fontWeight:'700', color:'#10b981' }}>+{formatarMoeda(a.valor)}</p>
              <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:'#ecfdf5', color:'#10b981' }}>Finalizado</span>
            </div>
          ))}
          {agsFinalizados.length === 0 && !carregando && (
            <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum atendimento finalizado este mês.</div>
          )}
        </div>
      )}

      {/* Resumo */}
      {aba === 'relatorio' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'20px' }}>Resumo do mês</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[
              { label:'Receitas de lançamentos (pagos)',    valor:receitasLancamentos,  cor:'#10b981' },
              { label:'Receitas de agendamentos finalizados', valor:receitasAgendamentos, cor:'#10b981' },
              { label:'Total de receitas',                  valor:totalReceitas,        cor:'#10b981', bold:true },
              { label:'Total de despesas pagas',            valor:totalDespesas,        cor:'#ef4444' },
              { label:'Lucro líquido',                      valor:lucro,                cor:lucro>=0?'#6366f1':'#ef4444', bold:true },
              { label:'A receber / a pagar (pendentes)',    valor:totalPendentes,       cor:'#f59e0b' },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderRadius:'8px', background: row.bold?'#f8f8fc':'transparent', borderBottom:row.bold?'none':'1px solid #f9fafb' }}>
                <span style={{ fontSize:'14px', fontWeight:row.bold?'600':'400', color:'#374151' }}>{row.label}</span>
                <span style={{ fontSize:'15px', fontWeight:row.bold?'700':'500', color:row.cor }}>{formatarMoeda(row.valor)}</span>
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
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'✏️ Editar lançamento':'+ Novo lançamento'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
            </div>

            {/* Tipo */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
              {(['receita','despesa'] as const).map(t => (
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
                  <input type="date" value={form.data_pagamento} onChange={e=>{setForm(p=>({...p,data_pagamento:e.target.value,status:e.target.value?'pago':'pendente'}))}} style={inputStyle}/>
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
              {form.tipo === 'receita' && (
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cliente (opcional)</label>
                  <select value={form.cliente_id} onChange={f('cliente_id')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="">Sem cliente vinculado</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              )}
            </div>

            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado
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
