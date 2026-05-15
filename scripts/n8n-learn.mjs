/**
 * n8n-learn — alimenta o @n8n-specialist com conhecimento de vídeos do YouTube
 *
 * Uso:
 *   node scripts/n8n-learn.mjs <youtube-url>
 *   node scripts/n8n-learn.mjs https://www.youtube.com/watch?v=XXXX
 *
 * Pré-requisitos:
 *   1. yt-dlp instalado:  winget install yt-dlp.yt-dlp
 *   2. ANTHROPIC_API_KEY no .env
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'

// ─── Config ────────────────────────────────────────────────────────────────

const KNOWLEDGE_DIR = join(homedir(), '.claude', 'knowledge', 'n8n')
const AGENT_FILE = join(homedir(), '.claude', 'agents', 'n8n-specialist.md')

// ─── Helpers ───────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const env = readFileSync('.env', 'utf8')
    for (const line of env.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* .env opcional */ }
}

function checkYtDlp() {
  const r = spawnSync('yt-dlp', ['--version'], { encoding: 'utf8' })
  if (r.error || r.status !== 0) {
    console.error('\nERRO: yt-dlp não encontrado.')
    console.error('Instale com:  winget install yt-dlp.yt-dlp')
    console.error('Ou baixe em:  https://github.com/yt-dlp/yt-dlp/releases\n')
    process.exit(1)
  }
  return r.stdout.trim()
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function downloadTranscript(url, outDir) {
  // Tenta legendas manuais primeiro (pt-BR, pt, en), depois auto-geradas
  const langs = 'pt-BR,pt,en'
  const base = join(outDir, 'transcript')

  console.log('Baixando transcrição...')

  // 1. Legendas manuais
  spawnSync('yt-dlp', [
    '--skip-download',
    '--write-subs',
    '--sub-langs', langs,
    '--sub-format', 'vtt',
    '--convert-subs', 'vtt',
    '-o', base,
    url
  ], { encoding: 'utf8' })

  // 2. Auto-geradas se não encontrou legendas manuais
  const foundVtt = readdirSync(outDir).filter(f => f.endsWith('.vtt'))
  if (foundVtt.length === 0) {
    console.log('Sem legendas manuais — tentando auto-geradas...')
    spawnSync('yt-dlp', [
      '--skip-download',
      '--write-auto-subs',
      '--sub-langs', langs,
      '--sub-format', 'vtt',
      '--convert-subs', 'vtt',
      '-o', base,
      url
    ], { encoding: 'utf8' })
  }

  // Localiza o .vtt baixado
  const vtts = readdirSync(outDir).filter(f => f.endsWith('.vtt'))
  if (vtts.length === 0) {
    console.error('Nenhuma transcrição encontrada para este vídeo.')
    console.error('O vídeo pode não ter legendas ou closed captions disponíveis.')
    process.exit(1)
  }

  return join(outDir, vtts[0])
}

function getVideoTitle(url) {
  const r = spawnSync('yt-dlp', ['--get-title', url], { encoding: 'utf8' })
  return (r.stdout || '').trim() || 'Video sem título'
}

function parseVtt(vttPath) {
  const content = readFileSync(vttPath, 'utf8')
  const lines = content.split('\n')
  const textLines = []
  let lastText = ''

  for (const line of lines) {
    // Pula headers, timestamps e linhas de controle
    if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.match(/^\d+$/) || line.match(/^\d{2}:\d{2}/)) continue
    const clean = line
      .replace(/<[^>]+>/g, '')        // Remove tags HTML/VTT
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .trim()
    if (clean && clean !== lastText) {
      textLines.push(clean)
      lastText = clean
    }
  }

  return textLines.join(' ').replace(/\s+/g, ' ').trim()
}

async function extractKnowledgeWithClaude(title, url, transcript) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('\nERRO: ANTHROPIC_API_KEY não encontrada no .env')
    process.exit(1)
  }

  console.log('Processando com Claude...')

  // Limita transcrição a ~60k chars para não estourar contexto
  const maxChars = 60_000
  const truncated = transcript.length > maxChars
    ? transcript.slice(0, maxChars) + '\n\n[...transcrição truncada...]'
    : transcript

  const prompt = `Você é um especialista em n8n. Analise a transcrição deste vídeo e extraia conhecimento estruturado.

Título: ${title}
URL: ${url}

TRANSCRIÇÃO:
${truncated}

---

Extraia e estruture o conhecimento em formato Markdown com estas seções:

## Resumo
(2-3 frases do que o vídeo ensina)

## Nós n8n Demonstrados
(lista dos nodes usados/ensinados, com breve descrição do uso)

## Padrões e Técnicas
(padrões de workflow, técnicas, boas práticas ensinadas)

## Casos de Uso
(casos de uso práticos mostrados no vídeo)

## Snippets e Exemplos
(expressões, code nodes, configurações específicas mencionadas — copie literalmente se aparecer na transcrição)

## Armadilhas e Dicas
(erros comuns, dicas de performance, avisos mencionados)

Seja específico e técnico. Preserve termos em inglês para nodes e configurações do n8n.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('Erro na API Claude:', err)
    process.exit(1)
  }

  const data = await response.json()
  return data.content[0].text
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

function saveKnowledge(title, url, videoId, knowledge) {
  mkdirSync(KNOWLEDGE_DIR, { recursive: true })

  const date = new Date().toISOString().split('T')[0]
  const slug = slugify(title)
  const filename = `${date}-${slug}.md`
  const filepath = join(KNOWLEDGE_DIR, filename)

  const content = `---
title: "${title.replace(/"/g, "'")}"
source: ${url}
video_id: ${videoId}
date: ${date}
tags: [n8n, tutorial]
---

# ${title}

> Fonte: ${url}
> Ingerido em: ${date}

${knowledge}
`

  writeFileSync(filepath, content, 'utf8')
  return filepath
}

function updateAgentIndex() {
  if (!existsSync(AGENT_FILE)) return

  const agent = readFileSync(AGENT_FILE, 'utf8')
  const marker = '## Base de Conhecimento — Vídeos Aprendidos'

  if (agent.includes(marker)) return // já tem a seção

  const files = readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'))
  if (files.length === 0) return

  const insertion = `\n\n${marker}\n\nBiblioteca em \`~/.claude/knowledge/n8n/\` (${files.length} vídeo(s) ingerido(s)).\n\n**OBRIGATÓRIO antes de criar workflows complexos:**\n\`\`\`bash\nls ~/.claude/knowledge/n8n/\ncat ~/.claude/knowledge/n8n/ARQUIVO.md\n\`\`\`\n`

  // Insere antes da seção de Comandos
  const updated = agent.replace('## Comandos', insertion + '## Comandos')
  writeFileSync(AGENT_FILE, updated, 'utf8')
  console.log('Agente @n8n-specialist atualizado com referência à base de conhecimento.')
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  loadEnv()

  const url = process.argv[2]
  if (!url) {
    console.log('Uso: node scripts/n8n-learn.mjs <youtube-url>')
    console.log('Exemplo: node scripts/n8n-learn.mjs https://www.youtube.com/watch?v=XXXX')
    process.exit(0)
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    console.error('URL do YouTube inválida. Use o formato: https://www.youtube.com/watch?v=VIDEO_ID')
    process.exit(1)
  }

  // Verifica yt-dlp
  const ytdlpVersion = checkYtDlp()
  console.log(`yt-dlp ${ytdlpVersion} encontrado.`)

  // Pega título
  console.log('Obtendo título do vídeo...')
  const title = getVideoTitle(url)
  console.log(`Título: ${title}`)

  // Cria diretório temporário
  const tmpDir = join(tmpdir(), `n8n-learn-${videoId}`)
  mkdirSync(tmpDir, { recursive: true })

  try {
    // Download da transcrição
    const vttPath = downloadTranscript(url, tmpDir)
    console.log(`Transcrição baixada: ${vttPath}`)

    // Parse do VTT para texto limpo
    const transcript = parseVtt(vttPath)
    console.log(`Transcrição: ${transcript.length} caracteres`)

    if (transcript.length < 200) {
      console.error('Transcrição muito curta ou vazia — vídeo pode não ter legendas utilizáveis.')
      process.exit(1)
    }

    // Extração de conhecimento com Claude
    const knowledge = await extractKnowledgeWithClaude(title, url, transcript)

    // Salva no knowledge dir
    const savedPath = saveKnowledge(title, url, videoId, knowledge)
    console.log(`\nConhecimento salvo em:\n  ${savedPath}`)

    // Atualiza referência no agente
    updateAgentIndex()

    // Preview
    console.log('\n--- Prévia do conhecimento extraído ---')
    console.log(knowledge.slice(0, 800) + (knowledge.length > 800 ? '\n[...]' : ''))
    console.log('\n@n8n-specialist agora sabe o que este vídeo ensina.')

  } finally {
    // Limpa arquivos temporários
    try {
      for (const f of readdirSync(tmpDir)) unlinkSync(join(tmpDir, f))
    } catch { /* ignora */ }
  }
}

main().catch(err => {
  console.error('Erro:', err.message)
  process.exit(1)
})
