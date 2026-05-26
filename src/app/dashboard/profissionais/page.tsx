'use client'

import { useState } from 'react'
import { PROFISSIONAIS_CADASTRO } from '@/lib/dados'

type Profissional = {
  id: number
  nome: string
  email: string
  telefone: string
  especialidade: string
  servicos: string[]
  cor: string
  status: string
  atendimentosMes: number
  horarios: { dia: number; inicio: string; fim: string; ativo: boolean }[]
}

const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const CORES = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']
const SERVICOS_LISTA = ['Consulta','Retorno','Avaliação','Sessão Terapêutica','Retorno Express']

const horariosBase = DIAS.map((_, i) => ({ dia:i, inicio:'08:00', fim:'18:00', ativo: i>=1&&i<=5 }))

const profissionaisIniciais: Profissional[] = [
  { id:1, nome:'Dr. Carlos Souza',    email:'carlos@studio.com',  telefone:'(11) 99999-0010', especialidade:'Terapeuta',      servicos:['Consulta','Retorno','Sessão Terapêutica'], cor:'#6366f1', status:'ativo', atendimentosMes:38, horarios: horariosBase },
  { id:2, nome:'Dra. Ana Lima',       email:'ana@studio.com',     telefone:'(11) 99999-0011', especialidade:'Fisioterapeuta', servicos:['Consulta','Avaliação'],                    cor:'#06b6d4', status:'ativo', atendimentosMes:25, horarios: horariosBase },
  { id:3, nome:'Dr. Pedro Costa',     email:'pedro@studio.com',   telefone:'(11) 99999-0012', especialidade:'Psicólogo',      servicos:['Consulta','Sessão Terapêutica'],           cor:'#10b981', status:'ativo', atendimentosMes:31, horarios: horariosBase },
  { id:4, nome:'Dra. Sofia Mendes',   email:'sofia@studio.com',   telefone:'(11) 99999-0013', especialidade:'Nutricionista',  servicos:['Avaliação','Retorno'],                     cor:'#ec4899', status:'inativo',atendimentosMes:0,  horarios: horariosBase },
]

const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function ProfissionaisPage() {
  const [profissionais, setProfissionais] = useState<Profissional[]>(PROFISSIONAIS_CADASTRO.map(p => ({...p, id: Number(p.id), atendimentosMes: 0})) as any)
  const [modalAberto, setModalAberto] = useState(false)
  const [abaModal, setAbaModal] = useState<'dados'|'horarios'|'servicos'>('dados')
  const [modoEdicao, setModoEdicao] = useState(false)
  const [selecionado, setSelecionado] = useState<Profissional | null>(null)
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({ nome:'', email:'', telefone:'', especialidade:'', cor:CORES[0], status:'ativo' })
  const [servicosSel, setServicosSel] = useState<string[]>([])
  const [horarios, setHorarios] = useState(horariosBase.map(h => ({...h})))

  const filtrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.especialidade.toLowerCase().includes(busca.toLowerCase())
  )

  function abrirNovo() {
    setModoEdicao(false); setSelecionado(null); setAbaModal('dados')
    setForm({ nome:'', email:'', telefone:'', especialidade:'', cor:CORES[0], status:'ativo' })
    setServicosSel([]); setHorarios(horariosBase.map(h => ({...h})))
    setModalAberto(true)
  }

  function abrirEdicao(p: Profissional) {
    setModoEdicao(true); setSelecionado(p); setAbaModal('dados')
    setForm({ nome:p.nome, email:p.email, telefone:p.telefone, especialidade:p.especialidade, cor:p.cor, status:p.status })
    setServicosSel([...p.servicos]); setHorarios(p.horarios.map(h => ({...h})))
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setSelecionado(null) }

  function salvar() {
    if (!form.nome.trim()) return
    if (modoEdicao && selecionado) {
      setProfissionais(prev => prev.map(p => p.id === selecionado.id
        ? { ...p, ...form, servicos:servicosSel, horarios }
        : p))
    } else {
      setProfissionais(prev => [...prev, { id:Date.now(), ...form, servicos:servicosSel, horarios, atendimentosMes:0 }])
    }
    fecharModal()
  }

  function excluir(id: number) {
    if (confirm('Excluir este profissional?')) { setProfissionais(prev => prev.filter(p => p.id !== id)); fecharModal() }
  }

  function toggleServico(s: string) {
    setServicosSel(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function toggleHorario(i: number) {
    setHorarios(prev => prev.map((h, idx) => idx===i ? {...h, ativo:!h.ativo} : h))
  }

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(prev => ({...prev, [k]:e.target.value}))

  return (
    <div style={{ padding:'24px 16px' }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Profissionais</h1>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>{profissionais.filter(p=>p.status==='ativo').length} ativos de {profissionais.length} cadastrados</p>
        </div>
        <button onClick={abrirNovo} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          + Novo profissional
        </button>
      </div>

      {/* Busca */}
      <div style={{ position:'relative', maxWidth:'300px', marginBottom:'20px' }}>
        <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}>🔍</span>
        <input style={{ ...inputStyle, paddingLeft:'36px' }} placeholder="Buscar profissional..." value={busca} onChange={e => setBusca(e.target.value)}/>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'14px' }}>
        {filtrados.map(p => (
          <div key={p.id} style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px', opacity: p.status==='inativo'?0.7:1 }}>
            {/* Topo */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'46px', height:'46px', borderRadius:'50%', background:p.cor+'20', border:`2px solid ${p.cor}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', color:p.cor, flexShrink:0 }}>
                  {p.nome.split(' ').slice(0,2).map(n=>n[0]).join('')}
                </div>
                <div>
                  <p style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>{p.nome}</p>
                  <p style={{ fontSize:'12px', color:'#9ca3af' }}>{p.especialidade}</p>
                </div>
              </div>
              <span style={{ fontSize:'11px', fontWeight:'500', padding:'3px 10px', borderRadius:'99px', background: p.status==='ativo'?'#ecfdf5':'#f9fafb', color: p.status==='ativo'?'#10b981':'#9ca3af' }}>
                {p.status==='ativo'?'Ativo':'Inativo'}
              </span>
            </div>

            {/* Contato */}
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'14px' }}>
              <p style={{ fontSize:'12px', color:'#9ca3af' }}>📧 {p.email}</p>
              <p style={{ fontSize:'12px', color:'#9ca3af' }}>📱 {p.telefone}</p>
            </div>

            {/* Serviços */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'14px' }}>
              {p.servicos.map(s => (
                <span key={s} style={{ fontSize:'11px', background:p.cor+'15', color:p.cor, padding:'2px 8px', borderRadius:'99px', fontWeight:'500' }}>{s}</span>
              ))}
            </div>

            {/* Métricas */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'12px', borderTop:'1px solid #f9fafb' }}>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:'18px', fontWeight:'700', color:'#1a1a2e' }}>{p.atendimentosMes}</p>
                <p style={{ fontSize:'11px', color:'#9ca3af' }}>atend./mês</p>
              </div>
              <div style={{ textAlign:'center' }}>
                <p style={{ fontSize:'18px', fontWeight:'700', color:'#1a1a2e' }}>{p.horarios.filter(h=>h.ativo).length}</p>
                <p style={{ fontSize:'11px', color:'#9ca3af' }}>dias/semana</p>
              </div>
              <button onClick={() => abrirEdicao(p)} style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'8px', padding:'7px 14px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>
                ✏️ Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div onClick={fecharModal} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'560px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicao?'✏️ Editar profissional':'+ Novo profissional'}</h2>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
            </div>

            {/* Abas */}
            <div style={{ display:'flex', gap:'0', marginBottom:'20px', borderBottom:'2px solid #f3f4f6' }}>
              {([['dados','Dados'],['servicos','Serviços'],['horarios','Horários']] as const).map(([v,l]) => (
                <button key={v} onClick={() => setAbaModal(v)} style={{
                  padding:'8px 16px', border:'none', background:'none', cursor:'pointer', fontSize:'13px',
                  fontWeight: abaModal===v?'600':'400', color: abaModal===v?'#6366f1':'#9ca3af',
                  borderBottom: abaModal===v?'2px solid #6366f1':'2px solid transparent', marginBottom:'-2px',
                }}>{l}</button>
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
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail</label>
                    <input type="email" value={form.email} onChange={f('email')} style={inputStyle} placeholder="email@empresa.com"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Telefone</label>
                    <input value={form.telefone} onChange={f('telefone')} style={inputStyle} placeholder="(11) 99999-0000"/>
                  </div>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Especialidade</label>
                  <input value={form.especialidade} onChange={f('especialidade')} style={inputStyle} placeholder="Ex: Fisioterapeuta, Psicólogo..."/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Cor de identificação</label>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {CORES.map(cor => (
                      <button key={cor} onClick={() => setForm(prev => ({...prev, cor}))} style={{ width:'28px', height:'28px', borderRadius:'50%', background:cor, border: form.cor===cor?'3px solid #1a1a2e':'2px solid transparent', cursor:'pointer' }}/>
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
                <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'4px' }}>Selecione os serviços que este profissional realiza:</p>
                {SERVICOS_LISTA.map(s => (
                  <div key={s} onClick={() => toggleServico(s)} style={{
                    display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px',
                    borderRadius:'10px', border: servicosSel.includes(s)?'1.5px solid #6366f1':'1px solid #e5e7eb',
                    background: servicosSel.includes(s)?'#eef2ff':'white', cursor:'pointer', transition:'all .15s',
                  }}>
                    <div style={{ width:'20px', height:'20px', borderRadius:'50%', border: servicosSel.includes(s)?'none':'1.5px solid #d1d5db', background: servicosSel.includes(s)?'#6366f1':'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {servicosSel.includes(s) && <span style={{ color:'white', fontSize:'12px' }}>✓</span>}
                    </div>
                    <span style={{ fontSize:'14px', color:'#1a1a2e', fontWeight: servicosSel.includes(s)?'500':'400' }}>{s}</span>
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
                    <div onClick={() => toggleHorario(i)} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background: h.ativo?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                      <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left: h.ativo?'18px':'2px' }}/>
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:'500', color: h.ativo?'#1a1a2e':'#9ca3af', minWidth:'30px' }}>{DIAS[h.dia]}</span>
                    {h.ativo ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <input type="time" value={h.inicio} onChange={e => setHorarios(prev => prev.map((x,j) => j===i?{...x,inicio:e.target.value}:x))}
                          style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'5px 8px', fontSize:'13px', outline:'none' }}/>
                        <span style={{ color:'#9ca3af', fontSize:'12px' }}>até</span>
                        <input type="time" value={h.fim} onChange={e => setHorarios(prev => prev.map((x,j) => j===i?{...x,fim:e.target.value}:x))}
                          style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'5px 8px', fontSize:'13px', outline:'none' }}/>
                      </div>
                    ) : <span style={{ fontSize:'12px', color:'#d1d5db' }}>Não atende</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Botões */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicao && selecionado
                ? <button onClick={() => excluir(selecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvar} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
                  {modoEdicao?'Salvar alterações':'Salvar profissional'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
