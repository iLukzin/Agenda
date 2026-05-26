'use client'

import { useState } from 'react'

type Cliente = {
  id: number
  nome: string
  cpf: string
  telefone: string
  whatsapp: string
  email: string
  dataNascimento: string
  endereco: string
  plano: string
  sessoes: string
  observacoes: string
  status: string
  ultima: string
}

const clientesIniciais: Cliente[] = [
  { id:1, nome:'Maria Silva',    cpf:'123.456.789-00', telefone:'(11) 99999-0001', whatsapp:'(11) 99998-0001', email:'maria@email.com',  dataNascimento:'1990-05-15', endereco:'Rua das Flores, 123', plano:'Plano 8 sessões', sessoes:'5/8', observacoes:'',                    status:'ativo',   ultima:'08/01/2024' },
  { id:2, nome:'João Santos',    cpf:'234.567.890-11', telefone:'(11) 99999-0002', whatsapp:'',                email:'joao@email.com',   dataNascimento:'1985-08-20', endereco:'Av. Central, 456',   plano:'Avulso',          sessoes:'—',   observacoes:'Alérgico a látex',   status:'ativo',   ultima:'10/01/2024' },
  { id:3, nome:'Ana Costa',      cpf:'345.678.901-22', telefone:'(11) 99999-0003', whatsapp:'(11) 99998-0003', email:'ana@email.com',    dataNascimento:'1995-03-10', endereco:'Rua Verde, 789',     plano:'Plano 4 sessões', sessoes:'2/4', observacoes:'',                    status:'ativo',   ultima:'07/01/2024' },
  { id:4, nome:'Pedro Oliveira', cpf:'456.789.012-33', telefone:'(11) 99999-0004', whatsapp:'',                email:'pedro@email.com',  dataNascimento:'1978-11-25', endereco:'Rua Azul, 321',      plano:'Plano Ilimitado', sessoes:'∞',   observacoes:'Prefere tarde',      status:'ativo',   ultima:'09/01/2024' },
  { id:5, nome:'Lucia Ferreira', cpf:'567.890.123-44', telefone:'(11) 99999-0005', whatsapp:'(11) 99998-0005', email:'lucia@email.com',  dataNascimento:'1992-07-18', endereco:'Av. Brasil, 654',    plano:'Avulso',          sessoes:'—',   observacoes:'',                    status:'inativo', ultima:'15/12/2023' },
  { id:6, nome:'Carlos Mendes',  cpf:'678.901.234-55', telefone:'(11) 99999-0006', whatsapp:'',                email:'carlos@email.com', dataNascimento:'1988-02-14', endereco:'Rua Boa Vista, 987', plano:'Plano 8 sessões', sessoes:'8/8', observacoes:'Pagamento sempre PIX',status:'ativo',   ultima:'11/01/2024' },
]

const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciais)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroPlano, setFiltroPlano] = useState('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [form, setForm] = useState<Omit<Cliente,'id'|'sessoes'|'ultima'>>({
    nome:'', cpf:'', telefone:'', whatsapp:'', email:'',
    dataNascimento:'', endereco:'', plano:'', observacoes:'', status:'ativo',
  })

  const filtrados = clientes.filter(c => {
    const buscaOk = c.nome.toLowerCase().includes(busca.toLowerCase()) || c.cpf.includes(busca) || c.telefone.includes(busca)
    const statusOk = filtroStatus === 'todos' || c.status === filtroStatus
    const planoOk  = filtroPlano  === 'todos' || c.plano  === filtroPlano
    return buscaOk && statusOk && planoOk
  })

  function abrirNovo() {
    setModoEdicao(false)
    setClienteSelecionado(null)
    setForm({ nome:'', cpf:'', telefone:'', whatsapp:'', email:'', dataNascimento:'', endereco:'', plano:'', observacoes:'', status:'ativo' })
    setModalAberto(true)
  }

  function abrirEdicao(c: Cliente) {
    setModoEdicao(true)
    setClienteSelecionado(c)
    setForm({ nome:c.nome, cpf:c.cpf, telefone:c.telefone, whatsapp:c.whatsapp, email:c.email, dataNascimento:c.dataNascimento, endereco:c.endereco, plano:c.plano, observacoes:c.observacoes, status:c.status })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setClienteSelecionado(null); setModoEdicao(false) }

  function salvar() {
    if (!form.nome.trim()) return
    if (modoEdicao && clienteSelecionado) {
      setClientes(prev => prev.map(c => c.id === clienteSelecionado.id ? { ...c, ...form } : c))
    } else {
      setClientes(prev => [...prev, { ...form, id: Date.now(), sessoes:'—', ultima:'Hoje' }])
    }
    fecharModal()
  }

  function excluir(id: number) {
    if (confirm('Deseja excluir este cliente?')) {
      setClientes(prev => prev.filter(c => c.id !== id))
      fecharModal()
    }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div style={{ padding:'24px 16px' }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Clientes</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{clientes.length} cadastrados</p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo cliente
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'18px', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:'200px', maxWidth:'300px' }}>
          <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}/>
        </div>
        <select style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
        <select style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }} value={filtroPlano} onChange={e => setFiltroPlano(e.target.value)}>
          <option value="todos">Todos os planos</option>
          <option value="Avulso">Avulso</option>
          <option value="Plano 4 sessões">Plano 4 sessões</option>
          <option value="Plano 8 sessões">Plano 8 sessões</option>
          <option value="Plano Ilimitado">Plano Ilimitado</option>
        </select>
      </div>

      {/* Tabela */}
      <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'640px' }}>
          <thead>
            <tr style={{ background:'#fafafa', borderBottom:'1px solid #f3f4f6' }}>
              {['Cliente','Contato','Plano','Sessões','Última visita','Status',''].map(col => (
                <th key={col} style={{ padding:'12px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(c => (
              <tr key={c.id} style={{ borderBottom:'1px solid #f9fafb', cursor:'pointer', transition:'background .1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='#fafafa' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent' }}>
                <td style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'600', color:'#6366f1', flexShrink:0 }}>
                      {c.nome.split(' ').map(n=>n[0]).slice(0,2).join('')}
                    </div>
                    <div>
                      <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'1px' }}>{c.nome}</p>
                      <p style={{ fontSize:'12px', color:'#9ca3af' }}>{c.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding:'14px 16px' }}>{c.whatsapp ? (<a href={`https://wa.me/55${c.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#16a34a', fontWeight:'500', textDecoration:'none' }}><span style={{ fontSize:'15px' }}>💬</span>{c.whatsapp}</a>) : c.telefone ? (<span style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#6b7280' }}><span style={{ fontSize:'15px' }}>📞</span>{c.telefone}</span>) : (<span style={{ fontSize:'13px', color:'#d1d5db' }}>—</span>)}</td>
                <td style={{ padding:'14px 16px' }}>
                  <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background: c.plano==='Avulso'?'#f3f4f6':'#eef2ff', color: c.plano==='Avulso'?'#6b7280':'#6366f1' }}>{c.plano}</span>
                </td>
                <td style={{ padding:'14px 16px', fontSize:'13px', color:'#374151', fontWeight:'500' }}>{c.sessoes}</td>
                <td style={{ padding:'14px 16px', fontSize:'13px', color:'#6b7280' }}>{c.ultima}</td>
                <td style={{ padding:'14px 16px' }}>
                  <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background: c.status==='ativo'?'#ecfdf5':'#f9fafb', color: c.status==='ativo'?'#10b981':'#9ca3af' }}>
                    {c.status==='ativo'?'Ativo':'Inativo'}
                  </span>
                </td>
                <td style={{ padding:'14px 16px' }}>
                  <button onClick={() => abrirEdicao(c)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>
                    ✏️ Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>Nenhum cliente encontrado</div>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'560px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 18px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao ? '✏️ Editar cliente' : '+ Novo cliente'}</h2>
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
                <input type="date" value={form.dataNascimento} onChange={f('dataNascimento')} style={inputStyle}/>
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
                <input value={form.endereco} onChange={f('endereco')} style={inputStyle} placeholder="Rua, número, bairro, cidade"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Plano</label>
                <select value={form.plano} onChange={f('plano')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="">Sem plano (avulso)</option>
                  <option>Plano 4 sessões</option>
                  <option>Plano 8 sessões</option>
                  <option>Plano Ilimitado</option>
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
                <textarea rows={3} value={form.observacoes} onChange={f('observacoes')} style={{ ...inputStyle, resize:'none' }} placeholder="Informações adicionais sobre o cliente..."/>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && clienteSelecionado ? (
                <button onClick={() => excluir(clienteSelecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>
                  🗑 Excluir
                </button>
              ) : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
                  {modoEdicao ? 'Salvar alterações' : 'Salvar cliente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
