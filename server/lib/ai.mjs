import { getSupabaseAdmin } from './supabase-admin.mjs'
import { loadEnv } from './load-env.mjs'
import { DEFAULT_CATEGORIES } from './transacoes.mjs'

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
  - "categoria_id": UUID EXATO de uma categoria da lista abaixo cujo "Tipo" seja igual a "tipo" (DESPESA ou RECEITA). Se nenhuma servir, null.
  - "subcategoria_id": UUID EXATO de uma subcategoria que pertença à categoria escolhida (mesma linha na lista). Se não houver subcategoria adequada ou categoria_id for null, use null.

3. A subcategoria_id DEVE ser filha da categoria_id (ambos da mesma categoria na lista). Nunca misture subcategoria de outra categoria.

4. Dicas de mapeamento (mensagem em português) — use os nomes EXATOS das categorias/subcategorias listados acima:
   - mercado, supermercado, feira → DESPESA Alimentação: ex. "Supermercado", "Feira e Sacolão", "Padaria e Cafeteira", "Delivery (iFood, etc)".
   - combustível, posto → Transporte: "Combustível".
   - Uber, 99, táxi → Transporte: "App de Transporte (Uber, 99)" ou "Táxi".
   - restaurante, lanche, iFood → Alimentação: "Restaurantes e Lanches", "Fast Food" ou "Delivery (iFood, etc)".

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

  let parsed
  try {
    parsed = JSON.parse(text.trim())
  } catch (parseError) {
    // Fallback 1: tentar extrair apenas o bloco JSON de dentro do texto retornado
    try {
      const firstBrace = text.indexOf('{')
      const lastBrace = text.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const inner = text.slice(firstBrace, lastBrace + 1)
        parsed = JSON.parse(inner)
      } else {
        throw new Error('no_json_block_found')
      }
    } catch {
      // Fallback 2: parser simples local (sem IA) para mensagens do tipo "Gastei 20 reais na padaria"
      const simples = fallbackParseMensagemSimples(message)
      if (!simples) {
        throw new Error('A IA não conseguiu estruturar os dados da mensagem (' + message + ') corretamente.')
      }
      parsed = simples
    }
  }

  const sanitized = sanitizeTransacaoExtraidaIA(parsed, categoriasUsuario)
  return enriquecerCategoriaPorTexto(message, sanitized, categoriasUsuario)
}

/**
 * Garante que categoria/subcategoria existem, batem com o tipo e a sub pertence à categoria.
 */
export function sanitizeTransacaoExtraidaIA(extractedData, categoriasUsuario) {
  if (!extractedData || typeof extractedData !== 'object') return extractedData

  const tipo = extractedData.tipo
  if (tipo !== 'DESPESA' && tipo !== 'RECEITA') return extractedData

  const cat = categoriasUsuario.find((c) => c.id === extractedData.categoria_id)
  if (!cat || cat.tipo !== tipo) {
    extractedData.categoria_id = null
    extractedData.subcategoria_id = null
    return extractedData
  }

  if (extractedData.subcategoria_id) {
    const subOk = cat.subcategorias?.some((s) => s.id === extractedData.subcategoria_id)
    if (!subOk) extractedData.subcategoria_id = null
  }

  return extractedData
}

function normTxt(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function inferTipoBasicoFromTexto(message) {
  const m = normTxt(message)
  if (/(recebi|ganhei|entrou|caiu na conta|salario|salário|deposito|dep[oó]sito|pix recebido)/.test(m)) {
    return 'RECEITA'
  }
  if (/(gastei|paguei|pago|pagando|comprei|enviei pix|fiz um pix|transferi|debito|d[eé]bito|saquei)/.test(m)) {
    return 'DESPESA'
  }
  // Se falar "gasto", "conta", "boleto" assumimos despesa por padrão
  if (/(gasto|conta|boleto|fatura|aluguel|iptu|luz|agua|água|gas|gás)/.test(m)) {
    return 'DESPESA'
  }
  return null
}

function extrairValorBasicoFromTexto(message) {
  const m = message.match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  let raw = m[1].trim()
  // Formatos comuns BR: 20,50  |  1200  |  1.200,50 (tratamos os mais simples bem)
  if (raw.includes(',') && !raw.includes('.')) {
    raw = raw.replace(',', '.')
  } else if (raw.includes('.') && raw.includes(',')) {
    // "1.200,50" -> "1200.50"
    raw = raw.replace(/\./g, '').replace(',', '.')
  }
  const val = parseFloat(raw)
  if (!isFinite(val) || val <= 0) return null
  return val
}

/**
 * Fallback local quando nem o JSON da IA vem parseável.
 * Consegue lidar com frases simples como:
 * - "Gastei 20 reais na padaria"
 * - "Recebi 1500 de salário"
 */
function fallbackParseMensagemSimples(message) {
  const tipo = inferTipoBasicoFromTexto(message)
  const valor = extrairValorBasicoFromTexto(message)
  if (!tipo || !valor) return null
  return {
    tipo,
    valor,
    descricao: message,
    categoria_id: null,
    subcategoria_id: null,
  }
}

/** Resolve categoria pelo nome exato do seed (`DEFAULT_CATEGORIES`). */
function findCategoryBySeedNome(cats, categoriaNome) {
  const nref = normTxt(categoriaNome)
  return cats.find((c) => c.nome === categoriaNome || normTxt(c.nome) === nref)
}

/**
 * Escolhe subcategoria na ordem de preferência (rótulos iguais ou contidos no nome do banco).
 * Rótulos devem coincidir com `subcategorias` em `DEFAULT_CATEGORIES`.
 */
function findSubPreferida(cat, subLabels) {
  if (!cat?.subcategorias?.length || !subLabels?.length) return null
  for (const label of subLabels) {
    const n = normTxt(label)
    const s = cat.subcategorias.find((sub) => {
      const sn = normTxt(sub.nome)
      return sn === n || sn.includes(n) || n.includes(sn)
    })
    if (s) return s
  }
  return null
}

/** Nomes de categorias válidos no seed (evita typo nas regras). */
const SEED_CAT_NOMES = new Set(DEFAULT_CATEGORIES.map((c) => c.nome))

/**
 * Regras alinhadas a `DEFAULT_CATEGORIES` em transacoes.mjs — ordem: mais específicas primeiro.
 * `categoriaNome` deve existir no seed; `subLabels` são nomes de subcategorias do seed (ordem de prioridade).
 */
const DESPESA_RULES = [
  { re: /atacad|assai|atacadao|makro/i, categoriaNome: 'Alimentação', subLabels: ['Atacadista', 'Supermercado'] },
  { re: /feira|sacolao|sacolão|hortifrut|hortifruti|verdur/i, categoriaNome: 'Alimentação', subLabels: ['Feira e Sacolão', 'Hortifruti', 'Supermercado'] },
  { re: /mercado|supermercado|carrefour|walmart|hiper|pao de acucar|pão de açúcar/i, categoriaNome: 'Alimentação', subLabels: ['Supermercado', 'Atacadista'] },
  { re: /padaria|pao|pão|cafeteria|cafe\b|café/i, categoriaNome: 'Alimentação', subLabels: ['Padaria e Cafeteira'] },
  { re: /açougue|acougue|peixaria|peixe\b/i, categoriaNome: 'Alimentação', subLabels: ['Açougue e Peixaria'] },
  { re: /bebida|cerveja|vinho|refrigerante/i, categoriaNome: 'Alimentação', subLabels: ['Bebidas'] },
  { re: /ifood|rappi|delivery|uber\s*eats|zap\s*food|99\s*food/i, categoriaNome: 'Alimentação', subLabels: ['Delivery (iFood, etc)', 'Restaurantes e Lanches', 'Fast Food'] },
  { re: /restaurante|lanche|almoco|almoço|jantar|mcdonald|burguer|burger|pizza|bk\b/i, categoriaNome: 'Alimentação', subLabels: ['Restaurantes e Lanches', 'Fast Food', 'Delivery (iFood, etc)'] },
  { re: /combust|gasolina|etanol|posto|diesel|shell|ipiranga|petrobras/i, categoriaNome: 'Transporte', subLabels: ['Combustível'] },
  { re: /\buber\b|\b99\b(?!\s*food)|taxi|táxi|cabify|indriver|bolt\b|99pop/i, categoriaNome: 'Transporte', subLabels: ['App de Transporte (Uber, 99)', 'Táxi'] },
  { re: /onibus|ônibus|metro|metrô|vlt|bilhete unico|integracao/i, categoriaNome: 'Transporte', subLabels: ['Transporte Público'] },
  { re: /estaciona|zona azul/i, categoriaNome: 'Transporte', subLabels: ['Estacionamento'] },
  { re: /pedagio|pedágio/i, categoriaNome: 'Transporte', subLabels: ['Pedágio'] },
  { re: /farmacia|drogaria|remedio|remédio|medicamento|droga\b/i, categoriaNome: 'Saúde', subLabels: ['Medicamentos'] },
  { re: /plano de saude|plano de saúde|unimed|amil|bradesco saude/i, categoriaNome: 'Saúde', subLabels: ['Plano de Saúde'] },
  { re: /dentista|odontologia|odontoi/i, categoriaNome: 'Saúde', subLabels: ['Odontologia / Dentista'] },
  { re: /consulta|clinico|clínico|medico\b|médico\b|hospital(?!idade)/i, categoriaNome: 'Saúde', subLabels: ['Consultas Médicas', 'Exames'] },
  { re: /academia|smartfit|musculacao|musculação/i, categoriaNome: 'Saúde', subLabels: ['Academia e Esportes'] },
  { re: /mensalidade.*escola|faculdade|universidade|col[eé]gio|matricula\b|matrícula/i, categoriaNome: 'Educação', subLabels: ['Mensalidade (Escola/Faculdade)'] },
  { re: /curso\b|certificacao|certificação|udemy|alura/i, categoriaNome: 'Educação', subLabels: ['Cursos e Certificações'] },
  { re: /netflix|spotify|prime video|disney\+|hbo|globoplay|assinatura/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Assinaturas (Netflix, Spotify, etc)'] },
  { re: /cinema|show\b|teatro|ingresso.*show/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Cinema, Shows e Teatro'] },
  { re: /bar\b|balada|cervejaria/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Bares e Baladas'] },
  { re: /salao|salão|barbearia|cabelo|manicure/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Salão de Beleza / Barbearia'] },
  { re: /roupa|camisa|calca|calça|tenis|tênis|vestuario/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Vestuário (Roupas do Dia a Dia)', 'Sapatos e Tênis'] },
  { re: /racao|pet\b|dog|gato|veterinar|banho e tosa/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Ração e Alimentação PET', 'Veterinário e Petshop', 'Banho e Tosa'] },
  { re: /passagem|hotel|hospedagem|airbnb|booking/i, categoriaNome: 'Viagens', subLabels: ['Passagens Aéreas / Ônibus', 'Hospedagem / Hotel'] },
  { re: /notebook|celular novo|iphone|galaxy|computador|monitor\b|tecnologia/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['Computadores e Periféricos', 'Celular Novo e Acessórios'] },
  { re: /aluguel(?!.*receb)/i, categoriaNome: 'Moradia', subLabels: ['Aluguel'] },
  { re: /condominio|condomínio/i, categoriaNome: 'Moradia', subLabels: ['Condomínio'] },
  { re: /luz\b|energia eletrica|energia elétrica|celesc|copel|enel/i, categoriaNome: 'Moradia', subLabels: ['Conta de Luz'] },
  { re: /agua\b|água\b|sanepar|cedae/i, categoriaNome: 'Moradia', subLabels: ['Conta de Água'] },
  { re: /internet\b|fibra|wifi|vivo fibra|net\b claro|oi fibra/i, categoriaNome: 'Moradia', subLabels: ['Internet e TV'] },
  { re: /\bgas\b|glp|botijao|botijão/i, categoriaNome: 'Moradia', subLabels: ['Gás'] },
  { re: /iptu\b/i, categoriaNome: 'Moradia', subLabels: ['IPTU'] },
  { re: /fatura|cartao|cartão|anuidade|ted|pix.*tarifa|tarifa banc/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Pagamento de Fatura (Não Categorizado)', 'Taxas e Tarifas Bancárias', 'Juros Cartão de Crédito'] },
  { re: /emprestimo|empréstimo|financiamento(?!.*veic)/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Parcela de Empréstimo'] },
]

const RECEITA_RULES = [
  { re: /salario|salário|folha|clt|holerite/i, categoriaNome: 'Renda Principal', subLabels: ['Salário'] },
  { re: /ferias|férias/i, categoriaNome: 'Renda Principal', subLabels: ['Férias'] },
  { re: /13o|13º|decimo terceiro|décimo terceiro/i, categoriaNome: 'Renda Principal', subLabels: ['13º Salário'] },
  { re: /plr|bonus|bônus|gratificacao|gratificação/i, categoriaNome: 'Renda Principal', subLabels: ['PLR / Bônus'] },
  { re: /inss|aposentadoria|aposent\b|bpc\b/i, categoriaNome: 'Renda Principal', subLabels: ['Aposentadoria / INSS', 'BPC'] },
  { re: /pro.?labore|prolabore|pró-labore/i, categoriaNome: 'Rendas PJ / Empresa', subLabels: ['Pró-labore', 'Distribuição de Lucros'] },
  { re: /freelance|freela|pj\b|honorario|honorário|servico extra|serviço extra/i, categoriaNome: 'Renda Extra', subLabels: ['Freelance / Serviços Extras'] },
  { re: /venda\b|comiss[aã]o|comission/i, categoriaNome: 'Renda Extra', subLabels: ['Vendas e Comissionamentos', 'Venda de Bens/Ativos Usados'] },
  { re: /aluguel.*receb|rendimento.*aluguel/i, categoriaNome: 'Renda Extra', subLabels: ['Aluguéis Recebidos'] },
  { re: /restituicao|restituição|imposto.*restit/i, categoriaNome: 'Renda Extra', subLabels: ['Restituição de Imposto'] },
  { re: /dividend|fii|fiis|acao|ação|cdb|tesouro|juros.*receb|rendimento.*invest/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['Dividendos (Ações e FIIs)', 'Rendimento de Investimentos', 'Juros Recebidos'] },
  { re: /fgts|seguro.desemprego|abono|auxilio|auxílio|mesada recebida/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['FGTS', 'Seguro-Desemprego', 'Abono Salarial', 'Auxílios Governamentais', 'Mesada Recebida'] },
]

function rulesForTipo(tipo) {
  return tipo === 'RECEITA' ? RECEITA_RULES : DESPESA_RULES
}

/**
 * Se a IA deixou categoria/subcategoria vazias, tenta casar palavras da mensagem com nomes reais do usuário.
 */
export function enriquecerCategoriaPorTexto(message, extractedData, categoriasUsuario) {
  if (!extractedData || !categoriasUsuario?.length) return extractedData

  const tipo = extractedData.tipo
  if (tipo !== 'DESPESA' && tipo !== 'RECEITA') return extractedData

  const low = normTxt(message)
  const catsTipo = categoriasUsuario.filter((c) => c.tipo === tipo)

  if (extractedData.categoria_id && !extractedData.subcategoria_id) {
    const cat = categoriasUsuario.find((c) => c.id === extractedData.categoria_id && c.tipo === tipo)
    if (cat?.subcategorias?.length) {
      for (const rule of rulesForTipo(tipo)) {
        if (!rule.categoriaNome || !rule.subLabels?.length) continue
        if (!SEED_CAT_NOMES.has(rule.categoriaNome)) continue
        if (!rule.re.test(low)) continue
        if (findCategoryBySeedNome(catsTipo, rule.categoriaNome)?.id !== cat.id) continue
        const sub = findSubPreferida(cat, rule.subLabels)
        if (sub) {
          extractedData.subcategoria_id = sub.id
          return extractedData
        }
      }
    }
  }

  if (extractedData.categoria_id && extractedData.subcategoria_id) return extractedData

  for (const rule of rulesForTipo(tipo)) {
    if (!rule.categoriaNome || !rule.subLabels?.length) continue
    if (!SEED_CAT_NOMES.has(rule.categoriaNome)) continue
    if (!rule.re.test(low)) continue
    const cat = findCategoryBySeedNome(catsTipo, rule.categoriaNome)
    if (!cat) continue
    const sub = findSubPreferida(cat, rule.subLabels)
    if (sub) {
      extractedData.categoria_id = cat.id
      extractedData.subcategoria_id = sub.id
      return extractedData
    }
  }

  return extractedData
}

/**
 * Fallback: Gemini compara dígitos do webhook (LID/ruído) com telefones cadastrados no Supabase.
 */
export async function resolverUsuarioIdPorTelefoneGemini(digitosWebhook, usuarios) {
  loadEnv()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !digitosWebhook || !usuarios?.length) return null

  const digitos = String(digitosWebhook).replace(/\D/g, '')
  const lista = usuarios
    .map((u, i) => `${i + 1}. usuario_id="${u.id}" telefone="${String(u.telefone || '').replace(/\D/g, '')}"`)
    .join('\n')

  const prompt = `Você faz pareamento de telefone entre um identificador vindo do WhatsApp (webhook Baileys/Telein) e usuários cadastrados no Brasil.

DÍGITOS DO WEBHOOK (podem ter comprimento estranho por LID @lid, dígito extra, ou falta do 55):
${digitos}

USUÁRIOS CADASTRADOS (apenas dígitos do telefone):
${lista}

Regras:
- Celular BR costuma ser: opcional DDI 55 + DDD (2 dígitos) + 9 dígitos (celular: primeiro dígito após DDD é 9).
- O mesmo aparelho pode aparecer como 11999887766, 5511999887766, ou com sufixo/prefixo diferente por ID interno.
- Escolha no máximo UM usuario_id que seja claramente o mesmo número físico.

Responda APENAS JSON válido, sem markdown:
{"usuario_id":"<uuid>"}
ou
{"usuario_id":null}`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
      }),
    })

    if (!response.ok) return null

    const json = await response.json()
    let text = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    text = text.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    }

    const parsed = JSON.parse(text)
    const id = parsed?.usuario_id
    if (!id || typeof id !== 'string') return null

    const valid = usuarios.find((u) => u.id === id)
    return valid || null
  } catch {
    return null
  }
}
