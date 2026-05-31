// BUILD: 1779992105
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEmpresa } from '@/context/EmpresaContext'
import { createClient } from '@/lib/supabase'
import { buscarEmpresa, atualizarConfiguracoes, listarPlanos, criarPlano, atualizarPlano, excluirPlano } from '@/lib/api'
import { enviarMensagem, aplicarVariaveis } from '@/lib/whatsapp'

type Plano = { id:string; nome:string; descricao?:string; valor_mensal:number; sessoes_mes:number|null; validade_dias:number; status:string }
const inputStyle = { width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

function TemplateEditor({ template, onSave }: { template: any; onSave: (id: string, msg: string) => void }) {
  const [msg, setMsg] = useState(template.mensagem)
  const [salvou, setSalvou] = useState(false)
  function salvar() { onSave(template.id, msg); setSalvou(true); setTimeout(()=>setSalvou(false), 2000) }
  return (
    <div>
      <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={5}
        style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'13px', outline:'none', resize:'vertical', boxSizing:'border-box' as const, fontFamily:'inherit', lineHeight:'1.6' }}
        onFocus={e=>{(e.target as HTMLTextAreaElement).style.borderColor='#6366f1'}}
        onBlur={e=>{(e.target as HTMLTextAreaElement).style.borderColor='#e5e7eb'}}/>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'8px' }}>
        <button onClick={salvar} style={{ background:salvou?'#22c55e':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'7px 16px', fontSize:'12px', fontWeight:'600', cursor:'pointer', transition:'background .2s' }}>
          {salvou ? 'Salvo!' : 'Salvar template'}
        </button>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const { empresaAtiva, recarregar } = useEmpresa()
  const [aba, setAba] = useState<'empresa'|'horarios'|'planos'|'whatsapp'>('empresa')
  const [empresa, setEmpresa]   = useState<any>(null)
  const [planos, setPlanos]     = useState<Plano[]>([])
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo]       = useState(false)
  const DIAS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  const [horarios, setHorarios] = useState(DIAS.map((dia,i)=>({dia,ativo:i>=1&&i<=5,inicio:'08:00',fim:'18:00'})))

  // Plano modal
  const [modalPlano, setModalPlano]         = useState(false)
  const [modoEdicaoPlano, setModoEdicaoPlano] = useState(false)
  const [planoSel, setPlanoSel]             = useState(null as Plano | null)
  const [formPlano, setFormPlano] = useState({ nome:'', descricao:'', valor_mensal:'', sessoes_mes:'', validade_dias:'30', status:'ativo', ilimitado:false })
  const [erroPlano, setErroPlano] = useState('')
  const [salvandoPlano, setSalvandoPlano]   = useState(false)
  // WhatsApp
  const [wpp, setWpp] = useState({ api_url:'', api_token:'', instancia:'', ativo:false })
  const [templates, setTemplates] = useState<any[]>([])
  const [testando, setTestando] = useState(false)
  const [testeNum, setTesteNum] = useState('')
  const [salvandoWpp, setSalvandoWpp] = useState(false)
  const [msgWpp, setMsgWpp] = useState('')

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    const sb2 = createClient()
    const [emp, pls, tmpl] = await Promise.all([
      buscarEmpresa(empresaAtiva.id),
      listarPlanos(empresaAtiva.id),
      sb2.from('mensagens_template').select('*').eq('empresa_id', empresaAtiva.id).order('created_at'),
    ])
    if (emp.data) {
      setEmpresa(emp.data)
      setWpp({ api_url:emp.data.whatsapp_api_url||'', api_token:emp.data.whatsapp_api_token||'', instancia:emp.data.whatsapp_instancia||'', ativo:emp.data.whatsapp_ativo||false })
    }
    if (pls.data) setPlanos(pls.data as Plano[])
    if (tmpl.data) setTemplates(tmpl.data)
    // Criar templates padrão se nao existirem
    if (tmpl.data && tmpl.data.length === 0) {
      const sb3 = createClient()
      await sb3.from('mensagens_template').insert([
        { empresa_id:empresaAtiva.id, tipo:'confirmacao', nome:'Confirmacao de Horario', mensagem:'Ola {{cliente}}! Tudo bem?

Gostarmos de confirmar seu horario:
*Data:* {{data}}
*Horario:* {{hora}}
*Servico:* {{servico}}

Pode confirmar?
*Sim* - Estarei presente!
*Nao* - Preciso remarcar.

Obrigado! 😊', ativo:true },
        { empresa_id:empresaAtiva.id, tipo:'aniversario', nome:'Parabens Aniversario', mensagem:'Ola {{cliente}}! 🎂🎉

Hoje e um dia muito especial - SEU ANIVERSARIO!

A equipe da *{{empresa}}* deseja a voce um dia incrivel, cheio de alegria e realizacoes!

Muitas felicidades! 🥳', ativo:true },
        { empresa_id:empresaAtiva.id, tipo:'massa', nome:'Mensagem em Massa', mensagem:'Ola {{cliente}}!

Temos novidades especiais para voce.

*{{empresa}}*
📞 Entre em contato conosco!', ativo:true },
      ])
      const { data: newTmpl } = await sb3.from('mensagens_template').select('*').eq('empresa_id', empresaAtiva.id)
      if (newTmpl) setTemplates(newTmpl)
    }
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  async function salvarEmpresa() {
    if (!empresa || !empresaAtiva?.id) return
    setSalvando(true)
    const { error } = await atualizarConfiguracoes(empresaAtiva.id, { nome:empresa.nome, cnpj:empresa.cnpj, telefone:empresa.telefone, email:empresa.email, endereco:empresa.endereco, tipo_agenda:empresa.tipo_agenda||'grade' })
    if (!error) { setSalvo(true); setTimeout(()=>setSalvo(false),2500); recarregar() }
    setSalvando(false)
  }

  function abrirNovoPlano() { setModoEdicaoPlano(false); setPlanoSel(null); setErroPlano(''); setFormPlano({nome:'',descricao:'',valor_mensal:'',sessoes_mes:'',validade_dias:'30',status:'ativo',ilimitado:false}); setModalPlano(true) }
  function abrirEdicaoPlano(p: Plano) { setModoEdicaoPlano(true); setPlanoSel(p); setErroPlano(''); setFormPlano({nome:p.nome,descricao:p.descricao||'',valor_mensal:String(p.valor_mensal),sessoes_mes:p.sessoes_mes!=null?String(p.sessoes_mes):'',validade_dias:String(p.validade_dias),status:p.status,ilimitado:p.sessoes_mes===null}); setModalPlano(true) }
  function fecharModalPlano() { setModalPlano(false); setPlanoSel(null) }

  async function salvarWpp() {
    if (!empresaAtiva?.id) return
    setSalvandoWpp(true); setMsgWpp('')
    const sb2 = createClient()
    const { error } = await sb2.from('empresas').update({
      whatsapp_api_url: wpp.api_url || null,
      whatsapp_api_token: wpp.api_token || null,
      whatsapp_instancia: wpp.instancia || null,
      whatsapp_ativo: wpp.ativo,
    }).eq('id', empresaAtiva.id)
    if (error) { setMsgWpp('Erro: ' + error.message) }
    else { setMsgWpp('Configuracao salva!') ; setTimeout(()=>setMsgWpp(''), 3000) }
    setSalvandoWpp(false)
  }

  async function testarWpp() {
    if (!testeNum) return setMsgWpp('Informe um numero para teste.')
    setTestando(true); setMsgWpp('')
    const { ok, erro } = await enviarMensagem({ api_url:wpp.api_url, api_token:wpp.api_token, instancia:wpp.instancia }, testeNum, 'Teste de conexao AgendaFortitude. Se recebeu esta mensagem a API esta funcionando!')
    setMsgWpp(ok ? 'Mensagem enviada com sucesso!' : 'Erro: ' + erro)
    setTestando(false)
  }

  async function salvarTemplate(id: string, mensagem: string) {
    const sb2 = createClient()
    await sb2.from('mensagens_template').update({ mensagem }).eq('id', id)
    setMsgWpp('Template salvo!'); setTimeout(()=>setMsgWpp(''), 2000)
  }

  async function enviarMassa() {
    if (!empresaAtiva?.id) return
    const tmplMassa = templates.find(t => t.tipo === 'massa' && t.ativo)
    if (!tmplMassa) return setMsgWpp('Configure o template de mensagem em massa primeiro.')
    if (!wpp.ativo) return setMsgWpp('Configure e ative o WhatsApp primeiro.')
    if (!confirm('Enviar mensagem para TODOS os clientes ativos? Esta acao nao pode ser desfeita.')) return
    const sb2 = createClient()
    const { data: clientes } = await sb2.from('clientes').select('id,nome,whatsapp,telefone').eq('empresa_id', empresaAtiva.id).eq('status', 'ativo')
    if (!clientes || clientes.length === 0) return setMsgWpp('Nenhum cliente ativo encontrado.')
    let enviados = 0, erros = 0
    for (const c of clientes) {
      const num = c.whatsapp || c.telefone
      if (!num) { erros++; continue }
      const msg = aplicarVariaveis(tmplMassa.mensagem, { cliente: c.nome, empresa: empresaAtiva.nome || '' })
      const { ok } = await enviarMensagem({ api_url:wpp.api_url, api_token:wpp.api_token, instancia:wpp.instancia }, num, msg)
      if (ok) enviados++; else erros++
      await new Promise(r => setTimeout(r, 500)) // delay para nao sobrecarregar API
    }
    setMsgWpp('Envio concluido: ' + enviados + ' enviados, ' + erros + ' erros.')
  }

  async function salvarPlano() {
    if (!formPlano.nome.trim()) return setErroPlano('Nome é obrigatório.')
    if (!empresaAtiva?.id) return
    setSalvandoPlano(true); setErroPlano('')
    const payload = { nome:formPlano.nome, descricao:formPlano.descricao, valor_mensal:parseFloat(formPlano.valor_mensal)||0, sessoes_mes:formPlano.ilimitado?null:(parseInt(formPlano.sessoes_mes)||0), validade_dias:parseInt(formPlano.validade_dias)||30, status:formPlano.status }
    let error: any
    if (modoEdicaoPlano && planoSel) { ({ error } = await atualizarPlano(planoSel.id, payload)) }
    else { ({ error } = await criarPlano(empresaAtiva.id, payload)) }
    if (error) { setErroPlano('Erro: '+error.message); setSalvandoPlano(false); return }
    await carregar(); fecharModalPlano(); setSalvandoPlano(false)
  }

  async function deletarPlano(id: string) {
    if (!confirm('Excluir este plano?')) return
    const { error } = await excluirPlano(id)
    if (error) { alert('Erro: '+error.message); return }
    await carregar(); fecharModalPlano()
  }

  async function toggleStatusPlano(p: Plano) {
    await atualizarPlano(p.id, { status: p.status==='ativo'?'inativo':'ativo' })
    await carregar()
  }

  const abas = [{ key:'empresa', label:'Empresa' },{ key:'horarios', label:'Horários' },{ key:'planos', label:'Planos' },{ key:'notificacoes', label:'Notificações' }]

  return (
    <div style={{ padding:'24px 16px', maxWidth:'740px' }}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#1a1a2e' }}>Configurações</h1>
        <p style={{ fontSize:'13px', color:'#9ca3af' }}>Gerencie as configurações da sua empresa</p>
      </div>

      <div style={{ display:'flex', marginBottom:'24px', borderBottom:'2px solid #f3f4f6', overflowX:'auto' }}>
        {abas.map(a=>(
          <button key={a.key} onClick={()=>setAba(a.key as any)} style={{ padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontSize:'14px', fontWeight:aba===a.key?'600':'400', color:aba===a.key?'#6366f1':'#9ca3af', borderBottom:aba===a.key?'2px solid #6366f1':'2px solid transparent', marginBottom:'-2px', whiteSpace:'nowrap' }}>{a.label}</button>
        ))}
      </div>

      {/* Empresa */}
      {aba==='empresa' && empresa && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'20px' }}>Dados da empresa</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:'16px' }}>
            {[
              { label:'Nome', key:'nome', placeholder:'Nome da empresa' },
              { label:'CNPJ', key:'cnpj', placeholder:'00.000.000/0001-00' },
              { label:'E-mail', key:'email', placeholder:'email@empresa.com' },
              { label:'Telefone', key:'telefone', placeholder:'(11) 99999-9999' },
            ].map(f=>(
              <div key={f.key}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>{f.label}</label>
                <input value={empresa[f.key]||''} onChange={e=>setEmpresa((p: any)=>({...p,[f.key]:e.target.value}))} style={inputStyle} placeholder={f.placeholder}/>
              </div>
            ))}
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Endereço</label>
              <input value={empresa.endereco||''} onChange={e=>setEmpresa((p: any)=>({...p,endereco:e.target.value}))} style={inputStyle} placeholder="Rua, número, bairro, cidade"/>
            </div>
            {/* Tipo de agenda */}
            <div style={{ gridColumn:'1/-1' }}>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'10px' }}>Tipo de visualização da agenda</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div onClick={()=>setEmpresa((p: any)=>({...p,tipo_agenda:'grade'}))}
                  style={{ padding:'16px', borderRadius:'12px', cursor:'pointer', border:(empresa.tipo_agenda||'grade')==='grade'?'2px solid #6366f1':'2px solid #e5e7eb', background:(empresa.tipo_agenda||'grade')==='grade'?'#eef2ff':'white', transition:'all .15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:(empresa.tipo_agenda||'grade')==='grade'?'#6366f1':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={(empresa.tipo_agenda||'grade')==='grade'?'white':'#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    </div>
                    <p style={{ fontSize:'14px', fontWeight:'700', color:(empresa.tipo_agenda||'grade')==='grade'?'#4f46e5':'#374151' }}>Grade de horários</p>
                  </div>
                  <p style={{ fontSize:'12px', color:'#6b7280' }}>Visualização em colunas por profissional com grade de horários</p>
                  {(empresa.tipo_agenda||'grade')==='grade' && <span style={{ fontSize:'11px', fontWeight:'700', color:'#4f46e5', background:'#e0e7ff', borderRadius:'99px', padding:'2px 10px', display:'inline-block', marginTop:'8px' }}>Ativo</span>}
                </div>
                <div onClick={()=>setEmpresa((p: any)=>({...p,tipo_agenda:'calendario'}))}
                  style={{ padding:'16px', borderRadius:'12px', cursor:'pointer', border:empresa.tipo_agenda==='calendario'?'2px solid #f97316':'2px solid #e5e7eb', background:empresa.tipo_agenda==='calendario'?'#fff7ed':'white', transition:'all .15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:empresa.tipo_agenda==='calendario'?'#f97316':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={empresa.tipo_agenda==='calendario'?'white':'#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <p style={{ fontSize:'14px', fontWeight:'700', color:empresa.tipo_agenda==='calendario'?'#ea580c':'#374151' }}>Calendário mensal</p>
                  </div>
                  <p style={{ fontSize:'12px', color:'#6b7280' }}>Calendário com dias do mês e lista de horários ao clicar no dia</p>
                  {empresa.tipo_agenda==='calendario' && <span style={{ fontSize:'11px', fontWeight:'700', color:'#ea580c', background:'#ffedd5', borderRadius:'99px', padding:'2px 10px', display:'inline-block', marginTop:'8px' }}>Ativo</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Horários */}
      {aba==='horarios' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'6px' }}>Horários de funcionamento</h2>
          <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'20px' }}>Configure os dias e horários disponíveis</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {horarios.map((h,i)=>(
              <div key={h.dia} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', borderRadius:'10px', border:'1px solid #f0f0f8', flexWrap:'wrap' }}>
                <div onClick={()=>setHorarios(p=>p.map((x,j)=>j===i?{...x,ativo:!x.ativo}:x))} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background:h.ativo?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                  <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left:h.ativo?'18px':'2px' }}/>
                </div>
                <span style={{ fontSize:'14px', fontWeight:'500', color:h.ativo?'#1a1a2e':'#9ca3af', minWidth:'70px' }}>{h.dia}</span>
                {h.ativo ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <input type="time" value={h.inicio} onChange={e=>setHorarios(p=>p.map((x,j)=>j===i?{...x,inicio:e.target.value}:x))} style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 10px', fontSize:'13px', outline:'none' }}/>
                    <span style={{ color:'#9ca3af', fontSize:'13px' }}>até</span>
                    <input type="time" value={h.fim} onChange={e=>setHorarios(p=>p.map((x,j)=>j===i?{...x,fim:e.target.value}:x))} style={{ border:'1px solid #e5e7eb', borderRadius:'6px', padding:'6px 10px', fontSize:'13px', outline:'none' }}/>
                  </div>
                ) : <span style={{ fontSize:'13px', color:'#d1d5db' }}>Fechado</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp */}
      {aba === 'whatsapp' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* Config API */}
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'22px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'18px' }}>
              <div style={{ width:'42px', height:'42px', borderRadius:'12px', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div>
                <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a' }}>Conexao WhatsApp</h2>
                <p style={{ fontSize:'12px', color:'#6b7280' }}>Configure a Evolution API ou similar</p>
              </div>
              <div onClick={()=>setWpp(p=>({...p, ativo:!p.ativo}))} style={{ marginLeft:'auto', width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:wpp.ativo?'#22c55e':'#e5e7eb', position:'relative', flexShrink:0 }}>
                <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left .2s', left:wpp.ativo?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[{l:'URL da API',k:'api_url',ph:'https://api.seuservidor.com.br',t:'text'},{l:'Token / API Key',k:'api_token',ph:'eyJhbGciOiJIUzI1...',t:'password'},{l:'Nome da Instancia',k:'instancia',ph:'minha-instancia',t:'text'}].map(f=>(
                <div key={f.k}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.04em' }}>{f.l}</label>
                  <input type={f.t} value={(wpp as any)[f.k]} onChange={e=>setWpp(p=>({...p,[f.k]:e.target.value}))} style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }} placeholder={f.ph}
                    onFocus={e=>{(e.target as HTMLInputElement).style.borderColor='#6366f1'}}
                    onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='#e5e7eb'}}/>
                </div>
              ))}
              <div style={{ display:'flex', gap:'10px', marginTop:'4px', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:'180px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.04em' }}>Numero de teste</label>
                  <input value={testeNum} onChange={e=>setTesteNum(e.target.value)} style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }} placeholder="(34) 99999-0000"/>
                </div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:'8px' }}>
                  <button onClick={testarWpp} disabled={testando} style={{ background:'#f0fdf4', color:'#16a34a', border:'1.5px solid #86efac', borderRadius:'8px', padding:'10px 16px', fontSize:'13px', fontWeight:'600', cursor:testando?'not-allowed':'pointer', whiteSpace:'nowrap' }}>
                    {testando ? 'Enviando...' : 'Testar conexao'}
                  </button>
                  <button onClick={salvarWpp} disabled={salvandoWpp} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
                    {salvandoWpp ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
            {msgWpp && <div style={{ marginTop:'12px', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', background:msgWpp.startsWith('Erro')?'#fef2f2':'#f0fdf4', color:msgWpp.startsWith('Erro')?'#dc2626':'#16a34a', border:'1px solid '+(msgWpp.startsWith('Erro')?'#fecaca':'#bbf7d0') }}>{msgWpp}</div>}
          </div>

          {/* Templates de mensagens */}
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'22px' }}>
            <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a', marginBottom:'6px' }}>Templates de mensagens</h2>
            <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'18px' }}>Variaveis disponíveis: {'{{cliente}}'} {'{{empresa}}'} {'{{data}}'} {'{{hora}}'} {'{{servico}}'}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {templates.map(t => {
                const corTipo: Record<string,string> = { confirmacao:'#2563eb', aniversario:'#f59e0b', massa:'#7c3aed' }
                const bgTipo:  Record<string,string> = { confirmacao:'#eff6ff', aniversario:'#fffbeb', massa:'#f5f3ff' }
                const iconTipo: Record<string,any> = {
                  confirmacao: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
                  aniversario:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                  massa:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                }
                return (
                  <div key={t.id} style={{ border:'1.5px solid #f0f0f8', borderRadius:'12px', overflow:'hidden' }}>
                    <div style={{ background:bgTipo[t.tipo]||'#f9fafb', padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px', borderBottom:'1px solid #f0f0f8' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'white', borderRadius:'99px', padding:'4px 10px', fontSize:'11px', fontWeight:'700', color:corTipo[t.tipo]||'#6b7280', border:'1px solid '+(corTipo[t.tipo]||'#e5e7eb')+'30' }}>
                        {iconTipo[t.tipo]} {t.tipo === 'confirmacao' ? 'Confirmacao' : t.tipo === 'aniversario' ? 'Aniversario' : 'Mensagem em Massa'}
                      </span>
                      <span style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>{t.nome}</span>
                      {t.tipo === 'massa' && (
                        <button onClick={enviarMassa} style={{ marginLeft:'auto', background:'#7c3aed', color:'white', border:'none', borderRadius:'8px', padding:'6px 14px', fontSize:'12px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                          Enviar para todos
                        </button>
                      )}
                    </div>
                    <div style={{ padding:'14px 16px' }}>
                      <TemplateEditor template={t} onSave={salvarTemplate}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Planos */}
      {aba==='planos' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
            <div>
              <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'2px' }}>Planos mensais</h2>
              <p style={{ fontSize:'13px', color:'#9ca3af' }}>{planos.filter(p=>p.status==='ativo').length} ativos</p>
            </div>
            <button onClick={abrirNovoPlano} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>+ Novo plano</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {planos.map(p=>(
              <div key={p.id} style={{ border:'1px solid #f0f0f8', borderRadius:'12px', padding:'16px 18px', opacity:p.status==='inativo'?0.6:1 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                      <p style={{ fontSize:'15px', fontWeight:'600', color:'#1a1a2e' }}>{p.nome}</p>
                      <span style={{ fontSize:'11px', fontWeight:'500', padding:'2px 8px', borderRadius:'99px', background:p.status==='ativo'?'#ecfdf5':'#f9fafb', color:p.status==='ativo'?'#10b981':'#9ca3af' }}>{p.status==='ativo'?'Ativo':'Inativo'}</span>
                    </div>
                    <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'8px' }}>{p.descricao}</p>
                    <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
                      <div><p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Valor mensal</p><p style={{ fontSize:'16px', fontWeight:'700', color:'#6366f1' }}>R$ {p.valor_mensal.toFixed(2).replace('.',',')}</p></div>
                      <div><p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Sessões</p><p style={{ fontSize:'16px', fontWeight:'700', color:'#1a1a2e' }}>{p.sessoes_mes===null?'?':p.sessoes_mes}/mês</p></div>
                      <div><p style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>Validade</p><p style={{ fontSize:'16px', fontWeight:'700', color:'#1a1a2e' }}>{p.validade_dias} dias</p></div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0, alignItems:'flex-start' }}>
                    <div onClick={()=>toggleStatusPlano(p)} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background:p.status==='ativo'?'#6366f1':'#e5e7eb', position:'relative', marginTop:'2px' }}>
                      <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left:p.status==='ativo'?'18px':'2px' }}/>
                    </div>
                    <button onClick={()=>abrirEdicaoPlano(p)} style={{ background:'white', border:'1.5px solid #c7d2fe', borderRadius:'10px', padding:'7px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'600', color:'#4f46e5', display:'inline-flex', alignItems:'center', gap:'6px', boxShadow:'0 1px 3px rgba(99,102,241,0.15)' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>
                    <button onClick={()=>deletarPlano(p.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'none', borderRadius:'6px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
            {planos.length===0 && <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af', fontSize:'14px' }}>Nenhum plano cadastrado.</div>}
          </div>
        </div>
      )}

      {/* Notificações */}
      {aba==='notificacoes' && (
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'24px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#1a1a2e', marginBottom:'6px' }}>Notificações</h2>
          <p style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'20px' }}>Configure quando notificar clientes e profissionais</p>
          {[
            { label:'Confirmação de agendamento por e-mail', desc:'Envia e-mail ao cliente quando agendado', ativo:true },
            { label:'Lembrete 24h antes', desc:'Lembra o cliente 1 dia antes', ativo:true },
            { label:'Lembrete 1h antes', desc:'Lembra o cliente 1 hora antes', ativo:true },
            { label:'Notificar profissional ao agendar', desc:'Avisa o profissional sobre novos agendamentos', ativo:false },
            { label:'Alerta de cancelamento', desc:'Notifica quando um agendamento é cancelado', ativo:false },
          ].map((n,i)=>(
            <div key={n.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid #f9fafb', gap:'12px' }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'14px', fontWeight:'500', color:'#1a1a2e', marginBottom:'2px' }}>{n.label}</p>
                <p style={{ fontSize:'12px', color:'#9ca3af' }}>{n.desc}</p>
              </div>
              <div style={{ width:'40px', height:'22px', borderRadius:'99px', cursor:'pointer', background:n.ativo?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                <div style={{ position:'absolute', top:'3px', width:'16px', height:'16px', borderRadius:'50%', background:'white', left:n.ativo?'21px':'3px' }}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botão salvar */}
      {(aba==='empresa'||aba==='horarios') && (
        <div style={{ marginTop:'20px', display:'flex', alignItems:'center', gap:'12px', justifyContent:'flex-end' }}>
          {salvo && <span style={{ fontSize:'13px', color:'#10b981', fontWeight:'500' }}>Salvo com sucesso!</span>}
          <button onClick={salvarEmpresa} disabled={salvando} style={{ background:salvando?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'10px 24px', fontSize:'14px', fontWeight:'500', cursor:salvando?'not-allowed':'pointer' }}>
            {salvando?'Salvando...':'Salvar configurações'}
          </button>
        </div>
      )}

      {/* Modal plano */}
      {modalPlano && (
        <div onClick={fecharModalPlano} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'500px', borderRadius:'20px 20px 0 0', padding:'24px 20px', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ width:'36px', height:'4px', background:'#e5e7eb', borderRadius:'99px', margin:'0 auto 16px' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'17px', fontWeight:'600', color:'#1a1a2e' }}>{modoEdicaoPlano ? 'Editar plano' : '+ Novo plano'}</h2>
              <button onClick={fecharModalPlano} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer' }}>?</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div><label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Nome *</label><input value={formPlano.nome} onChange={e=>setFormPlano(f=>({...f,nome:e.target.value}))} style={inputStyle} placeholder="Ex: Plano 4 sessões"/></div>
              <div><label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Descrição</label><input value={formPlano.descricao} onChange={e=>setFormPlano(f=>({...f,descricao:e.target.value}))} style={inputStyle} placeholder="Breve descrição"/></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div><label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Valor mensal (R$)</label><input type="number" value={formPlano.valor_mensal} onChange={e=>setFormPlano(f=>({...f,valor_mensal:e.target.value}))} style={inputStyle} placeholder="0,00"/></div>
                <div><label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Validade (dias)</label><input type="number" value={formPlano.validade_dias} onChange={e=>setFormPlano(f=>({...f,validade_dias:e.target.value}))} style={inputStyle} placeholder="30"/></div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'8px' }}>Sessões por mês</label>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                  <div onClick={()=>setFormPlano(f=>({...f,ilimitado:!f.ilimitado}))} style={{ width:'36px', height:'20px', borderRadius:'99px', cursor:'pointer', background:formPlano.ilimitado?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', left:formPlano.ilimitado?'18px':'2px' }}/>
                  </div>
                  <span style={{ fontSize:'13px', color:'#374151' }}>Ilimitado</span>
                </div>
                {!formPlano.ilimitado && <input type="number" value={formPlano.sessoes_mes} onChange={e=>setFormPlano(f=>({...f,sessoes_mes:e.target.value}))} style={inputStyle} placeholder="Ex: 4"/>}
              </div>
              <div><label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Status</label>
                <select value={formPlano.status} onChange={e=>setFormPlano(f=>({...f,status:e.target.value}))} style={{ ...inputStyle, padding:'9px 12px' }}>
                  <option value="ativo">Ativo</option><option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            {erroPlano && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#dc2626' }}>{erroPlano}</div>}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'20px' }}>
              {modoEdicaoPlano&&planoSel?<button onClick={()=>deletarPlano(planoSel.id)} style={{ background:'#fef2f2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>🗑 Excluir</button>:<div/>}
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={fecharModalPlano} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                <button onClick={salvarPlano} disabled={salvandoPlano} style={{ background:salvandoPlano?'#a5b4fc':'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'500', cursor:salvandoPlano?'not-allowed':'pointer' }}>
                  {salvandoPlano?'Salvando...':modoEdicaoPlano?'Salvar alterações':'Criar plano'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
