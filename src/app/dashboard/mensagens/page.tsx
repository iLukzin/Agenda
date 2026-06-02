'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useEmpresa } from '@/context/EmpresaContext'
import { aplicarVariaveis } from '@/lib/whatsapp'

type Campanha = { id:string; nome:string; mensagem:string; status:string; agendado_para:string|null; enviado_em:string|null; total_contatos:number; total_enviado:number; total_erro:number; created_at:string }

const inp = { width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'8px', padding:'10px 13px', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }

export default function MensagensPage() {
  const { empresaAtiva } = useEmpresa()
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [msgStatus, setMsgStatus] = useState('')
  const [form, setForm] = useState({ nome:'', mensagem:'', agendado_para:'', agendamento:false })
  const [preview, setPreview] = useState('')
  const [apiConfig, setApiConfig] = useState({ url:'', key:'', instancia:'' })
  const [templates, setTemplates] = useState<any[]>([])

  const carregar = useCallback(async () => {
    if (!empresaAtiva?.id) return
    setCarregando(true)
    const sb = createClient()
    const [camp, cli, cfg, tmpl, emp] = await Promise.all([
      sb.from('campanhas_mensagem').select('*').eq('empresa_id', empresaAtiva.id).order('created_at', { ascending:false }),
      sb.from('clientes').select('id,nome,whatsapp,telefone').eq('empresa_id', empresaAtiva.id).eq('status','ativo'),
      sb.from('config_sistema').select('chave,valor').in('chave', ['evolution_api_url','evolution_api_key']),
      sb.from('mensagens_template').select('*').eq('empresa_id', empresaAtiva.id).eq('tipo','massa'),
      sb.from('empresas').select('whatsapp_instancia').eq('id', empresaAtiva.id).single(),
    ])
    setCampanhas(camp.data || [])
    setClientes(cli.data || [])
    const cfgMap: Record<string,string> = {}
    if (cfg.data) cfg.data.forEach((c: any) => { cfgMap[c.chave] = c.valor || '' })
    const inst = emp.data?.whatsapp_instancia || ('emp-' + empresaAtiva.id.slice(0,8))
    setApiConfig({ url: cfgMap['evolution_api_url']||'', key: cfgMap['evolution_api_key']||'', instancia: inst })
    if (tmpl.data && tmpl.data.length > 0) setForm(f => ({ ...f, mensagem: tmpl.data[0].mensagem }))
    setTemplates(tmpl.data || [])
    setCarregando(false)
  }, [empresaAtiva?.id])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const ex = clientes[0]
    if (!ex) return
    const prev = aplicarVariaveis(form.mensagem, { cliente: ex.nome || 'Cliente', empresa: empresaAtiva?.nome || '', data: new Date().toLocaleDateString('pt-BR'), hora: '10:00', servico: 'Servico' })
    setPreview(prev)
  }, [form.mensagem, clientes, empresaAtiva])

  async function enviarAgora() {
    if (!empresaAtiva?.id || !form.nome.trim() || !form.mensagem.trim()) return
    if (!apiConfig.url || !apiConfig.key) { setMsgStatus('Configure a Evolution API em Configuracoes > WhatsApp.'); return }
    const clientesComNum = clientes.filter(c => c.whatsapp || c.telefone)
    if (clientesComNum.length === 0) { setMsgStatus('Nenhum cliente ativo com numero cadastrado.'); return }
    if (!confirm('Enviar para ' + clientesComNum.length + ' clientes? Esta acao nao pode ser desfeita.')) return

    setEnviando(true); setProgresso(0); setMsgStatus('')
    const sb = createClient()
    // Criar campanha
    const { data: camp } = await sb.from('campanhas_mensagem').insert({ empresa_id: empresaAtiva.id, nome: form.nome, mensagem: form.mensagem, status: 'enviando', total_contatos: clientesComNum.length }).select().single()
    if (!camp) { setEnviando(false); return }

    let enviados = 0, erros = 0
    for (let i = 0; i < clientesComNum.length; i++) {
      const c = clientesComNum[i]
      const num = (c.whatsapp || c.telefone).replace(/\D/g,'')
      const numFmt = num.startsWith('55') ? num : '55' + num
      const msg = aplicarVariaveis(form.mensagem, { cliente: c.nome, empresa: empresaAtiva.nome||'', data: new Date().toLocaleDateString('pt-BR'), hora: '', servico: '' })
      try {
        const res = await fetch(apiConfig.url.replace(/\/$/, '') + '/message/sendText/' + apiConfig.instancia, {
          method: 'POST',
          headers: { 'apikey': apiConfig.key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: numFmt, options:{ delay:500 }, textMessage:{ text: msg } }),
        })
        if (res.ok) { enviados++; await sb.from('mensagens_enviadas').insert({ empresa_id: empresaAtiva.id, cliente_id: c.id, tipo: 'massa', numero: numFmt, mensagem: msg, status: 'enviado' }) }
        else { erros++ }
      } catch { erros++ }
      setProgresso(Math.round((i+1)/clientesComNum.length*100))
      await new Promise(r => setTimeout(r, 600))
    }
    await sb.from('campanhas_mensagem').update({ status: 'concluida', enviado_em: new Date().toISOString(), total_enviado: enviados, total_erro: erros }).eq('id', camp.id)
    setMsgStatus('Concluido: ' + enviados + ' enviados, ' + erros + ' erros.')
    setEnviando(false); setProgresso(0); await carregar()
  }

  async function agendarEnvio() {
    if (!empresaAtiva?.id || !form.nome.trim() || !form.mensagem.trim() || !form.agendado_para) return
    const sb = createClient()
    const clientesComNum = clientes.filter(c => c.whatsapp || c.telefone)
    await sb.from('campanhas_mensagem').insert({ empresa_id: empresaAtiva.id, nome: form.nome, mensagem: form.mensagem, status: 'agendada', agendado_para: form.agendado_para, total_contatos: clientesComNum.length })
    setMsgStatus('Campanha agendada!'); setModalAberto(false); setForm(f => ({ ...f, nome:'', agendado_para:'' })); await carregar()
  }

  const statusCor: Record<string,string> = { agendada:'#f59e0b', enviando:'#2563eb', concluida:'#10b981', erro:'#ef4444' }
  const statusBg:  Record<string,string> = { agendada:'#fffbeb', enviando:'#eff6ff', concluida:'#f0fdf4', erro:'#fef2f2' }

  return (
    <div style={{ padding:'16px', minHeight:'100vh', background:'#f4f5fb' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'12px', marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.5px' }}>Mensagens WhatsApp</h1>
          <p style={{ fontSize:'13px', color:'#6b7280', marginTop:'2px' }}>{clientes.filter(c=>c.whatsapp||c.telefone).length} clientes com numero ? {campanhas.length} campanhas</p>
        </div>
        <button onClick={()=>setModalAberto(true)} style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', color:'white', border:'none', borderRadius:'10px', padding:'10px 18px', fontSize:'13px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Nova campanha
        </button>
      </div>

      {/* Lista de campanhas */}
      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#9ca3af' }}>Carregando...</div>
      ) : campanhas.length === 0 ? (
        <div style={{ background:'white', borderRadius:'14px', padding:'48px 24px', textAlign:'center', border:'1px solid #f0f0f8' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <p style={{ fontSize:'15px', fontWeight:'600', color:'#374151', marginBottom:'6px' }}>Nenhuma campanha ainda</p>
          <p style={{ fontSize:'13px', color:'#9ca3af' }}>Crie sua primeira campanha de mensagens em massa</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {campanhas.map(c => (
            <div key={c.id} style={{ background:'white', borderRadius:'12px', border:'1px solid #f0f0f8', padding:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'10px' }}>
                <div style={{ flex:1, minWidth:'200px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <p style={{ fontSize:'15px', fontWeight:'700', color:'#111827' }}>{c.nome}</p>
                    <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'99px', background:statusBg[c.status]||'#f3f4f6', color:statusCor[c.status]||'#6b7280', textTransform:'capitalize' }}>{c.status}</span>
                  </div>
                  <p style={{ fontSize:'12px', color:'#6b7280', marginBottom:'8px' }}>{c.mensagem.slice(0,80)}{c.mensagem.length>80?'...':''}</p>
                  <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
                    {c.agendado_para && <span style={{ fontSize:'11px', color:'#6b7280' }}>Agendado: {new Date(c.agendado_para).toLocaleString('pt-BR')}</span>}
                    {c.enviado_em && <span style={{ fontSize:'11px', color:'#6b7280' }}>Enviado: {new Date(c.enviado_em).toLocaleString('pt-BR')}</span>}
                    {c.total_contatos > 0 && (
                      <span style={{ fontSize:'11px', color:'#6b7280' }}>
                        {c.total_enviado}/{c.total_contatos} enviados {c.total_erro > 0 ? '? ' + c.total_erro + ' erros' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {c.status === 'concluida' && c.total_contatos > 0 && (
                  <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'10px 14px', textAlign:'center', minWidth:'80px' }}>
                    <p style={{ fontSize:'20px', fontWeight:'800', color:'#10b981' }}>{Math.round(c.total_enviado/c.total_contatos*100)}%</p>
                    <p style={{ fontSize:'10px', color:'#6b7280' }}>taxa envio</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nova campanha */}
      {modalAberto && (
        <div onClick={()=>{if(!enviando)setModalAberto(false)}} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', backdropFilter:'blur(4px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white', width:'100%', maxWidth:'560px', borderRadius:'20px', padding:'24px 20px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <div>
                <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a' }}>Nova campanha</h2>
                <p style={{ fontSize:'12px', color:'#6b7280', marginTop:'2px' }}>{clientes.filter(c=>c.whatsapp||c.telefone).length} clientes serao impactados</p>
              </div>
              {!enviando && <button onClick={()=>setModalAberto(false)} style={{ background:'#f3f4f6', border:'none', borderRadius:'50%', width:'30px', height:'30px', cursor:'pointer', fontSize:'16px' }}>?</button>}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Nome da campanha</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} style={inp} placeholder="Ex: Promocao de junho"/>
              </div>

              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                  <label style={{ fontSize:'12px', fontWeight:'600', color:'#374151' }}>Mensagem</label>
                  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                    {['{{cliente}}','{{empresa}}'].map(v => (
                      <button key={v} onClick={()=>setForm(f=>({...f,mensagem:f.mensagem+v}))} style={{ background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:'5px', padding:'2px 6px', fontSize:'10px', fontWeight:'700', cursor:'pointer', fontFamily:'monospace' }}>{v}</button>
                    ))}
                  </div>
                </div>
                <textarea value={form.mensagem} onChange={e=>setForm(f=>({...f,mensagem:e.target.value}))} rows={5}
                  style={{ ...inp, resize:'vertical', fontFamily:'inherit', lineHeight:'1.6' }}
                  placeholder="Ola {{cliente}}! Temos uma novidade especial para voce..."/>
              </div>

              {preview && (
                <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'12px 14px', border:'1px solid #bbf7d0' }}>
                  <p style={{ fontSize:'11px', fontWeight:'600', color:'#16a34a', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Preview (primeiro cliente)</p>
                  <p style={{ fontSize:'13px', color:'#374151', lineHeight:'1.6', whiteSpace:'pre-wrap' }}>{preview}</p>
                </div>
              )}

              <div style={{ background:'#f9fafb', borderRadius:'10px', padding:'12px 14px', border:'1px solid #e5e7eb' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:form.agendamento?'12px':'0' }}>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:'600', color:'#374151' }}>Agendar para depois</p>
                    <p style={{ fontSize:'11px', color:'#9ca3af' }}>Define data e hora de envio automatico</p>
                  </div>
                  <div onClick={()=>setForm(f=>({...f,agendamento:!f.agendamento}))} style={{ width:'44px', height:'24px', borderRadius:'99px', cursor:'pointer', background:form.agendamento?'#6366f1':'#e5e7eb', position:'relative', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left .2s', left:form.agendamento?'22px':'2px', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                  </div>
                </div>
                {form.agendamento && (
                  <input type="datetime-local" value={form.agendado_para} onChange={e=>setForm(f=>({...f,agendado_para:e.target.value}))} style={inp}/>
                )}
              </div>
            </div>

            {/* Progresso de envio */}
            {enviando && (
              <div style={{ marginTop:'16px', background:'#eff6ff', borderRadius:'10px', padding:'14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                  <p style={{ fontSize:'13px', fontWeight:'600', color:'#1d4ed8' }}>Enviando mensagens...</p>
                  <p style={{ fontSize:'13px', fontWeight:'700', color:'#1d4ed8' }}>{progresso}%</p>
                </div>
                <div style={{ background:'#bfdbfe', borderRadius:'99px', height:'8px', overflow:'hidden' }}>
                  <div style={{ background:'#2563eb', height:'100%', width:progresso+'%', borderRadius:'99px', transition:'width .3s' }}/>
                </div>
                <p style={{ fontSize:'11px', color:'#6b7280', marginTop:'6px' }}>Nao feche esta janela</p>
              </div>
            )}

            {msgStatus && (
              <div style={{ marginTop:'12px', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', background:msgStatus.startsWith('Erro')||msgStatus.startsWith('Configure')?'#fef2f2':'#f0fdf4', color:msgStatus.startsWith('Erro')||msgStatus.startsWith('Configure')?'#dc2626':'#16a34a', border:'1px solid '+(msgStatus.startsWith('Erro')||msgStatus.startsWith('Configure')?'#fecaca':'#bbf7d0') }}>{msgStatus}</div>
            )}

            {!enviando && (
              <div style={{ display:'flex', gap:'10px', marginTop:'18px' }}>
                <button onClick={()=>setModalAberto(false)} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 16px', fontSize:'14px', cursor:'pointer', flex:1 }}>Cancelar</button>
                {form.agendamento ? (
                  <button onClick={agendarEnvio} disabled={!form.nome||!form.mensagem||!form.agendado_para} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', fontWeight:'600', cursor:'pointer', flex:2 }}>
                    Agendar campanha
                  </button>
                ) : (
                  <button onClick={enviarAgora} disabled={!form.nome||!form.mensagem} style={{ background:'linear-gradient(135deg,#25d366,#128c7e)', color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', fontWeight:'700', cursor:'pointer', flex:2, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Enviar agora para {clientes.filter(c=>c.whatsapp||c.telefone).length} clientes
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
