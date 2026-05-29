'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('APP ERROR:', error)
  }, [error])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', padding:'20px' }}>
      <div style={{ background:'white', borderRadius:'16px', padding:'32px', maxWidth:'600px', width:'100%' }}>
        <h2 style={{ fontSize:'20px', fontWeight:'700', color:'#dc2626', marginBottom:'12px' }}>Erro na aplicação</h2>
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'16px', marginBottom:'16px', fontFamily:'monospace', fontSize:'13px', color:'#991b1b', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
          {error?.message || 'Erro desconhecido'}
          {error?.stack ? '\n\n' + error.stack.slice(0, 800) : ''}
        </div>
        <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'16px' }}>
          Digest: {error?.digest || 'N/A'}
        </p>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={reset} style={{ background:'#6366f1', color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>
            Tentar novamente
          </button>
          <button onClick={() => window.location.href = '/auth/login'} style={{ background:'#f3f4f6', color:'#374151', border:'none', borderRadius:'8px', padding:'10px 20px', cursor:'pointer', fontSize:'14px' }}>
            Voltar ao login
          </button>
        </div>
      </div>
    </div>
  )
}
