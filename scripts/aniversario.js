// Script de envio de parabens de aniversario
// Roda todo dia as 10h via cron no VPS
// Cron: 0 10 * * * /home/evolution/.nvm/versions/node/v20.10.0/bin/node /opt/scripts/aniversario.js

const https = require('https')
const http = require('http')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERRO: Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function supabaseGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1/' + path)
    const lib = url.protocol === 'https:' ? https : http
    const req = lib.request(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
      }
    }, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve([]) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.request(parsed, options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode, text: () => Promise.resolve(data) }))
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

async function main() {
  const hoje = new Date()
  const diaBR  = String(hoje.getDate()).padStart(2, '0')
  const mesBR  = String(hoje.getMonth() + 1).padStart(2, '0')
  console.log(`[${new Date().toISOString()}] Verificando aniversariantes do dia ${diaBR}/${mesBR}`)

  // Buscar empresas com wpp_auto_aniversario ativo e whatsapp_habilitado
  const empresas = await supabaseGet('empresas?select=id,nome,whatsapp_instancia,wpp_auto_aniversario,whatsapp_habilitado&wpp_auto_aniversario=eq.true&whatsapp_habilitado=eq.true')
  if (!Array.isArray(empresas) || empresas.length === 0) {
    console.log('Nenhuma empresa com automacao de aniversario ativa.')
    return
  }

  // Buscar config global da Evolution API
  const cfg = await supabaseGet('config_sistema?select=chave,valor&chave=in.(evolution_api_url,evolution_api_key)')
  const cfgMap = {}
  if (Array.isArray(cfg)) cfg.forEach(c => { cfgMap[c.chave] = c.valor || '' })
  const apiUrl = cfgMap['evolution_api_url']
  const apiKey = cfgMap['evolution_api_key']
  if (!apiUrl || !apiKey) { console.log('Evolution API nao configurada.'); return }

  for (const empresa of empresas) {
    const instancia = empresa.whatsapp_instancia || ('emp-' + empresa.id.slice(0, 8))
    console.log(`\nEmpresa: ${empresa.nome} | Instancia: ${instancia}`)

    // Buscar clientes aniversariantes hoje (campo data_nascimento formato YYYY-MM-DD)
    const clientes = await supabaseGet(
      `clientes?select=id,nome,whatsapp,telefone,data_nascimento&empresa_id=eq.${empresa.id}&status=eq.ativo&data_nascimento=not.is.null`
    )
    if (!Array.isArray(clientes) || clientes.length === 0) {
      console.log('  Nenhum cliente ativo com data de nascimento.')
      continue
    }

    // Filtrar os que fazem aniversario hoje
    const aniversariantes = clientes.filter(c => {
      if (!c.data_nascimento) return false
      const [, mm, dd] = c.data_nascimento.split('-')
      return dd === diaBR && mm === mesBR
    })

    console.log(`  ${aniversariantes.length} aniversariante(s) encontrado(s)`)
    if (aniversariantes.length === 0) continue

    // Buscar template de aniversario da empresa
    const templates = await supabaseGet(
      `mensagens_template?select=mensagem&empresa_id=eq.${empresa.id}&tipo=eq.aniversario&ativo=eq.true&limit=1`
    )
    const templateMsg = (Array.isArray(templates) && templates[0]?.mensagem)
      || `Ola {{cliente}}! Parabens pelo seu aniversario!\n\nA equipe da *{{empresa}}* deseja a voce um dia incrivel e cheio de alegria!\n\nMuitas felicidades!`

    // Verificar se WPP esta conectado
    try {
      const stRes = await fetchUrl(`${apiUrl.replace(/\/$/, '')}/instance/connectionState/${instancia}`, {
        headers: { 'apikey': apiKey }
      })
      const stData = JSON.parse(await stRes.text())
      const state = stData?.instance?.state || stData?.state || ''
      if (state !== 'open' && state !== 'connected') {
        console.log(`  WhatsApp desconectado (${state}). Pulando empresa.`)
        continue
      }
    } catch (e) {
      console.log(`  Erro ao verificar conexao: ${e.message}`)
      continue
    }

    // Enviar para cada aniversariante
    for (const cliente of aniversariantes) {
      const numero = cliente.whatsapp || cliente.telefone
      if (!numero) { console.log(`  [SKIP] ${cliente.nome} - sem numero`); continue }
      const digits = numero.replace(/\D/g, '')
      const numFmt = digits.startsWith('55') ? digits : '55' + digits
      const msg = templateMsg
        .replace(/\{\{cliente\}\}/g, cliente.nome)
        .replace(/\{\{empresa\}\}/g, empresa.nome)
      try {
        const res = await fetchUrl(`${apiUrl.replace(/\/$/, '')}/message/sendText/${instancia}`, {
          method: 'POST',
          headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: numFmt, options: { delay: 1000 }, text: msg }),
        })
        if (res.ok) {
          console.log(`  [OK] Parabens enviado para ${cliente.nome} (${numFmt})`)
          // Registrar envio
          await fetchUrl(`${SUPABASE_URL}/rest/v1/mensagens_enviadas`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ empresa_id: empresa.id, cliente_id: cliente.id, tipo: 'aniversario', numero: numFmt, mensagem: msg, status: 'enviado' }),
          })
        } else {
          const err = await res.text()
          console.log(`  [ERRO] ${cliente.nome}: ${err.slice(0, 80)}`)
        }
      } catch (e) {
        console.log(`  [ERRO] ${cliente.nome}: ${e.message}`)
      }
      await new Promise(r => setTimeout(r, 800))
    }
  }
  console.log('\nConcluido.')
}

main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1) })
