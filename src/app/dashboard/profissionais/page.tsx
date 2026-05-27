'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'

type Profissional = {
  id: string
  nome: string
  email: string
  telefone: string
  cargo: string
  especialidade: string
  cor: string
  status: string
  nivel_acesso: string
  horarios: { dia: number; inicio: string; fim: string; ativo: boolean }[]
  servicos: string[]
}

const DIAS         = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const CORES        = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']
const SERVICOS_LISTA = ['Consulta','Retorno','Avaliação','Sessão Terapêutica','Retorno Express']
const horariosBase = DIAS.map((_, i) => ({ dia:i, inicio:'08:00', fim:'18:00', ativo: i>=1&&i<=5 }))
const inputStyle   = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function ProfissionaisPage() {
  const { empresaAtiva } = useEmpresa()
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [busca, setBusca]           = useState('')
  const [servicosCadastrados, setServicosCadastrados] = useState<{id:string;nome:string}[]>([])
  const [modalAberto, setModalAberto]   = useState(false)
  const [abaModal, setAbaModal]         = useState<'dados'|'servicos'|'horarios'>('dados')
  const [modoEdicao, setModoEdicao]     = useState(false)
  const [selecionado, setSelecionado]   = useState<Profissional|null>(null)
  const [form, setForm]             = useState({ nome:'', email:'', telefone:'', cargo:'', especialidade:'', cor:CORES[0], status:'ativo' })
  const [servicosSel, setServicosSel]   = useState<string[]>([])
  const [horarios, setHorarios]     = useState(horariosBase.map(h => ({...h})))

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()

    // Busca serviços cadastrados
    const { data: servs } = await sb
      .from('servicos')
      .select('id, nome')
      .eq('empresa_id', empresaAtiva.id)
      .eq('status', 'ativo')
      .order('nome')
    setServicosCadastrados(servs || [])

    // Busca usuários da empresa que são profissionais ou admins
    const { data, error } = await sb
      .from('usuarios')
      .select('id, nome, email, telefone, cargo, status, nivel_acesso')
      .eq('empresa_id', empresaAtiva.id)
      .order('nome')

    if (error) {
      console.error('Erro ao buscar profissionais:', error)
      setCarregando(false)
      return
    }

    // Busca horários de cada profissional
    const { data: horariosData } = await sb
      .from('horarios_profissional')
      .select('usuario_id, dia_semana, hora_inicio, hora_fim, ativo')
      .eq('empresa_id', empresaAtiva.id)

    const horariosMap: Record<string, any[]> = {}
    if (horariosData) {
      horariosData.forEach((h: any) => {
        if (!horariosMap[h.usuario_id]) horariosMap[h.usuario_id] = []
        horariosMap[h.usuario_id].push(h)
      })
    }

    setProfissionais((data || []).map((u: any) => {
      // Monta horários do banco ou usa padrão
      const hDb = horariosMap[u.id] || []
      const hFormatados = DIAS.map((_, i) => {
        const hEncontrado = hDb.find((h: any) => h.dia_semana === i)
        return {
          dia: i,
          inicio: hEncontrado?.hora_inicio || '08:00',
          fim:    hEncontrado?.hora_fim    || '18:00',
          ativo:  hEncontrado?.ativo       ?? (i >= 1 && i <= 5),
        }
      })
      return {
        id:           u.id,
        nome:         u.nome || '',
        email:        u.email || '',
        telefone:     u.telefone || '',
        cargo:        u.cargo || '',
        especialidade: u.cargo || '',
        cor:          CORES[Math.abs(u.nome?.charCodeAt(0) || 0) % CORES.length],
        status:       u.status,
        nivel_acesso: u.nivel_acesso,
        horarios:     hFormatados,
        servicos:     [],
      }
    }))
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.cargo.toLowerCase().includes(busca.toLowerCase())
  )

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setErro(''); setAbaModal('dados')
    setForm({ nome:'', email:'', telefone:'', cargo:'', especialidade:'', cor:CORES[0], status:'ativo' })
    setServicosSel([]); setHorarios(horariosBase.map(h => ({...h})))
    setModalAberto(true)
  }

  function abrirEdicao(p: Profissional) {
    setModoEdicao(true); setSelecionado(p); setErro(''); setAbaModal('dados')
    setForm({ nome:p.nome, email:p.email, telefone:p.telefone, cargo:p.cargo, especialidade:p.cargo, cor:p.cor, status:p.status })
    setServicosSel([...p.servicos])
    setHorarios(p.horarios.map(h => ({...h})))
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null); setErro('') }

  async function salvar() {
    if (!form.nome.trim()) return setErro('Nome é obrigatório.')
    if (!empresaAtiva?.id) return setErro('Empresa não identificada.')
    setSalvando(true); setErro('')
    const sb = createClient()

    let usuarioId = selecionado?.id

    if (modoEdicao && selecionado) {
      // Atualiza dados básicos
      const { error } = await sb
        .from('usuarios')
        .update({
          nome:     form.nome.trim(),
          telefone: form.telefone || null,
          cargo:    form.cargo || null,
          status:   form.status,
        })
        .eq('id', selecionado.id)

      if (error) {
        setErro('Erro ao salvar: ' + error.message)
        setSalvando(false)
        return
      }
    } else {
      // Cria novo usuário no Auth + tabela
      if (!form.email.trim()) return setErro('E-mail é obrigatório.')

      // Usa API route que cria sem confirmação de email
      const senhaGerada = 'Agenda@' + Math.random().toString(36).slice(2, 10)
      const res = await fetch('/api/usuarios/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:         form.nome.trim(),
          email:        form.email.trim(),
          senha:        senhaGerada,
          telefone:     form.telefone || null,
          cargo:        form.cargo || null,
          nivel_acesso: 'profissional',
          empresa_id:   empresaAtiva?.id,
        }),
      })
      const result = await res.json()
      if (!result.success) {
        setErro(result.error || 'Erro ao criar usuário.')
        setSalvando(false)
        return
      }
      usuarioId = result.data?.id
      alert(`Profissional criado!\nSenha temporária: ${senhaGerada}\nPeça para ele alterar no primeiro acesso.`)
    }

    // Salva horários
    if (usuarioId) {
      await sb.from('horarios_profissional').delete().eq('usuario_id', usuarioId)
      const horariosAtivos = horarios
        .filter(h => h.ativo)
        .map(h => ({
          usuario_id:  usuarioId,
          empresa_id:  empresaAtiva.id,
          dia_semana:  h.dia,
          hora_inicio: h.inicio,
          hora_fim:    h.fim,
          ativo:       true,
        }))
      if (horariosAtivos.length > 0) {
        await sb.from('horarios_profissional').insert(horariosAtivos)
      }
    }

    await carregar()
    fecharModal()
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Inativar este profissional?')) return
    const sb = createClient()
    const { error } = await sb.from('usuarios').update({ status: 'inativo' }).eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    await carregar()
    fecharModal()
  }

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
      setForm(p => ({...p, [k]: e.target.value}))

  return (
    <div style={{ padding:'24px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Profissionais</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>
            {profissionais.filter(p=>p.status==='ativo').length} ativos de {profissionais.length}
          </p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo profissional
        </button>
      </div>

      <div style={{ position:'relative', maxWidth:'300px', marginBottom:'20px' }}>
        <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
        <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar profissional..." value={busca} onChange={e => setBusca(e.target.value)}/>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'14px' }}>
          {filtrados.map(p => (
            <div key={p.id} style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px', opacity: p.status==='inativo'?0.7:1 }}>
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
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>📧 {p.email || '—'}</p>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>📱 {p.telefone || '—'}</p>
              </div>

              {/* Dias que atende */}
              <div style={{ display:'flex', gap:'4px', marginBottom:'14px' }}>
                {DIAS.map((dia, i) => {
                  const h = p.horarios.find(h => h.dia === i)
                  return (
                    <div key={dia} style={{ width:'28px', height:'28px', borderRadius:'50%', background:h?.ativo?p.cor+'20':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'600', color:h?.ativo?p.cor:'#d1d5db' }}>
                      {dia.slice(0,1)}
                    </div>
                  )
                })}
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:'12px', borderTop:'1px solid #f9fafb' }}>
                <button onClick={() => abrirEdicao(p)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'8px', padding:'7px 14px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>
                  ✏️ Editar
                </button>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && !carregando && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px', color:'#9ca3af', fontSize:'14px' }}>
              Nenhum profissional cadastrado.
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
                {modoEdicao ? '✏️ Editar profissional' : '+ Novo profissional'}
              </h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
            </div>

            {/* Abas */}
            <div style={{ display:'flex', marginBottom:'20px', borderBottom:'2px solid #f3f4f6' }}>
              {([['dados','Dados'],['servicos','Serviços'],['horarios','Horários']] as const).map(([v,l]) => (
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
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail {!modoEdicao && '*'}</label>
                    <input type="email" value={form.email} onChange={f('email')} style={{ ...inputStyle, background:modoEdicao?'#f9fafb':'white' }} placeholder="email@empresa.com" disabled={modoEdicao}/>
                    {modoEdicao && <p style={{ fontSize:'11px', color:'#9ca3af', marginTop:'3px' }}>E-mail não pode ser alterado</p>}
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                    <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Cargo / Especialidade</label>
                  <input value={form.cargo} onChange={f('cargo')} style={inputStyle} placeholder="Ex: Fisioterapeuta, Psicólogo..."/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Cor de identificação</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {CORES.map(cor => (
                      <button key={cor} onClick={() => setForm(p => ({...p, cor}))} style={{ width:'28px', height:'28px', borderRadius:'50%', background:cor, border:form.cor===cor?'3px solid #1a1a2e':'2px solid transparent', cursor:'pointer' }}/>
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
                {!modoEdicao && (
                  <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#92400e' }}>
                    ⚠️ Uma senha temporária será gerada automaticamente. O profissional poderá alterá-la no primeiro acesso.
                  </div>
                )}
              </div>
            )}

            {/* Aba Serviços */}
            {abaModal === 'servicos' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'4px' }}>Selecione os serviços que este profissional realiza:</p>
                {servicosCadastrados.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'30px', color:'#9ca3af', fontSize:'13px' }}>
                    Nenhum serviço cadastrado.<br/>
                    <span style={{ fontSize:'12px' }}>Cadastre serviços na tela de Serviços primeiro.</span>
                  </div>
                ) : servicosCadastrados.map(s => (
                  <div key={s.id} onClick={() => setServicosSel(p => p.includes(s.nome) ? p.filter(x=>x!==s.nome) : [...p,s.nome])} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', borderRadius:'10px', border:servicosSel.includes(s.nome)?'1.5px solid #6366f1':'1px solid #e5e7eb', background:servicosSel.includes(s.nome)?'#eef2ff':'white', cursor:'pointer' }}>
                    <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:servicosSel.includes(s.nome)?'none':'1.5px solid #d1d5db', background:servicosSel.includes(s.nome)?'#6366f1':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
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
                    <div onClick={() => setHorarios(p => p.map((x,j) => j===i ? {...x,ativo:!x.ativo} : x))} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background:h.ativo?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                      <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left:h.ativo?'18px':'2px' }}/>
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:'500', color:h.ativo?'#1a1a2e':'#9ca3af', minWidth:'30px' }}>{DIAS[h.dia]}</span>
                    {h.ativo ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <input type="time" value={h.inicio} onChange={e => setHorarios(p => p.map((x,j) => j===i?{...x,inicio:e.target.value}:x))} style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'5px 8px', fontSize:'13px', outline:'none' }}/>
                        <span style={{ color:'#9ca3af', fontSize:'12px' }}>até</span>
                        <input type="time" value={h.fim} onChange={e => setHorarios(p => p.map((x,j) => j===i?{...x,fim:e.target.value}:x))} style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'5px 8px', fontSize:'13px', outline:'none' }}/>
                      </div>
                    ) : <span style={{ fontSize:'12px', color:'#d1d5db' }}>Não atende</span>}
                  </div>
                ))}
              </div>
            )}

            {erro && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'14px', fontSize:'13px', color:'#dc2626' }}>
                {erro}
              </div>
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
