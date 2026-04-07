import { getSupabaseAdmin } from './supabase-admin.mjs'
import { loadEnv } from './load-env.mjs'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

/**
 * Busca o resumo financeiro do usuário para usar como contexto da IA.
 */
async function getContextoFinanceiro(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: transacoes, error } = await supabaseAdmin
    .from('transacoes')
    .select(`
      tipo, valor, descricao, data_transacao, status,
      categorias(nome),
      subcategorias(nome)
    `)
    .eq('usuario_id', usuarioId)
    .order('data_transacao', { ascending: false })
    .limit(100)

  if (error || !transacoes || transacoes.length === 0) {
    return null
  }

  const totalReceitas = transacoes
    .filter(t => t.tipo === 'RECEITA')
    .reduce((sum, t) => sum + parseFloat(t.valor), 0)

  const totalDespesas = transacoes
    .filter(t => t.tipo === 'DESPESA')
    .reduce((sum, t) => sum + parseFloat(t.valor), 0)

  const saldo = totalReceitas - totalDespesas

  // Agrupar despesas por categoria
  const categoriasDespesas = {}
  transacoes
    .filter(t => t.tipo === 'DESPESA')
    .forEach(t => {
      const cat = t.categorias?.nome || 'Sem categoria'
      categoriasDespesas[cat] = (categoriasDespesas[cat] || 0) + parseFloat(t.valor)
    })

  const topCategorias = Object.entries(categoriasDespesas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([nome, valor]) => `  - ${nome}: R$ ${valor.toFixed(2)}`)
    .join('\n')

  // Últimas 10 transações (resumidas)
  const ultimasTransacoes = transacoes.slice(0, 10).map(t => {
    const data = new Date(t.data_transacao).toLocaleDateString('pt-BR')
    const tipo = t.tipo === 'RECEITA' ? '+' : '-'
    const cat = t.categorias?.nome || 'Sem categoria'
    const desc = t.descricao ? ` (${t.descricao})` : ''
    return `  - ${data} | ${tipo} R$ ${parseFloat(t.valor).toFixed(2)} | ${cat}${desc}`
  }).join('\n')

  return `
Resumo financeiro do usuário:
- Total de transações registradas: ${transacoes.length}
- Total de Receitas: R$ ${totalReceitas.toFixed(2)}
- Total de Despesas: R$ ${totalDespesas.toFixed(2)}
- Saldo Atual: R$ ${saldo.toFixed(2)}

Top 5 categorias com mais gastos:
${topCategorias || '  (sem despesas registradas)'}

Últimas 10 transações:
${ultimasTransacoes || '  (sem transações)'}
  `.trim()
}

/**
 * Pergunta ao Horizon: chama a API do Gemini com contexto financeiro do usuário.
 * @param {string} message - Pergunta do usuário
 * @param {string} usuarioId - ID do usuário no banco
 * @param {Array} historico - Array de { role: 'user'|'model', text: string }
 * @returns {Promise<string>} Resposta textual do Gemini
 */
export async function askHorizon(message, usuarioId, historico = []) {
  loadEnv()
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no .env')
  }

  const contexto = await getContextoFinanceiro(usuarioId)

  const systemPrompt = `Você é o Horizon, um assistente financeiro pessoal inteligente e amigável do aplicativo "Horizonte Financeiro".

Seu papel é ajudar o usuário a entender e melhorar suas finanças pessoais. Sempre responda em português brasileiro de forma clara, concisa e útil.

Regras importantes:
- Se houver dados financeiros disponíveis, use-os para dar respostas precisas e personalizadas.
- Se os dados não cobrem o que foi perguntado, diga isso de forma honesta e gentil.
- Seja encorajador e proativo com dicas financeiras quando fizer sentido.
- Não invente valores ou dados que não estejam no contexto fornecido.
- Formate valores monetários em Reais (R$) com duas casas decimais.
- Respostas devem ser curtas e objetivas (máximo 3-4 parágrafos normalmente).

${contexto ? `--- DADOS FINANCEIROS ATUAIS DO USUÁRIO ---\n${contexto}\n--- FIM DOS DADOS ---` : 'O usuário ainda não possui transações registradas. Incentive-o a começar a registrar suas finanças.'}`

  // Montar histórico de conversa no formato do Gemini
  const contents = []

  for (const msg of historico.slice(-10)) { // Últimas 10 msgs por contexto
    contents.push({
      role: msg.role,
      parts: [{ text: msg.text }]
    })
  }

  // Adicionar a mensagem atual
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  })

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      }
    })
  })

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errBody}`)
  }

  const json = await response.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Resposta vazia da API do Gemini')
  }

  return text
}

/**
 * Interpreta uma mensagem de texto (ex: WhatsApp) e a transforma em um objeto de transação.
 * @param {string} message - A mensagem enviada pelo usuário
 * @param {Array} categoriasUsuario - Array das categorias do usuário para mapeamento
 * @returns {Promise<Object>} JSON estruturado
 */
export async function parseWhatsAppMessageWithAI(message, categoriasUsuario) {
  loadEnv()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada')

  // Mapeamos as categorias disponíveis para a IA de forma resumida
  const catMap = categoriasUsuario.map(c => 
    `Categoria: "${c.nome}" (Tipo: ${c.tipo}, ID: ${c.id}) | Subcategorias: ${c.subcategorias.map(s => `"${s.nome}" (ID: ${s.id})`).join(', ')}`
  ).join('\n')

  const systemPrompt = `Você é um robô de extração financeira. Seu papel é receber uma mensagem de texto de um usuário do WhatsApp e transformá-la num JSON estrito contendo os dados da transação financeira.

REGRAS:
1. Retorne APENAS um objeto JSON válido, sem \`\`\`json, sem textos extras em volta.
2. Campos do JSON que você deve retornar:
  - "tipo": "RECEITA" ou "DESPESA" (obrigatório)
  - "valor": um número float representando o valor (obrigatório, se não achar tente deduzir, caso contrário retorne nulo)
  - "descricao": uma breve string do que foi o gasto/receita (obrigatório)
  - "categoria_id": a UUID da categoria mais próxima na lista fornecida. Se nenhuma bater, retorne null.
  - "subcategoria_id": a UUID da subcategoria mais próxima. Se nenhuma bater, retorne null.

DADOS DO USUÁRIO PARA MAPEAR:
${catMap || 'O usuário não tem categorias configuradas.'}

MENSAGEM RECEBIDA PARA ANÁLISE:
"${message}"

(Lembre-se: Retorne SOMENTE o JSON puro.)`

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: systemPrompt }]
      }],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.2, // Baixa temperatura para ser o mais determinístico possível
      }
    })
  })

  if (!response.ok) {
    throw new Error('Falha na API da IA ao analisar mensagem.')
  }

  const json = await response.json()
  let text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  
  text = text.trim()
  if (text.startsWith('\`\`\`json')) text = text.replace('\`\`\`json', '').replace('\`\`\`', '')
  else if (text.startsWith('\`\`\`')) text = text.replace('\`\`\`', '').replace('\`\`\`', '')

  try {
    return JSON.parse(text.trim())
  } catch (parseError) {
    throw new Error('A IA não conseguiu estruturar os dados da mensagem (' + message + ') corretamente.')
  }
}
