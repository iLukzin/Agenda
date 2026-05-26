'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [erro, setErro]         = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro(`Erro: ${error.message}`)
      setCarregando(false)
      return
    }

    if (!data.session) {
      setErro('Não foi possível iniciar a sessão. Tente novamente.')
      setCarregando(false)
      return
    }

    // Força refresh da sessão no servidor antes de navegar
    router.refresh()
    router.push('/dashboard')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0f17 0%, #1a1a2e 50%, #16213e 100%)',
        padding: '16px',
      }}
    >
      {/* Brilhos decorativos */}
      <div style={{ position:'fixed', top:'-10%', left:'-5%', width:'400px', height:'400px', background:'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', bottom:'-10%', right:'-5%', width:'500px', height:'500px', background:'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', borderRadius:'50%', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:'420px', position:'relative' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'56px', height:'56px', borderRadius:'16px', background:'#6366f1', marginBottom:'16px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h1 style={{ color:'white', fontSize:'26px', fontWeight:'700', letterSpacing:'-0.5px', margin:0 }}>AgendaPro</h1>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'14px', marginTop:'6px' }}>Sistema de Agenda Profissional</p>
        </div>

        {/* Card de login */}
        <div style={{ background:'white', borderRadius:'20px', padding:'36px', boxShadow:'0 25px 60px rgba(0,0,0,0.35)' }}>
          <h2 style={{ fontSize:'20px', fontWeight:'700', color:'#1a1a2e', marginBottom:'4px' }}>Entrar na sua conta</h2>
          <p style={{ fontSize:'14px', color:'#9ca3af', marginBottom:'28px' }}>Bem-vindo de volta! 👋</p>

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
                onFocus={e => { e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)' }}
                onBlur={e  => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.boxShadow='none' }}
              />
            </div>

            <div>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box', transition:'border-color .15s' }}
                onFocus={e => { e.currentTarget.style.borderColor='#6366f1'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(99,102,241,0.12)' }}
                onBlur={e  => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.boxShadow='none' }}
              />
            </div>

            {erro && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#dc2626', wordBreak:'break-word', lineHeight:'1.5' }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              style={{
                width:'100%', background: carregando ? '#a5b4fc' : '#6366f1',
                color:'white', border:'none', borderRadius:'8px',
                padding:'12px', fontSize:'15px', fontWeight:'600',
                cursor: carregando ? 'not-allowed' : 'pointer',
                transition:'background .15s',
                marginTop:'4px',
              }}
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:'12px', marginTop:'24px' }}>
          © {new Date().getFullYear()} AgendaPro. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
