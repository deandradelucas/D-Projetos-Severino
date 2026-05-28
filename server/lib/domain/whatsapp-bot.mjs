import { log } from '../logger.mjs'
import { buscarUsuarioPorTelefone } from '../usuarios.mjs'
import { getCategorias, inserirTransacao } from '../transacoes.mjs'
import { askHorizon, parseWhatsAppMessageWithAI, parseWhatsAppAudioDirectWithAI } from '../ai.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { isAgendaMessage, processarMensagemAgenda } from './agenda-whatsapp.mjs'
import { isListaComprasMessage, processarMensagemListaCompras } from './lista-compras-whatsapp.mjs'
import { detectExtratoPedido, montarRespostaExtratoWhatsApp } from './whatsapp-extrato.mjs'
import { resolveEscopoUsuario, assertFamiliaPodeEscrever } from '../conta-familiar.mjs'
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

  const { data, error } = await supabase
    .from('transacoes')
    .select('tipo, valor')
    .eq('usuario_id', usuarioId)
    .eq('status', 'EFETIVADA')
    .gte('data_transacao', mesInicio)
    .lte('data_transacao', mesFim)
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
    return { iso: new Date().toISOString(), explicit: false }
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return { iso: new Date().toISOString(), explicit: false }
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
  '🤖 *Severino*\n\n💬 Pergunte sobre suas finanças ou agenda — uso seus dados do app.\n\nTambém registro:\n\n💸 *Despesa:* "gastei 50 no mercado"\n✅ *Receita:* "recebi 2000 de salário"\n📊 *Saldo:* "meu saldo"\n📋 *Extrato:* "histórico do dia", "extrato do mês"\n📈 *Investimentos:* "meus investimentos", "quanto tenho investido"\n🗓️ *Agenda:* "marcar reunião amanhã às 15h" ou "agenda hoje"\n🛒 *Lista de compras:* "adiciona 2kg de arroz na lista Mercado" ou "ver lista Mercado"\n\nDigite *ajuda* para ver isto de novo.'

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

  if (/^(ajuda|help|menu)$/i.test(message.replace(/\s+/g, ' ').trim())) {
    return { ok: true, reply: AJUDA }
  }

  // Saudação isolada ou pedido de tutorial → tutorial de boas-vindas
  const msgNorm = message.replace(/\s+/g, ' ').trim()
  const TUTORIAL_RE =
    /^(tutorial|como\s+funciona(r|isso)?|como\s+usar|como\s+te\s+usar|como\s+uso|o\s+que\s+(voc[êe]\s+)?(faz|sabe|pode|consegue)|me\s+(ensina|explica|mostra|ajuda)|explica\s+(ai|a[ií]|pra\s+mim)?|comandos|instru[cç][oõ]es|manual|guia|dicas|o\s+que\s+posso\s+(fazer|pedir|falar)|quais\s+(s[aã]o\s+)?(os\s+)?comandos|come[cç]ar|come[cç]ando|iniciar|primeiro\s+uso|nunca\s+usei|n[aã]o\s+sei\s+(usar|como)|t[oô]\s+perdido|perdido|n[aã]o\s+entendi|como\s+registro|como\s+(lan[cç]o|cadastro)|como\s+lembro|lembrete)[\s!?.,]*$/i
  if (BOA_VINDAS_RE.test(msgNorm) || TUTORIAL_RE.test(msgNorm)) {
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

  // Consulta de saldo
  if (isSaldoQuery(message)) {
    try {
      const { saldo, receitas, despesas, periodo } = await calcularSaldo(dataUsuarioId)
      const nome = usuario.nome ? ` ${usuario.nome.split(' ')[0]}` : ''
      const mesLabel = fmtPeriodo(periodo.inicio)
      return {
        ok: true,
        reply: `📊 *Resumo de ${mesLabel}${nome}:*\n\n✅ Receitas: ${fmt(receitas)}\n❌ Despesas: ${fmt(despesas)}\n\n💰 *Saldo do mês: ${fmt(saldo)}*`,
      }
    } catch (e) {
      log.error('[whatsapp-bot] calcularSaldo error', e)
      return { ok: false, reply: '❌ Erro ao calcular saldo. Tente novamente.' }
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
      parsed = await parseWhatsAppAudioDirectWithAI(options.audioBytes, options.mimeHint || '', categorias)

      // Agenda detectada no áudio — rota para processador de agenda com transcrição + título da IA
      if (parsed?.tipo === 'AGENDA' && parsed?.transcricao) {
        const aiTitulo = typeof parsed.titulo === 'string' && parsed.titulo.trim().length >= 2
          ? parsed.titulo.trim()
          : null
        log.info('[whatsapp-bot] audio: agenda intent detectado', { transcLen: String(parsed.transcricao).length, aiTitulo })
        return processarMensagemAgenda(usuarioBot, phone, parsed.transcricao, aiTitulo)
      }
    } else {
      parsed = await parseWhatsAppMessageWithAI(message, categorias)
    }
  } catch (e) {
    log.error('[whatsapp-bot] parse IA error', e)
    return { ok: false, reply: '⚠️ Não consegui processar sua mensagem agora. Tente novamente.' }
  }

  // 4. Conversa — para áudio usa resposta direta da IA (não há texto transcrito disponível)
  if (parsed.tipo === 'CHAT') {
    if (!options.audioBytes) {
      try {
        const full = await askHorizon(message, dataUsuarioId, [], usuario.nome || null)
        return { ok: true, reply: formatAssistantReplyForWhatsApp(full) }
      } catch (e) {
        log.warn('[whatsapp-bot] askHorizon (WhatsApp CHAT)', e?.message || e)
      }
    }
    const resposta = parsed.resposta || AJUDA
    return { ok: true, reply: formatAssistantReplyForWhatsApp(resposta) }
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

  // Fallback: categoria/subcategoria não identificadas → "Outros"
  let finalCategoriaId = parsed.categoria_id || null
  let finalSubcategoriaId = parsed.subcategoria_id || null
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

  try {
    const actorUid = usuario?.id ? String(usuario.id).trim() : ''
    const lancadoPor =
      actorUid && actorUid !== String(dataUsuarioId || '').trim() ? actorUid : undefined
    await inserirTransacao({
      usuario_id: dataUsuarioId,
      tipo: parsed.tipo,
      valor: parsed.valor,
      descricao: parsed.descricao || message.slice(0, 100),
      data_transacao: dataTransacaoIso,
      status: 'EFETIVADA',
      categoria_id: finalCategoriaId || undefined,
      subcategoria_id: finalSubcategoriaId || undefined,
      ...(lancadoPor ? { lancado_por_usuario_id: lancadoPor } : {}),
    })
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

  return {
    ok: true,
    reply: `${emoji} *${acao} registrada!*\n\n💰 Valor: ${fmt(parsed.valor)}\n📝 ${parsed.descricao || message.slice(0, 60)}${dataLinha}${saldoLinha}`,
  }
}
