'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'

type Empresa = { id:string; nome:string; cnpj:string; email:string; telefone:string; endereco:string; plano:string; status:string; vencimento:string; bloqueada:boolean; motivo_bloqueio:string }

const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }
const planoCor: Record<string,string> = { basico:'#6b7280', profissional:'#6366f1', enterprise:'#f59e0b' }
const planoBg:  Record<string,string> = { basico:'#f3f4f6', profissional:'#eef2ff', enterprise:'#fffbeb' }

function formVazio() { return { nome:'', cnpj:'', email:'', telefone:'', endereco:'', plano:'profissional', status:'ativo', vencimento:'', bloqueada:false, motivo_bloqueio:'' } }

export default function EmpresasPage() {
  const router = useRouter()
  const { recarregar, isMaster } = useEmpresa()
  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [busca, setBusca]           = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao]   = useState(false)
  const [selecionada, setSelecionada] = useState<Empresa | null>(null)
  const [form, setForm] = useState(formVazio())
  const ativas = empresas.filter(e => e.status === 'ativo').length

  const carregar = useCallback(async () => {
    setCarregando(true)
    const sb = createClient()
    const { data } = await sb.from('empresas').select('id,nome,cnpj,email,telefone,endereco,plano,status,vencimento,bloqueada,motivo_bloqueio').order('nome')
    setEmpresas((data || []).map((e: any) => ({ id:e.id, nome:e.nome||'', cnpj:e.cnpj||'', email:e.email||'', telefone:e.telefone||'', endereco:e.endereco||'', plano:e.plano||'profissional', status:e.status||'ativo', vencimento:e.vencimento||'', bloqueada:e.bloqueada||false, motivo_bloqueio:e.motivo_bloqueio||'' })))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const filtradas = empresas.filter(e => {
    const nome = e.nome.toLowerCase().includes(busca.toLowerCase())
    const cnpj = e.cnpj.includes(busca)
    const mail = e.email.toLowerCase().includes(busca.toLowerCase())
    return nome || cnpj || mail
  })

  function abrirNova() { setModoEdicao(false); setSelecionada(null); setErro(''); setForm(formVazio()); setModalAberto(true) }

  function abrirEdicao(e: Empresa) {
    setModoEdicao(true); setSelecionada(e); setErro('')
    setForm({ nome:e.nome, cnpj:e.cnpj, email:e.email, telefone:e.telefone, endereco:e.endereco, plano:e.plano, status:e.status, vencimento:e.vencimento, bloqueada:e.bloqueada, motivo_bloqueio:e.motivo_bloqueio })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionada(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim()) return setErro('Nome e obrigatorio.')
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = { nome:form.nome.trim(), cnpj:form.cnpj||null, email:form.email||null, telefone:form.telefone||null, endereco:form.endereco||null, plano:form.plano, status:form.status, vencimento:form.vencimento||null, bloqueada:form.bloqueada, motivo_bloqueio:form.bloqueada?(form.motivo_bloqueio||'Falta de pagamento'):null }
    let error: any
    if (modoEdicao && selecionada) { const res = await sb.from('empresas').update(payload).eq('id', selecionada.id); error = res.error }
    else { const res = await sb.from('empresas').insert(payload); error = res.error }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    await carregar(); recarregar(); fecharModal(); setSalvando(false)
  }

  async function toggleStatus(e: Empresa) {
    const sb = createClient()
    const novoStatus = e.status === 'ativo' ? 'inativo' : 'ativo'
    await sb.from('empresas').update({ status: novoStatus }).eq('id', e.id)
    await carregar(); recarregar()
  }

  async function toggleBloqueio(e: Empresa) {
    const novo = !e.bloqueada
    const motivo = novo ? (prompt('Motivo do bloqueio:') || 'Falta de pagamento') : null
    if (novo && motivo === null) return
    const sb = createClient()
    await sb.from('empresas').update({ bloqueada: novo, motivo_bloqueio: motivo }).eq('id', e.id)
    await carregar(); recarregar()
    if (novo) alert('Empresa bloqueada. Usuarios serao deslogados automaticamente.')
  }

  const sf = (k: string) => (e: any) => setForm((p: any) => ({ ...p, [k]: e.target.value }))
  const sb2 = (k: string) => (v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  if (!isMaster) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'12px' }}>
      <p style={{ fontSize:'16px', fontWeight:'700', color:'#374151' }}>Acesso restrito ao Master</p>
    </div>
  )

  return (
    <div style={{ padding:'24px 16px', minHeight:'100vh', background:'#f4f5fb' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ display:'flex', alignItems:'center', gap:'8px', background:'white', border:'1.5px solid #e0e7ff', borderRadius:'12px', padding:'9px 16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', color:'#4f46e5', boxShadow:'0 1px 4px rgba(99,102,241,0.12)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </button>
          <div>
            <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px', lineHeight:1 }}>Gerenciar Empresas</h1>
            <p style={{ fontSize:'13px', color:'#6b7280', marginTop:'3px' }}>Painel Master</p>
          </div>
        </div>
        <button onClick={abrirNova} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'10px', padding:'9px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
          + Nova empresa
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:'14px', marginBottom:'20px' }}>
        {[{ label:'Empresas ativas', valor:ativas, cor:'#10b981' }, { label:'Total empresas', valor:empresas.length, cor:'#6b7280' }].map(m => (
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
                <tr key={e.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                  <td style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:e.bloqueada?'#fef2f2':'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'700', color:e.bloqueada?'#ef4444':'#6366f1', flexShrink:0 }}>
                        {e.nome.charAt(0)}
                      </div>
                      <div>
                        <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e' }}>{e.nome}</p>
                        <p style={{ fontSize:'12px', color:'#9ca3af' }}>{e.email || e.cnpj || '--'}</p>
                        {e.bloqueada && <span style={{ fontSize:'10px', fontWeight:'700', color:'#dc2626', background:'#fef2f2', borderRadius:'4px', padding:'1px 6px' }}>BLOQUEADA</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'14px 16px' }}>
                    <span style={{ fontSize:'12px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:planoBg[e.plano]||'#f3f4f6', color:planoCor[e.plano]||'#6b7280', textTransform:'capitalize' }}>{e.plano}</span>
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
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={() => abrirEdicao(e)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(99,102,241,0.15)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editar
                      </button>
                      <button onClick={() => toggleBloqueio(e)} style={{ background:e.bloqueada?'#ecfdf5':'#fef2f2', color:e.bloqueada?'#10b981':'#ef4444', border:e.bloqueada?'1px solid #6ee7b7':'1px solid #fecaca', borderRadius:'8px', padding:'6px 12px', fontSize:'12px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        {e.bloqueada ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'14px' }}>Nenhuma empresa cadastrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px', padding:'28px 24px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a' }}>{modoEdicao ? 'Editar empresa' : 'Nova empresa'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>x</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome *</label>
                <input value={form.nome} onChange={sf('nome')} style={inputStyle} placeholder="Nome da empresa"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>CNPJ</label>
                <input value={form.cnpj} onChange={sf('cnpj')} style={inputStyle} placeholder="00.000.000/0001-00"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                <input value={form.telefone} onChange={sf('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail</label>
                <input type="email" value={form.email} onChange={sf('email')} style={inputStyle} placeholder="contato@empresa.com"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Endereco</label>
                <input value={form.endereco} onChange={sf('endereco')} style={inputStyle} placeholder="Rua, numero, bairro"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Plano</label>
                <select value={form.plano} onChange={sf('plano')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="basico">Basico</option>
                  <option value="profissional">Profissional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Vencimento</label>
                <input type="date" value={form.vencimento} onChange={sf('vencimento')} style={inputStyle}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                <select value={form.status} onChange={sf('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
              <div style={{ gridColumn:'1/-1', background:form.bloqueada?'#fef2f2':'#f9fafb', borderRadius:'12px', padding:'14px 16px', border:form.bloqueada?'1.5px solid #fca5a5':'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:form.bloqueada?'12px':'0' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'600', color:form.bloqueada?'#dc2626':'#374151' }}>Bloquear acesso da empresa</p>
                    <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'2px' }}>Usuarios nao conseguirao fazer login</p>
                  </div>
                  <div onClick={() => sb2('bloqueada')(!form.bloqueada)} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:form.bloqueada?'#ef4444':'#e5e7eb', position:'relative', transition:'background .2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left .2s', left:form.bloqueada?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                  </div>
                </div>
                {form.bloqueada && (
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#dc2626', marginBottom:'6px' }}>Motivo da suspensao</label>
                    <input value={form.motivo_bloqueio} onChange={sf('motivo_bloqueio')} style={{ ...inputStyle, borderColor:'#fca5a5' }} placeholder="Ex: Falta de pagamento"/>
                  </div>
                )}
              </div>
            </div>
            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'20px' }}>
              <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'600', cursor:salvando?'not-allowed':'pointer' }}>
                {salvando ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Criar empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
