import fs from 'node:fs'
const content = fs.readFileSync('.env', 'utf8')
const line = content.split('\n').find(l => l.includes('VITE_SUPABASE_URL'))
console.log('Line:', JSON.stringify(line))
for (let i = 0; i < line.length; i++) {
  console.log(`${line[i]}: ${line.charCodeAt(i)}`)
}
