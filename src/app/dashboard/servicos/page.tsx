// BUILD: 1782434510
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'
import { createClient } from '@/lib/supabase'

type Servico = {
  id: string; nome: string; descricao: string
  valor: number; duracao_min: number; cor: string; status: string
}

const CORES    = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6']
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }


function useVisibilityRefresh(fn: () => void) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (typeof window === 'undefined') return
    let t = Date.now()
    const onVis = () => { if (document.visibilityState==='visible' && Date.now()-t>15000) ref.current(); t=Date.now() }
    const onFoc = () => { if (Date.now()-t>120000) ref.current(); t=Date.now() }
    const onBlr = () => { t=Date.now() }
    document.addEventListener('visibilitychange',onVis)
    window.addEventListener('focus',onFoc)
    window.addEventListener('blur',onBlr)
    return () => { document.removeEventListener('visibilitychange',onVis); window.removeEventListener('focus',onFoc); window.removeEventListener('blur',onBlr) }
  }, [])
}
export default function ServicosPage() {
  const { empresaAtiva } = useEmpresa()
  const perm = usePermissao('servicos')
  const [servicos, setServicos]     = useState<Servico[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [busca, setBusca]           = useState('')
  const [modalAberto, setModalAberto]   = useState(false)
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Servico|null>(null)
  const [form, setForm] = useState({ nome:'', descricao:'', valor:'', duracao_min:'60', cor:CORES[0], status:'ativo' })

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    const { data, error } = await sb
      .from('servicos')
      .select('id, nome, descricao, valor, duracao_min, cor, status')
      .eq('empresa_id', empresaAtiva.id)
      .order('nome')
    if (error) { console.error('Erro servicos:', error); setCarregando(false); return }
    setServicos((data || []).map((s: any) => ({
      ...s,
      descricao:   s.descricao || '',
      valor:       Number(s.valor) || 0,
      duracao_min: Number(s.duracao_min) || 60,
    })))
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])
  useVisibilityRefresh(carregar)

  const filtrados = servicos.filter(s => s.nome.toLowerCase().includes(busca.toLowerCase()))

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro('')
    setForm({ nome:'', descricao:'', valor:'', duracao_min:'60', cor:CORES[0], status:'ativo' })
    setModalAberto(true)
  }

  function abrirEdicao(s: Servico) {
    setModoEdicao(true); setSelecionado(s); setErro('')
    setForm({ nome:s.nome, descricao:s.descricao, valor:String(s.valor), duracao_min:String(s.duracao_min), cor:s.cor, status:s.status })
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (modoEdicao && !perm.alterar) return
    if (!perm.criar && !modoEdicao) return
    if (!form.nome.trim()) return setErro('Nome é obrigatório.')
    if (!empresaAtiva?.id) return setErro('Empresa não identificada.')
    setSalvando(true); setErro('')
    const sb = createClient()
    const payload = {
      nome:       form.nome.trim(),
      descricao:  form.descricao || null,
      valor:      parseFloat(form.valor) || 0,
      duracao_min: parseInt(form.duracao_min) || 60,
      cor:        form.cor,
      status:     form.status,
    }
    let error: any
    if (modoEdicao && selecionado) {
      const res = await sb.from('servicos').update(payload).eq('id', selecionado.id)
      error = res.error
    } else {
      const res = await sb.from('servicos').insert({ ...payload, empresa_id: empresaAtiva.id })
      error = res.error
    }
    if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    await carregar(); fecharModal(); setSalvando(false)
  }

  async function excluir(id: string) {
    if (!perm.excluir) return
    if (!confirm('Excluir este serviço?')) return
    const sb = createClient()
    const { error } = await sb.from('servicos').delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    await carregar(); fecharModal()
  }

  async function toggleStatus(s: Servico) {
    const sb = createClient()
    await sb.from('servicos').update({ status: s.status==='ativo'?'inativo':'ativo' }).eq('id', s.id)
    await carregar()
  }

  
  // Fixar header da página no mobile
  useEffect(() => {
    function fixarHeader() {
      const mob = window.innerWidth < 768
      const hdr = document.getElementById('page-header-fixed')
      const content = document.getElementById('page-content')
      if (!hdr) return
      if (mob) {
        const layoutH = document.getElementById('mobile-header-fixed')?.offsetHeight ?? 56
        hdr.style.position = 'fixed'
        hdr.style.top = layoutH + 'px'
        hdr.style.left = '0'
        hdr.style.right = '0'
        hdr.style.zIndex = '9990'
        setTimeout(() => {
          const hdrH = hdr.offsetHeight
          if (content) content.style.paddingTop = (layoutH + hdrH) + 'px'
        }, 50)
      } else {
        hdr.style.position = 'sticky'
        hdr.style.top = '0'
        hdr.style.left = ''
        hdr.style.right = ''
        if (content) content.style.paddingTop = '0'
      }
    }
    fixarHeader()
    const t = setTimeout(fixarHeader, 150)
    window.addEventListener('resize', fixarHeader)
    return () => { clearTimeout(t); window.removeEventListener('resize', fixarHeader) }
  }, [])

  return (
    <div id="page-content" style={{ padding:'16px 12px', background:'#f8f8fc' }}>
      <div id="page-header-fixed" style={{ position:'sticky', top:0, zIndex:20, background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 12px 10px', flexWrap:'wrap', gap:'10px' }}>
          <div>
            <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Serviços</h1>
            <p style={{ fontSize:'13px', color:'#9ca3af' }}>{servicos.filter(s=>s.status==='ativo').length} ativos de {servicos.length}</p>
          </div>
          <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer', display:perm.criar?'inline-block':'none' }}>+ Novo serviço</button>
        </div>
        <div style={{ position:'relative', maxWidth:'320px', padding:'0 12px 12px' }}>
          <span style={{ position:'absolute', left:'24px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft:'36px', width:'100%', boxSizing:'border-box' }} placeholder="Buscar serviço..." value={busca} onChange={e => setBusca(e.target.value)}/>
        </div>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(270px, 1fr))', gap:'14px' }}>
          {filtrados.map(s => (
            <div key={s.id} style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px', position:'relative', overflow:'hidden', opacity:s.status==='inativo'?0.7:1 }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'4px', background:s.cor, borderRadius:'14px 14px 0 0' }}/>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:s.cor+'20', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ width:'14px', height:'14px', borderRadius:'50%', background:s.cor }}/>
                  </div>
                  <div>
                    <p style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>{s.nome}</p>
                    <p style={{ fontSize:'12px', color:'#9ca3af' }}>{s.duracao_min} min</p>
                  </div>
                </div>
                <div onClick={() => toggleStatus(s)} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background:s.status==='ativo'?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                  <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left:s.status==='ativo'?'18px':'2px' }}/>
                </div>
              </div>
              <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'16px', lineHeight:'1.5', minHeight:'20px' }}>{s.descricao}</p>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'18px', fontWeight:'700', color:'#1a1a2e' }}>R$ {s.valor.toFixed(2).replace('.',',')}</span>
                <div style={{ display:'flex', gap:'6px' }}>
                  {perm.alterar && (<button onClick={() => abrirEdicao(s)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(99,102,241,0.15)' }} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff';el.style.boxShadow='0 3px 8px rgba(99,102,241,0.25)';el.style.transform='translateY(-1px)'}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.boxShadow='0 1px 3px rgba(99,102,241,0.15)';el.style.transform='translateY(0)'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>)}
                  {perm.excluir && (<button onClick={() => excluir(s.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>🗑</button>)}
                </div>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px', color:'#9ca3af', fontSize:'14px' }}>Nenhum serviço cadastrado.</div>}
        </div>
      )}

      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'500px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 18px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'Editar serviço':'+ Novo serviço'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome *</label>
                <input value={form.nome} onChange={e => setForm(f=>({...f,nome:e.target.value}))} style={inputStyle} placeholder="Nome do serviço"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Descrição</label>
                <textarea rows={2} value={form.descricao} onChange={e => setForm(f=>({...f,descricao:e.target.value}))} style={{ ...inputStyle, resize:'none' }} placeholder="Descrição do serviço"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Valor (R$)</label>
                  <input type="number" value={form.valor} onChange={e => setForm(f=>({...f,valor:e.target.value}))} style={inputStyle} placeholder="0,00"/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Duração (min)</label>
                  <select value={form.duracao_min} onChange={e => setForm(f=>({...f,duracao_min:e.target.value}))} style={{ ...inputStyle, padding:'9px 12px' }}>
                    {[15,30,45,50,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Cor na agenda</label>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {CORES.map(cor => (
                    <button key={cor} onClick={() => setForm(f=>({...f,cor}))} style={{ width:'28px', height:'28px', borderRadius:'50%', background:cor, border:form.cor===cor?'3px solid #1a1a2e':'2px solid transparent', cursor:'pointer' }}/>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado
                ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                {(modoEdicao ? perm.alterar : perm.criar) && (<button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando?'Salvando...':modoEdicao?'Salvar alterações':'Salvar serviço'}
                </button>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
