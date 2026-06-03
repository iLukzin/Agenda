'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'

type Empresa = { id:string; nome:string; cnpj:string; email:string; telefone:string; endereco:string; plano:string; status:string; vencimento:string; bloqueada:boolean; motivo_bloqueio:string }

const inp = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const, minHeight:'42px' }
const planoCor: Record<string,string> = { basico:'#6b7280', profissional:'#6366f1', enterprise:'#f59e0b' }
const planoBg:  Record<string,string> = { basico:'#f3f4f6', profissional:'#eef2ff', enterprise:'#fffbeb' }
function formVazio() { return { nome:'', cnpj:'', email:'', telefone:'', endereco:'', plano:'profissional', status:'ativo', vencimento:'', bloqueada:false, motivo_bloqueio:'', whatsapp_habilitado:false } }

function mascaraCnpjCpf(v: string) {
  const d = v.replace(/[^\d]/g, '').slice(0, 14)
  if (d.length <= 11) {
    if (d.length <= 3) return d
    if (d.length <= 6) return d.slice(0,3)+'.'+d.slice(3)
    if (d.length <= 9) return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6)
    return d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9)
  }
  if (d.length <= 12) return d.slice(0,2)+'.'+d.slice(2,5)+'.'+d.slice(5,8)+'/'+d.slice(8,12)
  return d.slice(0,2)+'.'+d.slice(2,5)+'.'+d.slice(5,8)+'/'+d.slice(8,12)+'-'+d.slice(12)
}

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
  const [selecionada, setSelecionada] = useState(null as Empresa | null)
  const [abaModal, setAbaModal] = useState('dados' as string)
  const [todosUsuarios, setTodosUsuarios] = useState<any[]>([])
  const [usuariosVinculados, setUsuariosVinculados] = useState<string[]>([])
  const [salvandoVinculos, setSalvandoVinculos] = useState(false)
  const [form, setForm] = useState(formVazio())
  const ativas = empresas.filter(e => e.status === 'ativo').length

  const carregar = useCallback(async () => {
    setCarregando(true)
    const sb = createClient()
    const { data } = await sb.from('empresas').select('id,nome,cnpj,email,telefone,endereco,plano,status,vencimento,bloqueada,motivo_bloqueio,whatsapp_habilitado').order('nome')
    setEmpresas((data || []).map((e: any) => ({ id:e.id, nome:e.nome||'', cnpj:e.cnpj||'', email:e.email||'', telefone:e.telefone||'', endereco:e.endereco||'', plano:e.plano||'profissional', status:e.status||'ativo', vencimento:e.vencimento||'', bloqueada:e.bloqueada||false, motivo_bloqueio:e.motivo_bloqueio||'', whatsapp_habilitado:e.whatsapp_habilitado||false , whatsapp_habilitado:e.whatsapp_habilitado||false })))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && modalAberto) fecharModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalAberto])

  const filtradas = empresas.filter(e => {
    const n = e.nome.toLowerCase().includes(busca.toLowerCase())
    const c = e.cnpj.includes(busca)
    const m = e.email.toLowerCase().includes(busca.toLowerCase())
    return n || c || m
  })

  function abrirNova() { setModoEdicao(false); setSelecionada(null); setErro(''); setForm(formVazio()); setModalAberto(true) }
  function abrirEdicao(e: Empresa) {
    setModoEdicao(true); setSelecionada(e); setErro('')
    setForm({ nome:e.nome, cnpj:e.cnpj, email:e.email, telefone:e.telefone, endereco:e.endereco, plano:e.plano, status:e.status, vencimento:e.vencimento, bloqueada:e.bloqueada, motivo_bloqueio:e.motivo_bloqueio, whatsapp_habilitado:e.whatsapp_habilitado||false })
    setModalAberto(true)
  }
  function fecharModal() { setModalAberto(false); setSelecionada(null); setErro(''); setAbaModal('dados'); setTodosUsuarios([]); setUsuariosVinculados([]) }

  async function carregarUsuariosEmpresa(empresaId: string) {
    const sb = createClient()
    const [resU, resV] = await Promise.all([
      sb.from('usuarios').select('id,nome,email,nivel_acesso').neq('nivel_acesso','master').order('nome'),
      sb.from('usuario_empresas').select('usuario_id').eq('empresa_id', empresaId),
    ])
    setTodosUsuarios(resU.data || [])
    setUsuariosVinculados((resV.data || []).map((v: any) => v.usuario_id))
  }

  async function salvarVinculos(empresaId: string) {
    setSalvandoVinculos(true)
    const sb = createClient()
    await sb.from('usuario_empresas').delete().eq('empresa_id', empresaId)
    if (usuariosVinculados.length > 0) {
      await sb.from('usuario_empresas').insert(
        usuariosVinculados.map((uid: string) => ({ usuario_id: uid, empresa_id: empresaId }))
      )
    }
    setSalvandoVinculos(false)
    alert('Vinculos salvos!')
  }

  async function salvar() {
    if (!form.nome.trim()) return setErro('Nome é obrigatório.')
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = { nome:form.nome.trim(), cnpj:form.cnpj||null, email:form.email||null, telefone:form.telefone||null, endereco:form.endereco||null, plano:form.plano, status:form.status, vencimento:form.vencimento||null, bloqueada:form.bloqueada, motivo_bloqueio:form.bloqueada?(form.motivo_bloqueio||'Falta de pagamento'):null, whatsapp_habilitado:form.whatsapp_habilitado }
    let error: any
    if (modoEdicao && selecionada) { const r = await sb.from('empresas').update(payload).eq('id', selecionada.id); error = r.error }
    else { const r = await sb.from('empresas').insert(payload); error = r.error }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    await carregar(); recarregar(); fecharModal(); setSalvando(false)
  }

  async function toggleStatus(e: Empresa) {
    const sb = createClient()
    await sb.from('empresas').update({ status: e.status === 'ativo' ? 'inativo' : 'ativo' }).eq('id', e.id)
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
    <div style={{ padding:'16px', minHeight:'100vh', background:'#f4f5fb' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
        <button onClick={() => router.push('/dashboard')}
          style={{ display:'flex', alignItems:'center', gap:'6px', background:'white', border:'1.5px solid #e0e7ff', borderRadius:'10px', padding:'8px 14px', cursor:'pointer', fontSize:'13px', fontWeight:'600', color:'#4f46e5', boxShadow:'0 1px 4px rgba(99,102,241,0.1)', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <div style={{ flex:1, minWidth:0 }}>
          <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px', lineHeight:1 }}>Gerenciar Empresas</h1>
          <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'2px' }}>{ativas} ativas ? {empresas.length} total</p>
        </div>
        <button onClick={abrirNova} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'10px', padding:'9px 16px', fontSize:'13px', fontWeight:'700', cursor:'pointer', flexShrink:0 }}>
          + Nova
        </button>
      </div>

      <input style={{ ...inp, maxWidth:'100%', marginBottom:'14px', background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }} placeholder="Buscar empresa..." value={busca} onChange={e=>setBusca(e.target.value)}/>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtradas.map(e => (
            <div key={e.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:'12px', flexWrap:'wrap' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:e.bloqueada?'#fef2f2':'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color:e.bloqueada?'#ef4444':'#6366f1', flexShrink:0 }}>
                  {e.nome.charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:'120px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', marginBottom:'3px' }}>
                    <p style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e' }}>{e.nome}</p>
                    {e.bloqueada && <span style={{ fontSize:'10px', fontWeight:'700', color:'#dc2626', background:'#fef2f2', borderRadius:'4px', padding:'1px 6px' }}>BLOQ</span>}
                    {e.whatsapp_habilitado && <span style={{ fontSize:'10px', fontWeight:'700', color:'#16a34a', background:'#f0fdf4', borderRadius:'4px', padding:'1px 6px' }}>WPP</span>}
                    <span style={{ fontSize:'11px', fontWeight:'500', padding:'2px 8px', borderRadius:'99px', background:planoBg[e.plano]||'#f3f4f6', color:planoCor[e.plano]||'#6b7280', textTransform:'capitalize' }}>{e.plano}</span>
                  </div>
                  <p style={{ fontSize:'12px', color:'#9ca3af' }}>{e.email || e.cnpj || '--'}</p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0, flexWrap:'wrap' }}>
                  <div onClick={() => toggleStatus(e)} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background:e.status==='ativo'?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left:e.status==='ativo'?'18px':'2px' }}/>
                  </div>
                  <button onClick={() => abrirEdicao(e)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'5px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                  </button>
                  <button onClick={() => toggleBloqueio(e)} style={{ background:e.bloqueada?'#ecfdf5':'#fef2f2', color:e.bloqueada?'#10b981':'#ef4444', border:e.bloqueada?'1px solid #6ee7b7':'1px solid #fecaca', borderRadius:'8px', padding:'6px 10px', fontSize:'12px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    {e.bloqueada ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtradas.length === 0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Nenhuma empresa.</div>}
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={ev=>ev.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a' }}>{modoEdicao ? 'Editar empresa' : 'Nova empresa'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px' }}>×</button>
            </div>
            {/* Abas - só mostra na edição */}
            {modoEdicao && selecionada && (
              <div style={{ display:'flex', gap:'4px', marginBottom:'4px', borderBottom:'2px solid #f0f0f8', paddingBottom:'0' }}>
                {(['dados','usuarios'] as ('dados'|'usuarios')[]).map((k) => (
                  <button key={k} onClick={()=>{ setAbaModal(k as string); if(k==='usuarios' && selecionada) carregarUsuariosEmpresa(selecionada.id) }}
                    style={{ background:'none', border:'none', padding:'8px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', borderBottom: abaModal===k ? '2px solid #6366f1' : '2px solid transparent', color: abaModal===k ? '#6366f1' : '#6b7280', marginBottom:'-2px' }}>
                    {k === 'dados' ? 'Dados da Empresa' : 'Usuários Vinculados'}
                  </button>
                ))}
              </div>
            )}

            {/* Aba Dados */}
            {(abaModal === 'dados' || !modoEdicao) && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[{l:'Nome *',k:'nome',ph:'Nome da empresa'},{l:'E-mail',k:'email',ph:'email@empresa.com'},{l:'Telefone',k:'telefone',ph:'(11) 99999-9999'}].map(f=>(
                <div key={f.k}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>{f.l}</label>
                  <input value={(form as any)[f.k]} onChange={sf(f.k)} style={inp} placeholder={f.ph}/>
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>CNPJ / CPF</label>
                <input value={form.cnpj} onChange={e=>setForm(f=>({...f,cnpj:mascaraCnpjCpf(e.target.value)}))} style={inp} placeholder="CPF ou CNPJ" maxLength={18}/>
                <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'3px' }}>Digite CPF (11 digitos) ou CNPJ (14 digitos)</p>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Endereço</label>
                <input value={form.endereco} onChange={sf('endereco')} style={inp} placeholder="Rua, número, bairro, cidade"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Plano</label>
                  <select value={form.plano} onChange={sf('plano')} style={{ ...inp, padding:'10px 12px' }}>
                    <option value="basico">Basico</option>
                    <option value="profissional">Profissional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Vencimento</label>
                  <input type="date" value={form.vencimento} onChange={sf('vencimento')} style={inp}/>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Status</label>
                <select value={form.status} onChange={sf('status')} style={{ ...inp, padding:'10px 12px' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div style={{ background:'#f0fdf4', borderRadius:'12px', padding:'14px 16px', border:'1px solid #bbf7d0', marginBottom:'4px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>Habilitar WhatsApp</p>
                    <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'1px' }}>Permite a empresa conectar e usar WhatsApp no sistema</p>
                  </div>
                  <div onClick={()=>setForm(p=>({...p,whatsapp_habilitado:!p.whatsapp_habilitado}))} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:form.whatsapp_habilitado?'#22c55e':'#e5e7eb', position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left .2s', left:form.whatsapp_habilitado?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                  </div>
                </div>
              </div>
              <div style={{ background:form.bloqueada?'#fef2f2':'#f9fafb', borderRadius:'12px', padding:'14px', border:form.bloqueada?'1.5px solid #fca5a5':'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:form.bloqueada?'12px':'0' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'600', color:form.bloqueada?'#dc2626':'#374151' }}>Bloquear acesso</p>
                    <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'1px' }}>Usuarios nao conseguirao fazer login</p>
                  </div>
                  <div onClick={() => sb2('bloqueada')(!form.bloqueada)} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:form.bloqueada?'#ef4444':'#e5e7eb', position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left .2s', left:form.bloqueada?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                  </div>
                </div>
                {form.bloqueada && (
                  <div>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#dc2626', marginBottom:'5px' }}>Motivo</label>
                    <input value={form.motivo_bloqueio} onChange={sf('motivo_bloqueio')} style={{ ...inp, borderColor:'#fca5a5' }} placeholder="Ex: Falta de pagamento"/>
                  </div>
                )}
              </div>
            </div>
            {erro && <div style={{ background:'#fef2f2', borderRadius:'8px', padding:'10px 13px', marginTop:'12px', fontSize:'13px', color:'#dc2626', border:'1px solid #fecaca' }}>{erro}</div>}
            )} {/* fim aba dados */}

            {/* Aba Usuários */}
            {abaModal === 'usuarios' && modoEdicao && selecionada && (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', minHeight:'200px' }}>
                <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'4px' }}>Selecione os usuários que podem acessar esta empresa:</p>
                {todosUsuarios.length === 0 ? (
                  <p style={{ color:'#9ca3af', fontSize:'13px', textAlign:'center', padding:'20px' }}>Nenhum usuário cadastrado</p>
                ) : (
                  todosUsuarios.map((u: any) => (
                    <label key={u.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px', borderRadius:'8px', border:'1px solid #e5e7eb', cursor:'pointer', background: usuariosVinculados.includes(u.id) ? '#eef2ff' : 'white' }}>
                      <input type="checkbox" checked={usuariosVinculados.includes(u.id)}
                        onChange={e => setUsuariosVinculados(prev => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id))}
                        style={{ width:'16px', height:'16px', accentColor:'#6366f1' }}/>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827' }}>{u.nome}</p>
                        <p style={{ fontSize:'11px', color:'#6b7280' }}>{u.email} · {u.nivel_acesso}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}

              <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'18px' }}>
              <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
              {abaModal === 'usuarios' && selecionada ? (
                <button onClick={()=>salvarVinculos(selecionada.id)} disabled={salvandoVinculos} style={{ background:salvandoVinculos?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>
                  {salvandoVinculos ? 'Salvando...' : 'Salvar vínculos'}
                </button>
              ) : (
              <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'600', cursor:salvando?'not-allowed':'pointer' }}>
                {salvando ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Criar empresa'}
              </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
