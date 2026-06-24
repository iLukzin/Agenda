'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import { TELAS, permPadrao, salvarPermissoes, buscarPermissoes, buscarPadraoEmpresa, type Permissao } from '@/lib/permissoes'

type Usuario = { id:string; nome:string; email:string; nivel_acesso:string; empresa_id:string; empresa_nome:string; status:string }
type Empresa  = { id:string; nome:string }

const NIVEL_COR:   Record<string,string> = { admin:'#0891b2', profissional:'#059669', usuario:'#d97706' }
const NIVEL_BG:    Record<string,string> = { admin:'#e0f2fe', profissional:'#d1fae5', usuario:'#fef3c7' }
const NIVEL_LABEL: Record<string,string> = { admin:'Admin', profissional:'Profissional', usuario:'Usuario' }

export default function PermissoesPage() {
  const { usuario: usuarioLogado, isMaster } = useEmpresa()
  const router = useRouter()
  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [empresas, setEmpresas]     = useState<Empresa[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [mensagem, setMensagem]     = useState('')
  const [msgOk, setMsgOk]           = useState(false)
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [busca, setBusca]           = useState('')
  const [usuarioSel, setUsuarioSel] = useState<Usuario|null>(null)
  const [permissoes, setPermissoes] = useState<Record<string,Permissao>>({})

  const carregar = useCallback(async () => {
    setCarregando(true)
    const sb = createClient()
    const [{ data: us }, { data: emps }] = await Promise.all([
      sb.from('usuarios').select('id,nome,email,nivel_acesso,empresa_id,status').neq('nivel_acesso','master').order('nome'),
      sb.from('empresas').select('id,nome').order('nome'),
    ])
    const empsMap: Record<string,string> = {}
    if (emps) emps.forEach((e: any) => { empsMap[e.id] = e.nome })
    setEmpresas(emps || [])
    setUsuarios((us || []).map((u: any) => ({ ...u, empresa_nome: u.empresa_id ? (empsMap[u.empresa_id]||'?') : '?' })))
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

 async function selecionarUsuario(u: Usuario) {
    setUsuarioSel(u); setMensagem('')
    const perm = await buscarPermissoes(u.id)
    if (Object.keys(perm).length > 0) {
      setPermissoes(perm)
    } else {
      const padrao = u.empresa_id
        ? await buscarPadraoEmpresa(u.empresa_id, u.nivel_acesso)
        : permPadrao(u.nivel_acesso)
      setPermissoes(padrao)
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

  async function salvar() {
    if (!usuarioSel?.empresa_id) { setMensagem('Este usuario nao tem empresa vinculada.'); setMsgOk(false); return }
    setSalvando(true); setMensagem('')
    const lista = TELAS.map(t => permissoes[t.key] || { tela:t.key, visualizar:false, criar:false, alterar:false, excluir:false })
    const { error } = await salvarPermissoes(usuarioSel.id, usuarioSel.empresa_id, lista)
    setMsgOk(!error)
    setMensagem(error ? 'Erro: '+error.message : 'Permissoes salvas com sucesso!')
    if (!error) setTimeout(() => setMensagem(''), 3000)
    setSalvando(false)
  }

  const filtrados = usuarios.filter(u => {
    const buscaOk = u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())
    const empOk   = !filtroEmpresa || u.empresa_id === filtroEmpresa
    return buscaOk && empOk && u.status === 'ativo'
  })

  if (!isMaster) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'12px' }}>
      <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <p style={{ fontSize:'16px', fontWeight:'700', color:'#374151' }}>Acesso restrito ao Master</p>
    </div>
  )

  return (
    <div style={{ padding:'24px 16px', minHeight:'100vh', background:'#f4f5fb' }}>
      {/* Cabecalho sofisticado */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
        <button onClick={()=>router.push('/dashboard')}
          style={{ display:'flex', alignItems:'center', gap:'8px', background:'white', border:'1.5px solid #e0e7ff', borderRadius:'12px', padding:'9px 16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', color:'#4f46e5', boxShadow:'0 1px 4px rgba(99,102,241,0.12)', transition:'all .15s' }}
          onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff';el.style.boxShadow='0 4px 12px rgba(99,102,241,0.2)'}}
          onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.boxShadow='0 1px 4px rgba(99,102,241,0.12)'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar ao painel
        </button>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px', lineHeight:1 }}>Permissoes de Usuarios</h1>
          <p style={{ fontSize:'13px', color:'#6b7280', marginTop:'3px' }}>Defina o que cada usuario pode visualizar, criar, alterar e excluir</p>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* Lista de usuarios */}
        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #e8e9f4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', background:'linear-gradient(135deg,#f8faff,#f0f4ff)', borderBottom:'1px solid #e8e9f4', display:'flex', flexDirection:'column', gap:'8px' }}>
            <input placeholder="Buscar usuario..." value={busca} onChange={e=>setBusca(e.target.value)}
              style={{ width:'100%', border:'1.5px solid #e0e7ff', borderRadius:'10px', padding:'9px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box', background:'white' }}
              onFocus={e=>{(e.target as HTMLInputElement).style.borderColor='#6366f1'}}
              onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='#e0e7ff'}}/>
            <select value={filtroEmpresa} onChange={e=>setFiltroEmpresa(e.target.value)}
              style={{ width:'100%', border:'1.5px solid #e0e7ff', borderRadius:'10px', padding:'9px 12px', fontSize:'13px', outline:'none', background:'white' }}>
              <option value="">Todas as empresas</option>
              {empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
          <div style={{ maxHeight:'260px', overflowY:'auto' }}>
            {carregando ? (
              <div style={{ padding:'30px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>Carregando...</div>
            ) : filtrados.map(u => (
              <div key={u.id} onClick={()=>selecionarUsuario(u)}
                style={{ padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid #f5f5fb', background:usuarioSel?.id===u.id?'#eef2ff':'transparent', transition:'background .12s' }}
                onMouseEnter={e=>{if(usuarioSel?.id!==u.id)(e.currentTarget as HTMLElement).style.background='#fafbff'}}
                onMouseLeave={e=>{if(usuarioSel?.id!==u.id)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:usuarioSel?.id===u.id?'#6366f1':(NIVEL_BG[u.nivel_acesso]||'#f3f4f6'), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:usuarioSel?.id===u.id?'white':(NIVEL_COR[u.nivel_acesso]||'#6b7280'), flexShrink:0 }}>
                    {u.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'13px', fontWeight:'600', color:usuarioSel?.id===u.id?'#4f46e5':'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.nome}</p>
                    <p style={{ fontSize:'11px', color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.empresa_nome}</p>
                  </div>
                  <span style={{ fontSize:'10px', fontWeight:'700', padding:'3px 8px', borderRadius:'99px', background:NIVEL_BG[u.nivel_acesso]||'#f3f4f6', color:NIVEL_COR[u.nivel_acesso]||'#6b7280', flexShrink:0 }}>
                    {NIVEL_LABEL[u.nivel_acesso]||u.nivel_acesso}
                  </span>
                </div>
              </div>
            ))}
            {filtrados.length===0&&!carregando && (
              <div style={{ padding:'30px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>Nenhum usuario encontrado</div>
            )}
          </div>
        </div>

        {/* Painel de permissoes */}
        {usuarioSel ? (
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #e8e9f4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
            {/* Header do usuario selecionado */}
            <div style={{ padding:'18px 22px', background:'linear-gradient(135deg,#f8faff,#eef2ff)', borderBottom:'1px solid #e8e9f4', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color:'white', boxShadow:'0 3px 10px rgba(99,102,241,0.3)' }}>
                  {usuarioSel.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div>
                  <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a', marginBottom:'2px' }}>{usuarioSel.nome}</h2>
                  <p style={{ fontSize:'12px', color:'#6b7280' }}>{usuarioSel.email} ? {usuarioSel.empresa_nome}</p>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
               {(['profissional','admin','usuario'] as const).map(nivel => (
                  <button key={nivel} onClick={async ()=>{
                    if (usuarioSel?.empresa_id) {
                      const p = await buscarPadraoEmpresa(usuarioSel.empresa_id, nivel)
                      setPermissoes(p)
                    } else {
                      setPermissoes(permPadrao(nivel))
                    }
                  }}
                    style={{ background:NIVEL_BG[nivel], border:'1.5px solid '+NIVEL_COR[nivel]+'40', borderRadius:'8px', padding:'6px 12px', fontSize:'12px', cursor:'pointer', color:NIVEL_COR[nivel], fontWeight:'600', transition:'all .15s' }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=NIVEL_COR[nivel];(e.currentTarget as HTMLElement).style.color='white'}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=NIVEL_BG[nivel];(e.currentTarget as HTMLElement).style.color=NIVEL_COR[nivel]}}>
                    Padrao {NIVEL_LABEL[nivel]}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabela de permissoes */}
            <div style={{ padding:'12px', overflowX:'auto', WebkitOverflowScrolling:'touch' } as any}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'320px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #f0f0f8' }}>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', width:'38%' }}>Modulo</th>
                    {['Visualizar','Criar','Alterar','Excluir'].map(h=>(
                      <th key={h} style={{ padding:'10px 8px', textAlign:'center', fontSize:'11px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TELAS.map((tela, i) => {
                    const p = permissoes[tela.key] || { tela:tela.key, visualizar:false, criar:false, alterar:false, excluir:false }
                    return (
                      <tr key={tela.key} style={{ borderBottom:'1px solid #f5f5fb', background:i%2===0?'transparent':'#fafbff' }}>
                        <td style={{ padding:'14px', fontSize:'14px', fontWeight:'600', color:'#111827', display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:p.visualizar?'#10b981':'#e5e7eb', flexShrink:0 }}/>
                          {tela.label}
                        </td>
                        {(['visualizar','criar','alterar','excluir'] as const).map(tipo => (
                          <td key={tipo} style={{ padding:'14px 8px', textAlign:'center' }}>
                            <div onClick={()=>togglePerm(tela.key, tipo)}
                              style={{ width:'26px', height:'26px', borderRadius:'7px', cursor:'pointer', border:p[tipo]?'2px solid #6366f1':'2px solid #e5e7eb', background:p[tipo]?'#6366f1':'white', display:'inline-flex', alignItems:'center', justifyContent:'center', transition:'all .15s', boxShadow:p[tipo]?'0 2px 6px rgba(99,102,241,0.3)':'none' }}>
                              {p[tipo] && (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ padding:'16px 22px', borderTop:'1px solid #f0f0f8', background:'#fafbff', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
              <div>
                {mensagem ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', fontWeight:'600', color:msgOk?'#059669':'#dc2626' }}>
                    {msgOk
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                    {mensagem}
                  </div>
                ) : (
                  <p style={{ fontSize:'12px', color:'#9ca3af' }}>Marcar Criar/Alterar/Excluir habilita Visualizar automaticamente.</p>
                )}
              </div>
              <button onClick={salvar} disabled={salvando}
                style={{ display:'flex', alignItems:'center', gap:'8px', background:salvando?'#a5b4fc':'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'10px', padding:'11px 24px', fontSize:'14px', fontWeight:'700', cursor:salvando?'not-allowed':'pointer', boxShadow:salvando?'none':'0 3px 10px rgba(99,102,241,0.35)', transition:'all .15s' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                {salvando ? 'Salvando...' : 'Salvar permissoes'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #e8e9f4', padding:'60px 40px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <p style={{ fontSize:'16px', fontWeight:'700', color:'#111827', marginBottom:'6px' }}>Selecione um usuario</p>
            <p style={{ fontSize:'13px', color:'#9ca3af' }}>Clique em um usuario na lista para configurar as permissoes.</p>
          </div>
        )}
      </div>
    </div>
  )
}
