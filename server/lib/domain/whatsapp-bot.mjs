import { log } from '../logger.mjs'
import { buscarUsuarioPorTelefone } from '../usuarios.mjs'
import { getCategorias, inserirTransacao, atualizarTransacao, deletarTransacao } from '../transacoes.mjs'
import { TransactionService } from '../services/transaction-service.mjs'
import { askHorizon, parseWhatsAppMessageWithAI, parseWhatsAppAudioDirectWithAI } from '../ai.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { isAgendaMessage, processarMensagemAgenda } from './agenda-whatsapp.mjs'
import { isListaComprasMessage, processarMensagemListaCompras } from './lista-compras-whatsapp.mjs'
import { detectExtratoPedido, montarRespostaExtratoWhatsApp } from './whatsapp-extrato.mjs'
import { resolveEscopoUsuario, assertFamiliaPodeEscrever } from '../conta-familiar.mjs'
import { resolverCategoriaPorCorrecao } from './transacao-categoria-logger.mjs'
import { computeAssinaturaFlags } from '../assinatura-flags.mjs'
import { hojeYmdBrt } from '../date-brt.mjs'
import { dispararAlertasTransacao, upsertLimiteOrcamento, listarLimitesOrcamento } from './alertas-financeiros.mjs'
import { listarInvestimentosUsuario } from '../investimentos.mjs'
import {
  buscarTaxaCdiAa,
  calcularRendimentoInvestimento,
  ehDiaUtilHoje,
} from '../investimentos-rendimento.mjs'

const SALDO_RE =
  /\b(saldo|quanto[\s-]tenho|meu[\s-]saldo|balan[çc]o|quanto[\s-]sobrou|resumo financeiro)\b/i

export function isSaldoQuery(message) {
  return SALDO_RE.test(String(message || ''))
}

const INVESTIMENTO_RE =
  /\b(investimento[s]?|investindo|invest[iu]|aplica[çc][aã]o|aplica[çc][õo]es|renda[\s-]fixa|cdb|lci|lca|cri|cra|tesouro|poupan[çc]a|quanto[\s-]tenho[\s-]investido|meus[\s-]investimentos|carteira[\s-]de[\s-]investimento[s]?|rendimento[s]?|aportes?)\b/i

export function isInvestimentoQuery(message) {
  return INVESTIMENTO_RE.test(String(message || ''))
}

export async function montarRespostaInvestimentosWhatsApp(usuarioId) {
  const [investimentos, cdiAa] = await Promise.all([
    listarInvestimentosUsuario(usuarioId),
    buscarTaxaCdiAa(),
  ])

  if (!investimentos || investimentos.length === 0) {
    return '📈 Você ainda não tem investimentos cadastrados no *Severino*.\n\nAbra o app e cadastre seus investimentos para eu poder acompanhar junto com você!'
  }

  const fmtBrl = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
  const fmtData = (s) => {
    if (!s) return null
    return new Date(s + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }
  const fmtSinal = (v) => (v >= 0 ? `+${fmtBrl(v)}` : fmtBrl(v))

  const diaUtil = ehDiaUtilHoje()

  let totalInvestido = 0
  let totalRendDiarioBruto = 0
  let totalRendDiarioLiquido = 0
  let totalAcumBruto = 0
  let totalAcumLiquido = 0

  const linhas = investimentos.map((inv) => {
    const valor = Number(inv.valor_investido) || 0
    totalInvestido += valor

    const indexador =
      inv.tipo_indexador === 'PREFIXADO'
        ? `${inv.percentual_cdi}% a.a. (prefixado)`
        : `${inv.percentual_cdi}% do CDI`

    const venc = fmtData(inv.data_vencimento)
    const inicio = fmtData(inv.data_aquisicao)
    const inst = inv.instituicao_nome ? ` | ${inv.instituicao_nome}` : ''
    const numAportes = (inv.aportes || []).length

    const rend = calcularRendimentoInvestimento(inv, cdiAa)

    let rendLinhas = ''
    if (rend) {
      totalAcumBruto += rend.brutoAcum
      totalAcumLiquido += rend.liquidoAcum

      const irFmt = rend.isento
        ? 'Isento IR'
        : `IR ${(rend.aliquota * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%`

      const acumLinha = rend.isento
        ? `  💹 Acumulado: *${fmtSinal(rend.brutoAcum)}* (${irFmt})`
        : `  💹 Acumulado: ${fmtSinal(rend.brutoAcum)} bruto → *${fmtSinal(rend.liquidoAcum)}* líq. (${irFmt})`

      if (diaUtil) {
        totalRendDiarioBruto += rend.bruto
        totalRendDiarioLiquido += rend.liquido
        const diaLinha = rend.isento
          ? `  📈 Hoje: *${fmtSinal(rend.bruto)}*`
          : `  📈 Hoje: ${fmtSinal(rend.bruto)} bruto / *${fmtSinal(rend.liquido)}* líq.`
        rendLinhas = `\n${diaLinha}\n${acumLinha}`
      } else {
        rendLinhas = `\n${acumLinha}`
      }

      rendLinhas += `\n  ⏱ ${rend.diasCorr} dias corridos | ${rend.diasUteis} dias úteis`
    }

    return (
      `• *${inv.nome}*${inst}\n` +
      `  💰 ${fmtBrl(valor)} — ${indexador}` +
      `${inicio ? `\n  📅 Início: ${inicio}${venc ? ` | Vence: ${venc}` : ''}` : venc ? `\n  📅 Vence: ${venc}` : ''}` +
      `${numAportes > 1 ? `\n  📌 ${numAportes} aportes` : ''}` +
      rendLinhas
    )
  })

  const cabecalho = `📊 *Seus Investimentos* (${investimentos.length})\n`
  const separador = '─────────────────────\n'

  let rodape = `\n${separador}💼 *Total investido: ${fmtBrl(totalInvestido)}*`

  if (totalAcumBruto > 0) {
    if (diaUtil && totalRendDiarioBruto > 0) {
      rodape += `\n📈 *Rendimento hoje: ${fmtSinal(totalRendDiarioLiquido)}* (líq.)`
    }
    rodape += `\n💹 *Acumulado estimado: ${fmtSinal(totalAcumLiquido)}* (líq.)`
  }

  if (cdiAa) {
    rodape += `\n📉 CDI atual: ${cdiAa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}% a.a.`
  }

  if (!diaUtil) {
    rodape += '\n\n_ℹ️ Hoje não é dia útil — rendimento diário não calculado._'
  }

  rodape += '\n\n_Estimativas baseadas no CDI do BCB. Não consideram eventos específicos do emissor._'

  return cabecalho + '\n' + linhas.join('\n\n') + rodape
}

export function assertBotSecret(authHeader) {
  const secret = process.env.WHATSAPP_BOT_SECRET
  if (!secret) {
    log.warn('[whatsapp-bot] WHATSAPP_BOT_SECRET não configurado')
    return { ok: false, status: 503, message: 'Bot não configurado (WHATSAPP_BOT_SECRET ausente).' }
  }
  const token = String(authHeader || '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  if (!token || token !== secret) return { ok: false, status: 401, message: 'Não autorizado.' }
  return { ok: true }
}

export async function calcularSaldo(usuarioId, { inicio = null, fim = null } = {}) {
  const supabase = getSupabaseAdmin()
  const now = new Date()
  const mesInicio =
    inicio ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const mesFim =
    fim ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  // lte contra 'YYYY-MM-DD' corta às 00h do dia — usar lt no dia seguinte para incluir o dia inteiro
  const mesFimNext = (() => {
    const d = new Date(mesFim + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  const { data, error } = await supabase
    .from('transacoes')
    .select('tipo, valor')
    .eq('usuario_id', usuarioId)
    .eq('status', 'EFETIVADA')
    .gte('data_transacao', mesInicio)
    .lt('data_transacao', mesFimNext)
  if (error) throw error

  let receitas = 0
  let despesas = 0
  for (const t of data || []) {
    const v = parseFloat(t.valor) || 0
    if (t.tipo === 'RECEITA') receitas += v
    else despesas += v
  }
  return { saldo: receitas - despesas, receitas, despesas, periodo: { inicio: mesInicio, fim: mesFim } }
}

function fmtPeriodo(inicio) {
  const d = new Date(inicio + 'T00:00:00Z')
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

/** ISO para gravar na transação + se o utilizador mencionou data na mensagem (IA). */
export function resolveDataTransacaoParaBot(parsed) {
  const raw = parsed?.data_transacao
  if (raw == null || raw === '') {
    // Sem data explícita: usa HOJE em BRT ao meio-dia (evita gravar no dia seguinte
    // quando a mensagem chega após 21h BRT, quando o UTC já virou o dia).
    return { iso: `${hojeYmdBrt()}T12:00:00-03:00`, explicit: false }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    // Sem data explícita: usa HOJE em BRT ao meio-dia (evita gravar no dia seguinte
    // quando a mensagem chega após 21h BRT, quando o UTC já virou o dia).
    return { iso: `${hojeYmdBrt()}T12:00:00-03:00`, explicit: false }
  }
  return { iso: d.toISOString(), explicit: true }
}

function formatDataTransacaoReplyPtBr(iso) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const AJUDA =
  '🤖 *Severino*\n\n💬 Pergunte sobre suas finanças ou agenda — uso seus dados do app.\n\nTambém registro:\n\n💸 *Despesa:* "gastei 50 no mercado"\n✅ *Receita:* "recebi 2000 de salário"\n📊 *Saldo:* "meu saldo"\n📋 *Extrato:* "histórico do dia", "extrato do mês"\n📈 *Investimentos:* "meus investimentos", "quanto tenho investido"\n🗓️ *Agenda:* "marcar reunião amanhã às 15h" ou "agenda hoje"\n🛒 *Lista de compras:* "adiciona 2kg de arroz na lista Mercado" ou "ver lista Mercado"\n✏️ *Corrigir:* "corrigir valor 50", "corrigir categoria alimentação"\n🗑️ *Desfazer:* "desfazer" — remove a última transação\n\nDigite *ajuda* para ver isto de novo.'

// Detecta saudações isoladas: "Olá", "Oi", "Bom dia", "Salve", "Opa", etc.
const BOA_VINDAS_RE =
  /^(ol[aá]|oi+|e\s*a[ií]|bom\s+dia|boa\s+tarde|boa\s+noite|boa|bom|tudo\s+(bem|bom|certo|ok)|como\s+(vai|vc\s+vai|voce\s+vai|est[aá])|hey|hello|hi|salve+|opa|fala|al[oô]|boas|eae|eai|ol[aá]\s+tudo|bom\s+dia\s+severino|boa\s+tarde\s+severino|boa\s+noite\s+severino|ol[aá]\s+severino|oi\s+severino)[\s!?.,🙂😊🖐👋]*$/iu

function buildTutorialBoasVindas(nome) {
  return (
    `👋 *Olá${nome}! Bem-vindo ao Severino!*\n\n` +
    `Sou seu assistente financeiro pessoal. Pode falar por texto ou 🎙️ áudio — entendo os dois!\n\n` +
    `─────────────────────\n` +
    `💸 *Registrar gastos*\n` +
    `─────────────────────\n` +
    `"Severino, gastei 200 com combustível"\n` +
    `"Paguei 50 no mercado"\n` +
    `"120 de conta de luz"\n\n` +
    `─────────────────────\n` +
    `✅ *Registrar receitas*\n` +
    `─────────────────────\n` +
    `"Severino, ganhei 70 reais com rendimentos"\n` +
    `"Recebi 3000 de salário"\n` +
    `"Entrou 500 de freelance"\n\n` +
    `─────────────────────\n` +
    `🗓️ *Agenda e lembretes*\n` +
    `─────────────────────\n` +
    `"Severino, reunião às 17 horas"\n` +
    `"Consulta médica amanhã às 9h"\n` +
    `"Pagar boleto na sexta"\n\n` +
    `Após criar o evento, basta informar quantos minutos antes quer ser avisado — e o Severino te lembra na hora certa! ⏰\n\n` +
    `─────────────────────\n` +
    `🛒 *Lista de compras*\n` +
    `─────────────────────\n` +
    `"Cria uma lista chamada Mercado"\n` +
    `"Adiciona 2kg de arroz na lista Mercado"\n` +
    `"Coloca 6 ovos e 1L de leite na lista Mercado"\n` +
    `"Ver lista Mercado"\n\n` +
    `─────────────────────\n` +
    `📊 *Consultas rápidas*\n` +
    `─────────────────────\n` +
    `"Meu saldo" — resumo financeiro do mês\n` +
    `"Extrato do dia" — transações de hoje\n` +
    `"Meus investimentos" — carteira com rendimentos\n\n` +
    `Digite *ajuda* para ver este menu novamente.`
  )
}

/** WhatsApp: limite útil de caracteres; resume **markdown** do modelo para *negrito* WA. */
function formatAssistantReplyForWhatsApp(text) {
  let s = String(text || '').trim()
  s = s.replace(/\*\*(.+?)\*\*/g, '*$1*')
  s = s.replace(/^[-*]\s+/gm, '• ')
  const max = 3800
  if (s.length > max) s = `${s.slice(0, max - 3)}...`
  return s
}

/**
 * Ponto central do bot — recebe telefone + mensagem bruta do n8n e retorna o texto de resposta.
 * options.audioBytes + options.mimeHint: áudio raw; usa parse combinado (áudio → JSON direto).
 */
export async function processarMensagemBot(phone, rawMessage, options = {}) {
  const message = String(rawMessage || '').trim()
  if (!message && !options.audioBytes) return { ok: false, reply: '❌ Mensagem vazia.' }

  // 1. Resolve usuário pelo telefone
  let usuario
  try {
    usuario = await buscarUsuarioPorTelefone(phone, { usarGemini: false })
  } catch (e) {
    log.error('[whatsapp-bot] buscarUsuarioPorTelefone error', e)
    return { ok: false, reply: '❌ Erro ao identificar usuário. Tente novamente.' }
  }

  if (!usuario) {
    return {
      ok: false,
      reply:
        '❌ Número não cadastrado no *Severino*.\n\nAcesse o app e adicione seu telefone em *Perfil* para usar o assistente pelo WhatsApp.',
    }
  }

  let familiaEscopo = {
    actorId: usuario.id,
    dataUsuarioId: usuario.id,
    familiaPapel: null,
    isMembroConta: false,
  }
  try {
    familiaEscopo = await resolveEscopoUsuario(usuario.id)
  } catch {
    /* mantém titular */
  }
  const dataUsuarioId = familiaEscopo.dataUsuarioId
  const usuarioBot = { ...usuario, dataUsuarioId, familiaEscopo }

  // Gate de acesso: trial expirado sem assinatura → bloqueio com mensagem de conversão
  try {
    const supabase = getSupabaseAdmin()
    const { data: titularFlags } = await supabase
      .from('usuarios')
      .select('email, isento_pagamento, trial_ends_at, assinatura_paga, assinatura_asaas_status')
      .eq('id', dataUsuarioId)
      .maybeSingle()
    if (titularFlags) {
      const flags = computeAssinaturaFlags(titularFlags)
      if (!flags.acesso_app_liberado) {
        const LINK = process.env.APP_URL
          ? `${process.env.APP_URL}/pagamento`
          : 'https://severino.mestredamente.com/pagamento'
        const nomeUser = usuario.nome ? `, ${usuario.nome.split(' ')[0]}` : ''
        return {
          ok: false,
          reply:
            `⏰ *Seu período de teste encerrou${nomeUser}.*\n\n` +
            `Suas finanças estão salvas e esperando você voltar!\n\n` +
            `Assine o Severino por menos de R$ 1/dia e volte a registrar tudo pelo WhatsApp:\n` +
            `👉 ${LINK}\n\n` +
            `_Rápido, fácil, sem fidelidade._ 🙌`,
        }
      }
    }
  } catch (e) {
    log.warn('[whatsapp-bot] gate trial error', e?.message)
    // falha silenciosa — não bloqueia usuário por erro de verificação
  }

  if (/^(ajuda|help|menu)$/i.test(message.replace(/\s+/g, ' ').trim())) {
    return { ok: true, reply: AJUDA }
  }

  // Saudação isolada ou pedido de tutorial → tutorial de boas-vindas
  const msgNorm = message.replace(/\s+/g, ' ').trim()
  const TUTORIAL_RE =
    /^(tutorial|como\s+funciona(r|isso)?|como\s+usar|como\s+te\s+usar|como\s+uso|o\s+que\s+(voc[êe]\s+)?(faz|sabe|pode|consegue)|me\s+(ensina|explica|mostra|ajuda)|explica\s+(ai|a[ií]|pra\s+mim)?|comandos|instru[cç][oõ]es|manual|guia|dicas|o\s+que\s+posso\s+(fazer|pedir|falar)|quais\s+(s[aã]o\s+)?(os\s+)?comandos|come[cç]ar|come[cç]ando|iniciar|primeiro\s+uso|nunca\s+usei|n[aã]o\s+sei\s+(usar|como)|t[oô]\s+perdido|perdido|n[aã]o\s+entendi|como\s+registro|como\s+(lan[cç]o|cadastro)|como\s+lembro|lembrete)[\s!?.,]*$/i
  if (BOA_VINDAS_RE.test(msgNorm) || TUTORIAL_RE.test(msgNorm)) {
    // 1.9: Boas-vindas personalizadas para membro de conta familiar
    if (familiaEscopo.isMembroConta) {
      const nome = usuario.nome ? `, ${usuario.nome.split(' ')[0]}` : ''
      let titularNome = ''
      try {
        const supabase = getSupabaseAdmin()
        const { data: titular } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', dataUsuarioId)
          .maybeSingle()
        titularNome = titular?.nome ? titular.nome.split(' ')[0] : ''
      } catch { /* ignora */ }
      const papelLabel = familiaEscopo.familiaPapel === 'VIEWER'
        ? 'consultar as finanças'
        : 'registrar e consultar as finanças'
      return {
        ok: true,
        reply:
          `👋 *Olá${nome}! Bem-vindo ao Severino!*\n\n` +
          `Você está na conta familiar${titularNome ? ` de *${titularNome}*` : ''}.\n\n` +
          `Aqui você pode ${papelLabel} da família pelo WhatsApp:\n\n` +
          `💸 "gastei 50 no mercado"\n✅ "recebi 500 de freelance"\n📊 "meu saldo"\n📋 "extrato do dia"\n\n` +
          `Digite *ajuda* para ver todos os comandos.`,
      }
    }
    const nome = usuario.nome ? `, ${usuario.nome.split(' ')[0]}` : ''
    return { ok: true, reply: buildTutorialBoasVindas(nome) }
  }

  // 2. Agenda via WhatsApp — antes do parser financeiro para não confundir compromissos com transações
  if (isAgendaMessage(message)) {
    return processarMensagemAgenda(usuarioBot, phone, message)
  }

  // Lista de compras — antes da IA financeira para não interpretar itens como transações
  if (isListaComprasMessage(message)) {
    try {
      const resultado = await processarMensagemListaCompras(dataUsuarioId, message)
      if (resultado !== null) return resultado
    } catch (e) {
      log.error('[whatsapp-bot] processarMensagemListaCompras error', e)
      return { ok: false, reply: '❌ Erro ao processar lista de compras. Tente novamente.' }
    }
  }

  // Extrato / histórico (dia, semana ou mês) — antes da IA para não cair em CHAT genérico
  if (detectExtratoPedido(message)) {
    try {
      const texto = await montarRespostaExtratoWhatsApp(dataUsuarioId, message)
      if (texto) return { ok: true, reply: texto }
    } catch (e) {
      log.error('[whatsapp-bot] montarRespostaExtratoWhatsApp error', e)
      return { ok: false, reply: '❌ Erro ao buscar seu histórico. Tente novamente.' }
    }
  }

  // Consulta de investimentos
  if (isInvestimentoQuery(message)) {
    try {
      const texto = await montarRespostaInvestimentosWhatsApp(dataUsuarioId)
      return { ok: true, reply: texto }
    } catch (e) {
      log.error('[whatsapp-bot] montarRespostaInvestimentosWhatsApp error', e)
      return { ok: false, reply: '❌ Erro ao buscar seus investimentos. Tente novamente.' }
    }
  }

  // Consulta de saldo + últimas 3 transações do mês
  if (isSaldoQuery(message)) {
    try {
      const supabase = getSupabaseAdmin()
      const now = new Date()
      const mesInicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const [saldoData, { data: ultimas }] = await Promise.all([
        calcularSaldo(dataUsuarioId),
        supabase
          .from('transacoes')
          .select('tipo, valor, descricao, data_transacao, categorias(nome)')
          .eq('usuario_id', dataUsuarioId)
          .eq('status', 'EFETIVADA')
          .gte('data_transacao', mesInicio)
          .order('data_transacao', { ascending: false })
          .limit(3),
      ])
      const { saldo, receitas, despesas, periodo } = saldoData
      const nome = usuario.nome ? ` ${usuario.nome.split(' ')[0]}` : ''
      const mesLabel = fmtPeriodo(periodo.inicio)
      let reply = `📊 *Resumo de ${mesLabel}${nome}:*\n\n✅ Receitas: ${fmt(receitas)}\n❌ Despesas: ${fmt(despesas)}\n\n💰 *Saldo do mês: ${fmt(saldo)}*`
      if (ultimas?.length) {
        const linhas = ultimas.map(t => {
          const emoji = t.tipo === 'RECEITA' ? '✅' : '💸'
          const cat = t.categorias?.nome ? ` (${t.categorias.nome})` : ''
          const data = new Date(t.data_transacao + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
          return `${emoji} ${fmt(t.valor)} — ${t.descricao || '-'}${cat} · ${data}`
        })
        reply += `\n\n📋 *Últimas transações do mês:*\n${linhas.join('\n')}`
      }
      return { ok: true, reply }
    } catch (e) {
      log.error('[whatsapp-bot] calcularSaldo error', e)
      return { ok: false, reply: '❌ Erro ao calcular saldo. Tente novamente.' }
    }
  }

  // Comando: "limite [categoria] [valor]" ou "orcamento [categoria] [valor]"
  const LIMITE_RE = /^(?:limite|or[çc]amento)(?:\s+de)?\s+(.+?)\s+([\d]+(?:[.,]\d{1,2})?)$/i
  const limiteMatch = message.replace(/\s+/g, ' ').trim().match(LIMITE_RE)
  if (limiteMatch) {
    try {
      const cats = await getCategorias(dataUsuarioId)
      const nomeBuscado = limiteMatch[1].trim().toLowerCase()
      const cat = cats.find(c => c.tipo === 'DESPESA' && c.nome.toLowerCase().includes(nomeBuscado))
      if (!cat) {
        const nomes = cats.filter(c => c.tipo === 'DESPESA').map(c => c.nome).join(', ')
        return { ok: true, reply: `❌ Categoria não encontrada. Categorias disponíveis:\n${nomes}` }
      }
      const valor = parseFloat(limiteMatch[2].replace(',', '.'))
      if (!valor || valor <= 0) return { ok: true, reply: '❌ Valor inválido para o limite.' }
      await upsertLimiteOrcamento(dataUsuarioId, cat.id, valor)
      return { ok: true, reply: `✅ Limite de *${cat.nome}* definido em ${fmt(valor)}/mês.\n\nVocê receberá alertas ao atingir 80% e 100% desse valor.` }
    } catch (e) {
      log.error('[whatsapp-bot] upsertLimiteOrcamento error', e)
      return { ok: false, reply: '❌ Erro ao definir limite. Tente novamente.' }
    }
  }

  // Comando: "limites" ou "meus limites"
  if (/^(meus\s+)?limites?(\s+de\s+or[çc]amento)?$/i.test(message.replace(/\s+/g, ' ').trim())) {
    try {
      const cats = await getCategorias(dataUsuarioId)
      const limites = await listarLimitesOrcamento(dataUsuarioId)
      if (!limites.length) {
        return { ok: true, reply: '📋 Você ainda não definiu nenhum limite.\n\nEnvie *limite [categoria] [valor]* para definir. Ex: _limite alimentação 800_' }
      }
      const linhas = limites.map(l => {
        const cat = cats.find(c => c.id === l.categoria_id)
        return `• ${cat?.nome ?? l.categoria_id}: ${fmt(l.limite_mensal)}/mês`
      })
      return { ok: true, reply: `📋 *Seus limites mensais:*\n\n${linhas.join('\n')}` }
    } catch (e) {
      log.error('[whatsapp-bot] listarLimitesOrcamento error', e)
      return { ok: false, reply: '❌ Erro ao buscar limites. Tente novamente.' }
    }
  }

  // Comando: "desfazer" — remove a última transação do usuário
  const DESFAZER_RE =
    /^(?:desfaz(?:er?|a)?(?:\s+[uúu]ltim[\w]*)?|apagar?\s+[uúu]ltim[\w]*|remover?\s+[uúu]ltim[\w]*|excluir?\s+[uúu]ltim[\w]*|deletar?\s+[uúu]ltim[\w]*)(?:\s+(?:transa[cç][aã]o|lan[cç]amento|gasto|despesa|receita|registro))?[\s!.?]*$/i
  if (DESFAZER_RE.test(message.replace(/\s+/g, ' ').trim())) {
    try {
      const supabase = getSupabaseAdmin()
      const { data: ultima } = await supabase
        .from('transacoes')
        .select('id, tipo, valor, descricao, data_transacao, categoria_id')
        .eq('usuario_id', dataUsuarioId)
        .order('data_transacao', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!ultima) {
        return { ok: true, reply: '❌ Nenhuma transação encontrada para desfazer.' }
      }
      const cats = await getCategorias(dataUsuarioId)
      const catNome = ultima.categoria_id ? cats.find(c => c.id === ultima.categoria_id)?.nome : null
      const data = new Date(ultima.data_transacao + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
      await deletarTransacao(ultima.id, dataUsuarioId)
      const emoji = ultima.tipo === 'RECEITA' ? '✅' : '💸'
      return {
        ok: true,
        reply: `🗑️ *Última transação removida!*\n\n${emoji} ${fmt(ultima.valor)} — ${ultima.descricao || '-'}${catNome ? ` (${catNome})` : ''} · ${data}\n\n_Se foi engano, registre novamente._`,
      }
    } catch (e) {
      log.error('[whatsapp-bot] desfazerTransacao error', e)
      return { ok: false, reply: '❌ Erro ao desfazer transação. Tente novamente.' }
    }
  }

  // Comando: "corrigir [campo] [novo valor]" — corrige a última transação do usuário
  const CORRIGIR_RE = /^corrigir\s+(valor|categoria|descri[cç][aã]o)\s+(.+)$/i
  const corrigirMatch = message.replace(/\s+/g, ' ').trim().match(CORRIGIR_RE)
  if (corrigirMatch) {
    const campoRaw = corrigirMatch[1].toLowerCase()
    const novoValorRaw = corrigirMatch[2].trim()
    try {
      const supabase = getSupabaseAdmin()
      const { data: ultima } = await supabase
        .from('transacoes')
        .select('id, tipo, valor, descricao, data_transacao, status, categoria_id, subcategoria_id')
        .eq('usuario_id', dataUsuarioId)
        .order('data_transacao', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!ultima) {
        return { ok: true, reply: '❌ Nenhuma transação encontrada para corrigir.' }
      }
      const update = {
        tipo: ultima.tipo,
        valor: Number(ultima.valor),
        descricao: ultima.descricao || '',
        data_transacao: ultima.data_transacao,
        status: ultima.status || 'EFETIVADA',
        categoria_id: ultima.categoria_id || null,
        subcategoria_id: ultima.subcategoria_id || null,
      }
      if (campoRaw === 'valor') {
        const v = parseFloat(novoValorRaw.replace(',', '.'))
        if (!v || v <= 0) return { ok: true, reply: '❌ Valor inválido.' }
        update.valor = v
      } else if (campoRaw === 'categoria') {
        const cats = await getCategorias(dataUsuarioId)
        const cat =
          cats.find(c => c.tipo === ultima.tipo && c.nome.toLowerCase().includes(novoValorRaw.toLowerCase())) ||
          cats.find(c => c.nome.toLowerCase().includes(novoValorRaw.toLowerCase()))
        if (!cat) {
          const nomes = cats.map(c => c.nome).join(', ')
          return { ok: true, reply: `❌ Categoria não encontrada. Disponíveis:\n${nomes}` }
        }
        update.categoria_id = cat.id
        update.subcategoria_id = null
      } else {
        update.descricao = novoValorRaw
      }
      await atualizarTransacao(ultima.id, dataUsuarioId, update)
      // 1.8: Confirmação de correção com antes → depois
      const cats2 = await getCategorias(dataUsuarioId)
      let mudancaTexto
      if (campoRaw === 'valor') {
        mudancaTexto = `💰 ${fmt(Number(ultima.valor))} → *${fmt(update.valor)}*`
      } else if (campoRaw === 'categoria') {
        const catAntes = cats2.find(c => c.id === ultima.categoria_id)?.nome || 'sem categoria'
        const catDepois = cats2.find(c => c.id === update.categoria_id)?.nome || '-'
        mudancaTexto = `🏷️ ${catAntes} → *${catDepois}*`
      } else {
        mudancaTexto = `📝 "${ultima.descricao || '-'}" → *"${update.descricao}"*`
      }
      return {
        ok: true,
        reply: `✅ *Correção aplicada!*\n\n${mudancaTexto}`,
      }
    } catch (e) {
      log.error('[whatsapp-bot] corrigirTransacao error', e)
      return { ok: false, reply: '❌ Erro ao corrigir transação. Tente novamente.' }
    }
  }

  // 3. Parse de transação via IA
  let categorias
  try {
    categorias = await getCategorias(dataUsuarioId)
  } catch (e) {
    log.error('[whatsapp-bot] getCategorias error', e)
    return { ok: false, reply: '❌ Erro ao carregar categorias. Tente novamente.' }
  }

  let parsed
  try {
    if (options.audioBytes) {
      // Combinado: áudio → JSON em um único call (transcrição + classificação de intent)
      parsed = await parseWhatsAppAudioDirectWithAI(options.audioBytes, options.mimeHint || '', categorias, usuarioBot.familiaEscopo?.actorId ?? usuarioBot.id)

      // Agenda detectada no áudio — rota para processador de agenda com transcrição + título da IA
      if (parsed?.tipo === 'AGENDA' && parsed?.transcricao) {
        const aiTitulo = typeof parsed.titulo === 'string' && parsed.titulo.trim().length >= 2
          ? parsed.titulo.trim()
          : null
        log.info('[whatsapp-bot] audio: agenda intent detectado', { transcLen: String(parsed.transcricao).length, aiTitulo })
        return processarMensagemAgenda(usuarioBot, phone, parsed.transcricao, aiTitulo)
      }

      // Lista de compras detectada no áudio — áudio bypassa os checks de texto acima
      if (parsed?.transcricao && isListaComprasMessage(parsed.transcricao)) {
        log.info('[whatsapp-bot] audio: lista de compras detectada na transcrição')
        try {
          const resultado = await processarMensagemListaCompras(dataUsuarioId, parsed.transcricao)
          if (resultado !== null) return resultado
        } catch (e) {
          log.error('[whatsapp-bot] audio: processarMensagemListaCompras error', e)
          return { ok: false, reply: '❌ Erro ao processar lista de compras. Tente novamente.' }
        }
      }
    } else {
      parsed = await parseWhatsAppMessageWithAI(message, categorias, usuarioBot.familiaEscopo?.actorId ?? usuarioBot.id)
    }
  } catch (e) {
    log.error('[whatsapp-bot] parse IA error', e)
    return { ok: false, reply: '⚠️ Não consegui processar sua mensagem agora. Tente novamente.' }
  }

  // 4. Conversa
  if (parsed.tipo === 'CHAT') {
    if (!options.audioBytes) {
      try {
        const full = await askHorizon(message, dataUsuarioId, [], usuario.nome || null)
        return { ok: true, reply: formatAssistantReplyForWhatsApp(full) }
      } catch (e) {
        log.warn('[whatsapp-bot] askHorizon (WhatsApp CHAT)', e?.message || e)
      }
      return { ok: true, reply: formatAssistantReplyForWhatsApp(parsed.resposta || AJUDA) }
    }
    // 1.7: Áudio classificado como CHAT — fallback claro se a IA não entendeu
    const respostaIA = String(parsed.resposta || '').trim()
    if (!respostaIA || /n[aã]o\s*(entendi|consegui|identifiquei)/i.test(respostaIA)) {
      return {
        ok: true,
        reply: '🎙️ Não consegui entender o áudio.\n\nTente novamente falando mais devagar, ou envie como texto. 😊',
      }
    }
    return { ok: true, reply: formatAssistantReplyForWhatsApp(respostaIA) }
  }

  // 5. Validação mínima
  if ((parsed.tipo !== 'RECEITA' && parsed.tipo !== 'DESPESA') || !parsed.valor) {
    return { ok: true, reply: AJUDA }
  }

  // 6. Inserir transação
  const bloqueio = assertFamiliaPodeEscrever(familiaEscopo)
  if (bloqueio) {
    return { ok: false, reply: `❌ ${bloqueio.message}` }
  }

  const { iso: dataTransacaoIso, explicit: dataExplicita } = resolveDataTransacaoParaBot(parsed)

  let finalCategoriaId = parsed.categoria_id || null
  let finalSubcategoriaId = parsed.subcategoria_id || null

  // Override determinístico: se o usuário já corrigiu a categoria desta descrição
  // antes, a escolha dele vence o palpite do LLM (aprendizado garantido).
  const correcao = await resolverCategoriaPorCorrecao(
    usuarioBot.familiaEscopo?.actorId ?? usuarioBot.id,
    parsed.descricao,
    categorias,
  )
  if (correcao?.categoria_id) {
    finalCategoriaId = correcao.categoria_id
    finalSubcategoriaId = correcao.subcategoria_id ?? null
  }

  // Fallback: categoria/subcategoria não identificadas → "Outros"
  if (!finalCategoriaId && categorias?.length) {
    const catOutros = categorias.find(
      (c) => c.tipo === parsed.tipo && c.nome.toLowerCase() === 'outros'
    )
    if (catOutros) {
      finalCategoriaId = catOutros.id
      const subOutros = catOutros.subcategorias?.find((s) => s.nome.toLowerCase() === 'outros')
      if (subOutros) finalSubcategoriaId = subOutros.id
    }
  }

  const parcelamento = parsed.parcelamento || null
  const recorrencia = parsed.recorrencia || null

  try {
    const actorUid = usuario?.id ? String(usuario.id).trim() : ''
    const lancadoPor =
      actorUid && actorUid !== String(dataUsuarioId || '').trim() ? actorUid : undefined

    let transacaoIdAlerta = null
    if (parcelamento) {
      // Compra parcelada ("em 3x") — mesma engine do app: parcelas mensais,
      // vencidas entram como pagas, futuras PENDENTE (transaction-service).
      const resParc = await TransactionService.createParcelamento(
        dataUsuarioId,
        {
          tipo: parsed.tipo,
          valor: parsed.valor,
          descricao: parsed.descricao || message.slice(0, 100),
          data_transacao: dataTransacaoIso,
          status: 'EFETIVADA',
          categoria_id: finalCategoriaId || null,
          subcategoria_id: finalSubcategoriaId || null,
          parcelamento,
        },
        lancadoPor ? { lancadoPorUsuarioId: lancadoPor } : {},
      )
      transacaoIdAlerta = resParc?.parcelas?.[0]?.id ?? null
    } else {
      const transacaoInserida = await inserirTransacao({
        usuario_id: dataUsuarioId,
        tipo: parsed.tipo,
        valor: parsed.valor,
        descricao: parsed.descricao || message.slice(0, 100),
        data_transacao: dataTransacaoIso,
        status: 'EFETIVADA',
        categoria_id: finalCategoriaId || undefined,
        subcategoria_id: finalSubcategoriaId || undefined,
        ...(recorrencia ? { recorrencia } : {}),
        ...(lancadoPor ? { lancado_por_usuario_id: lancadoPor } : {}),
      })
      transacaoIdAlerta = transacaoInserida?.id ?? null
    }

    // Alertas pós-insert (gasto alto + orçamento) — fire-and-forget, não bloqueia resposta
    if (parsed.tipo === 'DESPESA' && finalCategoriaId && transacaoIdAlerta) {
      const nomeCategoria = categorias.find(c => c.id === finalCategoriaId)?.nome
      dispararAlertasTransacao({
        usuarioId: dataUsuarioId,
        categoriaId: finalCategoriaId,
        nomeCategoria,
        valorAtual: parsed.valor,
        transacaoId: transacaoIdAlerta,
        phone,
        instance: process.env.EVOLUTION_INSTANCE,
      }).catch(e => log.warn('[alertas] dispararAlertasTransacao error', e?.message))
    }
  } catch (e) {
    log.error('[whatsapp-bot] inserirTransacao error', e)
    return { ok: false, reply: '❌ Erro ao salvar a transação. Tente novamente.' }
  }

  // 7. Montar resposta de confirmação com saldo atualizado
  let saldoAtual = null
  let saldoPeriodoLabel = null
  try {
    const { saldo, periodo } = await calcularSaldo(dataUsuarioId)
    saldoAtual = saldo
    saldoPeriodoLabel = fmtPeriodo(periodo.inicio)
  } catch {
    // não crítico
  }

  const emoji = parsed.tipo === 'RECEITA' ? '✅' : '💸'
  const acao = parsed.tipo === 'RECEITA' ? 'Receita' : 'Despesa'
  const saldoLinha =
    saldoAtual !== null
      ? `\n\n📊 Saldo de ${saldoPeriodoLabel}: *${fmt(saldoAtual)}*`
      : ''
  const dataLinha = dataExplicita
    ? `\n📅 *Data:* ${formatDataTransacaoReplyPtBr(dataTransacaoIso)}`
    : ''

  // Categoria visível na confirmação: usuário detecta erro na hora e aprende
  // o comando de correção (alimenta o few-shot de categorias).
  let categoriaLinha = ''
  if (finalCategoriaId) {
    const catObj = categorias.find((c) => c.id === finalCategoriaId)
    const subObj = catObj?.subcategorias?.find((s) => s.id === finalSubcategoriaId)
    if (catObj) {
      const rotulo = subObj ? `${catObj.nome} › ${subObj.nome}` : catObj.nome
      categoriaLinha = `\n🏷️ ${rotulo}`
    }
  }
  const dicaCorrigir = categoriaLinha
    ? `\n\n_Categoria errada? Responda "corrigir categoria <nome>"._`
    : ''

  let planoLinha = ''
  if (parcelamento) {
    const cada = fmt(Math.floor((parsed.valor / parcelamento.num_parcelas) * 100) / 100)
    planoLinha = `\n💳 Parcelado em *${parcelamento.num_parcelas}x* de ~${cada}`
  } else if (recorrencia) {
    const freqLabel = { MENSAL: 'mês', SEMANAL: 'semana', ANUAL: 'ano' }[recorrencia.frequencia]
    planoLinha = `\n🔁 Repete por *${recorrencia.quantidade}* ${freqLabel === 'mês' ? 'meses' : freqLabel + 's'} (${fmt(parsed.valor)} cada)`
  }

  return {
    ok: true,
    reply: `${emoji} *${acao} registrada!*\n\n💰 Valor: ${fmt(parsed.valor)}\n📝 ${parsed.descricao || message.slice(0, 60)}${categoriaLinha}${planoLinha}${dataLinha}${saldoLinha}${dicaCorrigir}`,
  }
}
