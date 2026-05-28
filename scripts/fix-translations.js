#!/usr/bin/env node
// Executa ANTES do build - corrige traducoes automaticas do navegador
const fs = require('fs')
const path = require('path')

const files = []
function walk(dir) {
  if (!fs.existsSync(dir)) return
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f)
    if (fs.statSync(full).isDirectory()) walk(full)
    else if (f.endsWith('.tsx') || f.endsWith('.ts')) files.push(full)
  })
}
walk('src')

const fixes = [
  ['retornar (', 'return ('],
  ['retornar(', 'return('],
  ['retornar nulo', 'return null'],
  ['retornar falso', 'return false'],
  ['retornar verdadeiro', 'return true'],
  ['exportar padrao ', 'export default '],
  ['funcao ', 'function '],
  ['assincrono ', 'async '],
  ['aguardar ', 'await '],
]

let fixed = 0
files.forEach(file => {
  let c = fs.readFileSync(file, 'utf8')
  let changed = false
  fixes.forEach(([pt, en]) => {
    if (c.includes(pt)) { c = c.split(pt).join(en); changed = true }
  })
  if (changed) { fs.writeFileSync(file, c, 'utf8'); fixed++; console.log('Fixed:', file) }
})
console.log('Done. Fixed', fixed, 'files')
