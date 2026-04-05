import fs from 'node:fs/promises'
import path from 'node:path'

const projectRoot = process.cwd()
const sourceDir = path.join(projectRoot, '.agent', 'agents')
const targetDir = path.join(projectRoot, '.agents', 'skills')

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseFrontmatter(content) {
  if (!content.startsWith('---')) {
    return { metadata: {}, body: content.trimStart() }
  }

  const parts = content.split(/^---\s*$/m)
  if (parts.length < 3) {
    return { metadata: {}, body: content.trimStart() }
  }

  const rawMetadata = parts[1]
  const body = parts.slice(2).join('---').trimStart()
  const metadata = {}

  for (const line of rawMetadata.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)\s*$/)
    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    metadata[key] = rawValue.trim()
  }

  return { metadata, body }
}

function buildSkillContent({ name, description, body, sourceFile }) {
  const summary = extractSummary(body)
  const focusAreas = extractFocusAreas(description)

  return `---
name: ${name}
description: ${description}
---

# ${name}

Converted from the legacy profile \`.agent/agents/${sourceFile}\` into Codex skill format.

## Mission

${summary}

## Focus Areas

${focusAreas.map((item) => `- ${item}`).join('\n')}

## Operating Rules

- Stay inside this specialty and hand off cross-domain work to the more appropriate skill.
- Clarify requirements only when ambiguity would change architecture, scope, or risk.
- Prefer reviewing existing code and constraints before proposing changes.
- Validate the result with the simplest reliable check available for the task.
- Keep recommendations practical, implementation-oriented, and easy to act on.

## Workflow

1. Identify the part of the task that belongs to this specialty.
2. Inspect the relevant files, dependencies, and constraints.
3. Make or recommend changes that fit the project’s current stack and conventions.
4. Call out risks, missing validation, or follow-up work in this domain.

## Legacy Notes

${extractLegacyHeadings(body).map((item) => `- ${item}`).join('\n')}
`
}

function extractSummary(body) {
  const lines = body.split(/\r?\n/).map((line) => line.trim())
  const paragraphLines = []

  for (const line of lines) {
    if (!line) {
      if (paragraphLines.length) {
        break
      }
      continue
    }

    if (line.startsWith('#') || line.startsWith('|') || line.startsWith('- ') || line.startsWith('>')) {
      continue
    }

    paragraphLines.push(line)
  }

  if (paragraphLines.length) {
    return paragraphLines.join(' ')
  }

  return 'Apply this specialist role when the task matches this domain and benefit from its review, implementation, and risk framing.'
}

function extractFocusAreas(description) {
  const clean = description.replace(/\.$/, '')
  const pieces = clean
    .split(/Use for|Use when|Triggers on|Triggers:/i)
    .map((part) => part.trim())
    .filter(Boolean)

  const areas = new Set()

  if (pieces[0]) {
    areas.add(pieces[0])
  }

  for (const piece of pieces.slice(1)) {
    for (const fragment of piece.split(/,| and /i).map((item) => item.trim()).filter(Boolean)) {
      areas.add(fragment)
    }
  }

  return [...areas].slice(0, 6)
}

function extractLegacyHeadings(body) {
  const headings = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^##?\s+/.test(line))
    .map((line) => line.replace(/^##?\s+/, ''))

  if (headings.length) {
    return headings.slice(0, 8)
  }

  return ['Legacy profile converted to skill format for Codex discovery.']
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function main() {
  await ensureDir(targetDir)

  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  const markdownFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))

  const created = []

  for (const file of markdownFiles) {
    const sourcePath = path.join(sourceDir, file.name)
    const raw = await fs.readFile(sourcePath, 'utf8')
    const { metadata, body } = parseFrontmatter(raw)

    const baseName = metadata.name ? slugify(metadata.name) : slugify(path.basename(file.name, '.md'))
    const skillName = baseName || slugify(path.basename(file.name, '.md'))
    const description = metadata.description
      ? metadata.description.replace(/^"|"$/g, '')
      : `Converted legacy agent profile from .agent/agents/${file.name}. Use when the task matches this specialist role.`

    const skillFolder = path.join(targetDir, skillName)
    const skillFile = path.join(skillFolder, 'SKILL.md')

    await ensureDir(skillFolder)
    await fs.writeFile(
      skillFile,
      buildSkillContent({
        name: skillName,
        description,
        body,
        sourceFile: file.name,
      }),
      'utf8'
    )

    created.push(path.relative(projectRoot, skillFile))
  }

  console.log(`Converted ${created.length} agent profiles into skills:`)
  for (const file of created) {
    console.log(`- ${file}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
