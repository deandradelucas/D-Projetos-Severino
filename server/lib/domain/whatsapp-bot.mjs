import { log } from '../logger.mjs'
import { buscarUsuarioPorTelefone } from '../usuarios.mjs'
import { getCategorias, inserirTransacao } from '../transacoes.mjs'
import { parseWhatsAppMessageWithAI } from '../ai.mjs'
import { getSupabaseAdmin } from '../supabase-admin.mjs'
import { isAgendaMessage, processarMensagemAgenda } from './agenda-whatsapp.mjs'

const SALDO_RE =
  /\b(saldo|quanto[\s-]tenho|meu[\s-]saldo|balan[çc]o|quanto[\s-]sobrou|extrato|resumo financeiro)\b/i

export function isSaldoQuery(message) {
  return SALDO_RE.test(String(message || ''))
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

export async function calcularSaldo(usuarioId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('transacoes')
    .select('tipo, valor')
    .eq('usuario_id', usuarioId)
    .eq('status', 'EFETIVADA')
  if (error) throw error

  let receitas = 0
  let despesas = 0
  for (const t of data || []) {
    const v = parseFloat(t.valor) || 0
    if (t.tipo === 'RECEITA') receitas += v
    else despesas += v
  }
  return { saldo: receitas - despesas, receitas, despesas }
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
  '🤖 *Horizonte Bot*\n\nPosso registrar:\n\n💸 *Despesa:* "gastei 50 no mercado"\n✅ *Receita:* "recebi 2000 de salário"\n📊 *Saldo:* "meu saldo"\n🗓️ *Agenda:* "marcar reunião amanhã às 15h" ou "agenda hoje"\n\nDigite uma dessas!'

/**
 * Ponto central do bot — recebe telefone + mensagem bruta do n8n e retorna o texto de resposta.
 */
export async function processarMensagemBot(phone, rawMessage) {
  const message = String(rawMessage || '').trim()
  if (!message) return { ok: false, reply: '❌ Mensagem vazia.' }

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
        '❌ Número não cadastrado no *Horizonte Financeiro*.\n\nAcesse o app e adicione seu telefone em *Perfil* para usar o bot.',
    }
  }

  // 2. Agenda via WhatsApp — antes do parser financeiro para não confundir compromissos com transações
  if (isAgendaMessage(message)) {
    return processarMensagemAgenda(usuario, phone, message)
  }

  // 2. Consulta de saldo
  if (isSaldoQuery(message)) {
    try {
      const { saldo, receitas, despesas } = await calcularSaldo(usuario.id)
      const nome = usuario.nome ? ` ${usuario.nome.split(' ')[0]}` : ''
      return {
        ok: true,
        reply: `📊 *Saldo atual${nome}:*\n\n✅ Receitas: ${fmt(receitas)}\n❌ Despesas: ${fmt(despesas)}\n\n💰 *Saldo: ${fmt(saldo)}*`,
      }
    } catch (e) {
      log.error('[whatsapp-bot] calcularSaldo error', e)
      return { ok: false, reply: '❌ Erro ao calcular saldo. Tente novamente.' }
    }
  }

  // 3. Parse de transação via IA
  let categorias
  try {
    categorias = await getCategorias(usuario.id)
  } catch (e) {
    log.error('[whatsapp-bot] getCategorias error', e)
    return { ok: false, reply: '❌ Erro ao carregar categorias. Tente novamente.' }
  }

  let parsed
  try {
    parsed = await parseWhatsAppMessageWithAI(message, categorias)
  } catch (e) {
    log.error('[whatsapp-bot] parseWhatsAppMessageWithAI error', e)
    return { ok: false, reply: '⚠️ Não consegui processar sua mensagem agora. Tente novamente.' }
  }

  // 4. Mensagem de chat (não é transação)
  if (parsed.tipo === 'CHAT') {
    const resposta = parsed.resposta || AJUDA
    return { ok: true, reply: resposta }
  }

  // 5. Validação mínima
  if ((parsed.tipo !== 'RECEITA' && parsed.tipo !== 'DESPESA') || !parsed.valor) {
    return { ok: true, reply: AJUDA }
  }

  // 6. Inserir transação
  const { iso: dataTransacaoIso, explicit: dataExplicita } = resolveDataTransacaoParaBot(parsed)
  try {
    await inserirTransacao({
      usuario_id: usuario.id,
      tipo: parsed.tipo,
      valor: parsed.valor,
      descricao: parsed.descricao || message.slice(0, 100),
      data_transacao: dataTransacaoIso,
      status: 'EFETIVADA',
      categoria_id: parsed.categoria_id || undefined,
      subcategoria_id: parsed.subcategoria_id || undefined,
    })
  } catch (e) {
    log.error('[whatsapp-bot] inserirTransacao error', e)
    return { ok: false, reply: '❌ Erro ao salvar a transação. Tente novamente.' }
  }

  // 7. Montar resposta de confirmação com saldo atualizado
  let saldoAtual = null
  try {
    const { saldo } = await calcularSaldo(usuario.id)
    saldoAtual = saldo
  } catch {
    // não crítico
  }

  const emoji = parsed.tipo === 'RECEITA' ? '✅' : '💸'
  const acao = parsed.tipo === 'RECEITA' ? 'Receita' : 'Despesa'
  const saldoLinha = saldoAtual !== null ? `\n\n📊 Saldo atual: *${fmt(saldoAtual)}*` : ''
  const dataLinha = dataExplicita
    ? `\n📅 *Data:* ${formatDataTransacaoReplyPtBr(dataTransacaoIso)}`
    : ''

  return {
    ok: true,
    reply: `${emoji} *${acao} registrada!*\n\n💰 Valor: ${fmt(parsed.valor)}\n📝 ${parsed.descricao || message.slice(0, 60)}${dataLinha}${saldoLinha}`,
  }
}
