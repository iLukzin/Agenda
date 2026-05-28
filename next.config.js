/** @type {import('next').NextConfig} */

// Corrige traducoes automaticas antes de qualquer compilacao
const fs = require('fs')
const path = require('path')

function fixTranslations(dir) {
  if (!fs.existsSync(dir)) return
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      fixTranslations(full)
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      let c = fs.readFileSync(full, 'utf8')
      const fixes = [
        ['retornar (', 'return ('],
        ['retornar(', 'return('],
        ['retornar nulo', 'return null'],
        ['retornar falso', 'return false'],
        ['retornar verdadeiro', 'return true'],
      ]
      let changed = false
      fixes.forEach(([pt, en]) => {
        if (c.includes(pt)) { c = c.split(pt).join(en); changed = true }
      })
      if (changed) {
        fs.writeFileSync(full, c, 'utf8')
        console.log('[fix-translations] Fixed:', full)
      }
    }
  })
}

// Executa a correcao ao carregar o next.config.js
fixTranslations(path.join(__dirname, 'src'))

const nextConfig = {}
module.exports = nextConfig
