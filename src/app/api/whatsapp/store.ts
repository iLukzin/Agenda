// Store global de sessoes WhatsApp (em memoria por processo Next.js)
// Para producao real usar Redis ou banco - mas para MVP funciona
export const sessoes: Map<string, {
  qr?: string
  conectado: boolean
  socket?: any
  timestamp: number
}> = new Map()
