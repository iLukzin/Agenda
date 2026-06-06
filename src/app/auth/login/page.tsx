'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail]           = useState('')
  const [senha, setSenha]           = useState('')
  const [erro, setErro]             = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mostrarSenha, setMostrarSenha]         = useState(false)
  const [empresaBloqueada, setEmpresaBloqueada] = useState(false)
  const [motivoBloqueio, setMotivoBloqueio]     = useState('')

  useEffect(() => {
    if (params.get('bloqueada') === '1') {
      setEmpresaBloqueada(true)
      setMotivoBloqueio(params.get('motivo') || 'Falta de pagamento')
    }
  }, [params])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) { setErro('E-mail ou senha incorretos.'); setCarregando(false); return }
      window.location.href = '/dashboard/agenda'
    } catch {
      setErro('Erro inesperado. Tente novamente.')
      setCarregando(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', padding:'16px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', top:'-100px', left:'-100px', width:'400px', height:'400px', background:'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', bottom:'-100px', right:'-100px', width:'500px', height:'500px', background:'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:'420px', position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'76px', height:'76px', borderRadius:'20px', background:'white', marginBottom:'18px', padding:'8px', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
            <img src="/logo-fortitude.png" alt="Fortitude" style={{ width:'60px', height:'60px', objectFit:'contain' }}/>
          </div>
          <h1 style={{ color:'white', fontSize:'26px', fontWeight:'700', letterSpacing:'-0.5px', margin:0 }}>AgendaFortitude</h1>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'14px', marginTop:'6px' }}>by Fortitude Sistym</p>
        </div>

        <div style={{ background:'white', borderRadius:'22px', padding:'36px', boxShadow:'0 25px 60px rgba(0,0,0,0.4)' }}>

          {/* Banner empresa bloqueada */}
          {empresaBloqueada && (
            <div style={{ background:'linear-gradient(135deg,#7f1d1d,#991b1b)', borderRadius:'14px', padding:'20px', marginBottom:'24px', border:'1px solid #fca5a5' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <p style={{ color:'white', fontWeight:'700', fontSize:'15px' }}>Sistema Suspenso</p>
                  <p style={{ color:'rgba(255,255,255,0.75)', fontSize:'12px', marginTop:'2px' }}>Acesso temporariamente bloqueado</p>
                </div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:'10px', padding:'12px 14px' }}>
                <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'4px', fontWeight:'600' }}>Motivo</p>
                <p style={{ color:'white', fontSize:'13px', fontWeight:'500' }}>{motivoBloqueio}</p>
              </div>
              <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'12px', marginTop:'12px', textAlign:'center' }}>
                Entre em contato com o suporte para regularizar.
              </p>
            </div>
          )}

          <h2 style={{ fontSize:'20px', fontWeight:'700', color:'#1a1a2e', margin:'0 0 4px' }}>Entrar na sua conta</h2>
          <p style={{ fontSize:'14px', color:'#9ca3af', margin:'0 0 28px' }}>Bem-vindo de volta!</p>

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
            <div>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'7px' }}>E-mail</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="seu@email.com" disabled={carregando}
                style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'10px', padding:'11px 14px', fontSize:'14px', outline:'none', boxSizing:'border-box', background:carregando?'#f9fafb':'white' }}
                onFocus={e=>{(e.target as HTMLInputElement).style.borderColor='#6366f1'}}
                onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='#e5e7eb'}}
              />
            </div>

            <div>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'7px' }}>Senha</label>
              <div style={{ position:'relative' }}>
                <input type={mostrarSenha?'text':'password'} value={senha} onChange={e=>setSenha(e.target.value)} required autoComplete="current-password" placeholder="Sua senha" disabled={carregando}
                  style={{ width:'100%', border:'1.5px solid #e5e7eb', borderRadius:'10px', padding:'11px 46px 11px 14px', fontSize:'14px', outline:'none', boxSizing:'border-box', background:carregando?'#f9fafb':'white' }}
                  onFocus={e=>{(e.target as HTMLInputElement).style.borderColor='#6366f1'}}
                  onBlur={e=>{(e.target as HTMLInputElement).style.borderColor='#e5e7eb'}}
                />
                <button type="button" onClick={()=>setMostrarSenha(v=>!v)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', padding:'4px' }}>
                  {mostrarSenha ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {erro && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#dc2626' }}>
                {erro}
              </div>
            )}

            <button type="submit" disabled={carregando} style={{ width:'100%', background:carregando?'#a5b4fc':'linear-gradient(135deg, #6366f1, #4f46e5)', color:'white', border:'none', borderRadius:'12px', padding:'13px', fontSize:'15px', fontWeight:'700', cursor:carregando?'not-allowed':'pointer', marginTop:'4px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', boxShadow:carregando?'none':'0 4px 14px rgba(99,102,241,0.4)' }}>
              {carregando && <span style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }}/>}
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:'24px' }}>
          <a href="https://www.instagram.com/fortitudesistym?igsh=MTU5djlxYzFxNm9oYw%3D%3D" target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'36px', height:'36px', borderRadius:'10px', background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', marginBottom:'10px', textDecoration:'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1" fill="white"/>
            </svg>
          </a>
          <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'12px' }}>
            AgendaFortitude {new Date().getFullYear()} - Fortitude Sistym
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a' }}>
        <div style={{ width:'40px', height:'40px', border:'3px solid rgba(255,255,255,0.1)', borderTop:'3px solid #6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
