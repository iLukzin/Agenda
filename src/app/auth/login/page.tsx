'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const inp: React.CSSProperties = {
  width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'10px',
  padding:'10px 14px', fontSize:'15px', outline:'none',
  boxSizing:'border-box', background:'white', color:'#1e293b',
  WebkitAppearance:'none',
}
const inpFocus = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement>) =>
  ((e.target as HTMLElement).style.borderColor = '#6366f1')
const inpBlur = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement>) =>
  ((e.target as HTMLElement).style.borderColor = '#e5e7eb')

function mascaraTel(v: string) {
  const n = v.replace(/\D/g,'').slice(0,11)
  if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'')
  return n.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3').replace(/-$/,'')
}

function mascaraCpfCnpj(v: string) {
  const n = v.replace(/\D/g,'').slice(0,14)
  if (n.length <= 11) {
    // CPF: 000.000.000-00
    return n
      .replace(/(\d{3})(\d)/,'$1.$2')
      .replace(/(\d{3})(\d)/,'$1.$2')
      .replace(/(\d{3})(\d{1,2})$/,'$1-$2')
  }
  // CNPJ: 00.000.000/0000-00
  return n
    .replace(/(\d{2})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1/$2')
    .replace(/(\d{4})(\d{1,2})$/,'$1-$2')
}

// ─── Formulário de Login ───────────────────────────────────────────
function LoginForm({ onCadastrar }: { onCadastrar: () => void }) {
  const params = useSearchParams()
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [erro, setErro]         = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [empresaBloqueada, setEmpresaBloqueada] = useState(false)
  const [isTrialExpirado, setIsTrialExpirado]   = useState(false)
  const [motivoBloqueio, setMotivoBloqueio]     = useState('')

  const WHATSAPP_SUPORTE = '5534988018483' // número do suporte

  useEffect(() => {
    if (params.get('bloqueada') === '1') {
      setEmpresaBloqueada(true)
      setIsTrialExpirado(params.get('trial') === '1')
      setMotivoBloqueio(params.get('motivo') || 'Falta de pagamento')
    }
  }, [params])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    try {
      const sb = createClient()
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) { setErro('E-mail ou senha incorretos.'); setCarregando(false); return }
      window.location.href = '/dashboard/agenda'
    } catch { setErro('Erro inesperado. Tente novamente.'); setCarregando(false) }
  }

  // ── Tela de trial expirado ──────────────────────────────────────
  if (isTrialExpirado) return (
    <div style={{ background:'white', borderRadius:'22px', overflow:'hidden', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>
      {/* Banner de cima */}
      <div style={{ background:'linear-gradient(135deg,#0f172a,#1e1b4b,#1d4ed8)', padding:'32px 28px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-40px', left:'-40px', width:'160px', height:'160px', background:'radial-gradient(circle,rgba(99,102,241,0.3),transparent 70%)', borderRadius:'50%' }}/>
        <div style={{ position:'absolute', bottom:'-30px', right:'-30px', width:'120px', height:'120px', background:'radial-gradient(circle,rgba(59,130,246,0.2),transparent 70%)', borderRadius:'50%' }}/>
        {/* Ícone de cadeado */}
        <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'2px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', position:'relative', zIndex:1 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 style={{ color:'white', fontSize:'20px', fontWeight:'800', margin:'0 0 6px', position:'relative', zIndex:1 }}>Período de teste encerrado</h2>
        <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'13px', margin:0, position:'relative', zIndex:1 }}>Seus 3 dias gratuitos expiraram</p>
      </div>

      {/* Corpo */}
      <div style={{ padding:'24px 28px 28px' }}>
        {/* Linha do tempo */}
        <div style={{ display:'flex', alignItems:'center', gap:'0', marginBottom:'24px' }}>
          {[
            { label:'Cadastrou', icon:'✓', ok:true },
            { label:'3 dias de teste', icon:'✓', ok:true },
            { label:'Continuar usando', icon:'🔒', ok:false },
          ].map((s, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', flex: i<2?1:'auto' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', background: s.ok?'#4f46e5':'#f1f5f9', border: s.ok?'none':'2px dashed #cbd5e1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px' }}>
                  {s.ok ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : <span>🔒</span>}
                </div>
                <span style={{ fontSize:'9px', fontWeight:'600', color: s.ok?'#4f46e5':'#94a3b8', whiteSpace:'nowrap' }}>{s.label}</span>
              </div>
              {i < 2 && <div style={{ flex:1, height:'2px', background: i===0?'#4f46e5':'#e2e8f0', margin:'0 4px', marginBottom:'14px' }}/>}
            </div>
          ))}
        </div>

        <div style={{ background:'#f8fafc', borderRadius:'14px', padding:'18px', marginBottom:'20px', border:'1px solid #e2e8f0' }}>
          <p style={{ fontSize:'14px', fontWeight:'700', color:'#1e293b', margin:'0 0 8px' }}>Continue usando o AgendaFortitude</p>
          <p style={{ fontSize:'13px', color:'#64748b', margin:0, lineHeight:'1.6' }}>
            Para continuar com acesso ao sistema, entre em contato com nosso suporte. A ativação é rápida e você não perde nenhum dado cadastrado.
          </p>
        </div>

        {/* Card de contato */}
        <a href={`https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent('Olá! Meu período de teste do AgendaFortitude expirou e quero continuar usando o sistema.')}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:'14px', background:'linear-gradient(135deg,#16a34a,#15803d)', borderRadius:'14px', padding:'16px 18px', textDecoration:'none', marginBottom:'14px', boxShadow:'0 4px 16px rgba(22,163,74,0.35)' }}>
          <div style={{ width:'46px', height:'46px', borderRadius:'12px', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
            </svg>
          </div>
          <div>
            <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'11px', fontWeight:'600', margin:'0 0 2px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Falar com suporte</p>
            <p style={{ color:'white', fontSize:'15px', fontWeight:'800', margin:0 }}>Ativar minha conta agora</p>
          </div>
          <div style={{ marginLeft:'auto', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </a>

        <button onClick={()=>{ setEmpresaBloqueada(false); setIsTrialExpirado(false); window.history.replaceState({},'','/auth/login') }}
          style={{ width:'100%', background:'none', border:'1px solid #e2e8f0', borderRadius:'10px', padding:'10px', fontSize:'13px', color:'#64748b', cursor:'pointer', fontWeight:'600' }}>
          Voltar ao login
        </button>
      </div>
    </div>
  )

  // ── Tela de empresa bloqueada (não trial) ────────────────────────
  return (
    <div style={{ background:'white', borderRadius:'22px', padding:'32px', boxShadow:'0 25px 60px rgba(0,0,0,0.4)' }}>
      {empresaBloqueada && (
        <div style={{ background:'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius:'14px', padding:'18px', marginBottom:'22px', border:'1px solid #fca5a5' }}>
          <p style={{ color:'white', fontWeight:'700', fontSize:'15px', margin:'0 0 6px' }}>Sistema Suspenso</p>
          <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'13px', margin:'0 0 10px' }}>{motivoBloqueio}</p>
          <a href={`https://wa.me/5534988018483?text=${encodeURIComponent('Olá! Preciso regularizar meu acesso ao AgendaFortitude.')}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'rgba(255,255,255,0.2)', color:'white', borderRadius:'8px', padding:'8px 14px', textDecoration:'none', fontSize:'13px', fontWeight:'600' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
            Contatar suporte
          </a>
        </div>
      )}

      <h2 style={{ fontSize:'20px', fontWeight:'700', color:'#1a1a2e', margin:'0 0 4px' }}>Entrar na sua conta</h2>
      <p style={{ fontSize:'14px', color:'#9ca3af', margin:'0 0 24px' }}>Bem-vindo de volta!</p>

      <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <div>
          <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' }}>E-mail</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seu@email.com"
            style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
        </div>
        <div>
          <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' }}>Senha</label>
          <div style={{ position:'relative' }}>
            <input type={mostrarSenha?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)} required placeholder="Sua senha"
              style={{ ...inp, paddingRight:'44px' }} onFocus={inpFocus} onBlur={inpBlur}/>
            <button type="button" onClick={()=>setMostrarSenha(v=>!v)}
              style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'4px', display:'flex' }}>
              {mostrarSenha
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
            </button>
          </div>
        </div>

        {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}

        <button type="submit" disabled={carregando}
          style={{ width:'100%', background:carregando?'#a5b4fc':'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'12px', padding:'13px', fontSize:'15px', fontWeight:'700', cursor:carregando?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', boxShadow:carregando?'none':'0 4px 14px rgba(99,102,241,0.4)' }}>
          {carregando && <span style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }}/>}
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div style={{ textAlign:'center', marginTop:'20px', paddingTop:'18px', borderTop:'1px solid #f3f4f6' }}>
        <p style={{ fontSize:'13px', color:'#6b7280', margin:0 }}>
          Não tem uma conta?{' '}
          <button onClick={onCadastrar}
            style={{ background:'none', border:'none', color:'#6366f1', fontWeight:'700', fontSize:'13px', cursor:'pointer', padding:0 }}>
            Cadastre-se agora
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Formulário de Cadastro Rápido ────────────────────────────────
function CadastroForm({ onVoltar }: { onVoltar: () => void }) {
  const [etapa, setEtapa]   = useState<'empresa'|'usuario'|'sucesso'>('empresa')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]     = useState('')

  const [empresa, setEmpresa] = useState({ nome:'', telefone:'', email:'', cnpj:'', endereco:'' })
  const [usuario, setUsuario] = useState({ nome:'', email:'', senha:'', confirmar:'' })
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const setE = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEmpresa(p => ({
      ...p,
      [k]: k === 'telefone' ? mascaraTel(e.target.value)
         : k === 'cnpj'    ? mascaraCpfCnpj(e.target.value)
         : e.target.value
    }))
  const setU = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setUsuario(p => ({ ...p, [k]: e.target.value }))

  function validarEmpresa() {
    if (!empresa.nome.trim()) return 'Nome da empresa é obrigatório.'
    if (!empresa.telefone.trim()) return 'Telefone é obrigatório.'
    return ''
  }
  function validarUsuario() {
    if (!usuario.nome.trim()) return 'Nome do responsável é obrigatório.'
    if (!usuario.email.trim() || !usuario.email.includes('@')) return 'E-mail inválido.'
    if (usuario.senha.length < 6) return 'Senha deve ter pelo menos 6 caracteres.'
    if (usuario.senha !== usuario.confirmar) return 'As senhas não conferem.'
    return ''
  }

  function avancar() {
    const e = validarEmpresa(); if (e) { setErro(e); return }
    setErro(''); setEtapa('usuario')
  }

  async function salvar() {
    const e = validarUsuario(); if (e) { setErro(e); return }
    setSalvando(true); setErro('')
    try {
      const res = await fetch('/api/cadastro-rapido', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          empresa_nome:      empresa.nome,
          empresa_telefone:  empresa.telefone,
          empresa_email:     empresa.email,
          empresa_cnpj:      empresa.cnpj,
          empresa_endereco:  empresa.endereco,
          usuario_nome:      usuario.nome,
          usuario_email:     usuario.email,
          usuario_senha:     usuario.senha,
        })
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErro(json.error || 'Erro ao cadastrar.'); setSalvando(false); return }
      setEtapa('sucesso')
    } catch { setErro('Erro de conexão. Tente novamente.'); setSalvando(false) }
  }

  if (etapa === 'sucesso') return (
    <div style={{ background:'white', borderRadius:'22px', padding:'32px', boxShadow:'0 25px 60px rgba(0,0,0,0.4)', textAlign:'center' }}>
      <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style={{ fontSize:'20px', fontWeight:'800', color:'#1e293b', margin:'0 0 8px' }}>Cadastro realizado!</h2>
      <p style={{ fontSize:'14px', color:'#64748b', margin:'0 0 6px' }}>Sua empresa foi criada com sucesso.</p>
      <p style={{ fontSize:'13px', color:'#94a3b8', margin:'0 0 24px' }}>Faça login com o e-mail <strong style={{ color:'#6366f1' }}>{usuario.email}</strong> e a senha cadastrada.</p>
      <button onClick={onVoltar}
        style={{ width:'100%', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'12px', padding:'13px', fontSize:'15px', fontWeight:'700', cursor:'pointer', boxShadow:'0 4px 14px rgba(99,102,241,0.4)' }}>
        Ir para o login
      </button>
    </div>
  )

  return (
    <div style={{ background:'white', borderRadius:'22px', padding:'32px', boxShadow:'0 25px 60px rgba(0,0,0,0.4)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <button onClick={()=>{ etapa==='usuario'?setEtapa('empresa'):onVoltar(); setErro('') }}
          style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', padding:'4px', display:'flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ flex:1 }}>
          <h2 style={{ fontSize:'18px', fontWeight:'800', color:'#1e293b', margin:0 }}>
            {etapa==='empresa' ? 'Dados da empresa' : 'Dados de acesso'}
          </h2>
          <p style={{ fontSize:'12px', color:'#94a3b8', margin:0 }}>
            {etapa==='empresa' ? 'Passo 1 de 2' : 'Passo 2 de 2'}
          </p>
        </div>
        {/* Progress */}
        <div style={{ display:'flex', gap:'4px' }}>
          <div style={{ width:'24px', height:'4px', borderRadius:'99px', background:'#6366f1' }}/>
          <div style={{ width:'24px', height:'4px', borderRadius:'99px', background: etapa==='usuario'?'#6366f1':'#e5e7eb' }}/>
        </div>
      </div>

      {/* Etapa 1 — Empresa */}
      {etapa === 'empresa' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>
              Nome da empresa <span style={{ color:'#ef4444' }}>*</span>
            </label>
            <input value={empresa.nome} onChange={setE('nome')} placeholder="Ex: Barbearia Silva" style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>
              Telefone / WhatsApp <span style={{ color:'#ef4444' }}>*</span>
            </label>
            <input value={empresa.telefone} onChange={setE('telefone')} placeholder="(11) 99999-0000" style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>E-mail da empresa</label>
            <input type="email" value={empresa.email} onChange={setE('email')} placeholder="contato@empresa.com" style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>CNPJ ou CPF</label>
            <input
              value={empresa.cnpj}
              onChange={setE('cnpj')}
              placeholder="CPF ou CNPJ"
              inputMode="numeric"
              style={inp}
              onFocus={inpFocus}
              onBlur={inpBlur}
            />
            {empresa.cnpj.length > 0 && (
              <p style={{ fontSize:'11px', margin:'3px 0 0 2px', color: empresa.cnpj.replace(/\D/g,'').length <= 11 ? '#6366f1' : '#0891b2', fontWeight:'600' }}>
                {empresa.cnpj.replace(/\D/g,'').length <= 11 ? '👤 CPF' : '🏢 CNPJ'}
              </p>
            )}
          </div>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>Endereço</label>
            <input value={empresa.endereco} onChange={setE('endereco')} placeholder="Rua, número, bairro, cidade" style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
          </div>
          {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}
          <button onClick={avancar}
            style={{ width:'100%', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'12px', padding:'13px', fontSize:'15px', fontWeight:'700', cursor:'pointer', marginTop:'4px', boxShadow:'0 4px 14px rgba(99,102,241,0.4)' }}>
            Continuar
          </button>
        </div>
      )}

      {/* Etapa 2 — Usuário */}
      {etapa === 'usuario' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#1d4ed8' }}>
            <strong>Empresa:</strong> {empresa.nome}
          </div>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>
              Seu nome completo <span style={{ color:'#ef4444' }}>*</span>
            </label>
            <input value={usuario.nome} onChange={setU('nome')} placeholder="Nome do responsável" style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>
              E-mail de acesso <span style={{ color:'#ef4444' }}>*</span>
            </label>
            <input type="email" value={usuario.email} onChange={setU('email')} placeholder="seu@email.com" style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>
              Senha <span style={{ color:'#ef4444' }}>*</span>
              <span style={{ fontSize:'11px', color:'#9ca3af', fontWeight:'400', marginLeft:'6px' }}>mínimo 6 caracteres</span>
            </label>
            <div style={{ position:'relative' }}>
              <input type={mostrarSenha?'text':'password'} value={usuario.senha} onChange={setU('senha')} placeholder="Crie uma senha" style={{ ...inp, paddingRight:'44px' }} onFocus={inpFocus} onBlur={inpBlur}/>
              <button type="button" onClick={()=>setMostrarSenha(v=>!v)}
                style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', display:'flex' }}>
                {mostrarSenha
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'5px' }}>
              Confirmar senha <span style={{ color:'#ef4444' }}>*</span>
            </label>
            <input type={mostrarSenha?'text':'password'} value={usuario.confirmar} onChange={setU('confirmar')} placeholder="Repita a senha" style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
          </div>

          {/* Info de permissões */}
          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'10px 14px' }}>
            <p style={{ fontSize:'12px', fontWeight:'700', color:'#15803d', margin:'0 0 4px' }}>✓ Permissões incluídas automaticamente</p>
            <p style={{ fontSize:'11px', color:'#16a34a', margin:0 }}>Agenda · Clientes · Profissionais · Serviços · Financeiro · Dashboard</p>
          </div>

          {erro && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#dc2626' }}>{erro}</div>}

          <button onClick={salvar} disabled={salvando}
            style={{ width:'100%', background:salvando?'#a5b4fc':'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'12px', padding:'13px', fontSize:'15px', fontWeight:'700', cursor:salvando?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', boxShadow:salvando?'none':'0 4px 14px rgba(99,102,241,0.4)' }}>
            {salvando && <span style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }}/>}
            {salvando ? 'Criando conta...' : 'Criar minha conta'}
          </button>
        </div>
      )}

      <div style={{ textAlign:'center', marginTop:'16px', paddingTop:'14px', borderTop:'1px solid #f3f4f6' }}>
        <p style={{ fontSize:'13px', color:'#6b7280', margin:0 }}>
          Já tem conta?{' '}
          <button onClick={onVoltar} style={{ background:'none', border:'none', color:'#6366f1', fontWeight:'700', fontSize:'13px', cursor:'pointer', padding:0 }}>
            Fazer login
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────
function LoginPage() {
  const [modo, setModo] = useState<'login'|'cadastro'>('login')

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)', padding:'16px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', top:'-100px', left:'-100px', width:'400px', height:'400px', background:'radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', bottom:'-100px', right:'-100px', width:'500px', height:'500px', background:'radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:'420px', position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'72px', height:'72px', borderRadius:'20px', background:'white', marginBottom:'16px', padding:'8px', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
            <img src="/logo-fortitude.png" alt="Fortitude" style={{ width:'56px', height:'56px', objectFit:'contain' }}/>
          </div>
          <h1 style={{ color:'white', fontSize:'24px', fontWeight:'700', letterSpacing:'-0.5px', margin:0 }}>AgendaFortitude</h1>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:'13px', marginTop:'4px' }}>by Fortitude Sistym</p>
        </div>

        {modo === 'login'
          ? <LoginForm onCadastrar={()=>setModo('cadastro')}/>
          : <CadastroForm onVoltar={()=>setModo('login')}/>
        }

        <div style={{ textAlign:'center', marginTop:'20px' }}>
          <a href="https://www.instagram.com/fortitudesistym?igsh=MTU5djlxYzFxNm9oYw%3D%3D" target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'34px', height:'34px', borderRadius:'10px', background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', marginBottom:'8px', textDecoration:'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1" fill="white"/>
            </svg>
          </a>
          <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'11px' }}>AgendaFortitude {new Date().getFullYear()} — Fortitude Sistym</p>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a' }}>
        <div style={{ width:'40px', height:'40px', border:'3px solid rgba(255,255,255,0.1)', borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <LoginPage/>
    </Suspense>
  )
}
