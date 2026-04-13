/**
 * @typedef {Object} AgendaEvent
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string} type
 * @property {string} [category]
 * @property {string} [subcategory]
 * @property {string} startAt — ISO 8601
 * @property {string} endAt
 * @property {boolean} [allDay]
 * @property {string} [location]
 * @property {string} [notes]
 * @property {number|null} [amount]
 * @property {string} status
 * @property {string} [priority]
 * @property {string} [recurrence]
 * @property {string} [reminder]
 * @property {string} [color]
 * @property {string|null} [linkedTransactionId]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * @typedef {Object} AgendaSummary
 * @property {number} todayCount
 * @property {number} next7DaysCount
 * @property {number} payableTotal
 * @property {number} receivableTotal
 */

const STORAGE_KEY = 'horizonte_agenda_events'

const DEFAULT_EVENTS = [
  {
    id: 'ev-aluguel',
    title: 'Vencimento do aluguel',
    description: 'Transferir para imobiliária',
    type: 'conta-pagar',
    category: 'Moradia',
    subcategory: 'Aluguel',
    startAt: new Date().toISOString().slice(0, 10) + 'T09:00:00Z',
    endAt: new Date().toISOString().slice(0, 10) + 'T09:30:00Z',
    allDay: false,
    location: 'Conta corrente',
    notes: 'Agendar débito automático',
    amount: 2140,
    status: 'pendente',
    priority: 'alta',
    recurrence: 'mensal',
    reminder: '1-dia',
    color: '#d97706',
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ev-assinatura',
    title: 'Assinatura mensal - SaaS',
    description: 'Cobrança recorrente',
    type: 'conta-pagar',
    category: 'Ferramentas',
    subcategory: 'SaaS',
    startAt: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString(),
    endAt: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString(),
    allDay: true,
    location: 'Cartão corporativo',
    notes: 'Revisar necessidade do plano',
    amount: 320,
    status: 'pendente',
    priority: 'media',
    recurrence: 'mensal',
    reminder: '1-dia',
    color: '#2563eb',
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ev-recebimento',
    title: 'Recebimento do contrato X',
    description: 'Validação antes do repasse',
    type: 'conta-receber',
    category: 'Clientes',
    subcategory: 'Contrato X',
    startAt: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    endAt: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    allDay: false,
    location: 'Pix/Conta digital',
    notes: 'Enviar comprovante ao cliente',
    amount: 12800,
    status: 'recebido',
    priority: 'alta',
    recurrence: 'nao-recorrente',
    reminder: '30-min',
    color: '#16a34a',
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ev-reuniao',
    title: 'Reunião com cliente Y',
    description: 'Planejamento financeiro trimestral',
    type: 'reuniao',
    category: 'Relatórios',
    subcategory: 'Planejamento',
    startAt: new Date(new Date().setHours(new Date().getHours() + 24)).toISOString(),
    endAt: new Date(new Date().setHours(new Date().getHours() + 25)).toISOString(),
    allDay: false,
    location: 'Sala 03 - HQ',
    notes: 'Levar projeções e gráficos',
    amount: null,
    status: 'pendente',
    priority: 'media',
    recurrence: 'nao-recorrente',
    reminder: '1-hora',
    color: '#7c3aed',
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ev-lembrete',
    title: 'Lembrete: pagar fatura cartão',
    description: 'Confere despesas e categoria',
    type: 'lembrete',
    category: 'Administração',
    subcategory: 'Financeiro',
    startAt: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
    endAt: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
    allDay: true,
    location: 'Contas corporativas',
    notes: '',
    amount: 0,
    status: 'pendente',
    priority: 'baixa',
    recurrence: 'nao-recorrente',
    reminder: '15-min',
    color: '#0ea5e9',
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ev-tarefa',
    title: 'Tarefa administrativa',
    description: 'Enviar relatório de contas a receber',
    type: 'tarefa',
    category: 'Operações',
    subcategory: 'Relatórios',
    startAt: new Date().toISOString(),
    endAt: new Date().toISOString(),
    allDay: false,
    location: 'Escritório',
    notes: '',
    amount: 0,
    status: 'concluido',
    priority: 'media',
    recurrence: 'nao-recorrente',
    reminder: '30-min',
    color: '#f97316',
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ev-consulta',
    title: 'Consulta médica',
    description: 'Check-up anual — coparticipação',
    type: 'compromisso',
    category: 'Saúde',
    subcategory: 'Check-up',
    startAt: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 8)
      d.setHours(14, 30, 0, 0)
      return d.toISOString()
    })(),
    endAt: (() => {
      const d = new Date()
      d.setDate(d.getDate() + 8)
      d.setHours(15, 30, 0, 0)
      return d.toISOString()
    })(),
    allDay: false,
    location: 'Clínica Central',
    notes: 'Levar exames anteriores',
    amount: 180,
    status: 'pendente',
    priority: 'media',
    recurrence: 'nao-recorrente',
    reminder: '1-hora',
    color: '#ec4899',
    linkedTransactionId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function delay(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadStorageEvents() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EVENTS))
    return DEFAULT_EVENTS
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // ignore
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_EVENTS))
  return DEFAULT_EVENTS
}

function persistEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `ev-${crypto.randomUUID()}`
  }
  return `ev-${Math.random().toString(36).slice(2, 11)}`
}

export async function listAgendaEvents() {
  await delay()
  return loadStorageEvents()
}

export async function getAgendaEventById(id) {
  const events = loadStorageEvents()
  return events.find((event) => event.id === id) || null
}

export async function createAgendaEvent(payload) {
  const events = loadStorageEvents()
  const now = new Date().toISOString()
  const next = {
    description: '',
    category: '',
    subcategory: '',
    allDay: false,
    location: '',
    notes: '',
    amount: null,
    priority: 'media',
    recurrence: 'nao-recorrente',
    reminder: '30-min',
    color: '#64748b',
    linkedTransactionId: null,
    ...payload,
    id: createId(),
    createdAt: now,
    updatedAt: now,
  }
  const updated = [next, ...events]
  persistEvents(updated)
  await delay()
  return next
}

export async function updateAgendaEvent(id, payload) {
  const events = loadStorageEvents()
  let updated = events.map((event) => {
    if (event.id !== id) return event
    return { ...event, ...payload, updatedAt: new Date().toISOString() }
  })
  persistEvents(updated)
  await delay()
  return updated.find((event) => event.id === id) || null
}

export async function deleteAgendaEvent(id) {
  const events = loadStorageEvents()
  const updated = events.filter((event) => event.id !== id)
  persistEvents(updated)
  await delay()
  return updated
}

export async function updateAgendaEventStatus(id, status) {
  return updateAgendaEvent(id, { status })
}

export function getAgendaSummary(events) {
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const endNext7 = new Date(startToday)
  endNext7.setDate(endNext7.getDate() + 7)
  endNext7.setHours(23, 59, 59, 999)

  const summary = {
    todayCount: 0,
    next7DaysCount: 0,
    payableTotal: 0,
    receivableTotal: 0,
  }
  const todayStr = new Date().toISOString().slice(0, 10)

  for (const event of events) {
    const t = new Date(event.startAt).getTime()
    if (Number.isNaN(t)) continue
    const dateKey = event.startAt?.slice(0, 10) || ''
    if (dateKey === todayStr) summary.todayCount += 1
    if (t >= startToday.getTime() && t <= endNext7.getTime()) summary.next7DaysCount += 1

    const st = String(event.status || '')
    const amt = Number(event.amount) || 0
    if (event.type === 'conta-pagar' && amt > 0 && !['pago', 'cancelado', 'concluido'].includes(st)) {
      summary.payableTotal += amt
    }
    if (event.type === 'conta-receber' && amt > 0 && !['recebido', 'cancelado', 'concluido'].includes(st)) {
      summary.receivableTotal += amt
    }
  }
  return summary
}

export function getAgendaEventsByPeriod(events, start, end) {
  const startTs = new Date(start).getTime()
  const endTs = new Date(end).getTime()
  return events.filter((event) => {
    const eventTs = new Date(event.startAt).getTime()
    return eventTs >= startTs && eventTs <= endTs
  })
}
