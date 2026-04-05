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
  return `---
name: ${name}
description: ${description}
---

# ${name}

This skill was converted from the legacy agent profile \`.agent/agents/${sourceFile}\`.

${body.trim()}
`
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
