'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro(`Erro: ${error.message}`)
      setCarregando(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f0f17 0%, #1a1a2e 50%, #16213e 100%)' }}>
      <div className="relative w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background:'#6366f1' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h1 style={{ color:'white', fontSize:'26px', fontWeight:'600', letterSpacing:'-0.5px' }}>AgendaPro</h1>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:'14px', marginTop:'4px' }}>Sistema de Agenda Profissional</p>
        </div>

        <div style={{ background:'white', borderRadius:'20px', padding:'36px', boxShadow:'0 25px 60px rgba(0,0,0,0.3)' }}>
          <h2 style={{ fontSize:'20px', fontWeight:'600', color:'#1a1a2e', marginBottom:'6px' }}>Entrar na sua conta</h2>
          <p style={{ fontSize:'14px', color:'#6b7280', marginBottom:'28px' }}>Bem-vindo de volta!</p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>E-mail</label>
              <input
                type="email"
                style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom:'24px' }}>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#374151', marginBottom:'6px' }}>Senha</label>
              <input
                type="password"
                style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
                placeholder="••••••••"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                required
              />
            </div>

            {erro && (
              <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'13px', color:'#dc2626', wordBreak:'break-word' }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              style={{ width:'100%', background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'11px', fontSize:'15px', fontWeight:'500', cursor:'pointer' }}
            >
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
