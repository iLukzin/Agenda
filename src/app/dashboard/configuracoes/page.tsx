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
  const [wpp, setWpp] = useState({ ativo:false })
  const [templates, setTemplates] = useState<any[]>([])
  const [testando, setTestando] = useState(false)
  const [testeNum, setTesteNum] = useState('')
  const [evoConfig, setEvoConfig] = useState({ url:'', token:'', instancia:'' })
  const [configGlobalCarregada, setConfigGlobalCarregada] = useState(false)
  const [salvandoEvo, setSalvandoEvo] = useState(false)
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
      if (aba === 'whatsapp' && !emp.data.whatsapp_habilitado) setAba('empresa')
      setWpp({ ativo:emp.data.whatsapp_ativo||false })
      // Instancia = ID da empresa (unica por empresa)
      const instanciaEmpresa = 'emp-' + (empresaAtiva?.id || '').slice(0, 8)
      // Buscar URL e Token globais da config_sistema
      const { data: cfgGlobal } = await sb2.from('config_sistema').select('chave,valor').in('chave', ['evolution_api_url','evolution_api_key'])
      const cfgMap: Record<string,string> = {}
      if (cfgGlobal) cfgGlobal.forEach((c: any) => { cfgMap[c.chave] = c.valor || '' })
      setEvoConfig({ url: cfgMap['evolution_api_url'] || '', token: cfgMap['evolution_api_key'] || '', instancia: emp.data.whatsapp_instancia || instanciaEmpresa })
      setConfigGlobalCarregada(true)
      // Verificar status usando config global (config_sistema)
      const urlEvo = cfgMap['evolution_api_url']
      const tokenEvo = cfgMap['evolution_api_key']
      const instEvo = emp.data.whatsapp_instancia || ('emp-' + (empresaAtiva?.id || '').slice(0,8))
      if (urlEvo && tokenEvo && instEvo) {
        fetch(urlEvo.replace(/\/$/, '') + '/instance/connectionState/' + instEvo, { headers: { 'apikey': tokenEvo } })
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (!d) return
            const st = d?.instance?.state || d?.state || ''
            if (st === 'open' || st === 'connected') setStatusConexao('conectado')
          })
          .catch(() => {})
      }
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
    const sb = createClient()
    const payload = {
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      telefone: empresa.telefone,
      email: empresa.email,
      endereco: empresa.endereco,
      tipo_agenda: empresa.tipo_agenda || 'grade',
    }
    const { error } = await sb.from('empresas').update(payload).eq('id', empresaAtiva.id)
    if (!error) { setSalvo(true); setTimeout(()=>setSalvo(false),2500); recarregar() }
    else { console.error('Erro ao salvar empresa:', error) }
    setSalvando(false)
  }

  function abrirNovoPlano() { setModoEdicaoPlano(false); setPlanoSel(null); setErroPlano(''); setFormPlano({nome:'',descricao:'',valor_mensal:'',sessoes_mes:'',validade_dias:'30',status:'ativo',ilimitado:false}); setModalPlano(true) }
  function abrirEdicaoPlano(p: Plano) { setModoEdicaoPlano(true); setPlanoSel(p); setErroPlano(''); setFormPlano({nome:p.nome,descricao:p.descricao||'',valor_mensal:String(p.valor_mensal),sessoes_mes:p.sessoes_mes!=null?String(p.sessoes_mes):'',validade_dias:String(p.validade_dias),status:p.status,ilimitado:p.sessoes_mes===null}); setModalPlano(true) }
  function fecharModalPlano() { setModalPlano(false); setPlanoSel(null) }

  async function salvarEvoConfig() {
    if (!empresaAtiva?.id) return
    setSalvandoEvo(true)
    const sb2 = createClient()
    // Salvar URL e Token globalmente (compartilhado por todas empresas)
    await Promise.all([
      sb2.from('config_sistema').upsert({ chave:'evolution_api_url', valor:evoConfig.url.trim() }, { onConflict:'chave' }),
      sb2.from('config_sistema').upsert({ chave:'evolution_api_key', valor:evoConfig.token.trim() }, { onConflict:'chave' }),
    ])
    // Salvar instancia da empresa (unica por empresa)
    const { error } = await sb2.from('empresas').update({ whatsapp_instancia: evoConfig.instancia.trim() || null }).eq('id', empresaAtiva.id)
    setSalvandoEvo(false)
    if (error) { setMsgWpp('Erro ao salvar: ' + error.message) }
    else { setMsgWpp('Configuracao salva!'); setTimeout(()=>setMsgWpp(''), 2000) }
  }

  async function salvarWpp() {
    if (!empresaAtiva?.id) return
    setSalvandoWpp(true); setMsgWpp('')
    const sb2 = createClient()
    const { error } = await sb2.from('empresas').update({
      whatsapp_ativo: wpp.ativo,
      wpp_auto_confirmacao: autoConfirmacao,
      wpp_auto_aniversario: autoAniversario,
    }).eq('id', empresaAtiva.id)
    if (error) { setMsgWpp('Erro: ' + error.message) }
    else { setMsgWpp('Configuracao salva!'); setTimeout(()=>setMsgWpp(''), 3000) }
    setSalvandoWpp(false)
  }

  // Chamar Evolution API diretamente do browser (evita bloqueio da Vercel para IPs privados)
  async function buscarQrCode() {
    if (!evoConfig.url || !evoConfig.token || !evoConfig.instancia) {
      setMsgWpp('Preencha e salve a URL da API, Token e Instancia antes de conectar.')
      return
    }
    setBuscandoQr(true); setQrCode(''); setStatusConexao('aguardando'); setMsgWpp('')
    const base = evoConfig.url.replace(/\/$/, '')
    const hdrs: Record<string,string> = { 'apikey': evoConfig.token, 'Content-Type': 'application/json' }
    try {
      // Funcao auxiliar para extrair base64 de qualquer resposta
      function extrairQR(data: any): string {
        if (!data) return ''
        const candidatos = [
          data?.qrcode?.base64, data?.base64, data?.qr, data?.code,
          data?.qrCode?.base64, data?.qrCode, data?.QRCode,
          data?.instance?.qrcode?.base64, data?.instance?.qr,
          data?.hash?.qrcode,
          typeof data === 'string' && data.length > 100 ? data : '',
        ]
        const b64 = candidatos.find(v => typeof v === 'string' && v.length > 50) || ''
        return b64 ? (b64.startsWith('data:') ? b64 : 'data:image/png;base64,' + b64) : ''
      }

      // 1. Verificar se ja esta conectado
      try {
        const sRes = await fetch(base + '/instance/connectionState/' + evoConfig.instancia, { headers: hdrs })
        if (sRes.ok) {
          const sData = await sRes.json()
          const state = sData?.instance?.state || sData?.state || ''
          if (state === 'open' || state === 'connected') {
            setStatusConexao('conectado'); setBuscandoQr(false); setMsgWpp('Ja conectado!'); return
          }
        }
      } catch {}

      // 2. Deletar instancia antiga
      try {
        await fetch(base + '/instance/logout/' + evoConfig.instancia, { method: 'DELETE', headers: hdrs })
        await fetch(base + '/instance/delete/' + evoConfig.instancia, { method: 'DELETE', headers: hdrs })
      } catch {}
      await new Promise(r => setTimeout(r, 1000))

      // 3. Deletar instancia existente e recriar
      try { await fetch(base + '/instance/delete/' + evoConfig.instancia, { method:'DELETE', headers:hdrs }) } catch {}
      await new Promise(r => setTimeout(r, 1500))

      // 4. Criar nova instancia
      await fetch(base + '/instance/create', {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ instanceName: evoConfig.instancia, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      })

      // 5. Aguardar Baileys inicializar e tentar /connect em loop ate ter QR
      setMsgWpp('Inicializando... aguarde ate 15 segundos.')
      let qrEncontrado = ''
      for (let tentQr = 0; tentQr < 8; tentQr++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const cRes = await fetch(base + '/instance/connect/' + evoConfig.instancia, { headers: hdrs })
          if (cRes.ok) {
            const cData = await cRes.json()
            const q = extrairQR(cData)
            if (q) { qrEncontrado = q; break }
          }
        } catch {}
      }
      if (!qrEncontrado) {
        setMsgWpp('Nao foi possivel gerar o QR Code. Verifique se o container da Evolution API esta rodando e tente novamente.')
        setBuscandoQr(false); setStatusConexao('desconectado'); return
      }
      setMsgWpp('')
      setQrCode(qrEncontrado)

      // 6. Polling conexao
      let tentativas = 0
      const intervalo = setInterval(async () => {
        tentativas++
        if (tentativas > 30) { clearInterval(intervalo); setBuscandoQr(false); setMsgWpp('QR expirou. Clique em Conectar novamente.'); return }
        try {
          const r2 = await fetch(base + '/instance/connectionState/' + evoConfig.instancia, { headers: hdrs })
          if (r2.ok) {
            const d2 = await r2.json()
            const s2 = d2?.instance?.state || d2?.state || ''
            if (s2 === 'open' || s2 === 'connected') {
              clearInterval(intervalo)
              setStatusConexao('conectado'); setQrCode(''); setBuscandoQr(false)
              setMsgWpp('WhatsApp conectado!'); setTimeout(()=>setMsgWpp(''), 3000)
            }
          }
        } catch {}
      }, 3000)

    } catch (ex: any) {
      setMsgWpp('Erro: ' + ex.message)
      setBuscandoQr(false); setStatusConexao('desconectado')
    }
  }

  async function desconectarWpp() {
    if (!evoConfig.url || !evoConfig.instancia) { setStatusConexao('desconectado'); setQrCode(''); return }
    const base = evoConfig.url.replace(/\/$/, '')
    try {
      await fetch(base + '/instance/logout/' + evoConfig.instancia, {
        method: 'DELETE', headers: { 'apikey': evoConfig.token }
      })
    } catch {}
    setStatusConexao('desconectado'); setQrCode(''); setMsgWpp('Desconectado.')
  }

  async function testarWpp() {
    if (!testeNum) return setMsgWpp('Informe um numero para teste.')
    setTestando(true); setMsgWpp('')
    if (!evoConfig.url || !evoConfig.token || !evoConfig.instancia) {
      setMsgWpp('Configure e salve a API primeiro.'); setTestando(false); return
    }
    const digits = testeNum.replace(/\D/g,'')
    const numFmt = digits.startsWith('55') ? digits : '55' + digits
    const base = evoConfig.url.replace(/\/$/, '')
    const resT = await fetch(base + '/message/sendText/' + evoConfig.instancia, {
      method: 'POST',
      headers: { 'apikey': evoConfig.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: numFmt, options:{ delay:1000 }, text: 'Teste AgendaFortitude - conexao funcionando!' }),
    })
    const ok = resT.ok
    const erro = ok ? '' : await resT.text().catch(() => 'erro desconhecido')
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
      const rr = await fetch('/api/whatsapp/enviar', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ empresa_id:empresaAtiva?.id, numero:num, mensagem:msg }) })
      const dr = await rr.json(); const ok = dr.ok
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

  const abasBase = [{ key:'empresa', label:'Empresa' },{ key:'horarios', label:'Horarios' },{ key:'planos', label:'Planos' }]
  const abas = [...abasBase, ...((empresa as any)?.whatsapp_habilitado ? [{ key:'whatsapp', label:'WhatsApp' }] : [])]

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
            
      )}
    </div>
  )
}
