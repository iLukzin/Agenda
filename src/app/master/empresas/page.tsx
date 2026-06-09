'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'

const inp = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const, minHeight:'42px' }
const planoCor: any = { basico:'#6b7280', profissional:'#6366f1', enterprise:'#f59e0b' }
const planoBg: any  = { basico:'#f3f4f6', profissional:'#eef2ff', enterprise:'#fffbeb' }
function formVazio() { return { nome:'', cnpj:'', email:'', telefone:'', endereco:'', plano:'profissional', status:'ativo', vencimento:'', bloqueada: false, motivo_bloqueio:'', whatsapp_habilitado: false } }

export default function EmpresasPage() {
  const router = useRouter()
  const { recarregar, isMaster } = useEmpresa()
  const [empresas, setEmpresas]     = useState([] as any[])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [busca, setBusca]           = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao]   = useState(false)
  const [selecionada, setSelecionada] = useState(null as any)
  const [abaModal, setAbaModal] = useState('dados')
  const [todosUsuarios, setTodosUsuarios] = useState([] as any[])
  const [usuariosVinculados, setUsuariosVinculados] = useState([] as string[])
  const [salvandoVinculos, setSalvandoVinculos] = useState(false)
  const [form, setForm] = useState(formVazio())
  const ativas = empresas.filter(function(e) { return e.status === 'ativo' }).length

  const carregar = useCallback(async function() {
    setCarregando(true)
    const sb = createClient()
    const { data } = await sb.from('empresas').select('id,nome,cnpj,email,telefone,endereco,plano,status,vencimento,bloqueada,motivo_bloqueio,whatsapp_habilitado').order('nome')
    setEmpresas((data || []).map(function(e: any) { return { id:e.id, nome:e.nome||'', cnpj:e.cnpj||'', email:e.email||'', telefone:e.telefone||'', endereco:e.endereco||'', plano:e.plano||'profissional', status:e.status||'ativo', vencimento:e.vencimento||'', bloqueada:e.bloqueada||false, motivo_bloqueio:e.motivo_bloqueio||'', whatsapp_habilitado:e.whatsapp_habilitado||false, } }))
    setCarregando(false)
  }, [])

  useEffect(function() { carregar() }, [carregar])
  useEffect(function() {
    function onKey(e: any) { if (e.key === 'Escape' && modalAberto) fecharModal() }
    window.addEventListener('keydown', onKey)
    return function() { window.removeEventListener('keydown', onKey) }
  }, [modalAberto])

  const filtradas = empresas.filter(function(e) {
    return e.nome.toLowerCase().includes(busca.toLowerCase()) || e.cnpj.includes(busca) || e.email.toLowerCase().includes(busca.toLowerCase())
  })

  function abrirNova() { setModoEdicao(false); setSelecionada(null); setErro(''); setForm(formVazio()); setAbaModal('dados'); setModalAberto(true) }
  function abrirEdicao(e: any) { setModoEdicao(true); setSelecionada(e); setErro(''); setForm({ nome:e.nome, cnpj:e.cnpj, email:e.email, telefone:e.telefone, endereco:e.endereco, plano:e.plano, status:e.status, vencimento:e.vencimento, bloqueada:e.bloqueada, motivo_bloqueio:e.motivo_bloqueio, whatsapp_habilitado:e.whatsapp_habilitado||false }); setAbaModal('dados'); setModalAberto(true) }
  function fecharModal() { setModalAberto(false); setSelecionada(null); setErro(''); setAbaModal('dados'); setTodosUsuarios([]); setUsuariosVinculados([]) }

  async function carregarUsuariosEmpresa(empresaId: any) {
    const sb = createClient()
    const r1 = await sb.from('usuarios').select('id,nome,email,nivel_acesso').neq('nivel_acesso','master').order('nome')
    const r2 = await sb.from('usuario_empresas').select('usuario_id').eq('empresa_id', empresaId)
    setTodosUsuarios(r1.data || [])
    setUsuariosVinculados(((r2.data || []) as any[]).map(function(v: any) { return v.usuario_id }))
  }

  async function salvarVinculos(empresaId: any) {
    setSalvandoVinculos(true)
    const sb = createClient()

    // Buscar usuários que têm empresa_id = empresaId (proprietários diretos)
    // Estes SEMPRE devem ter vínculo, independente da seleção
    const { data: proprietarios } = await sb
      .from('usuarios')
      .select('id')
      .eq('empresa_id', empresaId)
    const proprietariosIds = (proprietarios || []).map((p: any) => p.id) as string[]

    // Unir selecionados + proprietários (sem duplicar)
    const todosIds = Array.from(new Set([...usuariosVinculados, ...proprietariosIds]))

    // Deletar vínculos existentes e reinserir
    await sb.from('usuario_empresas').delete().eq('empresa_id', empresaId)
    if (todosIds.length > 0) {
      await sb.from('usuario_empresas').insert(
        todosIds.map(function(uid: any) { return { usuario_id: uid, empresa_id: empresaId } })
      )
    }
    setSalvandoVinculos(false)
    alert('Vinculos salvos!')
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome e obrigatorio.'); return }
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = { nome:form.nome.trim(), cnpj:form.cnpj||null, email:form.email||null, telefone:form.telefone||null, endereco:form.endereco||null, plano:form.plano, status:form.status, vencimento:form.vencimento||null, bloqueada:form.bloqueada, motivo_bloqueio:form.bloqueada?(form.motivo_bloqueio||'Falta de pagamento'):null, whatsapp_habilitado:form.whatsapp_habilitado }
    let error: any
    if (modoEdicao && selecionada) {
      const r = await sb.from('empresas').update(payload).eq('id', selecionada.id)
      error = r.error
    } else {
      // Criar empresa
      const r = await sb.from('empresas').insert(payload).select('id').single()
      error = r.error
      if (!error && r.data?.id) {
        // Vincular todos os usuários master automaticamente
        const { data: masters } = await sb
          .from('usuarios')
          .select('id')
          .eq('nivel_acesso', 'master')
          .eq('status', 'ativo')
        if (masters && masters.length > 0) {
          await sb.from('usuario_empresas').insert(
            masters.map((m: any) => ({ usuario_id: m.id, empresa_id: r.data.id }))
          )
        }
      }
    }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    await carregar(); recarregar(); fecharModal(); setSalvando(false)
  }

  async function toggleStatus(e: any) {
    const sb = createClient()
    await sb.from('empresas').update({ status: e.status === 'ativo' ? 'inativo' : 'ativo' }).eq('id', e.id)
    await carregar(); recarregar()
  }

  async function toggleBloqueio(e: any) {
    const novo = !e.bloqueada
    const motivo = novo ? (prompt('Motivo do bloqueio:') || 'Falta de pagamento') : null
    if (novo && motivo === null) return
    const sb = createClient()
    await sb.from('empresas').update({ bloqueada: novo, motivo_bloqueio: motivo }).eq('id', e.id)
    await carregar(); recarregar()
    if (novo) alert('Empresa bloqueada. Usuarios serao deslogados automaticamente.')
  }

  const setF = function(k: any) { return function(v: any) { setForm(function(p: any) { return { ...p, [k]: v } }) } }

  return (
    <div style={{ padding:'16px', minHeight:'100vh', background:'#f4f5fb' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
        <button onClick={function() { router.push('/dashboard') }} style={{ display:'flex', alignItems:'center', gap:'6px', background:'white', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', cursor:'pointer', color:'#374151' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#0f172a', flex:1 }}>Empresas</h1>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <span style={{ fontSize:'12px', color:'#6b7280' }}>{ativas} ativas / {empresas.length} total</span>
          <button onClick={abrirNova} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'8px', padding:'9px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>+ Nova empresa</button>
        </div>
      </div>

      <div style={{ background:'white', borderRadius:'12px', padding:'12px', marginBottom:'16px', border:'1px solid #f0f0f8' }}>
        <input value={busca} onChange={function(e) { setBusca(e.target.value) }} placeholder="Buscar por nome, CNPJ ou e-mail..." style={{ ...inp, marginBottom:0 }}/>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af', background:'white', borderRadius:'12px' }}>Nenhuma empresa encontrada</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtradas.map(function(e: any) {
            return (
              <div key={e.id} style={{ background:'white', borderRadius:'12px', padding:'14px 16px', border:'1px solid #f0f0f8', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                    <p style={{ fontSize:'14px', fontWeight:'700', color:'#0f172a' }}>{e.nome}</p>
                    {e.bloqueada && <span style={{ fontSize:'10px', fontWeight:'700', color:'#dc2626', background:'#fef2f2', borderRadius:'4px', padding:'1px 6px' }}>BLOQ</span>}
                    {e.whatsapp_habilitado && <span style={{ fontSize:'10px', fontWeight:'700', color:'#16a34a', background:'#f0fdf4', borderRadius:'4px', padding:'1px 6px' }}>WPP</span>}
                    <span style={{ fontSize:'11px', fontWeight:'500', padding:'2px 8px', borderRadius:'99px', background:planoBg[e.plano]||'#f3f4f6', color:planoCor[e.plano]||'#6b7280', textTransform:'capitalize' as const }}>{e.plano}</span>
                  </div>
                  <p style={{ fontSize:'12px', color:'#6b7280' }}>{e.cnpj||'–'} · {e.email||'–'}</p>
                </div>
                <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                  <button onClick={function() { abrirEdicao(e) }} style={{ background:'#f3f4f6', border:'none', borderRadius:'7px', padding:'7px 12px', fontSize:'12px', cursor:'pointer', color:'#374151' }}>Editar</button>
                  <button onClick={function() { toggleStatus(e) }} style={{ background: e.status==='ativo'?'#fff7ed':'#f0fdf4', border:'none', borderRadius:'7px', padding:'7px 12px', fontSize:'12px', cursor:'pointer', color: e.status==='ativo'?'#c2410c':'#16a34a' }}>{e.status==='ativo'?'Desativar':'Ativar'}</button>
                  <button onClick={function() { toggleBloqueio(e) }} style={{ background:'#f3f4f6', border:'none', borderRadius:'7px', padding:'7px 12px', fontSize:'12px', cursor:'pointer' }}>
                    <svg width="14" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    {e.bloqueada ? 'Desbloquear' : 'Bloquear'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={function(ev) { ev.stopPropagation() }} style={{ background:'white', width:'100%', maxWidth:'500px', borderRadius:'18px', maxHeight:'90vh', overflowY:'auto', padding:'22px 20px', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a' }}>{modoEdicao ? 'Editar empresa' : 'Nova empresa'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px' }}>x</button>
            </div>

            {modoEdicao && selecionada && (
              <div style={{ display:'flex', gap:'4px', marginBottom:'12px', borderBottom:'2px solid #f0f0f8', paddingBottom:'0' }}>
                <button onClick={function() { setAbaModal('dados') }} style={{ background:'none', border:'none', padding:'8px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', borderBottom: abaModal==='dados' ? '2px solid #6366f1' : '2px solid transparent', color: abaModal==='dados' ? '#6366f1' : '#6b7280', marginBottom:'-2px' }}>Dados da Empresa</button>
                <button onClick={function() { setAbaModal('usuarios'); carregarUsuariosEmpresa(selecionada.id) }} style={{ background:'none', border:'none', padding:'8px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', borderBottom: abaModal==='usuarios' ? '2px solid #6366f1' : '2px solid transparent', color: abaModal==='usuarios' ? '#6366f1' : '#6b7280', marginBottom:'-2px' }}>Usuarios Vinculados</button>
              </div>
            )}

            {(abaModal === 'dados' || !modoEdicao) && (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {([{l:'Nome *',k:'nome',ph:'Nome da empresa'},{l:'E-mail',k:'email',ph:'email@empresa.com'},{l:'Telefone',k:'telefone',ph:'(11) 99999-9999'}] as any[]).map(function(f: any) {
                return (
                  <div key={f.k}>
                    <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>{f.l}</label>
                    <input value={(form as any)[f.k]} onChange={function(e) { setForm(function(p) { return { ...p, [f.k]: e.target.value } }) }} style={inp} placeholder={f.ph}/>
                  </div>
                )
              })}
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>CNPJ / CPF</label>
                <input value={form.cnpj} onChange={function(e) { const r=e.target.value.replace(/[^0-9]/g,'').slice(0,14); const m=r.length<=11?(r.length<=3?r:r.length<=6?r.slice(0,3)+'.'+r.slice(3):r.length<=9?r.slice(0,3)+'.'+r.slice(3,6)+'.'+r.slice(6):r.slice(0,3)+'.'+r.slice(3,6)+'.'+r.slice(6,9)+'-'+r.slice(9)):(r.length<=12?r.slice(0,2)+'.'+r.slice(2,5)+'.'+r.slice(5,8)+'/'+r.slice(8,12):r.slice(0,2)+'.'+r.slice(2,5)+'.'+r.slice(5,8)+'/'+r.slice(8,12)+'-'+r.slice(12)); setForm(function(p) { return { ...p, cnpj: m } }) }} style={inp} placeholder="CPF ou CNPJ" maxLength={18}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Endereco</label>
                <input value={form.endereco} onChange={function(e) { setForm(function(p) { return { ...p, endereco: e.target.value } }) }} style={inp} placeholder="Rua, numero, cidade"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Plano</label>
                  <select value={form.plano} onChange={function(e) { setForm(function(p) { return { ...p, plano: e.target.value } }) }} style={{ ...inp, background:'white' }}>
                    <option value="basico">Basico</option>
                    <option value="profissional">Profissional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Status</label>
                  <select value={form.status} onChange={function(e) { setForm(function(p) { return { ...p, status: e.target.value } }) }} style={{ ...inp, background:'white' }}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Vencimento</label>
                <input type="date" value={form.vencimento} onChange={function(e) { setForm(function(p) { return { ...p, vencimento: e.target.value } }) }} style={inp}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'#f0fdf4', borderRadius:'10px', border:'1px solid #bbf7d0' }}>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:'600', color:'#065f46' }}>Habilitar WhatsApp</p>
                  <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'1px' }}>Permite a empresa conectar e usar WhatsApp no sistema</p>
                </div>
                <div onClick={function() { setForm(function(p) { return { ...p, whatsapp_habilitado: !p.whatsapp_habilitado } }) }} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:form.whatsapp_habilitado?'#22c55e':'#e5e7eb', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', left:form.whatsapp_habilitado?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s' }}/>
                </div>
              </div>
              {erro && <div style={{ padding:'10px 13px', borderRadius:'8px', fontSize:'13px', color:'#dc2626', border:'1px solid #fecaca' }}>{erro}</div>}
            </div>
            )}

            {abaModal === 'usuarios' && modoEdicao && selecionada && (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px', minHeight:'200px' }}>
                <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'4px' }}>Selecione os usuarios que podem acessar esta empresa:</p>
                {todosUsuarios.length === 0 ? (
                  <p style={{ color:'#9ca3af', fontSize:'13px', textAlign:'center', padding:'20px' }}>Nenhum usuario cadastrado</p>
                ) : (
                  todosUsuarios.map(function(u: any) {
                    return (
                      <label key={u.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px', borderRadius:'8px', border:'1px solid #e5e7eb', cursor:'pointer', background: usuariosVinculados.includes(u.id) ? '#eef2ff' : 'white' }}>
                        <input type="checkbox" checked={usuariosVinculados.includes(u.id)}
                          onChange={function(e) { setUsuariosVinculados(function(prev) { return e.target.checked ? [...prev, u.id] : prev.filter(function(id) { return id !== u.id }) }) }}
                          style={{ width:'16px', height:'16px', accentColor:'#6366f1' }}/>
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827' }}>{u.nome}</p>
                          <p style={{ fontSize:'11px', color:'#6b7280' }}>{u.email} · {u.nivel_acesso}</p>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'18px' }}>
              <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
              {abaModal === 'usuarios' && selecionada ? (
                <button onClick={function() { salvarVinculos(selecionada.id) }} disabled={salvandoVinculos} style={{ background:salvandoVinculos?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>
                  {salvandoVinculos ? 'Salvando...' : 'Salvar vinculos'}
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
