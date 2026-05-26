'use client'

import { useState } from 'react'
import Link from 'next/link'

type Usuario = {
  id: string
  nome: string
  email: string
  telefone: string
  cargo: string
  nivel_acesso: string
  empresa: string
  empresa_id: string
  status: string
}

const empresasMock = [
  { id:'1', nome:'Studio Demo'        },
  { id:'2', nome:'Clínica Saúde+'     },
  { id:'3', nome:'Espaço Terapêutico' },
  { id:'4', nome:'Physio Center'      },
]

const usuariosIniciais: Usuario[] = [
  { id:'1', nome:'Lucas Fortitude',   email:'lucas@fortitude.com',  telefone:'(11) 99999-9999', cargo:'Master',        nivel_acesso:'master',        empresa:'—',                  empresa_id:'',  status:'ativo' },
  { id:'2', nome:'Carlos Souza',      email:'carlos@studio.com',    telefone:'(11) 99999-0010', cargo:'Admin',         nivel_acesso:'admin',         empresa:'Studio Demo',        empresa_id:'1', status:'ativo' },
  { id:'3', nome:'Ana Lima',          email:'ana@studio.com',       telefone:'(11) 99999-0011', cargo:'Fisioterapeuta',nivel_acesso:'profissional',   empresa:'Studio Demo',        empresa_id:'1', status:'ativo' },
  { id:'4', nome:'Dr. João Santos',   email:'joao@saudemais.com',   telefone:'(11) 99999-0020', cargo:'Admin',         nivel_acesso:'admin',         empresa:'Clínica Saúde+',     empresa_id:'2', status:'ativo' },
  { id:'5', nome:'Maria Oliveira',    email:'maria@espaco.com',     telefone:'(11) 99999-0030', cargo:'Terapeuta',     nivel_acesso:'profissional',   empresa:'Espaço Terapêutico', empresa_id:'3', status:'inativo'},
]

const nivelLabel: Record<string, string> = { master:'Master', admin:'Administrador', profissional:'Profissional' }
const nivelCor:   Record<string, string> = { master:'#6366f1', admin:'#06b6d4', profissional:'#10b981' }
const nivelBg:    Record<string, string> = { master:'#eef2ff', admin:'#ecfeff', profissional:'#ecfdf5' }
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function UsuariosMasterPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [selecionado, setSelecionado] = useState<Usuario | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [form, setForm] = useState({ nome:'', email:'', telefone:'', cargo:'', nivel_acesso:'profissional', empresa_id:'', status:'ativo', senha:'' })

  const filtrados = usuarios.filter(u => {
    const buscaOk = u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())
    const nivelOk = filtroNivel==='todos' || u.nivel_acesso===filtroNivel
    return buscaOk && nivelOk
  })

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null)
    setForm({ nome:'', email:'', telefone:'', cargo:'', nivel_acesso:'profissional', empresa_id:'', status:'ativo', senha:'' })
    setModalAberto(true)
  }

  function abrirEdicao(u: Usuario) {
    setModoEdicao(true); setSelecionado(u)
    setForm({ nome:u.nome, email:u.email, telefone:u.telefone, cargo:u.cargo, nivel_acesso:u.nivel_acesso, empresa_id:u.empresa_id, status:u.status, senha:'' })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null) }

  function salvar() {
    if (!form.nome.trim() || !form.email.trim()) return
    const empresa = empresasMock.find(e => e.id===form.empresa_id)
    if (modoEdicao && selecionado) {
      setUsuarios(prev => prev.map(u => u.id===selecionado.id ? { ...u, ...form, empresa: empresa?.nome||'—' } : u))
    } else {
      setUsuarios(prev => [...prev, { id:Date.now().toString(), ...form, empresa: empresa?.nome||'—' }])
    }
    fecharModal()
  }

  function excluir(id: string) {
    if (confirm('Excluir este usuário?')) { setUsuarios(prev => prev.filter(u => u.id!==id)); fecharModal() }
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(prev => ({...prev, [k]:e.target.value}))

  return (
    <div style={{ padding:'24px 16px', minHeight:'100vh', background:'#f8f8fc' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ marginBottom:'4px' }}>
            <Link href="/dashboard" style={{ fontSize:'13px', color:'#9ca3af', textDecoration:'none' }}>← Dashboard</Link>
          </div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>👑 Usuários do Sistema</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>Painel Master — todos os usuários de todas as empresas</p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo usuário
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:'200px', maxWidth:'280px' }}>
          <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}/>
        </div>
        <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }}>
          <option value="todos">Todos os níveis</option>
          <option value="master">Master</option>
          <option value="admin">Administrador</option>
          <option value="profissional">Profissional</option>
        </select>
      </div>

      {/* Lista */}
      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {filtrados.map(u => (
          <div key={u.id} style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'16px 20px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
            <div style={{ width:'42px', height:'42px', borderRadius:'50%', background: nivelBg[u.nivel_acesso], display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'700', color: nivelCor[u.nivel_acesso], flexShrink:0 }}>
              {u.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
            </div>
            <div style={{ flex:1, minWidth:'160px' }}>
              <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>{u.nome}</p>
              <p style={{ fontSize:'12px', color:'#9ca3af' }}>{u.email}</p>
            </div>
            <div style={{ minWidth:'120px' }}>
              <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Empresa</p>
              <p style={{ fontSize:'13px', color:'#374151', fontWeight:'500' }}>{u.empresa}</p>
            </div>
            <div style={{ minWidth:'80px' }}>
              <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Cargo</p>
              <p style={{ fontSize:'13px', color:'#374151' }}>{u.cargo}</p>
            </div>
            <span style={{ fontSize:'12px', fontWeight:'500', padding:'4px 12px', borderRadius:'99px', background:nivelBg[u.nivel_acesso], color:nivelCor[u.nivel_acesso] }}>
              {nivelLabel[u.nivel_acesso]}
            </span>
            <span style={{ fontSize:'12px', fontWeight:'500', padding:'4px 12px', borderRadius:'99px', background: u.status==='ativo'?'#ecfdf5':'#f9fafb', color: u.status==='ativo'?'#10b981':'#9ca3af' }}>
              {u.status==='ativo'?'Ativo':'Inativo'}
            </span>
            <button onClick={() => abrirEdicao(u)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>
              ✏️ Editar
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'✏️ Editar usuário':'+ Novo usuário'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome completo *</label>
                <input value={form.nome} onChange={f('nome')} style={inputStyle} placeholder="Nome do usuário"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail *</label>
                <input type="email" value={form.email} onChange={f('email')} style={inputStyle} placeholder="email@empresa.com"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cargo</label>
                <input value={form.cargo} onChange={f('cargo')} style={inputStyle} placeholder="Ex: Terapeuta"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nível de acesso</label>
                <select value={form.nivel_acesso} onChange={f('nivel_acesso')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="profissional">Profissional</option>
                  <option value="admin">Administrador</option>
                  <option value="master">Master</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Empresa</label>
                <select value={form.empresa_id} onChange={f('empresa_id')} style={{ ...inputStyle, padding:'9px 12px' }} disabled={form.nivel_acesso==='master'}>
                  <option value="">— Sem empresa (master) —</option>
                  {empresasMock.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              {!modoEdicao && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Senha inicial</label>
                  <input type="password" value={form.senha} onChange={f('senha')} style={inputStyle} placeholder="Mínimo 8 caracteres"/>
                </div>
              )}
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                <select value={form.status} onChange={f('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado
                ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
                  {modoEdicao?'Salvar alterações':'Criar usuário'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
