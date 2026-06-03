'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import { aplicarVariaveis } from '@/lib/whatsapp'

type Campanha = { id:string; nome:string; mensagem:string; status:string; agendado_para:string|null; enviado_em:string|null; total_contatos:number; total_enviado:number; total_erro:number; envio_automatico:boolean; clientes_ids:string[]|null }

const inp = { width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'10px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function MensagensPage() {
  const { empresaAtiva } = useEmpresa()
  const router = useRouter()

  useEffect(() => {
    if (empresaAtiva && !empresaAtiva.whatsapp_habilitado) router.replace('/dashboard/agenda')
  }, [empresaAtiva, router])

  const [campanhas, setCampanhas] = useState([] as Campanha[])
  const [clientes, setClientes] = useState([] as any[])
  const [carregando, setCarregando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [enviandoCamp, setEnviandoCamp] = useState(null as string|null) // id da campanha sendo enviada
  const [progresso, setProgresso] = useState(0)
  const [msgStatus, setMsgStatus] = useState('')
  const [apiConfig, setApiConfig] = useState({ url:'', key:'', instancia:'' })

  // Form da campanha
  const [form, setForm] = useState({
    nome: '',
    mensagem: '',
    agendado_para: '',
    agendamento: false,
    envio_automatico: false,
    destinatarios: 'todos' as 'todos' | 'selecionar',
    clientes_selecionados: [] as string[],
  })
  const [busca, setBusca] = useState('')
  const [preview, setPreview] = useState('')
  const [campDetalhes, setCampDetalhes] = useState(null as Campanha|null)
  const [logEnvio, setLogEnvio] = useState([] as any[])
  const [carregandoLog, setCarregandoLog] = useState(false)

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    const [camp, cli, cfg, emp] = await Promise.all([
      sb.from('campanhas_mensagem').select('*').eq('empresa_id', empresaAtiva.id).order('created_at', { ascending: false }),
      sb.from('clientes').select('id,nome,whatsapp,telefone').eq('empresa_id', empresaAtiva.id).eq('status','ativo').order('nome'),
      sb.from('config_sistema').select('chave,valor').in('chave', ['evolution_api_url','evolution_api_key']),
      sb.from('empresas').select('whatsapp_instancia').eq('id', empresaAtiva.id).single(),
    ])
    setCampanhas(camp.data || [])
    setClientes(cli.data || [])
    const cfgMap: any = {}
    if (cfg.data) cfg.data.forEach((c: any) => { cfgMap[c.chave] = c.valor || '' })
    const inst = emp.data?.whatsapp_instancia || ('emp-' + empresaAtiva.id.slice(0,8))
    setApiConfig({ url: cfgMap['evolution_api_url']||'', key: cfgMap['evolution_api_key']||'', instancia: inst })
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    const ex = clientes[0]
    if (!ex || !form.mensagem) return
    setPreview(aplicarVariaveis(form.mensagem, { cliente: ex.nome || 'Cliente', empresa: empresaAtiva?.nome || '' }))
  }, [form.mensagem, clientes, empresaAtiva])

  function clientesFiltrados() {
    const s = busca.toLowerCase()
    return clientes.filter(c => c.nome.toLowerCase().includes(s) || (c.whatsapp||'').includes(s) || (c.telefone||'').includes(s))
  }

  function toggleCliente(id: string) {
    setForm(f => ({
      ...f,
      clientes_selecionados: f.clientes_selecionados.includes(id)
        ? f.clientes_selecionados.filter(x => x !== id)
        : [...f.clientes_selecionados, id]
    }))
  }

  async function abrirDetalhes(c: Campanha) {
    setCampDetalhes(c)
    setCarregandoLog(true)
    const sb = createClient()
    const { data } = await sb.from('campanha_log').select('*').eq('campanha_id', c.id).order('enviado_em')
    setLogEnvio(data || [])
    setCarregandoLog(false)
  }

  function fecharDetalhes() { setCampDetalhes(null); setLogEnvio([]) }

  function fecharModal() {
    setModalAberto(false)
    setForm({ nome:'', mensagem:'', agendado_para:'', agendamento:false, envio_automatico:false, destinatarios:'todos', clientes_selecionados:[] })
    setBusca('')
    setProgresso(0)
    setMsgStatus('')
  }

  function getDestinatarios(campanha?: Campanha) {
    if (campanha) {
      if (campanha.clientes_ids && campanha.clientes_ids.length > 0) {
        return clientes.filter(c => campanha.clientes_ids!.includes(c.id) && (c.whatsapp || c.telefone))
      }
      return clientes.filter(c => c.whatsapp || c.telefone)
    }
    if (form.destinatarios === 'selecionar') {
      return clientes.filter(c => form.clientes_selecionados.includes(c.id) && (c.whatsapp || c.telefone))
    }
    return clientes.filter(c => c.whatsapp || c.telefone)
  }

  async function enviarCampanha(campanha: Campanha) {
    if (!apiConfig.url || !apiConfig.key) { alert('Configure a Evolution API em Configuracoes.'); return }
    const dest = getDestinatarios(campanha)
    if (dest.length === 0) { alert('Nenhum cliente com numero cadastrado.'); return }
    if (!confirm(`Enviar para ${dest.length} clientes?`)) return

    setEnviandoCamp(campanha.id)
    setProgresso(0)
    const sb = createClient()
    await sb.from('campanhas_mensagem').update({ status: 'enviando' }).eq('id', campanha.id)

    let enviados = 0, erros = 0
    for (let i = 0; i < dest.length; i++) {
      const c = dest[i]
      const num = (c.whatsapp || c.telefone).replace(/\D/g,'')
      const numFmt = num.startsWith('55') ? num : '55' + num
      const msg = aplicarVariaveis(campanha.mensagem, { cliente: c.nome, empresa: empresaAtiva?.nome || '' })
      try {
        const res = await fetch(apiConfig.url.replace(/\/$/, '') + '/message/sendText/' + apiConfig.instancia, {
          method: 'POST',
          headers: { 'apikey': apiConfig.key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: numFmt, options:{ delay:500 }, text: msg }),
        })
        if (res.ok) {
          enviados++
          await sb.from('campanha_log').insert({ campanha_id: campanha.id, empresa_id: empresaAtiva?.id, cliente_id: c.id, nome: c.nome, numero: numFmt, mensagem: msg, status: 'enviado' })
        } else {
          erros++
          const errTxt = await res.text().catch(()=>'Erro HTTP '+res.status)
          await sb.from('campanha_log').insert({ campanha_id: campanha.id, empresa_id: empresaAtiva?.id, cliente_id: c.id, nome: c.nome, numero: numFmt, mensagem: msg, status: 'erro', erro_msg: errTxt.slice(0,200) })
        }
      } catch { erros++ }
      setProgresso(Math.round((i+1)/dest.length*100))
      await new Promise(r => setTimeout(r, 600))
    }
    await sb.from('campanhas_mensagem').update({ status:'concluida', enviado_em:new Date().toISOString(), total_enviado:enviados, total_erro:erros }).eq('id', campanha.id)
    setEnviandoCamp(null)
    setProgresso(0)
    alert(`Concluido: ${enviados} enviados, ${erros} erros.`)
    await carregar()
  }

  async function salvarCampanha() {
    if (!empresaAtiva?.id || !form.nome.trim() || !form.mensagem.trim()) return
    const dest = getDestinatarios()
    if (dest.length === 0) { setMsgStatus('Nenhum cliente com numero cadastrado.'); return }

    const sb = createClient()
    const clientesIds = form.destinatarios === 'selecionar' ? form.clientes_selecionados : null

    if (form.agendamento && form.agendado_para) {
      await sb.from('campanhas_mensagem').insert({
        empresa_id: empresaAtiva.id, nome: form.nome, mensagem: form.mensagem,
        status: 'agendada', agendado_para: form.agendado_para,
        total_contatos: dest.length, total_enviado: 0, total_erro: 0,
        envio_automatico: form.envio_automatico,
        clientes_ids: clientesIds,
      })
      setMsgStatus('Campanha agendada!')
      fecharModal()
      await carregar()
      return
    }

    // Envio imediato
    if (!apiConfig.url || !apiConfig.key) { setMsgStatus('Configure a Evolution API em Configuracoes.'); return }
    if (!confirm(`Enviar para ${dest.length} clientes?`)) return

    setMsgStatus('')
    const { data: camp } = await sb.from('campanhas_mensagem').insert({
      empresa_id: empresaAtiva.id, nome: form.nome, mensagem: form.mensagem,
      status: 'enviando', total_contatos: dest.length, total_enviado: 0, total_erro: 0,
      envio_automatico: false, clientes_ids: clientesIds,
    }).select().single()
    if (!camp) return

    setEnviandoCamp(camp.id)
    setProgresso(0)

    let enviados = 0, erros = 0
    for (let i = 0; i < dest.length; i++) {
      const c = dest[i]
      const num = (c.whatsapp || c.telefone).replace(/\D/g,'')
      const numFmt = num.startsWith('55') ? num : '55' + num
      const msg = aplicarVariaveis(form.mensagem, { cliente: c.nome, empresa: empresaAtiva.nome || '' })
      try {
        const res = await fetch(apiConfig.url.replace(/\/$/, '') + '/message/sendText/' + apiConfig.instancia, {
          method: 'POST',
          headers: { 'apikey': apiConfig.key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: numFmt, options:{ delay:500 }, text: msg }),
        })
        if (res.ok) {
          enviados++
          await sb.from('campanha_log').insert({ campanha_id: camp.id, empresa_id: empresaAtiva.id, cliente_id: c.id, nome: c.nome, numero: numFmt, mensagem: msg, status: 'enviado' })
        } else {
          erros++
          const errTxt = await res.text().catch(()=>'Erro HTTP '+res.status)
          await sb.from('campanha_log').insert({ campanha_id: camp.id, empresa_id: empresaAtiva.id, cliente_id: c.id, nome: c.nome, numero: numFmt, mensagem: msg, status: 'erro', erro_msg: errTxt.slice(0,200) })
        }
      } catch { erros++ }
      setProgresso(Math.round((i+1)/dest.length*100))
      await new Promise(r => setTimeout(r, 600))
    }
    await sb.from('campanhas_mensagem').update({ status:'concluida', enviado_em:new Date().toISOString(), total_enviado:enviados, total_erro:erros }).eq('id', camp.id)
    setEnviandoCamp(null)
    setProgresso(0)
    setMsgStatus(`Concluido: ${enviados} enviados, ${erros} erros.`)
    await carregar()
  }

  const statusCor: any = { agendada:'#f59e0b', enviando:'#2563eb', concluida:'#10b981', erro:'#ef4444' }
  const statusBg:  any = { agendada:'#fffbeb', enviando:'#eff6ff', concluida:'#f0fdf4', erro:'#fef2f2' }
  const destCount = getDestinatarios().length
  const todosComNum = clientes.filter(c => c.whatsapp || c.telefone).length

  return (
    <div style={{ padding:'16px', minHeight:'100vh', background:'#f4f5fb' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px' }}>Mensagens WhatsApp</h1>
          <p style={{ fontSize:'13px', color:'#6b7280', marginTop:'2px' }}>{todosComNum} clientes com numero cadastrado</p>
        </div>
        <button onClick={()=>setModalAberto(true)} style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', color:'white', border:'none', borderRadius:'10px', padding:'10px 18px', fontSize:'14px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova campanha
        </button>
      </div>

      {/* Lista de campanhas */}
      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : campanhas.length === 0 ? (
        <div style={{ background:'white', borderRadius:'14px', padding:'48px 24px', textAlign:'center', border:'1px solid #f0f0f8' }}>
          <p style={{ fontSize:'15px', fontWeight:'600', color:'#374151', marginBottom:'6px' }}>Nenhuma campanha criada</p>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>Crie sua primeira campanha de mensagens em massa</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {campanhas.map(c => (
            <div key={c.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
                <div style={{ flex:1, minWidth:'200px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                    <p style={{ fontSize:'15px', fontWeight:'700', color:'#111827' }}>{c.nome}</p>
                    <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'99px', background:statusBg[c.status]||'#f3f4f6', color:statusCor[c.status]||'#6b7280' }}>
                      {c.status}
                    </span>
                    {c.envio_automatico && (
                      <span style={{ fontSize:'11px', fontWeight:'600', padding:'2px 8px', borderRadius:'99px', background:'#eef2ff', color:'#6366f1' }}>Auto</span>
                    )}
                    {c.clientes_ids && c.clientes_ids.length > 0 && (
                      <span style={{ fontSize:'11px', color:'#6b7280' }}>{c.clientes_ids.length} clientes selecionados</span>
                    )}
                  </div>
                  <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'6px' }}>{c.mensagem.slice(0,80)}{c.mensagem.length > 80 ? '...' : ''}</p>
                  <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
                    {c.agendado_para && <span style={{ fontSize:'11px', color:'#6b7280' }}>Agendado: {new Date(c.agendado_para).toLocaleString('pt-BR')}</span>}
                    {c.enviado_em && <span style={{ fontSize:'11px', color:'#6b7280' }}>Enviado: {new Date(c.enviado_em).toLocaleString('pt-BR')}</span>}
                    {c.total_contatos > 0 && (
                      <span style={{ fontSize:'11px', color:'#6b7280' }}>
                        {c.total_enviado}/{c.total_contatos} enviados {c.total_erro > 0 ? `· ${c.total_erro} erros` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center', flexShrink:0 }}>
                  <button onClick={()=>abrirDetalhes(c)} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'6px 12px', fontSize:'12px', fontWeight:'600', color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Log
                  </button>
                  {c.status !== 'concluida' && c.status !== 'enviando' && (
                    <button
                      onClick={()=>enviarCampanha(c)}
                      disabled={enviandoCamp === c.id}
                      style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      {enviandoCamp === c.id ? `${progresso}%` : 'Enviar'}
                    </button>
                  )}
                  {c.status === 'concluida' && c.total_contatos > 0 && (
                    <div style={{ background:'#f0fdf4', borderRadius:'8px', padding:'6px 12px', textAlign:'center' }}>
                      <p style={{ fontSize:'16px', fontWeight:'800', color:'#10b981', lineHeight:1 }}>{Math.round(c.total_enviado/c.total_contatos*100)}%</p>
                      <p style={{ fontSize:'10px', color:'#6b7280' }}>taxa envio</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Barra de progresso se enviando */}
              {enviandoCamp === c.id && (
                <div style={{ marginTop:'10px' }}>
                  <div style={{ background:'#bfdbfe', borderRadius:'99px', height:'6px', overflow:'hidden' }}>
                    <div style={{ background:'#2563eb', height:'100%', width:progresso+'%', borderRadius:'99px', transition:'width 0.3s' }}/>
                  </div>
                  <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'4px' }}>Enviando... {progresso}% — nao feche esta aba</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal nova campanha */}
      {modalAberto && (
        <div onClick={()=>fecharModal()} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'600px', borderRadius:'20px', maxHeight:'92vh', overflowY:'auto', padding:'22px 20px', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
              <div>
                <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a' }}>Nova campanha</h2>
                <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'2px' }}>{destCount} destinatarios selecionados</p>
              </div>
              <button onClick={fecharModal} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px' }}>×</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {/* Nome */}
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Nome da campanha *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} style={inp} placeholder="Ex: Promocao de junho"/>
              </div>

              {/* Mensagem */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                  <label style={{ fontSize:'12px', fontWeight:'600', color:'#374151' }}>Mensagem *</label>
                  <div style={{ display:'flex', gap:'4px' }}>
                    {['{{cliente}}','{{empresa}}'].map(v => (
                      <button key={v} onClick={()=>setForm(f=>({...f,mensagem:f.mensagem+v}))} style={{ background:'#eef2ff', border:'none', borderRadius:'4px', padding:'2px 6px', fontSize:'11px', color:'#6366f1', cursor:'pointer' }}>{v}</button>
                    ))}
                  </div>
                </div>
                <textarea value={form.mensagem} onChange={e=>setForm(f=>({...f,mensagem:e.target.value}))} rows={4}
                  style={{ ...inp, resize:'vertical', fontFamily:'inherit', lineHeight:'1.6' }}
                  placeholder="Ola {{cliente}}! Temos uma novidade especial para voce..."/>
              </div>

              {/* Preview */}
              {preview && (
                <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'12px 14px', border:'1px solid #bbf7d0' }}>
                  <p style={{ fontSize:'11px', fontWeight:'600', color:'#16a34a', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.04em' }}>Preview</p>
                  <p style={{ fontSize:'13px', color:'#374151', lineHeight:'1.6', whiteSpace:'pre-wrap' }}>{preview}</p>
                </div>
              )}

              {/* Destinatários */}
              <div style={{ background:'#f9fafb', borderRadius:'10px', padding:'12px 14px', border:'1px solid #e5e7eb' }}>
                <p style={{ fontSize:'12px', fontWeight:'700', color:'#374151', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.04em' }}>Destinatarios</p>
                <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                  {([['todos','Todos os clientes'],['selecionar','Selecionar clientes']] as const).map(([val, label]) => (
                    <button key={val} onClick={()=>setForm(f=>({...f,destinatarios:val,clientes_selecionados:[]}))}
                      style={{ flex:1, padding:'8px', borderRadius:'8px', border:`2px solid ${form.destinatarios===val?'#6366f1':'#e5e7eb'}`, background:form.destinatarios===val?'#eef2ff':'white', color:form.destinatarios===val?'#6366f1':'#374151', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {form.destinatarios === 'selecionar' && (
                  <div>
                    <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente..." style={{ ...inp, marginBottom:'8px', padding:'7px 10px', fontSize:'13px' }}/>
                    <div style={{ maxHeight:'160px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'4px' }}>
                      {clientesFiltrados().filter(c=>c.whatsapp||c.telefone).map(c => (
                        <label key={c.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 8px', borderRadius:'7px', cursor:'pointer', background:form.clientes_selecionados.includes(c.id)?'#eef2ff':'white', border:`1px solid ${form.clientes_selecionados.includes(c.id)?'#c7d2fe':'#f0f0f8'}` }}>
                          <input type="checkbox" checked={form.clientes_selecionados.includes(c.id)} onChange={()=>toggleCliente(c.id)} style={{ accentColor:'#6366f1' }}/>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827' }}>{c.nome}</p>
                            <p style={{ fontSize:'11px', color:'#6b7280' }}>{c.whatsapp || c.telefone}</p>
                          </div>
                        </label>
                      ))}
                      {clientesFiltrados().filter(c=>c.whatsapp||c.telefone).length === 0 && (
                        <p style={{ fontSize:'13px', color:'#9ca3af', textAlign:'center', padding:'12px' }}>Nenhum cliente com numero encontrado</p>
                      )}
                    </div>
                    {form.clientes_selecionados.length > 0 && (
                      <p style={{ fontSize:'12px', color:'#6366f1', fontWeight:'600', marginTop:'6px' }}>{form.clientes_selecionados.length} cliente(s) selecionado(s)</p>
                    )}
                  </div>
                )}
              </div>

              {/* Agendamento */}
              <div style={{ background:'#f9fafb', borderRadius:'10px', padding:'12px 14px', border:'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: form.agendamento ? '10px' : '0' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>Agendar para depois</p>
                    <p style={{ fontSize:'11px', color:'#9ca3af' }}>Define data e hora de envio</p>
                  </div>
                  <div onClick={()=>setForm(f=>({...f,agendamento:!f.agendamento,envio_automatico:false}))} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:form.agendamento?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                    <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', left:form.agendamento?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s' }}/>
                  </div>
                </div>
                {form.agendamento && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    <input type="datetime-local" value={form.agendado_para} onChange={e=>setForm(f=>({...f,agendado_para:e.target.value}))} style={inp}/>
                    {/* Envio automático */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#eef2ff', borderRadius:'8px' }}>
                      <div>
                        <p style={{ fontSize:'13px', fontWeight:'600', color:'#4f46e5' }}>Envio automatico</p>
                        <p style={{ fontSize:'11px', color:'#6b7280' }}>Envia automaticamente na data/hora agendada</p>
                      </div>
                      <div onClick={()=>setForm(f=>({...f,envio_automatico:!f.envio_automatico}))} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:form.envio_automatico?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                        <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', left:form.envio_automatico?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)', transition:'left 0.2s' }}/>
                      </div>
                    </div>
                    {!form.envio_automatico && (
                      <p style={{ fontSize:'11px', color:'#9ca3af' }}>Com envio manual: a campanha ficara salva e voce clica em "Enviar" quando quiser.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Progresso */}
              {enviandoCamp && (
                <div style={{ background:'#eff6ff', borderRadius:'10px', padding:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                    <p style={{ fontSize:'13px', fontWeight:'600', color:'#1d4ed8' }}>Enviando mensagens...</p>
                    <p style={{ fontSize:'13px', fontWeight:'700', color:'#1d4ed8' }}>{progresso}%</p>
                  </div>
                  <div style={{ background:'#bfdbfe', borderRadius:'99px', height:'8px', overflow:'hidden' }}>
                    <div style={{ background:'#2563eb', height:'100%', width:progresso+'%', borderRadius:'99px', transition:'width 0.3s' }}/>
                  </div>
                  <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'6px' }}>Nao feche esta janela</p>
                </div>
              )}

              {msgStatus && (
                <div style={{ padding:'10px 14px', borderRadius:'8px', fontSize:'13px', background: msgStatus.includes('erro')||msgStatus.includes('Configure') ? '#fef2f2' : '#f0fdf4', color: msgStatus.includes('erro')||msgStatus.includes('Configure') ? '#dc2626' : '#16a34a', border:`1px solid ${msgStatus.includes('erro')||msgStatus.includes('Configure')?'#fecaca':'#bbf7d0'}` }}>
                  {msgStatus}
                </div>
              )}

              {!enviandoCamp && (
                <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
                  <button onClick={fecharModal} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 16px', fontSize:'14px', cursor:'pointer' }}>Cancelar</button>
                  <button onClick={salvarCampanha}
                    disabled={!form.nome||!form.mensagem||(form.destinatarios==='selecionar'&&form.clientes_selecionados.length===0)||(form.agendamento&&!form.agendado_para)}
                    style={{ flex:1, background:'linear-gradient(135deg,#25d366,#128c7e)', color:'white', border:'none', borderRadius:'8px', padding:'9px 20px', fontSize:'14px', fontWeight:'600', cursor:'pointer', opacity:(!form.nome||!form.mensagem)?0.5:1 }}>
                    {form.agendamento ? (form.envio_automatico ? '📅 Agendar (automatico)' : '📋 Salvar campanha') : `📤 Enviar agora para ${destCount} clientes`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de log da campanha */}
      {campDetalhes && (
        <div onClick={fecharDetalhes} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'620px', borderRadius:'20px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ padding:'20px 20px 14px', borderBottom:'1px solid #f0f0f8' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <h2 style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a' }}>Log: {campDetalhes.nome}</h2>
                  <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'3px' }}>
                    {logEnvio.filter(l=>l.status==='enviado').length} enviados · {logEnvio.filter(l=>l.status==='erro').length} erros · {logEnvio.length} total
                  </p>
                </div>
                <button onClick={fecharDetalhes} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px' }}>×</button>
              </div>
              {/* Resumo visual */}
              {logEnvio.length > 0 && (
                <div style={{ display:'flex', gap:'10px', marginTop:'12px' }}>
                  {[
                    { label:'Enviados', val: logEnvio.filter(l=>l.status==='enviado').length, cor:'#059669', bg:'#f0fdf4' },
                    { label:'Erros', val: logEnvio.filter(l=>l.status==='erro').length, cor:'#dc2626', bg:'#fef2f2' },
                    { label:'Total', val: logEnvio.length, cor:'#6366f1', bg:'#eef2ff' },
                  ].map(x => (
                    <div key={x.label} style={{ background:x.bg, borderRadius:'8px', padding:'8px 14px', flex:1, textAlign:'center' }}>
                      <p style={{ fontSize:'20px', fontWeight:'800', color:x.cor, lineHeight:1 }}>{x.val}</p>
                      <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'2px' }}>{x.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de logs */}
            <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
              {carregandoLog ? (
                <p style={{ textAlign:'center', color:'#9ca3af', padding:'24px' }}>Carregando log...</p>
              ) : logEnvio.length === 0 ? (
                <p style={{ textAlign:'center', color:'#9ca3af', padding:'24px' }}>Nenhum registro de envio ainda</p>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {logEnvio.map((l: any) => (
                    <div key={l.id} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'10px 12px', borderRadius:'8px', background: l.status==='enviado'?'#f0fdf4':'#fef2f2', border:`1px solid ${l.status==='enviado'?'#bbf7d0':'#fecaca'}` }}>
                      <div style={{ width:'20px', height:'20px', borderRadius:'50%', background: l.status==='enviado'?'#059669':'#dc2626', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>
                        {l.status === 'enviado'
                          ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        }
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' }}>
                          <p style={{ fontSize:'13px', fontWeight:'600', color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.nome || 'Cliente'}</p>
                          <p style={{ fontSize:'11px', color:'#9ca3af', flexShrink:0 }}>{l.enviado_em ? new Date(l.enviado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''}</p>
                        </div>
                        <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'1px' }}>+{l.numero}</p>
                        {l.status === 'erro' && l.erro_msg && (
                          <p style={{ fontSize:'11px', color:'#dc2626', marginTop:'4px', background:'#fff1f2', padding:'4px 8px', borderRadius:'4px' }}>⚠ {l.erro_msg}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
