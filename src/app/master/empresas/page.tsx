'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'

type Empresa = {
  id: string; nome: string; cnpj: string; email: string
  telefone: string; endereco: string; plano: string
  status: string; vencimento: string
}

const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }
const planoCor: Record<string,string> = { basico:'#6b7280', profissional:'#6366f1', enterprise:'#f59e0b' }
const planoBg:  Record<string,string> = { basico:'#f3f4f6', profissional:'#eef2ff', enterprise:'#fffbeb' }

export default function EmpresasPage() {
  const { recarregar } = useEmpresa()
  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [busca, setBusca]           = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao]   = useState(false)
  const [selecionada, setSelecionada] = useState<Empresa|null>(null)
  const [form, setForm] = useState({
    nome:'', cnpj:'', email:'', telefone:'', endereco:'',
    plano:'profissional', status:'ativo', vencimento:''
  })

  const carregar = useCallback(async () => {
    setCarregando(true)
    const sb = createClient()
    const { data } = await sb
      .from('empresas')
      .select('id,nome,cnpj,email,telefone,endereco,plano,status,vencimento')
      .order('nome')
    setEmpresas((data || []).map((e: any) => ({
      ...e,
      cnpj:       e.cnpj || '',
      email:      e.email || '',
      telefone:   e.telefone || '',
      endereco:   e.endereco || '',
      vencimento: e.vencimento || '',
    })))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const filtradas = empresas.filter(e =>
    e.nome.toLowerCase().includes(busca.toLowerCase()) ||
    e.cnpj.includes(busca) ||
    e.email.toLowerCase().includes(busca.toLowerCase())
  )

  function abrirNova() {
    setModoEdicao(false); setSelecionada(null); setErro('')
    setForm({ nome:'', cnpj:'', email:'', telefone:'', endereco:'', plano:'profissional', status:'ativo', vencimento:'' })
    setModalAberto(true)
  }

  function abrirEdicao(e: Empresa) {
    setModoEdicao(true); setSelecionada(e); setErro('')
    setForm({ nome:e.nome, cnpj:e.cnpj, email:e.email, telefone:e.telefone, endereco:e.endereco, plano:e.plano, status:e.status, vencimento:e.vencimento })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionada(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim()) return setErro('Nome e obrigatorio.')
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = {
      nome:       form.nome.trim(),
      cnpj:       form.cnpj || null,
      email:      form.email || null,
      telefone:   form.telefone || null,
      endereco:   form.endereco || null,
      plano:      form.plano,
      status:     form.status,
      vencimento: form.vencimento || null,
    }
    let error: any
    if (modoEdicao && selecionada) {
      const res = await sb.from('empresas').update(payload).eq('id', selecionada.id)
      error = res.error
    } else {
      const res = await sb.from('empresas').insert(payload)
      error = res.error
    }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    await carregar()
    recarregar()
    fecharModal()
    setSalvando(false)
  }

  async function toggleStatus(e: Empresa) {
    const sb = createClient()
    await sb.from('empresas').update({ status: e.status==='ativo'?'inativo':'ativo' }).eq('id', e.id)
    await carregar()
    recarregar()
  }

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
      setForm(p => ({...p, [k]: e.target.value}))

  const ativas = empresas.filter(e => e.status==='ativo').length

  return (
    <div style={{ padding:'24px 16px', minHeight:'100vh', background:'#f8f8fc' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <Link href="/dashboard" style={{ fontSize:'13px', color:'#9ca3af', textDecoration:'none', display:'block', marginBottom:'4px' }}>Painel</Link>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Gerenciar Empresas</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>Painel Master -- todas as empresas</p>
        </div>
        <button onClick={abrirNova} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Nova empresa
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Empresas ativas', valor:ativas,          cor:'#10b981' },
          { label:'Total empresas',  valor:empresas.length, cor:'#6b7280' },
        ].map(m => (
          <div key={m.label} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'18px 20px' }}>
            <p style={{ fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{m.label}</p>
            <p style={{ fontSize:'26px', fontWeight:'700', color:m.cor }}>{m.valor}</p>
          </div>
        ))}
      </div>

      <div style={{ position:'relative', maxWidth:'300px', marginBottom:'16px' }}>
        <input style={inputStyle} placeholder="Buscar empresa..." value={busca} onChange={e => setBusca(e.target.value)}/>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'700px' }}>
            <thead>
              <tr style={{ background:'#fafafa', borderBottom:'1px solid #f3f4f6' }}>
                {['Empresa','Plano','Vencimento','Status',''].map(c => (
                  <th key={c} style={{ padding:'12px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map(e => (
                <tr key={e.id} style={{ borderBottom:'1px solid #f9fafb' }}
                  onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background='#fafafa' }}
                  onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background='transparent' }}>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'700', color:'#6366f1', flexShrink:0 }}>
                        {e.nome.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e' }}>{e.nome}</p>
                        <p style={{ fontSize:'12px', color:'#9ca3af' }}>{e.email || e.cnpj || '--'}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:planoBg[e.plano]||'#f3f4f6', color:planoCor[e.plano]||'#6b7280', textTransform:'capitalize' }}>
                      {e.plano}
                    </span>
                  </td>
                  <td style={{ padding:'14px 16px', fontSize:'13px', color:'#6b7280' }}>
                    {e.vencimento ? new Date(e.vencimento).toLocaleDateString('pt-BR') : '--'}
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <div onClick={() => toggleStatus(e)} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background:e.status==='ativo'?'#6366f1':'#e5e7eb', position:'relative' }}>
                      <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left:e.status==='ativo'?'18px':'2px' }}/>
                    </div>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <button onClick={() => abrirEdicao(e)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>Editar</button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>Nenhuma empresa cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'Editar empresa':'Nova empresa'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>x</button>
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
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Endereco</label>
                <input value={form.endereco} onChange={f('endereco')} style={inputStyle} placeholder="Rua, numero, bairro, cidade"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Plano</label>
                <select value={form.plano} onChange={f('plano')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="basico">Basico</option>
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
            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'20px' }}>
              <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                {salvando?'Salvando...':modoEdicao?'Salvar':'Criar empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
