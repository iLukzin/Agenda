'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]           = useState('')
  const [senha, setSenha]           = useState('')
  const [erro, setErro]             = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const supabase = createClient()

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })

      if (error) {
        setErro('E-mail ou senha incorretos.')
        setCarregando(false)
        return
      }

      // Redireciona para o dashboard
      // window.location.href garante que o browser recarrega tudo
      // e o middleware consegue ler o cookie de sessão corretamente
      window.location.href = '/dashboard'

    } catch {
      setErro('Erro inesperado. Tente novamente.')
      setCarregando(false)
    }
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
          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'72px', height:'72px', borderRadius:'18px', background:'white', marginBottom:'16px', padding:'6px' }}>
            <img src="/logo-fortitude.png" alt="Fortitude" style={{ width:'60px', height:'60px', objectFit:'contain' }}/>
          </div>
          <h1 style={{ color:'white', fontSize:'26px', fontWeight:'700', letterSpacing:'-0.5px', margin:0 }}>
            AgendaFortitude
          </h1>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'14px', marginTop:'6px' }}>
            Sistema de Agenda Profissional
          </p>
        </div>

        {/* Card */}
        <div style={{ background:'white', borderRadius:'20px', padding:'36px', boxShadow:'0 25px 60px rgba(0,0,0,0.35)' }}>
          <h2 style={{ fontSize:'20px', fontWeight:'700', color:'#1a1a2e', marginBottom:'4px', margin:0 }}>
            Entrar na sua conta
          </h2>
          <p style={{ fontSize:'14px', color:'#9ca3af', marginBottom:'28px', marginTop:'4px' }}>
            Bem-vindo de volta! 👋
          </p>

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
                disabled={carregando}
                style={{
                  width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px',
                  padding:'10px 12px', fontSize:'14px', outline:'none',
                  boxSizing:'border-box', background: carregando ? '#f9fafb' : 'white',
                }}
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
                placeholder="Sua senha"
                disabled={carregando}
                style={{
                  width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px',
                  padding:'10px 12px', fontSize:'14px', outline:'none',
                  boxSizing:'border-box', background: carregando ? '#f9fafb' : 'white',
                }}
              />
            </div>

            {erro && (
              <div style={{
                background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px',
                padding:'10px 14px', fontSize:'13px', color:'#dc2626',
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              style={{
                width:'100%',
                background: carregando ? '#a5b4fc' : '#6366f1',
                color:'white', border:'none', borderRadius:'8px',
                padding:'12px', fontSize:'15px', fontWeight:'600',
                cursor: carregando ? 'not-allowed' : 'pointer',
                marginTop:'4px',
                display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
              }}
            >
              {carregando && (
                <span style={{
                  width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)',
                  borderTop:'2px solid white', borderRadius:'50%',
                  display:'inline-block', animation:'spin 0.7s linear infinite',
                }}/>
              )}
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:'12px', marginTop:'24px' }}>
          AgendaFortitude {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
