'use client'

import { useState } from 'react'

type Plano = {
  id: number
  nome: string
  descricao: string
  valor_mensal: number
  sessoes_mes: number | null
  validade_dias: number
  status: string
}

const planosIniciais: Plano[] = [
  { id:1, nome:'Plano 4 sessões',  descricao:'4 sessões por mês',  valor_mensal:400, sessoes_mes:4,    validade_dias:30, status:'ativo' },
  { id:2, nome:'Plano 8 sessões',  descricao:'8 sessões por mês',  valor_mensal:720, sessoes_mes:8,    validade_dias:30, status:'ativo' },
  { id:3, nome:'Plano Ilimitado',  descricao:'Sessões ilimitadas', valor_mensal:990, sessoes_mes:null, validade_dias:30, status:'ativo' },
]

const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function ConfiguracoesPage() {
  const [aba, setAba] = useState<'empresa'|'horarios'|'planos'|'notificacoes'>('empresa')

  // Empresa
  const [nomeEmpresa, setNomeEmpresa]   = useState('Studio Demo')
  const [email, setEmail]               = useState('contato@studiodemo.com')
  const [telefone, setTelefone]         = useState('(11) 99999-9999')
  const [cnpj, setCnpj]                 = useState('00.000.000/0001-00')
  const [endereco, setEndereco]         = useState('')
  const [salvo, setSalvo]               = useState(false)

  // Horários
  const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  const [horarios, setHorarios] = useState(
    DIAS.map((dia, i) => ({ dia, ativo: i>=1&&i<=5, inicio:'08:00', fim:'18:00' }))
  )

  // Planos
  const [planos, setPlanos]             = useState<Plano[]>(planosIniciais)
  const [modalPlano, setModalPlano]     = useState(false)
  const [modoEdicaoPlano, setModoEdicaoPlano] = useState(false)
  const [planoSelecionado, setPlanoSelecionado] = useState<Plano | null>(null)
  const [formPlano, setFormPlano]       = useState({ nome:'', descricao:'', valor_mensal:'', sessoes_mes:'', validade_dias:'30', status:'ativo', ilimitado:false })

  function abrirNovoPlano() {
    setModoEdicaoPlano(false)
    setPlanoSelecionado(null)
    setFormPlano({ nome:'', descricao:'', valor_mensal:'', sessoes_mes:'', validade_dias:'30', status:'ativo', ilimitado:false })
    setModalPlano(true)
  }

  function abrirEdicaoPlano(p: Plano) {
    setModoEdicaoPlano(true)
    setPlanoSelecionado(p)
    setFormPlano({
      nome: p.nome,
      descricao: p.descricao,
      valor_mensal: p.valor_mensal.toString(),
      sessoes_mes: p.sessoes_mes?.toString() || '',
      validade_dias: p.validade_dias.toString(),
      status: p.status,
      ilimitado: p.sessoes_mes === null,
    })
    setModalPlano(true)
  }

  function fecharModalPlano() { setModalPlano(false); setPlanoSelecionado(null) }

  function salvarPlano() {
    if (!formPlano.nome.trim()) return
    const novo: Plano = {
      id: modoEdicaoPlano && planoSelecionado ? planoSelecionado.id : Date.now(),
      nome: formPlano.nome,
      descricao: formPlano.descricao,
      valor_mensal: parseFloat(formPlano.valor_mensal) || 0,
      sessoes_mes: formPlano.ilimitado ? null : (parseInt(formPlano.sessoes_mes) || 0),
      validade_dias: parseInt(formPlano.validade_dias) || 30,
      status: formPlano.status,
    }
    if (modoEdicaoPlano && planoSelecionado) {
      setPlanos(prev => prev.map(p => p.id === planoSelecionado.id ? novo : p))
    } else {
      setPlanos(prev => [...prev, novo])
    }
    fecharModalPlano()
  }

  function excluirPlano(id: number) {
    if (confirm('Deseja excluir este plano?')) {
      setPlanos(prev => prev.filter(p => p.id !== id))
      fecharModalPlano()
    }
  }

  function toggleStatusPlano(id: number) {
    setPlanos(prev => prev.map(p => p.id === id ? { ...p, status: p.status==='ativo'?'inativo':'ativo' } : p))
  }

  function handleSalvar() {
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  const abas = [
    { key:'empresa',      label:'Empresa'      },
    { key:'horarios',     label:'Horários'     },
    { key:'planos',       label:'Planos'       },
    { key:'notificacoes', label:'Notificações' },
  ]

  return (
    <div style={{ padding:'24px 16px', maxWidth:'740px' }}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e', letterSpacing:'-0.5px' }}>Configurações</h1>
        <p style={{ fontSize:'13px', color:'#9ca3af' }}>Gerencie as configurações da sua empresa</p>
      </div>

      {/* Abas */}
      <div style={{ display:'flex', gap:'0', marginBottom:'24px', borderBottom:'2px solid #f3f4f6', overflowX:'auto' }}>
        {abas.map(a => (
          <button key={a.key} onClick={() => setAba(a.key as any)} style={{
            padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontSize:'14px',
            fontWeight: aba===a.key?'600':'400', color: aba===a.key?'#6366f1':'#9ca3af',
            borderBottom: aba===a.key?'2px solid #6366f1':'2px solid transparent',
            marginBottom:'-2px', transition:'all .15s', whiteSpace:'nowrap',
          }}>{a.label}</button>
        ))}
      </div>

      {/* ── Empresa ── */}
      {aba === 'empresa' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'20px' }}>Dados da empresa</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'16px' }}>
            {[
              { label:'Nome da empresa', value:nomeEmpresa, set:setNomeEmpresa, placeholder:'Nome da empresa' },
              { label:'CNPJ',            value:cnpj,        set:setCnpj,        placeholder:'00.000.000/0001-00' },
              { label:'E-mail',          value:email,       set:setEmail,       placeholder:'email@empresa.com' },
              { label:'Telefone',        value:telefone,    set:setTelefone,    placeholder:'(11) 99999-9999' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>{f.label}</label>
                <input value={f.value} onChange={e => f.set(e.target.value)} style={inputStyle} placeholder={f.placeholder}/>
              </div>
            ))}
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Endereço</label>
              <input value={endereco} onChange={e => setEndereco(e.target.value)} style={inputStyle} placeholder="Rua, número, bairro, cidade"/>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Logo da empresa</label>
              <div style={{ border:'2px dashed #e5e7eb', borderRadius:'10px', padding:'24px', textAlign:'center', cursor:'pointer' }}>
                <p style={{ fontSize:'24px', marginBottom:'6px' }}>📁</p>
                <p style={{ fontSize:'13px', color:'#9ca3af' }}>Clique para enviar a logo</p>
                <p style={{ fontSize:'11px', color:'#d1d5db', marginTop:'4px' }}>PNG, JPG até 2MB</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Horários ── */}
      {aba === 'horarios' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'6px' }}>Horários de funcionamento</h2>
          <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'20px' }}>Configure os dias e horários disponíveis para agendamento</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {horarios.map((h, i) => (
              <div key={h.dia} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', borderRadius:'10px', border:'1px solid #f0f0f8', flexWrap:'wrap' }}>
                <div onClick={() => setHorarios(prev => prev.map((x,j) => j===i?{...x,ativo:!x.ativo}:x))}
                  style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background: h.ativo?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                  <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left: h.ativo?'18px':'2px' }}/>
                </div>
                <span style={{ fontSize:'14px', fontWeight:'500', color: h.ativo?'#1a1a2e':'#9ca3af', minWidth:'70px' }}>{h.dia}</span>
                {h.ativo ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <input type="time" value={h.inicio} onChange={e => setHorarios(prev => prev.map((x,j) => j===i?{...x,inicio:e.target.value}:x))}
                      style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 10px', fontSize:'13px', outline:'none' }}/>
                    <span style={{ color:'#9ca3af', fontSize:'13px' }}>até</span>
                    <input type="time" value={h.fim} onChange={e => setHorarios(prev => prev.map((x,j) => j===i?{...x,fim:e.target.value}:x))}
                      style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 10px', fontSize:'13px', outline:'none' }}/>
                  </div>
                ) : (
                  <span style={{ fontSize:'13px', color:'#d1d5db' }}>Fechado</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Planos ── */}
      {aba === 'planos' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
            <div>
              <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>Planos mensais</h2>
              <p style={{ fontSize:'13px', color:'#9ca3af' }}>{planos.filter(p=>p.status==='ativo').length} ativos de {planos.length} cadastrados</p>
            </div>
            <button onClick={abrirNovoPlano} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>
              + Novo plano
            </button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {planos.map(p => (
              <div key={p.id} style={{ border:'1px solid #f0f0f8', borderRadius:'12px', padding:'16px 18px', opacity: p.status==='inativo'?0.6:1, transition:'all .15s' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                      <p style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e' }}>{p.nome}</p>
                      <span style={{ fontSize:'11px', fontWeight:'500', padding:'2px 8px', borderRadius:'99px', background: p.status==='ativo'?'#ecfdf5':'#f9fafb', color: p.status==='ativo'?'#10b981':'#9ca3af' }}>
                        {p.status==='ativo'?'Ativo':'Inativo'}
                      </span>
                    </div>
                    <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'8px' }}>{p.descricao}</p>
                    <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
                      <div>
                        <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Valor mensal</p>
                        <p style={{ fontSize:'16px', fontWeight:'700', color:'#6366f1' }}>R$ {p.valor_mensal.toFixed(2).replace('.',',')}</p>
                      </div>
                      <div>
                        <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Sessões</p>
                        <p style={{ fontSize:'16px', fontWeight:'700', color:'#1a1a2e' }}>{p.sessoes_mes === null ? '∞' : p.sessoes_mes}/mês</p>
                      </div>
                      <div>
                        <p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Validade</p>
                        <p style={{ fontSize:'16px', fontWeight:'700', color:'#1a1a2e' }}>{p.validade_dias} dias</p>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    <div onClick={() => toggleStatusPlano(p.id)} title={p.status==='ativo'?'Desativar':'Ativar'}
                      style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background: p.status==='ativo'?'#6366f1':'#e5e7eb', position:'relative', marginTop:'2px' }}>
                      <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left: p.status==='ativo'?'18px':'2px' }}/>
                    </div>
                    <button onClick={() => abrirEdicaoPlano(p)}
                      style={{ background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', fontWeight:'500', cursor:'pointer' }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => excluirPlano(p.id)}
                      style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {planos.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af', fontSize:'14px' }}>
                Nenhum plano cadastrado. Clique em "+ Novo plano" para começar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notificações ── */}
      {aba === 'notificacoes' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'6px' }}>Notificações</h2>
          <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'20px' }}>Configure quando e como notificar clientes e profissionais</p>
          {[
            { label:'Confirmação de agendamento por e-mail', desc:'Envia e-mail ao cliente quando um agendamento é criado', ativo:true  },
            { label:'Lembrete 24h antes',                    desc:'Lembra o cliente 1 dia antes do atendimento',            ativo:true  },
            { label:'Lembrete 1h antes',                     desc:'Lembra o cliente 1 hora antes do atendimento',           ativo:true  },
            { label:'Notificar profissional ao agendar',     desc:'Avisa o profissional sobre novos agendamentos',          ativo:false },
            { label:'Alerta de cancelamento',                desc:'Notifica quando um agendamento é cancelado',             ativo:false },
          ].map((n, i) => (
            <div key={n.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid #f9fafb', gap:'12px' }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'2px' }}>{n.label}</p>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>{n.desc}</p>
              </div>
              <div style={{ width:'40px', height:'22px', borderRadius:'99px', cursor:'pointer', background: n.ativo?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                <div style={{ position:'absolute', top:'3px', width:'16px', height:'16px', borderRadius:'50%', background:'white', left: n.ativo?'21px':'3px', transition:'left .2s' }}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão salvar */}
      <div style={{ marginTop:'20px', display:'flex', alignItems:'center', gap:'12px', justifyContent:'flex-end' }}>
        {salvo && <span style={{ fontSize:'13px', color:'#10b981', fontWeight:'500' }}>✓ Salvo com sucesso!</span>}
        <button onClick={handleSalvar} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'10px 24px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
          Salvar configurações
        </button>
      </div>

      {/* Modal plano */}
      {modalPlano && (
        <div onClick={fecharModalPlano} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'500px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>
                {modoEdicaoPlano ? '✏️ Editar plano' : '+ Novo plano'}
              </h2>
              <button onClick={fecharModalPlano} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>✕</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome do plano *</label>
                <input value={formPlano.nome} onChange={e => setFormPlano(f => ({...f, nome:e.target.value}))} style={inputStyle} placeholder="Ex: Plano 4 sessões"/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Descrição</label>
                <input value={formPlano.descricao} onChange={e => setFormPlano(f => ({...f, descricao:e.target.value}))} style={inputStyle} placeholder="Breve descrição do plano"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Valor mensal (R$)</label>
                  <input type="number" value={formPlano.valor_mensal} onChange={e => setFormPlano(f => ({...f, valor_mensal:e.target.value}))} style={inputStyle} placeholder="0,00"/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Validade (dias)</label>
                  <input type="number" value={formPlano.validade_dias} onChange={e => setFormPlano(f => ({...f, validade_dias:e.target.value}))} style={inputStyle} placeholder="30"/>
                </div>
              </div>

              {/* Sessões */}
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Sessões por mês</label>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                  <div onClick={() => setFormPlano(f => ({...f, ilimitado:!f.ilimitado}))}
                    style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background: formPlano.ilimitado?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left: formPlano.ilimitado?'18px':'2px' }}/>
                  </div>
                  <span style={{ fontSize:'13px', color:'#374151' }}>Ilimitado</span>
                </div>
                {!formPlano.ilimitado && (
                  <input type="number" value={formPlano.sessoes_mes} onChange={e => setFormPlano(f => ({...f, sessoes_mes:e.target.value}))} style={inputStyle} placeholder="Ex: 4"/>
                )}
              </div>

              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                <select value={formPlano.status} onChange={e => setFormPlano(f => ({...f, status:e.target.value}))} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicaoPlano && planoSelecionado
                ? <button onClick={() => excluirPlano(planoSelecionado.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>
                : <div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModalPlano} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvarPlano} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:'pointer' }}>
                  {modoEdicaoPlano ? 'Salvar alterações' : 'Criar plano'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
