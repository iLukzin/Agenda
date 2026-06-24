// BUILD: 1782266000
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import {
  TELAS,
  permPadrao,
  buscarPadraoEmpresa,
  salvarPadraoEmpresa,
  type Permissao,
} from '@/lib/permissoes'

type Empresa = { id: string; nome: string }
type Nivel   = 'admin' | 'profissional' | 'usuario'

const NIVEL_COR:   Record<Nivel, string> = { admin:'#0891b2', profissional:'#059669', usuario:'#d97706' }
const NIVEL_BG:    Record<Nivel, string> = { admin:'#e0f2fe', profissional:'#d1fae5', usuario:'#fef3c7' }
const NIVEL_LABEL: Record<Nivel, string> = { admin:'Admin', profissional:'Profissional', usuario:'Usuario' }
const NIVEL_DESC:  Record<Nivel, string> = {
  admin:        'Acesso administrativo na empresa',
  profissional: 'Profissional que atende na agenda',
  usuario:      'Acesso limitado ao proprio profissional vinculado',
}
const NIVEIS: Nivel[] = ['admin','profissional','usuario']

export default function PermissoesPadraoPage() {
  const { isMaster } = useEmpresa()
  const router = useRouter()

  const [empresas, setEmpresas]       = useState<Empresa[]>([])
  const [empresaSel, setEmpresaSel]   = useState<string>('')
  const [nivelSel, setNivelSel]       = useState<Nivel>('admin')
  const [permissoes, setPermissoes]   = useState<Record<string, Permissao>>({})
  const [carregandoEmps, setCarregandoEmps] = useState(false)
  const [carregandoPerm, setCarregandoPerm] = useState(false)
  const [salvando, setSalvando]       = useState(false)
  const [mensagem, setMensagem]       = useState('')
  const [msgOk, setMsgOk]             = useState(false)

  // Carrega lista de empresas
  const carregarEmpresas = useCallback(async () => {
    setCarregandoEmps(true)
    const sb = createClient()
    const { data } = await sb.from('empresas').select('id,nome').order('nome')
    setEmpresas(data || [])
    setCarregandoEmps(false)
  }, [])

  useEffect(() => { carregarEmpresas() }, [carregarEmpresas])

  // Carrega permissoes do padrao quando muda empresa ou nivel
  const carregarPermissoes = useCallback(async () => {
    if (!empresaSel) { setPermissoes({}); return }
    setCarregandoPerm(true); setMensagem('')
    const mapa = await buscarPadraoEmpresa(empresaSel, nivelSel)
    setPermissoes(mapa)
    setCarregandoPerm(false)
  }, [empresaSel, nivelSel])

  useEffect(() => { carregarPermissoes() }, [carregarPermissoes])

  function togglePerm(tela: string, tipo: keyof Omit<Permissao,'tela'>) {
    setPermissoes(prev => {
      const atual = prev[tela] || { tela, visualizar:false, criar:false, alterar:false, excluir:false }
      const novo  = { ...atual, [tipo]: !atual[tipo] }
      // Regras de coerencia: sem visualizar nao pode ter criar/alterar/excluir
      if (tipo === 'visualizar' && !novo.visualizar) { novo.criar=false; novo.alterar=false; novo.excluir=false }
      if ((tipo==='criar' || tipo==='alterar' || tipo==='excluir') && novo[tipo]) novo.visualizar = true
      return { ...prev, [tela]: novo }
    })
  }

  function restaurarHardcoded() {
    if (!confirm('Restaurar para o padrao original do sistema? As alteracoes nao salvas serao perdidas.')) return
    setPermissoes(permPadrao(nivelSel))
    setMensagem('Padrao restaurado. Clique em Salvar para aplicar.'); setMsgOk(true)
  }

  function marcarTodos(valor: boolean) {
    const novo: Record<string, Permissao> = {}
    for (const t of TELAS) {
      novo[t.key] = {
        tela: t.key,
        visualizar: valor,
        criar:      valor,
        alterar:    valor,
        excluir:    valor,
      }
    }
    setPermissoes(novo)
  }

  async function salvar() {
    if (!empresaSel) { setMensagem('Selecione uma empresa primeiro.'); setMsgOk(false); return }
    setSalvando(true); setMensagem('')
    const lista = TELAS.map(t => permissoes[t.key] || { tela:t.key, visualizar:false, criar:false, alterar:false, excluir:false })
    const { error } = await salvarPadraoEmpresa(empresaSel, nivelSel, lista)
    setMsgOk(!error)
    setMensagem(error ? 'Erro ao salvar: '+error.message : 'Padrao de ' + NIVEL_LABEL[nivelSel] + ' salvo com sucesso!')
    if (!error) setTimeout(() => setMensagem(''), 3000)
    setSalvando(false)
  }

  // === Proteção: somente master ===
  if (!isMaster) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'12px' }}>
      <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <p style={{ fontSize:'16px', fontWeight:'700', color:'#374151' }}>Acesso restrito ao Master</p>
      <p style={{ fontSize:'13px', color:'#9ca3af' }}>Somente o usuario master pode configurar padroes de permissao.</p>
    </div>
  )

  const empresaNome = empresas.find(e => e.id === empresaSel)?.nome || ''

  return (
    <div style={{ padding:'24px 16px', minHeight:'100vh', background:'#f4f5fb' }}>

      {/* Cabecalho */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
        <button onClick={()=>router.push('/dashboard')}
          style={{ display:'flex', alignItems:'center', gap:'8px', background:'white', border:'1.5px solid #e0e7ff', borderRadius:'12px', padding:'9px 16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', color:'#4f46e5', boxShadow:'0 1px 4px rgba(99,102,241,0.12)', transition:'all .15s' }}
          onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff';el.style.boxShadow='0 4px 12px rgba(99,102,241,0.2)'}}
          onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.boxShadow='0 1px 4px rgba(99,102,241,0.12)'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar ao painel
        </button>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px', lineHeight:1 }}>Permissoes Padrao</h1>
          <p style={{ fontSize:'13px', color:'#6b7280', marginTop:'3px' }}>Configure o padrao de permissoes por empresa e nivel. Aparece na tela de Permissoes de Usuario.</p>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* Selecao de empresa */}
        <div style={{ background:'white', borderRadius:'16px', border:'1px solid #e8e9f4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', padding:'18px 22px' }}>
          <label style={{ display:'block', fontSize:'12px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>Empresa</label>
          <select value={empresaSel} onChange={e=>setEmpresaSel(e.target.value)}
            disabled={carregandoEmps}
            style={{ width:'100%', maxWidth:'420px', border:'1.5px solid #e0e7ff', borderRadius:'10px', padding:'10px 12px', fontSize:'14px', outline:'none', background:'white', cursor:'pointer' }}
            onFocus={e=>{(e.target as HTMLSelectElement).style.borderColor='#6366f1'}}
            onBlur={e=>{(e.target as HTMLSelectElement).style.borderColor='#e0e7ff'}}>
            <option value="">{carregandoEmps ? 'Carregando...' : 'Selecione uma empresa'}</option>
            {empresas.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nome}</option>
            ))}
          </select>
        </div>

        {/* Conteudo principal — so aparece se empresa esta selecionada */}
        {empresaSel ? (
          <div style={{ background:'white', borderRadius:'16px', border:'1px solid #e8e9f4', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>

            {/* Header com info da empresa + abas de nivel */}
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #f0f0f8', background:'linear-gradient(135deg,#f8faff,#f0f4ff)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'linear-gradient(135deg,#6366f1,#4f46e5)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'10px', color:'#9ca3af', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', margin:0 }}>Configurando empresa</p>
                  <p style={{ fontSize:'15px', fontWeight:'800', color:'#0f172a', margin:0, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{empresaNome}</p>
                </div>
              </div>

              {/* Abas de nivel */}
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {NIVEIS.map(n => {
                  const ativo = nivelSel === n
                  return (
                    <button key={n} onClick={()=>setNivelSel(n)}
                      style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'2px', background: ativo ? NIVEL_COR[n] : 'white', border: '1.5px solid ' + (ativo ? NIVEL_COR[n] : '#e0e7ff'), borderRadius:'10px', padding:'8px 14px', cursor:'pointer', transition:'all .15s', minWidth:'130px' }}>
                      <span style={{ fontSize:'13px', fontWeight:'700', color: ativo ? 'white' : NIVEL_COR[n] }}>{NIVEL_LABEL[n]}</span>
                      <span style={{ fontSize:'10px', color: ativo ? 'rgba(255,255,255,0.85)' : '#94a3b8', fontWeight:'500', textAlign:'left' }}>{NIVEL_DESC[n]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Acoes rapidas */}
            <div style={{ padding:'12px 22px', borderBottom:'1px solid #f0f0f8', background:'#fafbff', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
              <span style={{ fontSize:'12px', color:'#6b7280', fontWeight:'600' }}>Acoes rapidas:</span>
              <button onClick={()=>marcarTodos(true)}
                style={{ background:'#ecfdf5', border:'1px solid #6ee7b7', borderRadius:'7px', padding:'4px 10px', fontSize:'11px', fontWeight:'700', color:'#059669', cursor:'pointer' }}>
                Marcar tudo
              </button>
              <button onClick={()=>marcarTodos(false)}
                style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'7px', padding:'4px 10px', fontSize:'11px', fontWeight:'700', color:'#ef4444', cursor:'pointer' }}>
                Desmarcar tudo
              </button>
              <button onClick={restaurarHardcoded}
                style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'7px', padding:'4px 10px', fontSize:'11px', fontWeight:'700', color:'#2563eb', cursor:'pointer' }}>
                Restaurar padrao do sistema
              </button>
            </div>

            {/* Tabela de permissoes */}
            <div style={{ padding:'12px', overflowX:'auto', WebkitOverflowScrolling:'touch' } as any}>
              {carregandoPerm ? (
                <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>Carregando...</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'320px' }}>
                  <thead>
                    <tr style={{ borderBottom:'2px solid #f0f0f8' }}>
                      <th style={{ padding:'10px 14px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', width:'38%' }}>Modulo</th>
                      {['Visualizar','Criar','Alterar','Excluir'].map(h => (
                        <th key={h} style={{ padding:'10px 8px', textAlign:'center', fontSize:'11px', fontWeight:'700', color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TELAS.map((tela, i) => {
                      const p = permissoes[tela.key] || { tela:tela.key, visualizar:false, criar:false, alterar:false, excluir:false }
                      return (
                        <tr key={tela.key} style={{ borderBottom:'1px solid #f5f5fb', background:i%2===0?'transparent':'#fafbff' }}>
                          <td style={{ padding:'14px', fontSize:'14px', fontWeight:'600', color:'#111827' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:p.visualizar?'#10b981':'#e5e7eb', flexShrink:0 }}/>
                              {tela.label}
                            </div>
                          </td>
                          {(['visualizar','criar','alterar','excluir'] as const).map(tipo => (
                            <td key={tipo} style={{ padding:'14px 8px', textAlign:'center' }}>
                              <div onClick={()=>togglePerm(tela.key, tipo)}
                                style={{ width:'26px', height:'26px', borderRadius:'7px', cursor:'pointer', border:p[tipo]?'2px solid '+NIVEL_COR[nivelSel]:'2px solid #e5e7eb', background:p[tipo]?NIVEL_COR[nivelSel]:'white', display:'inline-flex', alignItems:'center', justifyContent:'center', transition:'all .15s', boxShadow:p[tipo]?'0 2px 6px '+NIVEL_COR[nivelSel]+'40':'none' }}>
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
              )}
            </div>

            {/* Footer com botao salvar */}
            <div style={{ padding:'16px 22px', borderTop:'1px solid #f0f0f8', background:'#fafbff', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
              <div style={{ flex:1, minWidth:'180px' }}>
                {mensagem ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', fontWeight:'600', color: msgOk?'#059669':'#dc2626' }}>
                    {msgOk
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                    {mensagem}
                  </div>
                ) : (
                  <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>Marcar Criar/Alterar/Excluir habilita Visualizar automaticamente.</p>
                )}
              </div>
              <button onClick={salvar} disabled={salvando || carregandoPerm}
                style={{ display:'flex', alignItems:'center', gap:'8px', background:(salvando||carregandoPerm)?'#a5b4fc':'linear-gradient(135deg,'+NIVEL_COR[nivelSel]+','+NIVEL_COR[nivelSel]+'cc)', color:'white', border:'none', borderRadius:'10px', padding:'11px 24px', fontSize:'14px', fontWeight:'700', cursor:(salvando||carregandoPerm)?'not-allowed':'pointer', boxShadow:(salvando||carregandoPerm)?'none':'0 4px 12px '+NIVEL_COR[nivelSel]+'40', transition:'all .15s' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {salvando ? 'Salvando...' : 'Salvar padrao ' + NIVEL_LABEL[nivelSel]}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background:'white', borderRadius:'16px', border:'1px dashed #e0e7ff', padding:'48px 20px', textAlign:'center' }}>
            <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#eef2ff', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <p style={{ fontSize:'14px', fontWeight:'700', color:'#374151', margin:'0 0 4px' }}>Selecione uma empresa</p>
            <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>Escolha uma empresa acima para configurar os padroes de permissao.</p>
          </div>
        )}
      </div>
    </div>
  )
}
