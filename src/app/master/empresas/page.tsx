'use client'

import { useState } from 'react'
import Link from 'next/link'

type Empresa = {
  id: string
  nome: string
  cnpj: string
  email: string
  telefone: string
  plano: string
  status: string
  vencimento: string
  usuarios: number
  agendamentos: number
}

const empresasIniciais: Empresa[] = [
  { id:'1', nome:'Studio Demo',       cnpj:'00.000.000/0001-00', email:'demo@studio.com',      telefone:'(11) 99999-0001', plano:'profissional', status:'ativo',   vencimento:'31/12/2025', usuarios:4, agendamentos:124 },
  { id:'2', nome:'Clínica Saúde+',    cnpj:'11.111.111/0001-11', email:'contato@saudemais.com', telefone:'(11) 99999-0002', plano:'enterprise',   status:'ativo',   vencimento:'30/06/2025', usuarios:8, agendamentos:312 },
  { id:'3', nome:'Espaço Terapêutico',cnpj:'22.222.222/0001-22', email:'contato@espaco.com',    telefone:'(11) 99999-0003', plano:'basico',       status:'ativo',   vencimento:'28/02/2025', usuarios:2, agendamentos:45  },
  { id:'4', nome:'Physio Center',     cnpj:'33.333.333/0001-33', email:'contato@physio.com',    telefone:'(11) 99999-0004', plano:'profissional', status:'inativo', vencimento:'15/01/2025', usuarios:3, agendamentos:0   },
]

const planoCor: Record<string, string> = { basico:'#6b7280', profissional:'#6366f1', enterprise:'#f59e0b' }
const planoBg:  Record<string, string> = { basico:'#f3f4f6', profissional:'#eef2ff', enterprise:'#fffbeb' }
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>(empresasIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [selecionada, setSelecionada] = useState<Empresa | null>(null)
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({ nome:'', cnpj:'', email:'', telefone:'', plano:'profissional', status:'ativo', vencimento:'' })

  const filtradas = empresas.filter(e =>
    e.nome.toLowerCase().includes(busca.toLowerCase()) ||
    e.cnpj.includes(busca) || e.email.toLowerCase().includes(busca.toLowerCase())
  )

  function abrirNova() {
    setModoEdicao(false); setSelecionada(null)
    setForm({ nome:'', cnpj:'', email:'', telefone:'', plano:'profissional', status:'ativo', vencimento:'' })
    setModalAberto(true)
  }

  function abrirEdicao(e: Empresa) {
    setModoEdicao(true); setSelecionada(e)
    setForm({ nome:e.nome, cnpj:e.cnpj, email:e.email, telefone:e.telefone, plano:e.plano, status:e.status, vencimento:e.vencimento })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionada(null) }

  function salvar() {
    if (!form.nome.trim()) return
    if (modoEdicao && selecionada) {
      setEmpresas(prev => prev.map(e => e.id === selecionada.id ? { ...e, ...form } : e))
    } else {
      setEmpresas(prev => [...prev, { id: Date.now().toString(), ...form, usuarios:0, agendamentos:0 }])
    }
    fecharModal()
  }

  function excluir(id: string) {
    if (confirm('Excluir esta empresa? Esta ação não pode ser desfeita.')) {
      setEmpresas(prev => prev.filter(e => e.id !== id)); fecharModal()
    }
  }

  function toggleStatus(id: string) {
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, status: e.status==='ativo'?'inativo':'ativo' } : e))
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(prev => ({...prev, [k]:e.target.value}))

  const ativas   = empresas.filter(e => e.status==='ativo').length
  const totalUs  = empresas.reduce((s,e) => s+e.usuarios, 0)
  const totalAg  = empresas.reduce((s,e) => s+e.agendamentos, 0)

  return (
    <div style={{ padding:'24px 16px', minHeight:'100vh', background:'#f8f8fc' }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
            <Link href="/dashboard" style={{ fontSize:'13px', color:'#9ca3af', textDecoration:'none' }}>← Dashboard</Link>
          </div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>🏢 Gerenciar Empresas</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>Painel Master — todas as empresas do sistema</p>
        </div>
        <button onClick={abrirNova} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Nova empresa
        </button>
      </div>

      {/* Métricas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Empresas ativas',    valor:ativas,            cor:'#ecfdf5', corT:'#10b981' },
          { label:'Total de usuários',  valor:totalUs,           cor:'#eef2ff', corT:'#6366f1' },
          { label:'Agendamentos total', valor:totalAg,           cor:'#fffbeb', corT:'#f59e0b' },
          { label:'Total de empresas',  valor:empresas.length,   cor:'#f3f4f6', corT:'#6b7280' },
        ].map(m => (
          <div key={m.label} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'18px 20px' }}>
            <p style={{ fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{m.label}</p>
            <p style={{ fontSize:'26px', fontWeight:'700', color:m.corT }}>{m.valor}</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div style={{ position:'relative', maxWidth:'300px', marginBottom:'16px' }}>
        <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
        <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar empresa..." value={busca} onChange={e => setBusca(e.target.value)}/>
      </div>

      {/* Tabela */}
      <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', overflow:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'700px' }}>
          <thead>
            <tr style={{ background:'#fafafa', borderBottom:'1px solid #f3f4f6' }}>
              {['Empresa','CNPJ','Plano','Usuários','Agendamentos','Vencimento','Status',''].map(c => (
                <th key={c} style={{ padding:'12px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtradas.map(e => (
              <tr key={e.id} style={{ borderBottom:'1px solid #f9fafb', transition:'background .1s', cursor:'pointer' }}
                onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background='#fafafa' }}
                onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background='transparent' }}>
                <td style={{ padding:'14px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'700', color:'#6366f1', flexShrink:0 }}>
                      {e.nome.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e' }}>{e.nome}</p>
                      <p style={{ fontSize:'12px', color:'#9ca3af' }}>{e.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding:'14px 16px', fontSize:'12px', color:'#6b7280', fontFamily:'monospace' }}>{e.cnpj}</td>
                <td style={{ padding:'14px 16px' }}>
                  <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:planoBg[e.plano], color:planoCor[e.plano], textTransform:'capitalize' }}>{e.plano}</span>
                </td>
                <td style={{ padding:'14px 16px', fontSize:'14px', fontWeight:'600', color:'#374151', textAlign:'center' }}>{e.usuarios}</td>
                <td style={{ padding:'14px 16px', fontSize:'14px', fontWeight:'600', color:'#374151', textAlign:'center' }}>{e.agendamentos}</td>
                <td style={{ padding:'14px 16px', fontSize:'13px', color:'#6b7280' }}>{e.vencimento}</td>
                <td style={{ padding:'14px 16px' }}>
                  <div onClick={() => toggleStatus(e.id)} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background: e.status==='ativo'?'#6366f1':'#e5e7eb', position:'relative' }}>
                    <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left: e.status==='ativo'?'18px':'2px' }}/>
                  </div>
                </td>
                <td style={{ padding:'14px 16px' }}>
                  <button onClick={() => abrirEdicao(e)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>✏️ Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'✏️ Editar empresa':'🏢 Nova empresa'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome da empresa *</label>
                <input value={form.nome} onChange={f('nome')} style={inputStyle} placeholder="Nome da empresa"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>CNPJ</label>
                <input value={form.cnpj} onChange={f('cnpj')} style={inputStyle} placeholder="00.000.000/0001-00"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail</label>
                <input type="email" value={form.email} onChange={f('email')} style={inputStyle} placeholder="contato@empresa.com"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Plano</label>
                <select value={form.plano} onChange={f('plano')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="basico">Básico</option>
                  <option value="profissional">Profissional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Vencimento</label>
                <input type="date" value={form.vencimento} onChange={f('vencimento')} style={inputStyle}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                <select value={form.status} onChange={f('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionada
                ? <button onClick={() => excluir(selecionada.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
                  {modoEdicao?'Salvar alterações':'Criar empresa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
