import { createClient } from './supabase'

export type ConfigWpp = {
  api_url: string
  api_token: string
  instancia: string
}

// Formata numero para WhatsApp (somente digitos, com 55 Brasil)
export function formatarNumero(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  if (digits.length === 11 || digits.length === 10) return '55' + digits
  return digits
}

// Envia mensagem via Evolution API (padrao mais usado no Brasil)
export async function enviarMensagem(config: ConfigWpp, numero: string, mensagem: string): Promise<{ ok: boolean; erro?: string }> {
  const num = formatarNumero(numero)
  if (!num || num.length < 10) return { ok: false, erro: 'Numero invalido' }
  if (!config.api_url || !config.api_token) return { ok: false, erro: 'API nao configurada' }

  try {
    const url = config.api_url.replace(/\/$/, '') + '/message/sendText/' + config.instancia
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_token,
      },
      body: JSON.stringify({
        number: num,
        options: { delay: 1000, presence: 'composing' },
        text: mensagem,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      return { ok: false, erro: 'Erro API: ' + err.slice(0, 100) }
    }
    return { ok: true }
  } catch (ex: any) {
    return { ok: false, erro: ex.message }
  }
}

// Registra envio no banco
export async function registrarEnvio(empresaId: string, dados: {
  cliente_id?: string; agendamento_id?: string; tipo: string; numero: string; mensagem: string; status: string
}) {
  const sb = createClient()
  await sb.from('mensagens_enviadas').insert({ empresa_id: empresaId, ...dados })
}

// Substitui variaveis na mensagem
export function aplicarVariaveis(template: string, vars: Record<string, string>): string {
  let msg = template
  Object.entries(vars).forEach(([k, v]) => {
    msg = msg.split('{{' + k + '}}').join(v)
    msg = msg.split('{' + k + '}').join(v)
  })
  return msg
}

// Carregar config WhatsApp da empresa
export async function carregarConfigWpp(empresaId: string): Promise<ConfigWpp | null> {
  const sb = createClient()
  const { data } = await sb
    .from('empresas')
    .select('whatsapp_api_url,whatsapp_api_token,whatsapp_instancia,whatsapp_ativo')
    .eq('id', empresaId)
    .single()
  if (!data || !data.whatsapp_ativo) return null
  return {
    api_url: data.whatsapp_api_url || '',
    api_token: data.whatsapp_api_token || '',
    instancia: data.whatsapp_instancia || '',
  }
}
