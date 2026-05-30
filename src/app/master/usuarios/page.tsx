// BUILD: 1779992105
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Usuario = {
  id: string; nome: string; email: string; telefone: string
  cargo: string; nivel_acesso: string; empresa_id: string
  empresa_nome: string; status: string; profissional_id: string
}
type Empresa = { id: string; nome: string }
type Profissional = { id: string; nome: string; empresa_id: string }

const nivelLabel: Record<string,string> = { master:'Master', admin:'Administrador', profissional:'Profissional', usuario:'Usuario' }
const nivelCor:   Record<string,string> = { master:'#6366f1', admin:'#06b6d4', profissional:'#10b981', usuario:'#f59e0b' }
const nivelBg:    Record<string,string> = { master:'#eef2ff', admin:'#ecfeff', profissional:'#ecfdf5', usuario:'#fffbeb' }
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function UsuariosMasterPage() {
  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const router = useRouter()
  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [busca, setBusca]           = useState('')
  const [filtroNivel, setFiltroNivel] = useState('todos')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState(null as Usuario | null)
  const [form, setForm] = useState({
    nome:'', email:'', telefone:'', cargo:'',
    nivel_acesso:'profissional', empresa_id:'', status:'ativo', senha:'', profissional_id:''
  })

  const carregar = useCallback(async () => {
    setCarregando(true)
    const sb = createClient()
    const [{ data: us }, { data: emps }, { data: profs }] = await Promise.all([
      sb.from('usuarios').select('id,nome,email,telefone,cargo,nivel_acesso,empresa_id,status,profissional_id').order('nome'),
      sb.from('empresas').select('id,nome').order('nome'),
      sb.from('profissionais').select('id,nome,empresa_id').eq('status','ativo').order('nome'),
    ])
    setProfissionais(profs || [])
    const empsMap: Record<string,string> = {}
    if (emps) emps.forEach((e: any) => { empsMap[e.id] = e.nome })
    setEmpresas(emps || [])
    setUsuarios((us || []).map((u: any) => ({
      ...u,
      telefone:        u.telefone || '',
      cargo:           u.cargo || '',
      empresa_id:      u.empresa_id || '',
      empresa_nome:    u.empresa_id ? (empsMap[u.empresa_id] || '--') : '--',
      profissional_id: u.profissional_id || '',
    })))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = usuarios.filter(u => {
    const buscaOk = u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())
    const nivelOk = filtroNivel === 'todos' || u.nivel_acesso === filtroNivel
    return buscaOk && nivelOk
  })

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro('')
    setForm({ nome:'', email:'', telefone:'', cargo:'', nivel_acesso:'profissional', empresa_id:'', status:'ativo', senha:'', profissional_id:'' })
    setModalAberto(true)
  }

  function abrirEdicao(u: Usuario) {
    setModoEdicao(true); setSelecionado(u); setErro('')
    setForm({ nome:u.nome, email:u.email, telefone:u.telefone, cargo:u.cargo, nivel_acesso:u.nivel_acesso, empresa_id:u.empresa_id, status:u.status, senha:'', profissional_id:u.profissional_id||'' })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) return setErro('Nome e e-mail sao obrigatorios.')
    const senhaOk = modoEdicao || form.senha.length >= 6
    if (!senhaOk) return setErro('Senha deve ter pelo menos 6 caracteres.')
    if (form.nivel_acesso !== 'master' && !form.empresa_id) return setErro('Selecione uma empresa para este usuario.')
    setSalvando(true); setErro('')
    try {
      const sb = createClient()
      if (modoEdicao && selecionado) {
        const { error } = await sb.from('usuarios').update({
          nome:            form.nome.trim(),
          telefone:        form.telefone || null,
          cargo:           form.cargo || null,
          nivel_acesso:    form.nivel_acesso,
          empresa_id:      form.empresa_id || null,
          profissional_id: form.profissional_id || null,
          status:          form.status,
        }).eq('id', selecionado.id)
        if (error) throw new Error(error.message)
      } else {
        const res = await fetch('/api/usuarios/criar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome:         form.nome.trim(),
            email:        form.email.trim(),
            senha:        form.senha,
            telefone:     form.telefone || null,
            cargo:        form.cargo || null,
            nivel_acesso: form.nivel_acesso,
            empresa_id:   form.empresa_id || null,
          }),
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error)
      }
      await carregar()
      fecharModal()
    } catch (e: any) {
      setErro('Erro: ' + (e.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  async function toggleStatus(u: Usuario) {
    const sb = createClient()
    await sb.from('usuarios').update({ status: u.status==='ativo'?'inativo':'ativo' }).eq('id', u.id)
    await carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este usuario permanentemente?')) return
    const sb = createClient()
    await sb.from('usuarios').delete().eq('id', id)
    await carregar()
    fecharModal()
  }

  const f = (k: keyof typeof form) => (e: any) => setForm((p: any) => ({...p, [k]: e.target.value}))

  return (
    <div style={{ padding:'24px 16px', minHeight:'100vh', background:'#f8f8fc' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
            <button onClick={()=>router.push('/dashboard')}
              style={ display:'flex', alignItems:'center', gap:'8px', background:'white', border:'1.5px solid #e0e7ff', borderRadius:'12px', padding:'9px 16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', color:'#4f46e5', boxShadow:'0 1px 4px rgba(99,102,241,0.12)', transition:'all .15s', flexShrink:0 }
              onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff'}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Voltar
            </button>
            <div>
              <h1 style={ fontSize:'22px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px', lineHeight:1 }>Usuarios do Sistema</h1>
              <p style={ fontSize:'13px', color:'#6b7280', marginTop:'3px' }>Painel Master -- todos os usuarios</p>
            </div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Usuarios do Sistema</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>Painel Master -- todos os usuarios</p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
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
                {u.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
              </div>
              <div style={{ flex:1, minWidth:'150px' }}>
                <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>{u.nome}</p>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>{u.email}</p>
              </div>
              <div style={{ minWidth:'110px' }}>
                <p style={{ fontSize:'10px', color:'#9ca3af', marginBottom:'2px' }}>Empresa</p>
                <p style={{ fontSize:'13px', color:'#374151', fontWeight:'500' }}>{u.empresa_nome}</p>
              </div>
              <div style={{ minWidth:'80px' }}>
                <p style={{ fontSize:'10px', color:'#9ca3af', marginBottom:'2px' }}>Cargo</p>
                <p style={{ fontSize:'13px', color:'#374151' }}>{u.cargo||'--'}</p>
              </div>
              <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background:nivelBg[u.nivel_acesso]||'#f3f4f6', color:nivelCor[u.nivel_acesso]||'#6b7280' }}>
                {nivelLabel[u.nivel_acesso]||u.nivel_acesso}
              </span>
              <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background:u.status==='ativo'?'#ecfdf5':'#f9fafb', color:u.status==='ativo'?'#10b981':'#9ca3af' }}>
                {u.status==='ativo'?'Ativo':'Inativo'}
              </span>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={() => abrirEdicao(u)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>Editar</button>
                <button onClick={() => toggleStatus(u)} style={{ background:'#fffbeb', color:'#f59e0b', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }} title={u.status==='ativo'?'Inativar':'Reativar'}>
                  {u.status==='ativo'?'Pause':'Play'}
                </button>
                <button onClick={() => excluir(u.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>Del</button>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum usuario encontrado.</div>}
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'Editar usuario':'+ Novo usuario'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>x</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome completo *</label>
                <input value={form.nome} onChange={f('nome')} style={inputStyle} placeholder="Nome do usuario"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail *</label>
                <input type="email" value={form.email} onChange={f('email')} style={{ ...inputStyle, background:modoEdicao?'#f9fafb':'white' }} placeholder="email@empresa.com" disabled={modoEdicao}/>
                {modoEdicao && <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'3px' }}>E-mail nao pode ser alterado.</p>}
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cargo</label>
                <input value={form.cargo} onChange={f('cargo')} style={inputStyle} placeholder="Ex: Terapeuta"/>
              </div>

              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nivel de acesso *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
                  {(['usuario','profissional','admin','master'] as const).map(nivel => (
                    <div key={nivel} onClick={() => setForm(p => ({...p, nivel_acesso:nivel, empresa_id:nivel==='master'?'':p.empresa_id}))}
                      style={{ padding:'10px 8px', borderRadius:'10px', cursor:'pointer', textAlign:'center', border:form.nivel_acesso===nivel?'2px solid ' + nivelCor[nivel]:'2px solid #e5e7eb', background:form.nivel_acesso===nivel?nivelBg[nivel]:'white' }}>
                      <p style={{ fontSize:'12px', fontWeight:'600', color:form.nivel_acesso===nivel?nivelCor[nivel]:'#6b7280' }}>{nivelLabel[nivel]}</p>
                    </div>
                  ))}
                </div>
              </div>

              {form.nivel_acesso !== 'master' && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Empresa vinculada *</label>
                  <select value={form.empresa_id} onChange={e => {
                    setForm(p => ({...p, empresa_id: e.target.value, profissional_id: ''}))
                  }} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="">Selecione uma empresa...</option>
                    {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
              )}
              {(form.nivel_acesso === 'profissional' || form.nivel_acesso === 'usuario') && form.empresa_id && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Profissional vinculado</label>
                  <select value={form.profissional_id} onChange={f('profissional_id')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="">Nenhum profissional vinculado</option>
                    {profissionais.filter((p: any) => p.empresa_id === form.empresa_id).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                  <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'4px' }}>
                    {form.nivel_acesso === 'usuario' 
                      ? 'Nivel Usuario: ve SOMENTE a agenda do profissional vinculado.'
                      : 'Nivel Profissional: sem vinculo ve todas as agendas; com vinculo ve so a dele.'}
                  </p>
                </div>
              )}

              {!modoEdicao && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Senha de acesso *</label>
                  <input type="password" value={form.senha} onChange={f('senha')} style={inputStyle} placeholder="Minimo 6 caracteres"/>
                </div>
              )}

              {modoEdicao && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                  <select value={form.status} onChange={f('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
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
                <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando?'Salvando...':modoEdicao?'Salvar':'Criar usuario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
