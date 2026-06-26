// BUILD: 1782435011
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { usePermissao } from '@/hooks/usePermissao'
import { createClient } from '@/lib/supabase'

type Profissional = {
  id: string; nome: string; email: string; telefone: string
  cargo: string; especialidade: string; cor: string; status: string
  horarios: { dia: number; inicio: string; fim: string; ativo: boolean }[]
  servicos: string[]
}

const DIAS         = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const CORES = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#ffffff']
const horariosBase = DIAS.map((_, i) => ({ dia:i, inicio:'08:00', fim:'18:00', ativo: i>=1&&i<=5 }))
const inputStyle   = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }


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
export default function ProfissionaisPage() {
  const { empresaAtiva } = useEmpresa()
  const perm = usePermissao('profissionais')
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [servicosCadastrados, setServicosCadastrados] = useState<{id:string;nome:string}[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [busca, setBusca]           = useState('')
  const [modalAberto, setModalAberto]   = useState(false)
  const [abaModal, setAbaModal]         = useState<'dados'|'servicos'|'horarios'|'intervalo'>('dados')
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Profissional|null>(null)
  const [form, setForm]  = useState({ nome:'', email:'', telefone:'', cargo:'', especialidade:'', cor:CORES[0], status:'ativo', intervalo_atendimento:'30' })
  const [servicosSel, setServicosSel]   = useState<string[]>([])
  const [horarios, setHorarios]     = useState(horariosBase.map(h => ({...h})))

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()

    // Busca da tabela profissionais (não usuarios)
    const { data: profs, error } = await sb
      .from('profissionais')
      .select('id, nome, email, telefone, cargo, especialidade, cor, status, servicos, intervalo_atendimento')
      .eq('empresa_id', empresaAtiva.id)
      .order('nome')

    if (error) console.error('Erro profissionais:', error)

    // Busca horários
    const { data: hors } = await sb
      .from('horarios_prof')
      .select('profissional_id, dia_semana, hora_inicio, hora_fim, ativo')
      .eq('empresa_id', empresaAtiva.id)

    // Busca serviços cadastrados
    const { data: servs } = await sb
      .from('servicos')
      .select('id, nome')
      .eq('empresa_id', empresaAtiva.id)
      .eq('status', 'ativo')
      .order('nome')

    setServicosCadastrados(servs || [])

    // Monta mapa de horários por profissional
    const hMap: Record<string, any[]> = {}
    ;(hors || []).forEach((h: any) => {
      if (!hMap[h.profissional_id]) hMap[h.profissional_id] = []
      hMap[h.profissional_id].push(h)
    })

    setProfissionais((profs || []).map((p: any) => {
      const hDb = hMap[p.id] || []
      const horariosFormatados = DIAS.map((_, i) => {
        const h = hDb.find((x: any) => x.dia_semana === i)
        return { dia:i, inicio:h?.hora_inicio||'08:00', fim:h?.hora_fim||'18:00', ativo:h?.ativo??(i>=1&&i<=5) }
      })
      return {
        id:p.id, nome:p.nome||'', email:p.email||'', telefone:p.telefone||'',
        cargo:p.cargo||'', especialidade:p.especialidade||p.cargo||'',
        cor:p.cor||CORES[0], status:p.status,
        horarios:horariosFormatados, servicos:p.servicos||[],
        intervalo_atendimento: p.intervalo_atendimento || 30,
      }
    }))
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])
  useVisibilityRefresh(carregar)

  const filtrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.cargo.toLowerCase().includes(busca.toLowerCase())
  )

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro(''); setAbaModal('dados')
    setForm({ nome:'', email:'', telefone:'', cargo:'', especialidade:'', cor:CORES[0], status:'ativo', intervalo_atendimento:'30' })
    setServicosSel([]); setHorarios(horariosBase.map(h => ({...h})))
    setModalAberto(true)
  }

  function abrirEdicao(p: Profissional) {
    setModoEdicao(true); setSelecionado(p); setErro(''); setAbaModal('dados')
    setForm({ nome:p.nome, email:p.email, telefone:p.telefone, cargo:p.cargo, especialidade:p.especialidade, cor:p.cor, status:p.status, intervalo_atendimento: String((p as any).intervalo_atendimento || 30) })
    setServicosSel(p.servicos || [])
    setHorarios(p.horarios.map(h => ({...h})))
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim()) return setErro('Nome é obrigatório.')
    if (!empresaAtiva?.id) return setErro('Empresa não identificada.')
    setSalvando(true); setErro('')
    const sb = createClient()

    let profId = selecionado?.id

    const payload = {
      nome:         form.nome.trim(),
      email:        form.email || null,
      telefone:     form.telefone || null,
      cargo:        form.cargo || null,
      especialidade:form.cargo || null,
      cor:          form.cor,
      status:       form.status,
      servicos:     servicosSel,
      intervalo_atendimento: parseInt(form.intervalo_atendimento) || 30,
    }

    if (modoEdicao && selecionado) {
      const { error } = await sb.from('profissionais').update(payload).eq('id', selecionado.id)
      if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
    } else {
      const { data, error } = await sb.from('profissionais')
        .insert({ ...payload, empresa_id: empresaAtiva.id })
        .select('id').single()
      if (error) { setErro('Erro: ' + error.message); setSalvando(false); return }
      profId = data?.id
    }

    // Salva horários na nova tabela horarios_prof
    if (profId) {
      await sb.from('horarios_prof').delete().eq('profissional_id', profId)
      const ativos = horarios.filter(h => h.ativo).map(h => ({
        profissional_id: profId,
        empresa_id:      empresaAtiva.id,
        dia_semana:      h.dia,
        hora_inicio:     h.inicio,
        hora_fim:        h.fim,
        ativo:           true,
      }))
      if (ativos.length > 0) {
        const { error: hErr } = await sb.from('horarios_prof').insert(ativos)
        if (hErr) console.error('Erro horários:', hErr)
      }
    }

    await carregar(); fecharModal(); setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Inativar este profissional?')) return
    const sb = createClient()
    await sb.from('profissionais').update({ status:'inativo' }).eq('id', id)
    await carregar(); fecharModal()
  }

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
      setForm(p => ({...p, [k]: e.target.value}))

  
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
        hdr.style.zIndex = '35'
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
            <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Profissionais</h1>
            <p style={{ fontSize:'13px', color:'#9ca3af' }}>
              {profissionais.filter(p=>p.status==='ativo').length} ativos de {profissionais.length}
            </p>
          </div>
          {perm.criar && (
            <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
              + Novo profissional
            </button>
          )}
        </div>
        <div style={{ position:'relative', maxWidth:'320px', padding:'0 12px 12px' }}>
          <span style={{ position:'absolute', left:'24px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
          <input style={{ ...inputStyle, paddingLeft:'36px', width:'100%', boxSizing:'border-box' }} placeholder="Buscar profissional..." value={busca} onChange={e => setBusca(e.target.value)}/>
        </div>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'14px' }}>
          {filtrados.map(p => (
            <div key={p.id} style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px', opacity:p.status==='inativo'?0.7:1 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'46px', height:'46px', borderRadius:'50%', background:p.cor+'20', border:`2px solid ${p.cor}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color:p.cor, flexShrink:0 }}>
                    {p.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
                  </div>
                  <div>
                    <p style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>{p.nome}</p>
                    <p style={{ fontSize:'12px', color:'#9ca3af' }}>{p.cargo || 'Profissional'}</p>
                  </div>
                </div>
                <span style={{ fontSize:'11px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background:p.status==='ativo'?'#ecfdf5':'#f9fafb', color:p.status==='ativo'?'#10b981':'#9ca3af' }}>
                  {p.status==='ativo'?'Ativo':'Inativo'}
                </span>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'12px' }}>
                {p.email    && <p style={{ fontSize:'12px', color:'#9ca3af' }}>📧 {p.email}</p>}
                {p.telefone && <p style={{ fontSize:'12px', color:'#9ca3af' }}>📱 {p.telefone}</p>}
              </div>

              {/* Dias que atende */}
              <div style={{ display:'flex', gap:'4px', marginBottom:'14px' }}>
                {DIAS.map((dia, i) => {
                  const h = p.horarios.find(h => h.dia === i)
                  return (
                    <div key={dia} title={h?.ativo ? `${dia}: ${h.inicio}-${h.fim}` : `${dia}: não atende`}
                      style={{ width:'28px', height:'28px', borderRadius:'50%', background:h?.ativo?p.cor+'20':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'600', color:h?.ativo?p.cor:'#d1d5db', cursor:'default' }}>
                      {dia.slice(0,1)}
                    </div>
                  )
                })}
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'12px', borderTop:'1px solid #f9fafb', gap:'8px' }}>
                {perm.excluir && (
                  <button onClick={() => excluir(p.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'8px', padding:'7px 10px', fontSize:'12px', cursor:'pointer' }}>
                    🗑
                  </button>
                )}
                {perm.alterar && (
                  <button onClick={() => abrirEdicao(p)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'6px', transition:'all .15s', boxShadow:'0 1px 3px rgba(99,102,241,0.15)' }} onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background='#eef2ff';el.style.boxShadow='0 3px 8px rgba(99,102,241,0.25)';el.style.transform='translateY(-1px)'}} onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background='white';el.style.boxShadow='0 1px 3px rgba(99,102,241,0.15)';el.style.transform='translateY(0)'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>
                )}
              </div>
            </div>
          ))}
          {filtrados.length === 0 && !carregando && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px', color:'#9ca3af', fontSize:'14px' }}>
              <p style={{ fontSize:'32px', marginBottom:'12px' }}>👥</p>
              <p>Nenhum profissional cadastrado.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'560px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>
                {modoEdicao ? 'Editar profissional' : '+ Novo profissional'}
              </h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>x</button>
            </div>

            {/* Abas */}
            <div style={{ display:'flex', marginBottom:'20px', borderBottom:'2px solid #f3f4f6' }}>
              {([['dados','Dados'],['servicos','Serviços'],['horarios','Horários'],['intervalo','Intervalo']] as const).map(([v,l]) => (
                <button key={v} onClick={() => setAbaModal(v)} style={{ padding:'8px 16px', border:'none', background:'none', cursor:'pointer', fontSize:'13px', fontWeight:abaModal===v?'600':'400', color:abaModal===v?'#6366f1':'#9ca3af', borderBottom:abaModal===v?'2px solid #6366f1':'2px solid transparent', marginBottom:'-2px' }}>{l}</button>
              ))}
            </div>

            {/* Aba Dados */}
            {abaModal === 'dados' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome completo *</label>
                  <input value={form.nome} onChange={f('nome')} style={inputStyle} placeholder="Nome do profissional"/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail</label>
                    <input type="email" value={form.email} onChange={f('email')} style={inputStyle} placeholder="email@empresa.com"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                    <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cargo / Especialidade</label>
                  <input value={form.cargo} onChange={f('cargo')} style={inputStyle} placeholder="Ex: Fisioterapeuta, Nutricionista..."/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Cor de identificação</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {CORES.map(cor => (
                      <button key={cor} onClick={() => setForm(p => ({...p, cor}))} style={{ width:'28px', height:'28px', borderRadius:'50%', background:cor, border: form.cor===cor ? '3px solid #1a1a2e' : cor==='#ffffff' ? '2px solid #cbd5e1' : '2px solid transparent', cursor:'pointer', boxShadow: cor==='#ffffff' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none' }}/>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                  <select value={form.status} onChange={f('status')} style={{ ...inputStyle, padding:'9px 12px' }}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>
            )}

            {/* Aba Serviços */}
            {abaModal === 'servicos' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'4px' }}>Serviços que este profissional realiza:</p>
                {servicosCadastrados.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'30px', color:'#9ca3af', fontSize:'13px' }}>
                    Nenhum serviço cadastrado.<br/>
                    <span style={{ fontSize:'12px' }}>Cadastre serviços na tela de Serviços.</span>
                  </div>
                ) : servicosCadastrados.map(s => (
                  <div key={s.id} onClick={() => setServicosSel(prev => prev.includes(s.nome) ? prev.filter(x=>x!==s.nome) : [...prev, s.nome])}
                    style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', borderRadius:'10px', cursor:'pointer', border:servicosSel.includes(s.nome)?'1.5px solid #6366f1':'1px solid #e5e7eb', background:servicosSel.includes(s.nome)?'#eef2ff':'white', transition:'all .15s' }}>
                    <div style={{ width:'20px', height:'20px', borderRadius:'50%', flexShrink:0, border:servicosSel.includes(s.nome)?'none':'1.5px solid #d1d5db', background:servicosSel.includes(s.nome)?'#6366f1':'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {servicosSel.includes(s.nome) && <span style={{ color:'white', fontSize:'12px' }}>✓</span>}
                    </div>
                    <span style={{ fontSize:'14px', color:'#1a1a2e', fontWeight:servicosSel.includes(s.nome)?'500':'400' }}>{s.nome}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Aba Horários */}
            {abaModal === 'horarios' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'4px' }}>Configure os dias e horários de atendimento:</p>
                {horarios.map((h, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', borderRadius:'10px', border:'1px solid #f0f0f8', flexWrap:'wrap' }}>
                    <div onClick={() => setHorarios(p => p.map((x,j) => j===i ? {...x, ativo:!x.ativo} : x))}
                      style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background:h.ativo?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                      <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left:h.ativo?'18px':'2px' }}/>
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:'500', color:h.ativo?'#1a1a2e':'#9ca3af', minWidth:'30px' }}>{DIAS[h.dia]}</span>
                    {h.ativo ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <input type="time" value={h.inicio} onChange={e => setHorarios(p => p.map((x,j) => j===i?{...x,inicio:e.target.value}:x))}
                          style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'5px 8px', fontSize:'13px', outline:'none' }}/>
                        <span style={{ color:'#9ca3af', fontSize:'12px' }}>até</span>
                        <input type="time" value={h.fim} onChange={e => setHorarios(p => p.map((x,j) => j===i?{...x,fim:e.target.value}:x))}
                          style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'5px 8px', fontSize:'13px', outline:'none' }}/>
                      </div>
                    ) : <span style={{ fontSize:'12px', color:'#d1d5db' }}>Não atende</span>}
                  </div>
                ))}
              </div>
            )}

            {abaModal === 'intervalo' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'12px', padding:'14px 16px' }}>
                  <p style={{ fontSize:'13px', color:'#1d4ed8', fontWeight:'600', marginBottom:'4px' }}>Intervalo entre atendimentos</p>
                  <p style={{ fontSize:'12px', color:'#3b82f6' }}>Define o espaçamento dos horários disponíveis ao agendar para este profissional. Também usado na visualização de Horários Livres.</p>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
                  {[
                    { min: 15, label: '15 min', desc: 'Atendimentos rápidos\nSlots a cada 15 min' },
                    { min: 30, label: '30 min', desc: 'Padrão recomendado\nSlots a cada 30 min' },
                    { min: 60, label: '60 min', desc: 'Atendimentos longos\nSlots a cada 60 min' },
                  ].map(op => {
                    const sel = form.intervalo_atendimento === String(op.min)
                    return (
                      <div key={op.min} onClick={() => setForm(p=>({...p, intervalo_atendimento: String(op.min)}))}
                        style={{ border:`2px solid ${sel?'#6366f1':'#e5e7eb'}`, borderRadius:'14px', padding:'18px 12px', textAlign:'center', cursor:'pointer', background: sel ? '#eef2ff' : 'white', transition:'all .15s' }}>
                        <div style={{ width:'48px', height:'48px', borderRadius:'50%', background: sel ? '#6366f1' : '#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={sel?'white':'#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <p style={{ fontSize:'18px', fontWeight:'800', color: sel ? '#4f46e5' : '#374151', marginBottom:'6px' }}>{op.label}</p>
                        {op.desc.split('\n').map((line, i) => (
                          <p key={i} style={{ fontSize:'11px', color: sel ? '#6366f1' : '#9ca3af', margin:'1px 0', fontWeight: i===0?'600':'400' }}>{line}</p>
                        ))}
                        {sel && (
                          <div style={{ marginTop:'10px', display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span style={{ fontSize:'11px', color:'#6366f1', fontWeight:'700' }}>Selecionado</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div style={{ background:'#f8fafc', borderRadius:'10px', padding:'14px 16px', fontSize:'12.5px', color:'#6b7280', lineHeight:1.6 }}>
                  <b style={{ color:'#374151' }}>Exemplo com intervalo de {form.intervalo_atendimento} min:</b><br/>
                  {Array.from({length:5},(_,i)=>{
                    const base = 8*60 + i*parseInt(form.intervalo_atendimento)
                    return String(Math.floor(base/60)).padStart(2,'0')+':'+String(base%60).padStart(2,'0')
                  }).join(' → ')} → ...
                </div>
              </div>
            )}

            {erro && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'14px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>
            )}

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado
                ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Inativar</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
                  {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Salvar profissional'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
