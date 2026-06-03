// BUILD: 1779992105
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'
import { createClient } from '@/lib/supabase'

type Cliente = {
  id: string
  nome: string
  cpf: string
  telefone: string
  whatsapp: string
  email: string
  endereco: string
  data_nascimento: string
  observacoes: string
  plano_id: string
  status: string
  plano_nome: string
}

function mascaraTel(v: string): string {
  const n = v.replace(/\D/g,'').slice(0,11)
  if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'')
  return n.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'')
}

const inputStyle = {
  width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px',
  padding: '9px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const,
}

const formVazio = {
  nome: '', cpf: '', telefone: '', whatsapp: '', email: '',
  data_nascimento: '', endereco: '', plano_id: '', observacoes: '', status: 'ativo',
}


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
export default function ClientesPage() {
  const { empresaAtiva } = useEmpresa()
  const perm = usePermissao('clientes')
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [planos, setPlanos]         = useState<{id:string;nome:string}[]>([])
  const [busca, setBusca]           = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Cliente | null>(null)
  const [form, setForm]             = useState(formVazio)
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [modalHistorico, setModalHistorico] = useState(false)
  const [clienteHistorico, setClienteHistorico] = useState<any>(null)
  const [historico, setHistorico] = useState<any[]>([])
  const [histCarregando, setHistCarregando] = useState(false)
  const [histFiltroIni, setHistFiltroIni] = useState('')
  const [histFiltroFim, setHistFiltroFim] = useState('')

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()

    // Busca clientes
    const { data: cls, error: errCls } = await sb
      .from('clientes')
      .select('id, nome, cpf, telefone, whatsapp, email, endereco, data_nascimento, observacoes, plano_id, status')
      .eq('empresa_id', empresaAtiva.id)
      .order('nome')

    if (errCls) {
      console.error('Erro ao buscar clientes:', errCls)
      setCarregando(false)
      return
    }

    // Busca planos para fazer join manual
    const { data: pls } = await sb
      .from('planos')
      .select('id, nome')
      .eq('empresa_id', empresaAtiva.id)

    const planosMap: Record<string, string> = {}
    if (pls) pls.forEach((p: any) => { planosMap[p.id] = p.nome })

    setPlanos(pls || [])
    setClientes((cls || []).map((c: any) => ({
      ...c,
      cpf:            c.cpf || '',
      telefone:       c.telefone || '',
      whatsapp:       c.whatsapp || '',
      email:          c.email || '',
      endereco:       c.endereco || '',
      data_nascimento: c.data_nascimento || '',
      observacoes:    c.observacoes || '',
      plano_id:       c.plano_id || '',
      plano_nome:     c.plano_id ? (planosMap[c.plano_id] || 'Plano') : 'Avulso',
    })))
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])
  useVisibilityRefresh(carregar)

  const filtrados = clientes.filter(c => {
    const buscaOk = c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
                    c.cpf?.includes(busca) || c.telefone?.includes(busca) ||
                    c.whatsapp?.includes(busca)
    const stOk    = filtroStatus === 'todos' || c.status === filtroStatus
    return buscaOk && stOk
  })

  async function abrirHistorico(c: any) {
    setClienteHistorico(c)
    setModalHistorico(true)
    setHistCarregando(true)
    const sb = createClient()
    const { data } = await sb
      .from('agendamentos')
      .select('id,data_inicio,status,valor,forma_pagamento,servico_id,prof_id,motivo_cancelamento,observacoes')
      .eq('empresa_id', empresaAtiva?.id || '')
      .eq('cliente_id', c.id)
      .order('data_inicio', { ascending: false })
    const servIds = Array.from(new Set((data||[]).map((a:any)=>a.servico_id).filter(Boolean)))
    const profIds  = Array.from(new Set((data||[]).map((a:any)=>a.prof_id).filter(Boolean)))
    const servMap: Record<string,string> = {}
    const profMap: Record<string,string> = {}
    if (servIds.length > 0) {
      const { data: s } = await sb.from('servicos').select('id,nome').in('id', servIds as string[])
      ;(s||[]).forEach((x:any)=>{ servMap[x.id]=x.nome })
    }
    if (profIds.length > 0) {
      const { data: p } = await sb.from('profissionais').select('id,nome').in('id', profIds as string[])
      ;(p||[]).forEach((x:any)=>{ profMap[x.id]=x.nome })
    }
    setHistorico((data||[]).map((a:any)=>({
      id: a.id,
      data: a.data_inicio ? a.data_inicio.slice(0,10) : '',
      hora: a.data_inicio ? a.data_inicio.slice(11,16) : '',
      status: a.status,
      valor: a.valor || 0,
      forma: a.forma_pagamento || '',
      servico: servMap[a.servico_id] || '--',
      profissional: profMap[a.prof_id] || '--',
      motivo: a.motivo_cancelamento || '',
      observacoes: a.observacoes || '',
    })))
    setHistCarregando(false)
  }

  function fecharHistorico() { setModalHistorico(false); setClienteHistorico(null); setHistorico([]); setHistFiltroIni(''); setHistFiltroFim('') }

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro('')
    setForm(formVazio); setModalAberto(true)
  }

  function abrirEdicao(c: Cliente) {
    setModoEdicao(true); setSelecionado(c); setErro('')
    setForm({
      nome: c.nome, cpf: c.cpf, telefone: c.telefone, whatsapp: c.whatsapp,
      email: c.email, data_nascimento: c.data_nascimento, endereco: c.endereco,
      plano_id: c.plano_id, observacoes: c.observacoes, status: c.status,
    })
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false); setSelecionado(null); setErro('')
  }

  async function salvar() {
    if (modoEdicao && !perm.alterar) return
    if (!perm.criar && !modoEdicao) return
    if (!form.nome.trim()) return setErro('Nome completo é obrigatório.')
    if (form.nome.trim().split(' ').length < 2) return setErro('Informe o nome completo (nome e sobrenome).')
    if (!form.data_nascimento) return setErro('Data de nascimento é obrigatória.')
    if (!form.whatsapp || form.whatsapp.replace(/\D/g,'').length < 10) return setErro('WhatsApp válido é obrigatório.')
    if (!form.status) return setErro('Status é obrigatório.')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErro('E-mail inválido.')
    if (!empresaAtiva?.id) return setErro('Empresa não identificada.')
    setSalvando(true); setErro('')
    const sb = createClient()

    const payload: Record<string, any> = {
      nome:            form.nome.trim(),
      cpf:             form.cpf || null,
      telefone:        form.telefone || null,
      whatsapp:        form.whatsapp || null,
      email:           form.email || null,
      data_nascimento: form.data_nascimento || null,
      endereco:        form.endereco || null,
      plano_id:        form.plano_id || null,
      observacoes:     form.observacoes || null,
      status:          form.status,
    }

    let error: any
    if (modoEdicao && selecionado) {
      const res = await sb.from('clientes').update(payload).eq('id', selecionado.id)
      error = res.error
    } else {
      const res = await sb.from('clientes').insert({ ...payload, empresa_id: empresaAtiva.id })
      error = res.error
    }

    if (error) {
      console.error('Erro ao salvar cliente:', error)
      setErro('Erro ao salvar: ' + error.message)
      setSalvando(false)
      return
    }

    await carregar()
    fecharModal()
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!perm.excluir) return
    if (!confirm('Excluir este cliente?')) return
    const sb = createClient()
    const { error } = await sb.from('clientes').delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    await carregar()
    fecharModal()
  }

  const f = (k: keyof typeof form) => (e: any) => { const v = e.target.value; const mascarados = ['telefone','whatsapp']; setForm(p => ({ ...p, [k]: mascarados.includes(k) ? mascaraTel(v) : v })) }

  return (
    <div style={{ padding: '24px 16px' }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Clientes</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{clientes.length} cadastrados</p>
        </div>
        {perm.criar && (
          <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
            + Novo cliente
          </button>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'18px', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:'200px', maxWidth:'300px' }}>
          <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}/>
        </div>
        <select style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {/* Tabela */}
      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
            <thead>
              <tr style={{ background:'#fafafa', borderBottom:'1px solid #f3f4f6' }}>
                {['Cliente','Contato','Plano','Status',''].map(col => (
                  <th key={col} style={{ padding:'12px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} style={{ borderBottom:'1px solid #f9fafb' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#fafafa' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent' }}>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'600', color:'#6366f1', flexShrink:0 }}>
                        {c.nome?.split(' ').map(n => n[0]).slice(0,2).join('')}
                      </div>
                      <div>
                        <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'1px' }}>{c.nome}</p>
                        <p style={{ fontSize:'12px', color:'#9ca3af' }}>{c.email || '--'}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    {c.whatsapp ? (
                      <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                        style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#16a34a', fontWeight:'500', textDecoration:'none' }}>
                        💬 {c.whatsapp}
                      </a>
                    ) : c.telefone ? (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#6b7280' }}>📞 {c.telefone}</span>
                    ) : <span style={{ fontSize:'13px', color:'#d1d5db' }}>--</span>}
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background: c.plano_id ? '#eef2ff' : '#f3f4f6', color: c.plano_id ? '#6366f1' : '#6b7280' }}>
                      {c.plano_nome}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background: c.status==='ativo'?'#ecfdf5':'#f9fafb', color: c.status==='ativo'?'#10b981':'#9ca3af' }}>
                      {c.status==='ativo'?'Ativo':'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    {perm.alterar && (
              <button onClick={() => abrirEdicao(c)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(99,102,241,0.15)' }} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff';el.style.boxShadow='0 3px 8px rgba(99,102,241,0.25)';el.style.transform='translateY(-1px)'}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.boxShadow='0 1px 3px rgba(99,102,241,0.15)';el.style.transform='translateY(0)'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>
              )}
                    <button onClick={() => abrirHistorico(c)} style={{ background:'white', border:'1.5px solid #d1fae5', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#059669', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(5,150,105,0.15)' }} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#f0fdf4'}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white'}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Historico
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'560px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 18px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao ? 'edit Editar cliente' : '+ Novo cliente'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>x</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome completo *</label>
                <input value={form.nome} onChange={f('nome')} style={inputStyle} placeholder="Nome do cliente"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>CPF</label>
                <input value={form.cpf} onChange={f('cpf')} style={inputStyle} placeholder="000.000.000-00"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Data de nascimento</label>
                <input type="date" value={form.data_nascimento} onChange={f('data_nascimento')} style={inputStyle}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>WhatsApp</label>
                <input value={form.whatsapp} onChange={f('whatsapp')} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail</label>
                <input type="email" value={form.email} onChange={f('email')} style={inputStyle} placeholder="email@exemplo.com"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Endereço</label>
                <input value={form.endereco} onChange={f('endereco')} style={inputStyle} placeholder="Rua, número, bairro"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Plano</label>
                <select value={form.plano_id} onChange={f('plano_id')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="">Sem plano (avulso)</option>
                  {planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                <select value={form.status} onChange={f('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Observações</label>
                <textarea rows={3} value={form.observacoes} onChange={f('observacoes')} style={{ ...inputStyle, resize:'none' }} placeholder="Informações adicionais..."/>
              </div>
            </div>
            {erro && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>
                {erro}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado
                ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                {(modoEdicao ? perm.alterar : perm.criar) && (
            <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Salvar cliente'}
                </button>
            )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historico do Cliente */}
      {modalHistorico && clienteHistorico && (
        <div onClick={fecharHistorico} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'680px', borderRadius:'20px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>
            {/* Header */}
            <div style={{ padding:'22px 24px 16px', borderBottom:'1px solid #f0f0f8', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'42px', height:'42px', borderRadius:'50%', background:'linear-gradient(135deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color:'white', flexShrink:0 }}>
                  {clienteHistorico.nome?.split(' ').slice(0,2).map((n:string)=>n[0]).join('')}
                </div>
                <div>
                  <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a' }}>Historico - {clienteHistorico.nome}</h2>
                  <p style={{ fontSize:'12px', color:'#9ca3af' }}>{clienteHistorico.whatsapp || clienteHistorico.telefone || clienteHistorico.email || ''}</p>
                </div>
              </div>
              <button onClick={fecharHistorico} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'32px', height:'32px', cursor:'pointer', fontSize:'16px' }}>x</button>
            </div>
            {/* Filtro de periodo */}
            <div style={{ padding:'14px 24px', borderBottom:'1px solid #f5f5fb', display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
              <span style={{ fontSize:'12px', color:'#6b7280', fontWeight:'600' }}>Periodo:</span>
              <input type="date" value={histFiltroIni} onChange={e=>setHistFiltroIni(e.target.value)} style={{ border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'6px 10px', fontSize:'13px', outline:'none' }}/>
              <span style={{ fontSize:'12px', color:'#9ca3af' }}>ate</span>
              <input type="date" value={histFiltroFim} onChange={e=>setHistFiltroFim(e.target.value)} style={{ border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'6px 10px', fontSize:'13px', outline:'none' }}/>
              <button onClick={()=>{setHistFiltroIni('');setHistFiltroFim('')}} style={{ background:'#f3f4f6', border:'none', borderRadius:'8px', padding:'6px 12px', fontSize:'12px', cursor:'pointer', color:'#6b7280' }}>Limpar</button>
              {(() => {
                const filt = historico.filter(h => {
                  if (histFiltroIni && h.data < histFiltroIni) return false
                  if (histFiltroFim && h.data > histFiltroFim) return false
                  return true
                })
                const total = filt.filter(h=>h.status==='fechado').reduce((s:number,h:any)=>s+(h.valor||0),0)
                return <span style={{ marginLeft:'auto', fontSize:'13px', fontWeight:'700', color:'#059669' }}>Total recebido: R$ {total.toFixed(2).replace('.',',')}</span>
              })()}
            </div>
            {/* Lista */}
            <div style={{ flex:1, overflowY:'auto', padding:'8px 24px 20px' }}>
              {histCarregando ? (
                <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div>
              ) : (() => {
                const filt = historico.filter(h => {
                  if (histFiltroIni && h.data < histFiltroIni) return false
                  if (histFiltroFim && h.data > histFiltroFim) return false
                  return true
                })
                if (filt.length === 0) return <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum atendimento encontrado.</div>
                return filt.map((h:any) => (
                  <div key={h.id} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'14px 16px', borderRadius:'12px', border:'1px solid #f0f0f8', marginBottom:'8px', background:h.status==='fechado'?'#f0fdf4':h.status==='cancelado'?'#fff1f2':'#f8faff' }}>
                    <div style={{ width:'44px', textAlign:'center', flexShrink:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:'700', color:'#374151', fontFamily:'monospace' }}>{h.hora}</p>
                      <p style={{ fontSize:'10px', color:'#9ca3af' }}>{h.data ? new Date(h.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : ''}</p>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.servico}</p>
                      <p style={{ fontSize:'12px', color:'#6b7280' }}>{h.profissional}</p>
                      {h.observacoes && (
                        <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'4px', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {h.observacoes}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <p style={{ fontSize:'14px', fontWeight:'700', color:h.status==='fechado'?'#059669':'#9ca3af' }}>
                        {h.status==='fechado' ? 'R$ '+Number(h.valor).toFixed(2).replace('.',',') : '--'}
                      </p>
                      <p style={{ fontSize:'11px', color:'#9ca3af' }}>{h.forma || ''}</p>
                    </div>
                    <span style={{ fontSize:'10px', fontWeight:'700', padding:'3px 8px', borderRadius:'99px', flexShrink:0, background:h.status==='fechado'?'#d1fae5':h.status==='cancelado'?'#ffe4e6':'#dbeafe', color:h.status==='fechado'?'#065f46':h.status==='cancelado'?'#be123c':'#1d4ed8' }}>
                      {h.status==='fechado'?'Finalizado':h.status==='cancelado'?'Cancelado':'Aberto'}
                    </span>
                  </div>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
