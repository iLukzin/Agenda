'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import { TELAS, PERM_PADRAO_PROFISSIONAL, PERM_PADRAO_ADMIN, salvarPermissoes, buscarPermissoes, type Permissao } from '@/lib/permissoes'

type Usuario = { id:string; nome:string; email:string; nivel_acesso:string; empresa_id:string; empresa_nome:string; status:string }
type Empresa  = { id:string; nome:string }

export default function PermissoesPage() {
  const { usuario: usuarioLogado } = useEmpresa()
  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [mensagem, setMensagem]     = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [busca, setBusca]           = useState('')
  const [usuarioSel, setUsuarioSel] = useState<Usuario|null>(null)
  const [permissoes, setPermissoes] = useState<Record<string,Permissao>>({})

  const isMaster = usuarioLogado?.nivel_acesso === 'master'

  const carregar = useCallback(async () => {
    setCarregando(true)
    const sb = createClient()
    const [{ data: us }, { data: emps }] = await Promise.all([
      sb.from('usuarios').select('id, nome, email, nivel_acesso, empresa_id, status').neq('nivel_acesso','master').order('nome'),
      sb.from('empresas').select('id, nome').order('nome'),
    ])
    const empsMap: Record<string,string> = {}
    if (emps) emps.forEach((e: any) => { empsMap[e.id] = e.nome })
    setEmpresas(emps || [])
    setUsuarios((us || []).map((u: any) => ({ ...u, empresa_nome: u.empresa_id ? (empsMap[u.empresa_id]||'—') : '—' })))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function selecionarUsuario(u: Usuario) {
    setUsuarioSel(u); setMensagem('')
    const perm = await buscarPermissoes(u.id)
    if (Object.keys(perm).length === 0) {
      setPermissoes(u.nivel_acesso === 'admin' ? PERM_PADRAO_ADMIN : PERM_PADRAO_PROFISSIONAL)
    } else {
      setPermissoes(perm)
    }
  }

  function togglePerm(tela: string, tipo: keyof Omit<Permissao,'tela'>) {
    setPermissoes(prev => {
      const atual = prev[tela] || { tela, visualizar:false, criar:false, alterar:false, excluir:false }
      const novo  = { ...atual, [tipo]: !atual[tipo] }
      if (tipo === 'visualizar' && !novo.visualizar) { novo.criar=false; novo.alterar=false; novo.excluir=false }
      if ((tipo==='criar'||tipo==='alterar'||tipo==='excluir') && novo[tipo]) novo.visualizar=true
      return { ...prev, [tela]: novo }
    })
  }

  function aplicarPadrao(nivel: 'profissional'|'admin') {
    setPermissoes(nivel==='admin' ? PERM_PADRAO_ADMIN : PERM_PADRAO_PROFISSIONAL)
  }

  async function salvar() {
    if (!usuarioSel?.empresa_id) { setMensagem('Este usuário não tem empresa vinculada.'); return }
    setSalvando(true); setMensagem('')
    const lista = TELAS.map(t => permissoes[t.key] || { tela:t.key, visualizar:false, criar:false, alterar:false, excluir:false })
    const { error } = await salvarPermissoes(usuarioSel.id, usuarioSel.empresa_id, lista)
    setMensagem(error ? 'Erro: '+error.message : '✅ Permissões salvas!')
    if (!error) setTimeout(() => setMensagem(''), 3000)
    setSalvando(false)
  }

  const filtrados = usuarios.filter(u => {
    const buscaOk = u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())
    const empOk   = !filtroEmpresa || u.empresa_id === filtroEmpresa
    return buscaOk && empOk && u.status === 'ativo'
  })

  const nivelCor:   Record<string,string> = { admin:'#06b6d4', profissional:'#10b981' }
  const nivelBg:    Record<string,string> = { admin:'#ecfeff', profissional:'#ecfdf5' }
  const nivelLabel: Record<string,string> = { admin:'Admin',    profissional:'Profissional' }

  if (!isMaster) return (
    <div style={{ padding:'40px', textAlign:'center' }}>
      <p style={{ fontSize:'36px', marginBottom:'12px' }}>🔒</p>
      <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#1a1a2e' }}>Acesso restrito ao master</h2>
    </div>
  )

  return (
    <div style={{ padding:'24px 16px', minHeight:'100vh', background:'#f8f8fc' }}>
      <div style={{ marginBottom:'24px' }}>
        <Link href="/dashboard" style={{ fontSize:'13px', color:'#9ca3af', textDecoration:'none', display:'block', marginBottom:'4px' }}>← Dashboard</Link>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>🔐 Permissões de Usuários</h1>
        <p style={{ fontSize:'13px', color:'#9ca3af' }}>Defina o que cada usuário pode visualizar, criar, alterar e excluir</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'16px', alignItems:'start' }}>
        {/* Lista */}
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', flexDirection:'column', gap:'8px' }}>
            <input placeholder="Buscar usuário..." value={busca} onChange={e=>setBusca(e.target.value)}
              style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
            <select value={filtroEmpresa} onChange={e=>setFiltroEmpresa(e.target.value)}
              style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'8px 10px', fontSize:'13px', outline:'none' }}>
              <option value="">Todas as empresas</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div style={{ maxHeight:'520px', overflowY:'auto' }}>
            {carregando ? <div style={{ padding:'30px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>Carregando...</div>
            : filtrados.map(u => (
              <div key={u.id} onClick={()=>selecionarUsuario(u)}
                style={{ padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid #f9fafb', background:usuarioSel?.id===u.id?'#eef2ff':'transparent', transition:'background .1s' }}
                onMouseEnter={e=>{if(usuarioSel?.id!==u.id)(e.currentTarget as HTMLElement).style.background='#fafafa'}}
                onMouseLeave={e=>{if(usuarioSel?.id!==u.id)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:nivelBg[u.nivel_acesso]||'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', color:nivelCor[u.nivel_acesso]||'#6b7280', flexShrink:0 }}>
                    {u.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'13px', fontWeight:'600', color:usuarioSel?.id===u.id?'#6366f1':'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.nome}</p>
                    <p style={{ fontSize:'11px', color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.empresa_nome}</p>
                  </div>
                  <span style={{ fontSize:'10px', fontWeight:'600', padding:'2px 6px', borderRadius:'99px', background:nivelBg[u.nivel_acesso]||'#f3f4f6', color:nivelCor[u.nivel_acesso]||'#6b7280', flexShrink:0 }}>
                    {nivelLabel[u.nivel_acesso]||u.nivel_acesso}
                  </span>
                </div>
              </div>
            ))}
            {filtrados.length===0&&!carregando && <div style={{ padding:'30px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>Nenhum usuário</div>}
          </div>
        </div>

        {/* Painel */}
        {usuarioSel ? (
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8' }}>
            <div style={{ padding:'18px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>{usuarioSel.nome}</h2>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>{usuarioSel.email} · {usuarioSel.empresa_nome}</p>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={()=>aplicarPadrao('profissional')} style={{ background:'#f3f4f6', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', cursor:'pointer', color:'#374151' }}>↩ Padrão Profissional</button>
                <button onClick={()=>aplicarPadrao('admin')} style={{ background:'#ecfeff', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', cursor:'pointer', color:'#06b6d4' }}>↩ Padrão Admin</button>
              </div>
            </div>

            <div style={{ padding:'20px', overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'500px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #f3f4f6' }}>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontSize:'12px', fontWeight:'600', color:'#374151', width:'40%' }}>Tela / Módulo</th>
                    {['Visualizar','Criar','Alterar','Excluir'].map(h=>(
                      <th key={h} style={{ padding:'10px 8px', textAlign:'center', fontSize:'12px', fontWeight:'600', color:'#374151' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TELAS.map((tela, i)=>{
                    const p = permissoes[tela.key]||{tela:tela.key,visualizar:false,criar:false,alterar:false,excluir:false}
                    return (
                      <tr key={tela.key} style={{ borderBottom:'1px solid #f9fafb', background:i%2===0?'transparent':'#fafafa' }}>
                        <td style={{ padding:'14px', fontSize:'14px', fontWeight:'500', color:'#1a1a2e' }}>{tela.label}</td>
                        {(['visualizar','criar','alterar','excluir'] as const).map(tipo=>(
                          <td key={tipo} style={{ padding:'14px 8px', textAlign:'center' }}>
                            <div onClick={()=>togglePerm(tela.key, tipo)} style={{
                              width:'24px', height:'24px', borderRadius:'6px', cursor:'pointer',
                              border:p[tipo]?'2px solid #6366f1':'2px solid #e5e7eb',
                              background:p[tipo]?'#6366f1':'white',
                              display:'inline-flex', alignItems:'center', justifyContent:'center', transition:'all .15s',
                            }}>
                              {p[tipo]&&<span style={{ color:'white', fontSize:'13px', fontWeight:'700', lineHeight:1 }}>✓</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding:'16px 20px', borderTop:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
              {mensagem
                ? <span style={{ fontSize:'13px', fontWeight:'500', color:mensagem.startsWith('✅')?'#10b981':'#ef4444' }}>{mensagem}</span>
                : <p style={{ fontSize:'12px', color:'#9ca3af' }}>ℹ️ Marcar Criar/Alterar/Excluir habilita Visualizar automaticamente.</p>}
              <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'10px 24px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                {salvando?'Salvando...':'💾 Salvar permissões'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'60px', textAlign:'center', color:'#9ca3af' }}>
            <p style={{ fontSize:'36px', marginBottom:'12px' }}>👈</p>
            <p style={{ fontSize:'15px', fontWeight:'500', marginBottom:'6px' }}>Selecione um usuário</p>
            <p style={{ fontSize:'13px' }}>Clique em um usuário para configurar as permissões.</p>
          </div>
        )}
      </div>
    </div>
  )
}
