// BUILD: 1779992105
'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePermissao } from '@/hooks/usePermissao'
import { useEmpresa } from '@/context/EmpresaContext'
import { listarUsuarios, atualizarUsuario, inativarUsuario, excluirUsuario } from '@/lib/api'
import { createClient } from '@/lib/supabase'

type Usuario = {
  id: string; nome: string; email: string; telefone?: string
  cargo?: string; nivel_acesso: string; empresa_id?: string; status: string
}

const nivelLabel: Record<string,string> = { master:'Master', admin:'Administrador', profissional:'Profissional' }
const nivelCor:   Record<string,string> = { master:'#6366f1', admin:'#06b6d4', profissional:'#10b981' }
const nivelBg:    Record<string,string> = { master:'#eef2ff', admin:'#ecfeff', profissional:'#ecfdf5' }
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function UsuariosPage() {
  const perm = usePermissao('usuarios')

    if (!perm.visualizar && !perm.carregando) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'12px' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <p style={{ fontSize:'16px', fontWeight:'700', color:'#374151' }}>Acesso nao permitido</p>
        <p style={{ fontSize:'13px', color:'#9ca3af' }}>Voce nao tem permissao para acessar esta tela.</p>
      </div>
    )

  const { isMaster, empresaAtiva, usuario: usuarioLogado } = useEmpresa()
  const [usuarios, setUsuarios]   = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]   = useState(false)
  const [busca, setBusca]         = useState('')
  const [filtroNivel, setFiltroNivel]   = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Usuario|null>(null)
  const [modalConfirm, setModalConfirm] = useState<{tipo:'excluir'|'inativar';id:string}|null>(null)
  const [erro, setErro]           = useState('')
  const [form, setForm] = useState({ nome:'', email:'', telefone:'', cargo:'', nivel_acesso:'profissional', status:'ativo', senha:'', bloquear_edicao_valor:true, permitir_desconto:false })

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const { data } = await listarUsuarios(empresaAtiva.id)
    if (data) setUsuarios(data as Usuario[])
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = usuarios.filter(u => {
    const buscaOk  = u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())
    const nivelOk  = filtroNivel  === 'todos' || u.nivel_acesso === filtroNivel
    const statusOk = filtroStatus === 'todos' || u.status       === filtroStatus
    return buscaOk && nivelOk && statusOk
  })

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro('')
    setForm({ nome:'', email:'', telefone:'', cargo:'', nivel_acesso:'profissional', status:'ativo', senha:'' })
    setModalAberto(true)
  }

  function abrirEdicao(u: Usuario) {
    setModoEdicao(true); setSelecionado(u); setErro('')
    setForm({ nome:u.nome, email:u.email, telefone:u.telefone||'', cargo:u.cargo||'', nivel_acesso:u.nivel_acesso, status:u.status, senha:'', bloquear_edicao_valor:u.bloquear_edicao_valor !== false, permitir_desconto:u.permitir_desconto === true })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) return setErro('Nome e e-mail são obrigatórios.')
    if (!modoEdicao && form.senha.length < 6) return setErro('Senha deve ter pelo menos 6 caracteres.')
    if (!empresaAtiva?.id) return
    setSalvando(true); setErro('')

    try {
      if (modoEdicao && selecionado) {
        // Atualiza dados na tabela usuarios
        const { error } = await atualizarUsuario(selecionado.id, {
          nome: form.nome, telefone: form.telefone,
          cargo: form.cargo, nivel_acesso: form.nivel_acesso, status: form.status, bloquear_edicao_valor: form.bloquear_edicao_valor !== false,
            permitir_desconto: form.permitir_desconto === true,
        })
        if (error) throw new Error(error.message)
      } else {
        // Usa API route que cria sem confirmação de email
        const res = await fetch('/api/usuarios/criar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome:         form.nome,
            email:        form.email.trim(),
            senha:        form.senha,
            telefone:     form.telefone || null,
            cargo:        form.cargo || null,
            nivel_acesso: form.nivel_acesso,
            empresa_id:   empresaAtiva.id,
            bloquear_edicao_valor: form.bloquear_edicao_valor !== false,
            permitir_desconto: form.permitir_desconto === true,
          }),
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error)
      }

      await carregar(); fecharModal()
    } catch (e: any) {
      setErro('Erro: ' + (e.message || 'Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  async function executarAcao() {
    if (!modalConfirm) return
    const { tipo, id } = modalConfirm
    if (tipo === 'excluir') {
      await excluirUsuario(id)
    } else {
      await inativarUsuario(id)
    }
    setModalConfirm(null)
    if (selecionado?.id === id) fecharModal()
    await carregar()
  }

  async function reativar(id: string) {
    await atualizarUsuario(id, { status: 'ativo' })
    await carregar()
  }

  if (!isMaster) {
    return (
      <div style={{ padding:'40px 24px', textAlign:'center' }}>
        <p style={{ fontSize:'40px', marginBottom:'12px' }}>🔒</p>
        <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#1a1a2e', marginBottom:'8px' }}>Acesso restrito</h2>
        <p style={{ fontSize:'14px', color:'#9ca3af' }}>Somente o usuário master pode gerenciar usuários.</p>
      </div>
    )
  }

  const ativos   = usuarios.filter(u => u.status==='ativo').length
  const inativos = usuarios.filter(u => u.status==='inativo').length

  return (
    <div style={{ padding:'24px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Usuários do sistema</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{ativos} ativos ? {inativos} inativos</p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo usuário
        </button>
      </div>

      {/* Cards resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'Total',          valor:usuarios.length,                                     cor:'#6b7280', bg:'#f3f4f6' },
          { label:'Administradores',valor:usuarios.filter(u=>u.nivel_acesso==='admin').length,  cor:'#06b6d4', bg:'#ecfeff' },
          { label:'Profissionais',  valor:usuarios.filter(u=>u.nivel_acesso==='profissional').length, cor:'#10b981', bg:'#ecfdf5' },
        ].map(m => (
          <div key={m.label} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 16px' }}>
            <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>{m.label}</p>
            <p style={{ fontSize:'22px', fontWeight:'700', color:m.cor }}>{m.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:'180px', maxWidth:'280px' }}>
          <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        </div>
        <select value={filtroNivel} onChange={e=>setFiltroNivel(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }}>
          <option value="todos">Todos os níveis</option>
          <option value="master">Master</option>
          <option value="admin">Administrador</option>
          <option value="profissional">Profissional</option>
        </select>
        <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filtrados.map(u => (
            <div key={u.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', opacity:u.status==='inativo'?0.65:1 }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'50%', flexShrink:0, background:nivelBg[u.nivel_acesso], border:`1.5px solid ${nivelCor[u.nivel_acesso]}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'700', color:nivelCor[u.nivel_acesso] }}>
                {u.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
              </div>
              <div style={{ flex:1, minWidth:'150px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
                  <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e' }}>{u.nome}</p>
                  {u.id === usuarioLogado?.id && <span style={{ fontSize:'10px', background:'#fffbeb', color:'#f59e0b', padding:'1px 6px', borderRadius:'99px', fontWeight:'600' }}>você</span>}
                </div>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>{u.email}</p>
              </div>
              <div style={{ minWidth:'90px' }}>
                <p style={{ fontSize:'10px', color:'#9ca3af', marginBottom:'2px' }}>Cargo</p>
                <p style={{ fontSize:'13px', color:'#374151' }}>{u.cargo||'?'}</p>
              </div>
              <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background:nivelBg[u.nivel_acesso], color:nivelCor[u.nivel_acesso] }}>{nivelLabel[u.nivel_acesso]}</span>
              <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background:u.status==='ativo'?'#ecfdf5':'#f9fafb', color:u.status==='ativo'?'#10b981':'#9ca3af' }}>{u.status==='ativo'?'Ativo':'Inativo'}</span>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={()=>abrirEdicao(u)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(99,102,241,0.15)' }} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff';el.style.boxShadow='0 3px 8px rgba(99,102,241,0.25)';el.style.transform='translateY(-1px)'}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.boxShadow='0 1px 3px rgba(99,102,241,0.15)';el.style.transform='translateY(0)'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>
                {u.status==='ativo'
                  ? <button onClick={()=>setModalConfirm({tipo:'inativar',id:u.id})} style={{ background:'#fffbeb', color:'#f59e0b', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }} title="Inativar">Inativar</button>
                  : <button onClick={()=>reativar(u.id)} style={{ background:'#ecfdf5', color:'#10b981', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }} title="Reativar">Ativar</button>}
                <button onClick={()=>setModalConfirm({tipo:'excluir',id:u.id})} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>🗑</button>
              </div>
            </div>
          ))}
          {filtrados.length===0 && <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>Nenhum usuário encontrado.</div>}
        </div>
      )}

      {/* Modal criar/editar */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'Editar usuario':'+ Novo usuário'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>×</button>
            </div>

            <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'10px 14px', marginBottom:'18px', fontSize:'13px', color:'#4338ca', lineHeight:'1.5' }}>
              🔵 <b>Profissional</b> ? vê só a própria agenda &nbsp;|&nbsp; 🟦 <b>Admin</b> ? gerencia a empresa &nbsp;|&nbsp; 🟣 <b>Master</b> ? acesso total
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome completo *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} style={inputStyle} placeholder="Nome do usuário"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail *</label>
                <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={{ ...inputStyle, background:modoEdicao?'#f9fafb':'white' }} placeholder="email@empresa.com" disabled={modoEdicao}/>
                {modoEdicao && <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'3px' }}>O e-mail não pode ser alterado.</p>}
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                <input value={form.telefone} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cargo / Função</label>
                <input value={form.cargo} onChange={e=>setForm(f=>({...f,cargo:e.target.value}))} style={inputStyle} placeholder="Ex: Fisioterapeuta"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nível de acesso *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
                  {(['profissional','admin','master'] as const).map(nivel=>(
                    <div key={nivel} onClick={()=>setForm(f=>({...f,nivel_acesso:nivel}))} style={{ padding:'10px 8px', borderRadius:'10px', cursor:'pointer', textAlign:'center', border:form.nivel_acesso===nivel?`2px solid ${nivelCor[nivel]}`:'2px solid #e5e7eb', background:form.nivel_acesso===nivel?nivelBg[nivel]:'white' }}>
                      <p style={{ fontSize:'18px', marginBottom:'3px' }}>{nivel==='profissional'?'🩺':nivel==='admin'?'🏢':'👑'}</p>
                      <p style={{ fontSize:'12px', fontWeight:'600', color:form.nivel_acesso===nivel?nivelCor[nivel]:'#6b7280' }}>{nivelLabel[nivel]}</p>
                    </div>
                  ))}
                </div>
              </div>
              {!modoEdicao && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Senha de acesso *</label>
                  <input type="password" value={form.senha} onChange={e=>setForm(f=>({...f,senha:e.target.value}))} style={inputStyle} placeholder="Mínimo 6 caracteres"/>
                </div>
              )}
              {modoEdicao && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              )}
            </div>

            {/* Toggle bloquear edição de valor */}
            <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f9fafb', borderRadius:'10px', padding:'12px 14px', border:'1px solid #e5e7eb' }}>
              <div>
                <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827', marginBottom:'2px' }}>Bloquear edição de valor no agendamento</p>
                <p style={{ fontSize:'11px', color:'#6b7280' }}>Quando ativado, o usuário não pode alterar o valor definido pelo serviço</p>
              </div>
              <div onClick={()=>setForm(f=>({...f, bloquear_edicao_valor:!f.bloquear_edicao_valor}))}
                style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', flexShrink:0, background:form.bloquear_edicao_valor?'#6366f1':'#e5e7eb', position:'relative', transition:'background 0.2s' }}>
                <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', left:form.bloquear_edicao_valor?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s' }}/>
              </div>
            </div>

            {/* Toggle permitir desconto */}
            <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f9fafb', borderRadius:'10px', padding:'12px 14px', border:'1px solid #e5e7eb' }}>
              <div>
                <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827', marginBottom:'2px' }}>Permitir aplicar desconto no agendamento</p>
                <p style={{ fontSize:'11px', color:'#6b7280' }}>Quando ativado, o usuário pode aplicar desconto no valor do agendamento</p>
              </div>
              <div onClick={()=>setForm(f=>({...f, permitir_desconto:!f.permitir_desconto}))}
                style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', flexShrink:0, background:form.permitir_desconto?'#10b981':'#e5e7eb', position:'relative', transition:'background 0.2s' }}>
                <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', left:form.permitir_desconto?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s' }}/>
              </div>
            </div>

            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'14px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado ? (
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={()=>setModalConfirm({tipo:'inativar',id:selecionado.id})} style={{ background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', cursor:'pointer' }}>? Inativar</button>
                  <button onClick={()=>setModalConfirm({tipo:'excluir',id:selecionado.id})} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', cursor:'pointer' }}>🗑 Excluir</button>
                </div>
              ) : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando?'Salvando...':modoEdicao?'Salvar alterações':'Criar usuário'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação */}
      {modalConfirm && (
        <div onClick={()=>setModalConfirm(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', borderRadius:'16px', padding:'28px 24px', maxWidth:'360px', width:'100%', textAlign:'center' }}>
            <p style={{ fontSize:'36px', marginBottom:'12px' }}>{modalConfirm.tipo==='excluir'?'🗑':'?'}</p>
            <h3 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'8px' }}>{modalConfirm.tipo==='excluir'?'Excluir usuário?':'Inativar usuário?'}</h3>
            <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'24px', lineHeight:'1.5' }}>
              {modalConfirm.tipo==='excluir'?'Esta ação não pode ser desfeita.':'O usuário não conseguirá mais acessar o sistema.'}
            </p>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
              <button onClick={()=>setModalConfirm(null)} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
              <button onClick={executarAcao} style={{ background:modalConfirm.tipo==='excluir'?'#ef4444':'#f59e0b', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
                {modalConfirm.tipo==='excluir'?'Sim, excluir':'Sim, inativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
