'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { listarClientes, criarCliente, atualizarCliente, excluirCliente } from '@/lib/api'

type Cliente = {
  id: string
  nome: string
  cpf?: string
  telefone?: string
  whatsapp?: string
  email?: string
  endereco?: string
  data_nascimento?: string
  observacoes?: string
  plano_id?: string
  status: string
  plano?: { id: string; nome: string }
}

const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }
const formVazio  = { nome:'', cpf:'', telefone:'', whatsapp:'', email:'', data_nascimento:'', endereco:'', plano_id:'', observacoes:'', status:'ativo' }

export default function ClientesPage() {
  const { empresaAtiva } = useEmpresa()
  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [busca, setBusca]         = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Cliente | null>(null)
  const [form, setForm]           = useState(formVazio)
  const [carregando, setCarregando]     = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]           = useState('')

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const { data } = await listarClientes(empresaAtiva.id)
    if (data) setClientes(data.map((c: any) => ({ ...c, plano: Array.isArray(c.plano) ? c.plano[0] : c.plano })) as Cliente[])
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = clientes.filter(c => {
    const ok = c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
               c.cpf?.includes(busca) || c.telefone?.includes(busca) || c.whatsapp?.includes(busca)
    const st = filtroStatus === 'todos' || c.status === filtroStatus
    return ok && st
  })

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro('')
    setForm(formVazio); setModalAberto(true)
  }

  function abrirEdicao(c: Cliente) {
    setModoEdicao(true); setSelecionado(c); setErro('')
    setForm({ nome:c.nome||'', cpf:c.cpf||'', telefone:c.telefone||'', whatsapp:c.whatsapp||'',
              email:c.email||'', data_nascimento:c.data_nascimento||'', endereco:c.endereco||'',
              plano_id:c.plano_id||'', observacoes:c.observacoes||'', status:c.status })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim()) return setErro('Nome é obrigatório.')
    if (!empresaAtiva?.id) return
    setSalvando(true); setErro('')
    const payload = { ...form, data_nascimento: form.data_nascimento || null, plano_id: form.plano_id || null }
    let error: any
    if (modoEdicao && selecionado) {
      ({ error } = await atualizarCliente(selecionado.id, payload))
    } else {
      ({ error } = await criarCliente(empresaAtiva.id, payload))
    }
    if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return }
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este cliente?')) return
    const { error } = await excluirCliente(id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    await carregar(); fecharModal()
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ padding:'24px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Clientes</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{clientes.length} cadastrados</p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo cliente
        </button>
      </div>

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

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'640px' }}>
            <thead>
              <tr style={{ background:'#fafafa', borderBottom:'1px solid #f3f4f6' }}>
                {['Cliente','Contato','Plano','Status',''].map(col => (
                  <th key={col} style={{ padding:'12px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} style={{ borderBottom:'1px solid #f9fafb', cursor:'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#fafafa' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent' }}>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'600', color:'#6366f1', flexShrink:0 }}>
                        {c.nome?.split(' ').map(n=>n[0]).slice(0,2).join('') || '?'}
                      </div>
                      <div>
                        <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'1px' }}>{c.nome}</p>
                        <p style={{ fontSize:'12px', color:'#9ca3af' }}>{c.email || '—'}</p>
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
                    ) : <span style={{ fontSize:'13px', color:'#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:'#eef2ff', color:'#6366f1' }}>
                      {c.plano?.nome || 'Avulso'}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background: c.status==='ativo'?'#ecfdf5':'#f9fafb', color: c.status==='ativo'?'#10b981':'#9ca3af' }}>
                      {c.status==='ativo'?'Ativo':'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <button onClick={() => abrirEdicao(c)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>✏️ Editar</button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && !carregando && (
                <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>Nenhum cliente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'560px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 18px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'✏️ Editar cliente':'+ Novo cliente'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
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
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                <select value={form.status} onChange={f('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Plano</label>
                <select value={form.plano_id} onChange={f('plano_id')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="">Sem plano (avulso)</option>
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Observações</label>
                <textarea rows={3} value={form.observacoes} onChange={f('observacoes')} style={{ ...inputStyle, resize:'none' }} placeholder="Informações adicionais..."/>
              </div>
            </div>
            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado
                ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ background: salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor: salvando?'not-allowed':'pointer' }}>
                  {salvando?'Salvando...':modoEdicao?'Salvar alterações':'Salvar cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
