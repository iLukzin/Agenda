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
  const [qrCode, setQrCode] = useState('')
  const [statusConexao, setStatusConexao] = useState<'desconectado'|'aguardando'|'conectado'>('desconectado')
  const [buscandoQr, setBuscandoQr] = useState(false)
  const [autoConfirmacao, setAutoConfirmacao] = useState(false)
  const [autoAniversario, setAutoAniversario] = useState(false)

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
      setAutoConfirmacao(emp.data.wpp_auto_confirmacao||false)
      setAutoAniversario(emp.data.wpp_auto_aniversario||false)
    }
    if (pls.data) setPlanos(pls.data as Plano[])
    if (tmpl.data) setTemplates(tmpl.data)
    // Criar templates padrão se nao existirem
    if (tmpl.data && tmpl.data.length === 0) {
      const sb3 = createClient()
      const nl = String.fromCharCode(10)
      const msgConf  = 'Ola {{cliente}}! Tudo bem?' + nl + nl + 'Confirmando seu horario:' + nl + '*Data:* {{data}}' + nl + '*Horario:* {{hora}}' + nl + '*Servico:* {{servico}}' + nl + nl + 'Pode confirmar? Responda Sim ou Nao.'
      const msgAniv  = 'Ola {{cliente}}! Parabens pelo seu aniversario!' + nl + nl + 'A equipe da *{{empresa}}* deseja a voce um dia incrivel!' + nl + nl + 'Muitas felicidades!'
      const msgMassa = 'Ola {{cliente}}!' + nl + nl + 'Temos novidades especiais para voce.' + nl + nl + '*{{empresa}}*'
      await sb3.from('mensagens_template').insert([
        { empresa_id:empresaAtiva.id, tipo:'confirmacao', nome:'Confirmacao de Horario', mensagem:msgConf, ativo:true },
        { empresa_id:empresaAtiva.id, tipo:'aniversario', nome:'Parabens Aniversario', mensagem:msgAniv, ativo:true },
        { empresa_id:empresaAtiva.id, tipo:'massa', nome:'Mensagem em Massa', mensagem:msgMassa, ativo:true },
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
      wpp_auto_confirmacao: autoConfirmacao,
      wpp_auto_aniversario: autoAniversario,
    }).eq('id', empresaAtiva.id)
    if (error) { setMsgWpp('Erro: ' + error.message) }
    else { setMsgWpp('Configuracao salva!'); setTimeout(()=>setMsgWpp(''), 3000) }
    setSalvandoWpp(false)
  }

  async function buscarQrCode() {
    if (!wpp.api_url || !wpp.api_token || !wpp.instancia) {
      setMsgWpp('Preencha a URL, Token e Instancia antes de conectar.')
      return
    }
    setBuscandoQr(true); setQrCode(''); setStatusConexao('aguardando'); setMsgWpp('')
    try {
      // Verificar status primeiro
      const urlStatus = wpp.api_url.replace(/\/$/, '') + '/instance/connectionState/' + wpp.instancia
      const resStatus = await fetch(urlStatus, { headers: { apikey: wpp.api_token } })
      if (resStatus.ok) {
        const dataStatus = await resStatus.json()
        const state = dataStatus?.instance?.state || dataStatus?.state || ''
        if (state === 'open' || state === 'connected') {
          setStatusConexao('conectado'); setMsgWpp('WhatsApp ja esta conectado!'); setBuscandoQr(false); return
        }
      }
      // Buscar QR code
      const urlQr = wpp.api_url.replace(/\/$/, '') + '/instance/connect/' + wpp.instancia
      const resQr = await fetch(urlQr, { headers: { apikey: wpp.api_token } })
      if (resQr.ok) {
        const dataQr = await resQr.json()
        const qr = dataQr?.qrcode?.base64 || dataQr?.base64 || dataQr?.qr || ''
        if (qr) {
          setQrCode(qr.startsWith('data:') ? qr : 'data:image/png;base64,' + qr)
          setStatusConexao('aguardando')
          // Verificar conexao a cada 3 segundos por 60 segundos
          let tentativas = 0
          const intervalo = setInterval(async () => {
            tentativas++
            if (tentativas > 20) { clearInterval(intervalo); setBuscandoQr(false); return }
            const r2 = await fetch(urlStatus, { headers: { apikey: wpp.api_token } })
            if (r2.ok) {
              const d2 = await r2.json()
              const s2 = d2?.instance?.state || d2?.state || ''
              if (s2 === 'open' || s2 === 'connected') {
                clearInterval(intervalo); setStatusConexao('conectado'); setQrCode(''); setMsgWpp('Conectado com sucesso!'); setBuscandoQr(false)
              }
            }
          }, 3000)
        } else {
          setMsgWpp('QR code nao retornado. Verifique a instancia.')
          setBuscandoQr(false); setStatusConexao('desconectado')
        }
      } else {
        const err = await resQr.text()
        setMsgWpp('Erro: ' + err.slice(0, 80)); setBuscandoQr(false); setStatusConexao('desconectado')
      }
    } catch (ex: any) {
      setMsgWpp('Erro de conexao: ' + ex.message); setBuscandoQr(false); setStatusConexao('desconectado')
    }
  }

  async function desconectarWpp() {
    if (!wpp.api_url || !wpp.instancia) return
    try {
      const url = wpp.api_url.replace(/\/$/, '') + '/instance/logout/' + wpp.instancia
      await fetch(url, { method: 'DELETE', headers: { apikey: wpp.api_token } })
      setStatusConexao('desconectado'); setQrCode(''); setMsgWpp('Desconectado.')
    } catch { setMsgWpp('Erro ao desconectar.') }
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

          {/* Status da Conexao */}
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'18px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:statusConexao==='conectado'?'#dcfce7':statusConexao==='aguardando'?'#fef9c3':'#fef2f2', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {statusConexao === 'conectado'
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/></svg>
                    : statusConexao === 'aguardando'
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                </div>
                <div>
                  <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#0f172a' }}>Status da Conexao</h3>
                  <p style={{ fontSize:'12px', color:statusConexao==='conectado'?'#16a34a':statusConexao==='aguardando'?'#ca8a04':'#dc2626', fontWeight:'600' }}>
                    {statusConexao === 'conectado' ? 'Conectado' : statusConexao === 'aguardando' ? 'Aguardando scan...' : 'Desconectado'}
                  </p>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                {statusConexao === 'conectado'
                  ? <button onClick={desconectarWpp} style={{ background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>Desconectar</button>
                  : <button onClick={buscarQrCode} disabled={buscandoQr} style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'700', cursor:buscandoQr?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
                      {buscandoQr ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation:'spin .7s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>Conectando...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>Conectar WhatsApp</>}
                    </button>}
              </div>
            </div>

            {/* QR Code */}
            {qrCode && statusConexao === 'aguardando' && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'20px', background:'#f8faff', borderRadius:'12px', border:'2px dashed #c7d2fe' }}>
                <p style={{ fontSize:'14px', fontWeight:'600', color:'#4f46e5', marginBottom:'16px', textAlign:'center' }}>
                  Abra o WhatsApp no celular e escaneie o QR Code
                </p>
                <div style={{ background:'white', padding:'16px', borderRadius:'12px', boxShadow:'0 4px 16px rgba(0,0,0,0.1)' }}>
                  <img src={qrCode} alt="QR Code WhatsApp" style={{ width:'220px', height:'220px', display:'block' }}/>
                </div>
                <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'14px', textAlign:'center' }}>
                  WhatsApp > Aparelhos conectados > Conectar aparelho
                </p>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'8px' }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#f59e0b', animation:'pulse 1.5s infinite' }}/>
                  <span style={{ fontSize:'12px', color:'#f59e0b', fontWeight:'600' }}>Aguardando scan...</span>
                </div>
              </div>
            )}
            {statusConexao === 'conectado' && (
              <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <p style={{ fontSize:'13px', fontWeight:'600', color:'#16a34a' }}>WhatsApp conectado e pronto para enviar mensagens!</p>
              </div>
            )}
          </div>

          {/* Configuracao API */}
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
            <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>Configuracao da API</h3>
            <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'16px' }}>Compatible com Evolution API, Z-API e WPPConnect</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f9fafb', borderRadius:'10px', padding:'12px 14px' }}>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>Ativar WhatsApp</p>
                  <p style={{ fontSize:'11px', color:'#9ca3af' }}>Habilitar envio de mensagens</p>
                </div>
                <div onClick={()=>setWpp(p=>({...p,ativo:!p.ativo}))} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:wpp.ativo?'#22c55e':'#e5e7eb', position:'relative' }}>
                  <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left .2s', left:wpp.ativo?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                </div>
              </div>
              {[{l:'URL da API',k:'api_url',ph:'https://api.seuservidor.com.br',t:'text'},{l:'API Key / Token',k:'api_token',ph:'sua-chave-api-aqui',t:'password'},{l:'Nome da Instancia',k:'instancia',ph:'minha-instancia',t:'text'}].map(f=>(
                <div key={f.k}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>{f.l}</label>
                  <input type={f.t} value={(wpp as any)[f.k]} onChange={e=>setWpp(p=>({...p,[f.k]:e.target.value}))}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }}
                    placeholder={f.ph}
                    onFocus={e=>{(e.target as HTMLInputElement).style.borderColor='#6366f1'}}
                    onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='#e5e7eb'}}/>
                </div>
              ))}
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:'160px' }}>
                  <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Numero para teste</label>
                  <input value={testeNum} onChange={e=>setTesteNum(e.target.value)}
                    style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }}
                    placeholder="(34) 99999-9999"
                    onFocus={e=>{(e.target as HTMLInputElement).style.borderColor='#6366f1'}}
                    onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='#e5e7eb'}}/>
                </div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:'8px' }}>
                  <button onClick={testarWpp} disabled={testando} style={{ background:'#f0fdf4', color:'#16a34a', border:'1.5px solid #86efac', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
                    {testando ? 'Enviando...' : 'Testar'}
                  </button>
                  <button onClick={salvarWpp} disabled={salvandoWpp} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
                    {salvandoWpp ? 'Salvando...' : 'Salvar config'}
                  </button>
                </div>
              </div>
            </div>
            {msgWpp && <div style={{ marginTop:'12px', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', background:msgWpp.startsWith('Erro')?'#fef2f2':'#f0fdf4', color:msgWpp.startsWith('Erro')?'#dc2626':'#16a34a', border:'1px solid '+(msgWpp.startsWith('Erro')?'#fecaca':'#bbf7d0') }}>{msgWpp}</div>}
          </div>

          {/* Automacao */}
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
            <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>Envios automaticos</h3>
            <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'16px' }}>Configure quais mensagens serao enviadas automaticamente</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { label:'Confirmacao de agendamento', desc:'Enviar automaticamente ao criar um novo agendamento', val:autoConfirmacao, set:setAutoConfirmacao, icon:'check', cor:'#2563eb' },
                { label:'Parabens de aniversario', desc:'Enviar mensagem no dia do aniversario do cliente', val:autoAniversario, set:setAutoAniversario, icon:'cake', cor:'#f59e0b' },
              ].map(item => (
                <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:item.val?'#f0f9ff':'#f9fafb', borderRadius:'12px', padding:'14px 16px', border:item.val?'1.5px solid #bae6fd':'1px solid #e5e7eb', transition:'all .15s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:item.val?item.cor+'15':'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {item.icon === 'check'
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.val?item.cor:'#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.val?item.cor:'#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                    </div>
                    <div>
                      <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827' }}>{item.label}</p>
                      <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'1px' }}>{item.desc}</p>
                    </div>
                  </div>
                  <div onClick={()=>item.set(!item.val)} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:item.val?item.cor:'#e5e7eb', position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left .2s', left:item.val?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                  </div>
                </div>
              ))}
              <button onClick={salvarWpp} disabled={salvandoWpp} style={{ alignSelf:'flex-end', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'13px', fontWeight:'700', cursor:'pointer', marginTop:'4px' }}>
                {salvandoWpp ? 'Salvando...' : 'Salvar automacoes'}
              </button>
            </div>
          </div>

          {/* Templates */}
          <div style={{ background:'white', borderRadius:'14px', border:'1px solid #f0f0f8', padding:'20px' }}>
            <h3 style={{ fontSize:'15px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>Templates de mensagens</h3>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'14px' }}>
              {['{{cliente}}','{{empresa}}','{{data}}','{{hora}}','{{servico}}'].map(v => (
                <span key={v} style={{ background:'#eef2ff', color:'#4f46e5', borderRadius:'6px', padding:'3px 8px', fontSize:'11px', fontWeight:'700', fontFamily:'monospace' }}>{v}</span>
              ))}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {templates.map(t => {
                const meta: Record<string,any> = {
                  confirmacao: { label:'Confirmacao de agendamento', cor:'#2563eb', bg:'#eff6ff', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17z"/></svg> },
                  aniversario:  { label:'Parabens de aniversario', cor:'#f59e0b', bg:'#fffbeb', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
                  massa:        { label:'Mensagem em massa', cor:'#7c3aed', bg:'#f5f3ff', icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
                }
                const m = meta[t.tipo] || meta['massa']
                return (
                  <div key={t.id} style={{ border:'1.5px solid #f0f0f8', borderRadius:'12px', overflow:'hidden' }}>
                    <div style={{ background:m.bg, padding:'11px 16px', display:'flex', alignItems:'center', gap:'8px', borderBottom:'1px solid #f0f0f8' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'white', borderRadius:'99px', padding:'4px 10px', fontSize:'11px', fontWeight:'700', color:m.cor, border:'1px solid '+m.cor+'30' }}>
                        {m.icon} {m.label}
                      </span>
                      {t.tipo === 'massa' && (
                        <button onClick={enviarMassa} style={{ marginLeft:'auto', background:m.cor, color:'white', border:'none', borderRadius:'7px', padding:'5px 12px', fontSize:'11px', fontWeight:'600', cursor:'pointer' }}>
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

      {/* Planos */}      {/* Planos */}
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
