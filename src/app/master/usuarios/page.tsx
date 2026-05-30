'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'

type Usuario = { id:string; nome:string; email:string; telefone:string; cargo:string; nivel_acesso:string; empresa_id:string; empresa_nome:string; status:string; profissional_id:string }
type Empresa = { id:string; nome:string }
type Profissional = { id:string; nome:string; empresa_id:string }

const nivelLabel: Record<string,string> = { master:'Master', admin:'Administrador', profissional:'Profissional', usuario:'Usuario' }
const nivelCor:   Record<string,string> = { master:'#6366f1', admin:'#06b6d4', profissional:'#10b981', usuario:'#f59e0b' }
const nivelBg:    Record<string,string> = { master:'#eef2ff', admin:'#ecfeff', profissional:'#ecfdf5', usuario:'#fffbeb' }
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

function formVazio() { return { nome:'', email:'', telefone:'', cargo:'', nivel_acesso:'profissional', empresa_id:'', status:'ativo', senha:'', profissional_id:'' } }

export default function UsuariosMasterPage() {
  const router = useRouter()
  const { isMaster } = useEmpresa()
  const [usuarios, setUsuarios]         = useState<Usuario[]>([])
  const [empresas, setEmpresas]         = useState<Empresa[]>([])
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [carregando, setCarregando]     = useState(false)
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [busca, setBusca]               = useState('')
  const [filtroNivel, setFiltroNivel]   = useState('todos')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Usuario | null>(null)
  const [form, setForm] = useState(formVazio())

  const carregar = useCallback(async () => {
    setCarregando(true)
    const sb = createClient()
    const [r1, r2, r3] = await Promise.all([
      sb.from('usuarios').select('id,nome,email,telefone,cargo,nivel_acesso,empresa_id,status,profissional_id').order('nome'),
      sb.from('empresas').select('id,nome').order('nome'),
      sb.from('profissionais').select('id,nome,empresa_id').eq('status','ativo').order('nome'),
    ])
    const empsMap: Record<string,string> = {}
    if (r2.data) r2.data.forEach((e: any) => { empsMap[e.id] = e.nome })
    setEmpresas(r2.data || [])
    setProfissionais(r3.data || [])
    setUsuarios((r1.data || []).map((u: any) => ({
      id: u.id, nome: u.nome||'', email: u.email||'', telefone: u.telefone||'',
      cargo: u.cargo||'', nivel_acesso: u.nivel_acesso||'profissional',
      empresa_id: u.empresa_id||'', empresa_nome: u.empresa_id ? (empsMap[u.empresa_id]||'--') : '--',
      status: u.status||'ativo', profissional_id: u.profissional_id||'',
    })))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = usuarios.filter(u => {
    const bOk = u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())
    const nOk = filtroNivel === 'todos' || u.nivel_acesso === filtroNivel
    return bOk && nOk
  })

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro(''); setForm(formVazio()); setModalAberto(true)
  }

  function abrirEdicao(u: Usuario) {
    setModoEdicao(true); setSelecionado(u); setErro('')
    setForm({ nome:u.nome, email:u.email, telefone:u.telefone, cargo:u.cargo, nivel_acesso:u.nivel_acesso, empresa_id:u.empresa_id, status:u.status, senha:'', profissional_id:u.profissional_id||'' })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) return setErro('Nome e e-mail sao obrigatorios.')
    const senhaValida = modoEdicao || form.senha.length > 5
    if (!senhaValida) return setErro('Senha deve ter pelo menos 6 caracteres.')
    if (form.nivel_acesso !== 'master' && !form.empresa_id) return setErro('Selecione uma empresa.')
    setSalvando(true); setErro('')
    try {
      const sb = createClient()
      if (modoEdicao && selecionado) {
        const { error } = await sb.from('usuarios').update({
          nome: form.nome.trim(), telefone: form.telefone||null, cargo: form.cargo||null,
          nivel_acesso: form.nivel_acesso, empresa_id: form.empresa_id||null,
          profissional_id: form.profissional_id||null, status: form.status,
        }).eq('id', selecionado.id)
        if (error) throw new Error(error.message)
      } else {
        const res = await fetch('/api/usuarios/criar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome:form.nome.trim(), email:form.email.trim(), senha:form.senha, telefone:form.telefone||null, cargo:form.cargo||null, nivel_acesso:form.nivel_acesso, empresa_id:form.empresa_id||null, profissional_id:form.profissional_id||null }),
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error)
      }
      await carregar(); fecharModal()
    } catch (ex: any) {
      setErro('Erro: ' + (ex.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  async function toggleStatus(u: Usuario) {
    const sb = createClient()
    const novoStatus = u.status === 'ativo' ? 'inativo' : 'ativo'
    await sb.from('usuarios').update({ status: novoStatus }).eq('id', u.id)
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este usuario permanentemente?')) return
    const sb = createClient()
    await sb.from('usuarios').delete().eq('id', id)
    await carregar(); fecharModal()
  }

  const sf = (k: string) => (e: any) => setForm((p: any) => ({ ...p, [k]: e.target.value }))
  const sv = (k: string) => (v: any) => setForm((p: any) => ({ ...p, [k]: v }))

  if (!isMaster) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
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
            <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px', lineHeight:1 }}>Usuarios do Sistema</h1>
            <p style={{ fontSize:'13px', color:'#6b7280', marginTop:'3px' }}>Painel Master</p>
          </div>
        </div>
        <button onClick={abrirNovo} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'10px', padding:'9px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
          + Novo usuario
        </button>
      </div>

      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <input style={{ ...inputStyle, flex:1, minWidth:'200px', maxWidth:'280px' }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}/>
        <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }}>
          <option value="todos">Todos os niveis</option>
          <option value="master">Master</option>
          <option value="admin">Administrador</option>
          <option value="profissional">Profissional</option>
          <option value="usuario">Usuario</option>
        </select>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filtrados.map(u => (
            <div key={u.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', opacity:u.status==='inativo'?0.65:1 }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'50%', flexShrink:0, background:nivelBg[u.nivel_acesso]||'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'700', color:nivelCor[u.nivel_acesso]||'#6b7280' }}>
                {u.nome.split(' ').slice(0,2).map(n => n[0]).join('')}
              </div>
              <div style={{ flex:1, minWidth:'150px' }}>
                <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>{u.nome}</p>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>{u.email}</p>
              </div>
              <div style={{ minWidth:'110px' }}>
                <p style={{ fontSize:'10px', color:'#9ca3af', marginBottom:'2px' }}>Empresa</p>
                <p style={{ fontSize:'13px', color:'#374151', fontWeight:'500' }}>{u.empresa_nome}</p>
              </div>
              <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background:nivelBg[u.nivel_acesso]||'#f3f4f6', color:nivelCor[u.nivel_acesso]||'#6b7280' }}>
                {nivelLabel[u.nivel_acesso]||u.nivel_acesso}
              </span>
              <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background:u.status==='ativo'?'#ecfdf5':'#f9fafb', color:u.status==='ativo'?'#10b981':'#9ca3af' }}>
                {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={() => abrirEdicao(u)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(99,102,241,0.15)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
                <button onClick={() => toggleStatus(u)} style={{ background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a', borderRadius:'8px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>
                  {u.status === 'ativo' ? 'Pausar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum usuario encontrado.</div>}
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px', padding:'28px 24px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a' }}>{modoEdicao ? 'Editar usuario' : '+ Novo usuario'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>x</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome completo *</label>
                <input value={form.nome} onChange={sf('nome')} style={inputStyle} placeholder="Nome do usuario"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail *</label>
                <input type="email" value={form.email} onChange={sf('email')} style={{ ...inputStyle, background:modoEdicao?'#f9fafb':'white' }} placeholder="email@empresa.com" disabled={modoEdicao}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                <input value={form.telefone} onChange={sf('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cargo</label>
                <input value={form.cargo} onChange={sf('cargo')} style={inputStyle} placeholder="Ex: Terapeuta"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nivel de acesso *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px' }}>
                  {['usuario','profissional','admin','master'].map(nivel => (
                    <div key={nivel} onClick={() => sv('nivel_acesso')(nivel)}
                      style={{ padding:'8px 6px', borderRadius:'10px', cursor:'pointer', textAlign:'center', border:form.nivel_acesso===nivel?'2px solid '+(nivelCor[nivel]||'#6b7280'):'2px solid #e5e7eb', background:form.nivel_acesso===nivel?(nivelBg[nivel]||'#f3f4f6'):'white' }}>
                      <p style={{ fontSize:'11px', fontWeight:'600', color:form.nivel_acesso===nivel?(nivelCor[nivel]||'#6b7280'):'#6b7280' }}>{nivelLabel[nivel]||nivel}</p>
                    </div>
                  ))}
                </div>
              </div>
              {form.nivel_acesso !== 'master' && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Empresa vinculada *</label>
                  <select value={form.empresa_id} onChange={e => { sf('empresa_id')(e); sv('profissional_id')('') }} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="">Selecione uma empresa...</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
              )}
              {(form.nivel_acesso === 'profissional' || form.nivel_acesso === 'usuario') && form.empresa_id && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Profissional vinculado</label>
                  <select value={form.profissional_id} onChange={sf('profissional_id')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="">Nenhum profissional vinculado</option>
                    {profissionais.filter(p => p.empresa_id === form.empresa_id).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'4px' }}>
                    {form.nivel_acesso === 'usuario' ? 'Nivel Usuario: ve SOMENTE a agenda deste profissional.' : 'Com vinculo ve so a agenda dele; sem vinculo ve todas.'}
                  </p>
                </div>
              )}
              {!modoEdicao && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Senha de acesso *</label>
                  <input type="password" value={form.senha} onChange={sf('senha')} style={inputStyle} placeholder="Minimo 6 caracteres"/>
                </div>
              )}
              {modoEdicao && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                  <select value={form.status} onChange={sf('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              )}
            </div>
            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'14px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado
                ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'600', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando ? 'Salvando...' : modoEdicao ? 'Salvar' : 'Criar usuario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
