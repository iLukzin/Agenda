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

// ─── Formulário de Login ───────────────────────────────────────────
function LoginForm({ onCadastrar }: { onCadastrar: () => void }) {
  const params = useSearchParams()
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [erro, setErro]         = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [empresaBloqueada, setEmpresaBloqueada] = useState(false)
  const [motivoBloqueio, setMotivoBloqueio]     = useState('')

  useEffect(() => {
    if (params.get('bloqueada') === '1') {
      setEmpresaBloqueada(true)
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

  return (
    <div style={{ background:'white', borderRadius:'22px', padding:'32px', boxShadow:'0 25px 60px rgba(0,0,0,0.4)' }}>
      {empresaBloqueada && (
        <div style={{ background:'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius:'14px', padding:'18px', marginBottom:'22px', border:'1px solid #fca5a5' }}>
          <p style={{ color:'white', fontWeight:'700', fontSize:'15px', margin:'0 0 6px' }}>Sistema Suspenso</p>
          <p style={{ color:'rgba(255,255,255,0.8)', fontSize:'13px', margin:0 }}>{motivoBloqueio}</p>
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
    setEmpresa(p => ({ ...p, [k]: k==='telefone' ? mascaraTel(e.target.value) : e.target.value }))
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
            <input value={empresa.cnpj} onChange={setE('cnpj')} placeholder="00.000.000/0000-00" style={inp} onFocus={inpFocus} onBlur={inpBlur}/>
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
