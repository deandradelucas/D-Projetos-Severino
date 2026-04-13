/** @typedef {'compromisso' | 'lembrete' | 'conta-pagar' | 'conta-receber' | 'reuniao' | 'tarefa'} AgendaEventType */
/** @typedef {'pendente' | 'concluido' | 'cancelado' | 'vencido' | 'pago' | 'recebido'} AgendaEventStatus */
/** @typedef {'baixa' | 'media' | 'alta'} AgendaPriority */
/** @typedef {'nao-recorrente' | 'diario' | 'semanal' | 'mensal'} AgendaRecurrence */
/** @typedef {'agora' | '15-min' | '30-min' | '1-hora' | '1-dia'} AgendaReminder */

export const AGENDA_EVENT_TYPES = {
  COMPROMISSO: 'compromisso',
  LEMBRETE: 'lembrete',
  CONTA_PAGAR: 'conta-pagar',
  CONTA_RECEBER: 'conta-receber',
  REUNIAO: 'reuniao',
  TAREFA: 'tarefa',
}

export const AGENDA_TYPE_LABELS = {
  [AGENDA_EVENT_TYPES.COMPROMISSO]: 'Compromisso',
  [AGENDA_EVENT_TYPES.LEMBRETE]: 'Lembrete',
  [AGENDA_EVENT_TYPES.CONTA_PAGAR]: 'Conta a pagar',
  [AGENDA_EVENT_TYPES.CONTA_RECEBER]: 'Conta a receber',
  [AGENDA_EVENT_TYPES.REUNIAO]: 'Reunião',
  [AGENDA_EVENT_TYPES.TAREFA]: 'Tarefa',
}

export const AGENDA_STATUS_LABELS = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  vencido: 'Vencido',
  pago: 'Pago',
  recebido: 'Recebido',
}

export const AGENDA_PRIORITY_LABELS = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export const AGENDA_RECURRENCE_LABELS = {
  'nao-recorrente': 'Não recorrente',
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
}

export const AGENDA_REMINDER_LABELS = {
  agora: 'No horário',
  '15-min': '15 minutos antes',
  '30-min': '30 minutos antes',
  '1-hora': '1 hora antes',
  '1-dia': '1 dia antes',
}

/** Status aplicáveis por tipo (UI) */
export const STATUS_OPTIONS_BY_TYPE = {
  [AGENDA_EVENT_TYPES.COMPROMISSO]: ['pendente', 'concluido', 'cancelado'],
  [AGENDA_EVENT_TYPES.LEMBRETE]: ['pendente', 'concluido', 'cancelado'],
  [AGENDA_EVENT_TYPES.CONTA_PAGAR]: ['pendente', 'pago', 'vencido', 'cancelado'],
  [AGENDA_EVENT_TYPES.CONTA_RECEBER]: ['pendente', 'recebido', 'cancelado'],
  [AGENDA_EVENT_TYPES.REUNIAO]: ['pendente', 'concluido', 'cancelado'],
  [AGENDA_EVENT_TYPES.TAREFA]: ['pendente', 'concluido', 'cancelado'],
}

export const AGENDA_VIEW_MODES = {
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  LIST: 'list',
}
