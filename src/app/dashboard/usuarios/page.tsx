'use client'

import { useState } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'

type Usuario = {
  id: string
  nome: string
  email: string
  telefone: string
  cargo: string
  nivel_acesso: 'master' | 'admin' | 'profissional'
  empresa_id: string
  empresa_nome: string
  status: 'ativo' | 'inativo'
  auth_id?: string
}

const empresasMock = [
  { id:'1', nome:'Studio Demo'        },
  { id:'2', nome:'Clínica Saúde+'     },
  { id:'3', nome:'Espaço Terapêutico' },
  { id:'4', nome:'Physio Center'      },
]

const usuariosIniciais: Usuario[] = [
  { id:'1', nome:'Lucas Fortitude',  email:'lucas@fortitude.com',  telefone:'(11) 99999-9999', cargo:'Master',         nivel_acesso:'master',        empresa_id:'',  empresa_nome:'—',            status:'ativo'   },
  { id:'2', nome:'Carlos Souza',     email:'carlos@studio.com',    telefone:'(11) 99999-0010', cargo:'Administrador',  nivel_acesso:'admin',         empresa_id:'1', empresa_nome:'Studio Demo',  status:'ativo'   },
  { id:'3', nome:'Ana Lima',         email:'ana@studio.com',       telefone:'(11) 99999-0011', cargo:'Fisioterapeuta', nivel_acesso:'profissional',  empresa_id:'1', empresa_nome:'Studio Demo',  status:'ativo'   },
  { id:'4', nome:'Pedro Costa',      email:'pedro@studio.com',     telefone:'(11) 99999-0012', cargo:'Psicólogo',      nivel_acesso:'profissional',  empresa_id:'1', empresa_nome:'Studio Demo',  status:'ativo'   },
  { id:'5', nome:'Maria Oliveira',   email:'maria@espaco.com',     telefone:'(11) 99999-0030', cargo:'Terapeuta',      nivel_acesso:'profissional',  empresa_id:'3', empresa_nome:'Espaço Ter.', status:'inativo'  },
]

const nivelLabel: Record<string, string> = { master:'Master', admin:'Administrador', profissional:'Profissional' }
const nivelCor:   Record<string, string> = { master:'#6366f1', admin:'#06b6d4',      profissional:'#10b981'      }
const nivelBg:    Record<string, string> = { master:'#eef2ff', admin:'#ecfeff',      profissional:'#ecfdf5'      }

const inputStyle = {
  width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px',
  padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const,
}

type FormState = {
  nome: string; email: string; telefone: string; cargo: string
  nivel_acesso: string; empresa_id: string; status: string; senha: string
}

const formVazio: FormState = {
  nome:'', email:'', telefone:'', cargo:'',
  nivel_acesso:'profissional', empresa_id:'', status:'ativo', senha:'',
}

export default function UsuariosPage() {
  const { isMaster, usuario: usuarioLogado } = useEmpresa()

  const [usuarios, setUsuarios]         = useState<Usuario[]>(usuariosIniciais)
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Usuario | null>(null)
  const [busca, setBusca]               = useState('')
  const [filtroNivel, setFiltroNivel]   = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [form, setForm]                 = useState<FormState>(formVazio)
  const [salvando, setSalvando]         = useState(false)
  const [erroForm, setErroForm]         = useState('')
  const [modalConfirm, setModalConfirm] = useState<{ tipo: 'excluir'|'inativar'; id: string } | null>(null)

  // Sem permissão
  if (!isMaster) {
    return (
      <div style={{ padding:'40px 24px', textAlign:'center' }}>
        <p style={{ fontSize:'40px', marginBottom:'12px' }}>🔒</p>
        <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#1a1a2e', marginBottom:'8px' }}>Acesso restrito</h2>
        <p style={{ fontSize:'14px', color:'#9ca3af' }}>Somente o usuário master pode gerenciar usuários do sistema.</p>
      </div>
    )
  }

  const filtrados = usuarios.filter(u => {
    const buscaOk  = u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())
    const nivelOk  = filtroNivel  === 'todos' || u.nivel_acesso === filtroNivel
    const statusOk = filtroStatus === 'todos' || u.status       === filtroStatus
    return buscaOk && nivelOk && statusOk
  })

  /* ── Abrir modais ── */
  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErroForm('')
    setForm(formVazio); setModalAberto(true)
  }

  function abrirEdicao(u: Usuario) {
    setModoEdicao(true); setSelecionado(u); setErroForm('')
    setForm({ nome:u.nome, email:u.email, telefone:u.telefone, cargo:u.cargo,
              nivel_acesso:u.nivel_acesso, empresa_id:u.empresa_id, status:u.status, senha:'' })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErroForm('') }

  /* ── Salvar (cria no Supabase Auth + tabela usuarios) ── */
  async function salvar() {
    if (!form.nome.trim())  return setErroForm('Nome é obrigatório.')
    if (!form.email.trim()) return setErroForm('E-mail é obrigatório.')
    if (!modoEdicao && form.senha.length < 6) return setErroForm('Senha deve ter pelo menos 6 caracteres.')
    if (form.nivel_acesso !== 'master' && !form.empresa_id) return setErroForm('Selecione uma empresa para este usuário.')

    setSalvando(true); setErroForm('')

    const empresa = empresasMock.find(e => e.id === form.empresa_id)

    if (modoEdicao && selecionado) {
      // Apenas atualiza localmente (em produção chama API)
      setUsuarios(prev => prev.map(u => u.id === selecionado.id ? {
        ...u, nome:form.nome, email:form.email, telefone:form.telefone,
        cargo:form.cargo, nivel_acesso:form.nivel_acesso as any,
        empresa_id:form.empresa_id, empresa_nome:empresa?.nome||'—', status:form.status as any,
      } : u))
    } else {
      // Criar no Supabase Auth
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.admin?.createUser({
          email: form.email, password: form.senha, email_confirm: true,
        }) as any

        const auth_id = data?.user?.id || `local_${Date.now()}`

        if (!error || error?.message?.includes('already')) {
          setUsuarios(prev => [...prev, {
            id: Date.now().toString(), auth_id,
            nome:form.nome, email:form.email, telefone:form.telefone,
            cargo:form.cargo, nivel_acesso:form.nivel_acesso as any,
            empresa_id:form.empresa_id, empresa_nome:empresa?.nome||'—', status:'ativo',
          }])
        } else {
          setErroForm(`Erro ao criar usuário: ${error.message}`)
          setSalvando(false); return
        }
      } catch {
        // fallback local (sem admin API)
        setUsuarios(prev => [...prev, {
          id: Date.now().toString(),
          nome:form.nome, email:form.email, telefone:form.telefone,
          cargo:form.cargo, nivel_acesso:form.nivel_acesso as any,
          empresa_id:form.empresa_id, empresa_nome:empresa?.nome||'—', status:'ativo',
        }])
      }
    }

    setSalvando(false); fecharModal()
  }

  /* ── Inativar / Excluir ── */
  function confirmarAcao(tipo: 'excluir'|'inativar', id: string) {
    setModalConfirm({ tipo, id })
  }

  function executarAcao() {
    if (!modalConfirm) return
    const { tipo, id } = modalConfirm
    if (tipo === 'excluir') {
      setUsuarios(prev => prev.filter(u => u.id !== id))
    } else {
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, status:'inativo' } : u))
    }
    setModalConfirm(null)
    if (selecionado?.id === id) fecharModal()
  }

  function reativar(id: string) {
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, status:'ativo' } : u))
  }

  const f = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
      setForm(prev => ({...prev, [k]:e.target.value}))

  const ativos   = usuarios.filter(u => u.status==='ativo').length
  const inativos = usuarios.filter(u => u.status==='inativo').length

  return (
    <div style={{ padding:'24px 16px' }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Usuários do sistema</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{ativos} ativos · {inativos} inativos</p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo usuário
        </button>
      </div>

      {/* Cards de resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'Total',         valor:usuarios.length,                                    cor:'#6b7280', bg:'#f3f4f6' },
          { label:'Master',        valor:usuarios.filter(u=>u.nivel_acesso==='master').length,cor:'#6366f1', bg:'#eef2ff' },
          { label:'Administradores',valor:usuarios.filter(u=>u.nivel_acesso==='admin').length, cor:'#06b6d4', bg:'#ecfeff' },
          { label:'Profissionais', valor:usuarios.filter(u=>u.nivel_acesso==='profissional').length,cor:'#10b981',bg:'#ecfdf5'},
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
          <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar por nome ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)}/>
        </div>
        <select value={filtroNivel} onChange={e => setFiltroNivel(e.target.value)}
          style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }}>
          <option value="todos">Todos os níveis</option>
          <option value="master">Master</option>
          <option value="admin">Administrador</option>
          <option value="profissional">Profissional</option>
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          style={{ border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none' }}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {/* Lista */}
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {filtrados.map(u => (
          <div key={u.id} style={{
            background:'white', borderRadius:'12px', border:'1px solid #f0f0f8',
            padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px',
            flexWrap:'wrap', opacity: u.status==='inativo'?0.65:1, transition:'opacity .2s',
          }}>
            {/* Avatar */}
            <div style={{
              width:'40px', height:'40px', borderRadius:'50%', flexShrink:0,
              background: nivelBg[u.nivel_acesso], border:`1.5px solid ${nivelCor[u.nivel_acesso]}30`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'13px', fontWeight:'700', color: nivelCor[u.nivel_acesso],
            }}>
              {u.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
            </div>

            {/* Info */}
            <div style={{ flex:1, minWidth:'150px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
                <p style={{ fontSize:'14px', fontWeight:'600', color:'#1a1a2e' }}>{u.nome}</p>
                {u.id === usuarioLogado?.id && (
                  <span style={{ fontSize:'10px', background:'#fffbeb', color:'#f59e0b', padding:'1px 6px', borderRadius:'99px', fontWeight:'600' }}>você</span>
                )}
              </div>
              <p style={{ fontSize:'12px', color:'#9ca3af' }}>{u.email}</p>
            </div>

            {/* Empresa */}
            <div style={{ minWidth:'110px' }}>
              <p style={{ fontSize:'10px', color:'#9ca3af', marginBottom:'2px' }}>Empresa</p>
              <p style={{ fontSize:'13px', color:'#374151', fontWeight:'500' }}>{u.empresa_nome}</p>
            </div>

            {/* Cargo */}
            <div style={{ minWidth:'90px' }}>
              <p style={{ fontSize:'10px', color:'#9ca3af', marginBottom:'2px' }}>Cargo</p>
              <p style={{ fontSize:'13px', color:'#374151' }}>{u.cargo||'—'}</p>
            </div>

            {/* Nível */}
            <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background:nivelBg[u.nivel_acesso], color:nivelCor[u.nivel_acesso] }}>
              {nivelLabel[u.nivel_acesso]}
            </span>

            {/* Status */}
            <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 10px', borderRadius:'99px', background: u.status==='ativo'?'#ecfdf5':'#f9fafb', color: u.status==='ativo'?'#10b981':'#9ca3af' }}>
              {u.status==='ativo'?'Ativo':'Inativo'}
            </span>

            {/* Ações */}
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => abrirEdicao(u)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>
                ✏️
              </button>
              {u.status === 'ativo' ? (
                <button onClick={() => confirmarAcao('inativar', u.id)} style={{ background:'#fffbeb', color:'#f59e0b', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }} title="Inativar">
                  ⏸
                </button>
              ) : (
                <button onClick={() => reativar(u.id)} style={{ background:'#ecfdf5', color:'#10b981', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }} title="Reativar">
                  ▶
                </button>
              )}
              <button onClick={() => confirmarAcao('excluir', u.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }} title="Excluir">
                🗑
              </button>
            </div>
          </div>
        ))}

        {filtrados.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' }}>
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      {/* ── Modal criar/editar ── */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'520px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>
                {modoEdicao ? '✏️ Editar usuário' : '+ Novo usuário'}
              </h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
            </div>

            {/* Aviso nível de acesso */}
            <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:'10px', padding:'10px 14px', marginBottom:'18px', fontSize:'13px', color:'#4338ca', lineHeight:'1.5' }}>
              <strong>Níveis de acesso:</strong><br/>
              🔵 <b>Profissional</b> — vê apenas a própria agenda<br/>
              🟦 <b>Administrador</b> — gerencia tudo da empresa<br/>
              🟣 <b>Master</b> — acesso total ao sistema SaaS
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome completo *</label>
                <input value={form.nome} onChange={f('nome')} style={inputStyle} placeholder="Nome do usuário"/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail *</label>
                <input type="email" value={form.email} onChange={f('email')} style={inputStyle} placeholder="email@empresa.com" disabled={modoEdicao}/>
                {modoEdicao && <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'3px' }}>O e-mail não pode ser alterado após a criação.</p>}
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cargo / Função</label>
                <input value={form.cargo} onChange={f('cargo')} style={inputStyle} placeholder="Ex: Fisioterapeuta"/>
              </div>

              {/* Nível de acesso */}
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nível de acesso *</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' }}>
                  {(['profissional','admin','master'] as const).map(nivel => (
                    <div key={nivel} onClick={() => setForm(prev => ({...prev, nivel_acesso:nivel, empresa_id: nivel==='master'?'':prev.empresa_id}))}
                      style={{
                        padding:'10px 8px', borderRadius:'10px', cursor:'pointer', textAlign:'center',
                        border: form.nivel_acesso===nivel ? `2px solid ${nivelCor[nivel]}` : '2px solid #e5e7eb',
                        background: form.nivel_acesso===nivel ? nivelBg[nivel] : 'white',
                        transition:'all .15s',
                      }}>
                      <p style={{ fontSize:'18px', marginBottom:'3px' }}>{nivel==='profissional'?'🩺':nivel==='admin'?'🏢':'👑'}</p>
                      <p style={{ fontSize:'12px', fontWeight:'600', color: form.nivel_acesso===nivel?nivelCor[nivel]:'#6b7280' }}>{nivelLabel[nivel]}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Empresa — só para não-master */}
              {form.nivel_acesso !== 'master' && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Empresa vinculada *</label>
                  <select value={form.empresa_id} onChange={f('empresa_id')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="">Selecione uma empresa...</option>
                    {empresasMock.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                  <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'4px' }}>
                    {form.nivel_acesso==='profissional'
                      ? 'Este usuário só verá a agenda da empresa selecionada.'
                      : 'Este usuário gerenciará todos os dados da empresa selecionada.'}
                  </p>
                </div>
              )}

              {/* Senha — só ao criar */}
              {!modoEdicao && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Senha de acesso *</label>
                  <input type="password" value={form.senha} onChange={f('senha')} style={inputStyle} placeholder="Mínimo 6 caracteres"/>
                  <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'4px' }}>O usuário poderá alterar a senha depois de acessar o sistema.</p>
                </div>
              )}

              {/* Status — só na edição */}
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

            {/* Erro */}
            {erroForm && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'14px', fontSize:'13px', color:'#dc2626' }}>
                {erroForm}
              </div>
            )}

            {/* Botões */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado ? (
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={() => confirmarAcao('inativar', selecionado.id)}
                    style={{ background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', cursor:'pointer' }}>
                    ⏸ Inativar
                  </button>
                  <button onClick={() => confirmarAcao('excluir', selecionado.id)}
                    style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', cursor:'pointer' }}>
                    🗑 Excluir
                  </button>
                </div>
              ) : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>
                  Cancelar
                </button>
                <button onClick={salvar} disabled={salvando}
                  style={{ background: salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor: salvando?'not-allowed':'pointer' }}>
                  {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Criar usuário'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação ── */}
      {modalConfirm && (
        <div onClick={() => setModalConfirm(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:'16px', padding:'28px 24px', maxWidth:'360px', width:'100%', textAlign:'center' }}>
            <p style={{ fontSize:'36px', marginBottom:'12px' }}>{modalConfirm.tipo==='excluir'?'🗑':'⏸'}</p>
            <h3 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'8px' }}>
              {modalConfirm.tipo==='excluir' ? 'Excluir usuário?' : 'Inativar usuário?'}
            </h3>
            <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'24px', lineHeight:'1.5' }}>
              {modalConfirm.tipo==='excluir'
                ? 'Esta ação não pode ser desfeita. O usuário perderá acesso permanentemente.'
                : 'O usuário não conseguirá mais acessar o sistema. Você pode reativar depois.'}
            </p>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
              <button onClick={() => setModalConfirm(null)} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={executarAcao} style={{
                background: modalConfirm.tipo==='excluir'?'#ef4444':'#f59e0b',
                color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:'pointer',
              }}>
                {modalConfirm.tipo==='excluir' ? 'Sim, excluir' : 'Sim, inativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
