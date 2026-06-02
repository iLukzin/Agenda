#!/usr/bin/env node
// Script de envio de parabens de aniversario
// Cron no VPS: 0 13 * * * (13h UTC = 10h BRT)
// Instalar: cp scripts/aniversario.js /opt/scripts/aniversario.js
// Testar:   node /opt/scripts/aniversario.js --test

const https = require('https')
const http = require('http')

// Carregar .env se existir
const path = require('path')
const fs = require('fs')
const envFile = '/opt/scripts/.env'
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) process.env[k.trim()] = v.join('=').trim()
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const TEST_MODE = process.argv.includes('--test')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERRO] Variaveis nao configuradas. Crie /opt/scripts/.env com:')
  console.error('NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co')
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx')
  process.exit(1)
}

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }
    const r = lib.request(options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode, body: data }))
    })
    r.on('error', reject)
    if (opts.body) r.write(opts.body)
    r.end()
  })
}

async function sbGet(table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`
  const r = await req(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
  try { return JSON.parse(r.body) } catch { return [] }
}

async function sbPost(table, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`
  const r = await req(url, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  })
  return r.ok
}

async function main() {
  // Horario de Brasilia
  const agora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const dia  = String(agora.getDate()).padStart(2, '0')
  const mes  = String(agora.getMonth() + 1).padStart(2, '0')
  const hoje = `${dia}/${mes}`

  console.log(`[${new Date().toISOString()}] Aniversarios do dia ${hoje}${TEST_MODE ? ' [MODO TESTE]' : ''}`)

  // Config da Evolution API
  const cfg = await sbGet('config_sistema', 'select=chave,valor&chave=in.(evolution_api_url,evolution_api_key)')
  const cfgMap = {}
  if (Array.isArray(cfg)) cfg.forEach(c => { cfgMap[c.chave] = c.valor || '' })
  const apiUrl = cfgMap['evolution_api_url']
  const apiKey = cfgMap['evolution_api_key']

  if (!apiUrl || !apiKey) {
    console.log('[AVISO] Evolution API nao configurada no sistema.')
    return
  }

  // Empresas com automacao ativa
  const empresas = await sbGet('empresas', 'select=id,nome,whatsapp_instancia,wpp_auto_aniversario,whatsapp_habilitado&wpp_auto_aniversario=eq.true&whatsapp_habilitado=eq.true')
  if (!Array.isArray(empresas) || empresas.length === 0) {
    console.log('Nenhuma empresa com automacao de aniversario ativa.')
    return
  }
  console.log(`${empresas.length} empresa(s) com automacao ativa.`)

  for (const empresa of empresas) {
    const instancia = empresa.whatsapp_instancia || ('emp-' + empresa.id.slice(0, 8))
    console.log(`\n--- ${empresa.nome} (${instancia}) ---`)

    // Verificar conexao WPP
    try {
      const stRes = await req(`${apiUrl.replace(/\/$/, '')}/instance/connectionState/${instancia}`, { headers: { apikey: apiKey } })
      const stData = JSON.parse(stRes.body)
      const state = stData?.instance?.state || stData?.state || ''
      if (state !== 'open' && state !== 'connected') {
        console.log(`  WhatsApp desconectado (estado: ${state || 'desconhecido'}). Pulando.`)
        continue
      }
      console.log(`  WhatsApp conectado OK`)
    } catch (e) {
      console.log(`  Erro ao verificar conexao: ${e.message}`)
      continue
    }

    // Buscar todos clientes ativos com data_nascimento
    const clientes = await sbGet('clientes', `select=id,nome,whatsapp,telefone,data_nascimento&empresa_id=eq.${empresa.id}&status=eq.ativo&data_nascimento=not.is.null`)
    if (!Array.isArray(clientes) || clientes.length === 0) {
      console.log('  Nenhum cliente com data de nascimento cadastrada.')
      continue
    }

    // Filtrar aniversariantes de hoje
    const aniversariantes = clientes.filter(c => {
      if (!c.data_nascimento) return false
      // data_nascimento pode ser YYYY-MM-DD ou DD/MM/YYYY
      let d, m
      if (c.data_nascimento.includes('-')) {
        const parts = c.data_nascimento.split('-')
        d = parts[2]?.slice(0,2)
        m = parts[1]
      } else if (c.data_nascimento.includes('/')) {
        const parts = c.data_nascimento.split('/')
        d = parts[0]
        m = parts[1]
      }
      return d === dia && m === mes
    })

    if (TEST_MODE && aniversariantes.length === 0) {
      console.log(`  [TESTE] Nenhum aniversariante hoje. Usando primeiro cliente para teste.`)
      if (clientes.length > 0) aniversariantes.push(clientes[0])
    }

    console.log(`  ${clientes.length} clientes com data | ${aniversariantes.length} aniversariante(s) hoje`)

    if (aniversariantes.length === 0) continue

    // Template de aniversario
    const templates = await sbGet('mensagens_template', `select=mensagem&empresa_id=eq.${empresa.id}&tipo=eq.aniversario&ativo=eq.true&limit=1`)
    const nl = '\n'
    const templateMsg = (Array.isArray(templates) && templates[0]?.mensagem) ||
      ('Ola {{cliente}}! Parabens pelo seu aniversario!' + nl + nl +
       'A equipe da *{{empresa}}* deseja a voce um dia incrivel!' + nl + nl +
       'Muitas felicidades!')

    // Enviar
    let ok = 0, err = 0
    for (const c of aniversariantes) {
      const numero = c.whatsapp || c.telefone
      if (!numero) { console.log(`  [SKIP] ${c.nome} - sem numero`); err++; continue }
      const digits = numero.replace(/\D/g, '')
      const numFmt = digits.startsWith('55') ? digits : '55' + digits
      const msg = templateMsg.replace(/\{\{cliente\}\}/g, c.nome).replace(/\{\{empresa\}\}/g, empresa.nome)

      if (TEST_MODE) {
        console.log(`  [TESTE] Simulando envio para ${c.nome} (${numFmt})`)
        console.log(`  Mensagem: ${msg.slice(0, 80)}...`)
        ok++; continue
      }

      try {
        const res = await req(`${apiUrl.replace(/\/$/, '')}/message/sendText/${instancia}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: numFmt, options: { delay: 1000 }, text: msg }),
        })
        if (res.ok) {
          console.log(`  [OK] ${c.nome} (${numFmt})`)
          await sbPost('mensagens_enviadas', { empresa_id: empresa.id, cliente_id: c.id, tipo: 'aniversario', numero: numFmt, mensagem: msg, status: 'enviado' })
          ok++
        } else {
          console.log(`  [ERRO] ${c.nome}: ${res.body.slice(0, 80)}`)
          err++
        }
      } catch (e) {
        console.log(`  [ERRO] ${c.nome}: ${e.message}`)
        err++
      }
      await new Promise(r => setTimeout(r, 800))
    }
    console.log(`  Resultado: ${ok} enviados, ${err} erros`)
  }
  console.log('\n[CONCLUIDO]')
}

main().catch(e => { console.error('[FATAL]', e.message); process.exit(1) })
