// Constantes e helpers puros da página de Listas (Compras / Tarefas).
// Extraídos de pages/ListaDeCompras.jsx — sem dependência de React.

import { formatCurrencyBRL } from './formatCurrency'

// Formatação BRL única do app (ver lib/formatCurrency.js)
export const formatarMoeda = formatCurrencyBRL

export const CATEGORIAS_LOOKUP = {
  'arroz': 'Grãos e Cereais',
  'feijão': 'Grãos e Cereais',
  'feijao': 'Grãos e Cereais',
  'macarrão': 'Grãos e Cereais',
  'macarrao': 'Grãos e Cereais',
  'farinha': 'Grãos e Cereais',
  'aveia': 'Grãos e Cereais',
  'granola': 'Grãos e Cereais',
  'leite': 'Laticínios',
  'queijo': 'Laticínios',
  'iogurte': 'Laticínios',
  'manteiga': 'Laticínios',
  'requeijão': 'Laticínios',
  'requeijao': 'Laticínios',
  'creme de leite': 'Laticínios',
  'nata': 'Laticínios',
  'frango': 'Carnes',
  'carne': 'Carnes',
  'peixe': 'Carnes',
  'linguiça': 'Carnes',
  'linguica': 'Carnes',
  'salsicha': 'Carnes',
  'atum': 'Carnes',
  'sardinha': 'Carnes',
  'presunto': 'Carnes',
  'bacon': 'Carnes',
  'alface': 'Hortifruti',
  'tomate': 'Hortifruti',
  'banana': 'Hortifruti',
  'maçã': 'Hortifruti',
  'maca': 'Hortifruti',
  'laranja': 'Hortifruti',
  'cebola': 'Hortifruti',
  'alho': 'Hortifruti',
  'batata': 'Hortifruti',
  'cenoura': 'Hortifruti',
  'limão': 'Hortifruti',
  'limao': 'Hortifruti',
  'pepino': 'Hortifruti',
  'abobrinha': 'Hortifruti',
  'brócolis': 'Hortifruti',
  'brocolis': 'Hortifruti',
  'espinafre': 'Hortifruti',
  'detergente': 'Limpeza',
  'sabão': 'Limpeza',
  'sabao': 'Limpeza',
  'desinfetante': 'Limpeza',
  'água sanitária': 'Limpeza',
  'agua sanitaria': 'Limpeza',
  'esponja': 'Limpeza',
  'vassoura': 'Limpeza',
  'rodo': 'Limpeza',
  'amaciante': 'Limpeza',
  'shampoo': 'Higiene',
  'sabonete': 'Higiene',
  'papel higiênico': 'Higiene',
  'papel higienico': 'Higiene',
  'fio dental': 'Higiene',
  'escova': 'Higiene',
  'creme dental': 'Higiene',
  'desodorante': 'Higiene',
  'absorvente': 'Higiene',
  'café': 'Bebidas',
  'cafe': 'Bebidas',
  'suco': 'Bebidas',
  'refrigerante': 'Bebidas',
  'água': 'Bebidas',
  'agua': 'Bebidas',
  'cerveja': 'Bebidas',
  'vinho': 'Bebidas',
  'chá': 'Bebidas',
  'cha': 'Bebidas',
  'pão': 'Padaria',
  'pao': 'Padaria',
  'bolo': 'Padaria',
  'biscoito': 'Biscoitos',
  'bolacha': 'Biscoitos',
  'cookie': 'Biscoitos',
  'salgadinho': 'Biscoitos',
  'chips': 'Biscoitos',
  'chocolate': 'Doces',
  'açúcar': 'Doces',
  'acucar': 'Doces',
  'mel': 'Doces',
  'geléia': 'Doces',
  'geleia': 'Doces',
  'sorvete': 'Doces',
  'óleo': 'Temperos',
  'oleo': 'Temperos',
  'azeite': 'Temperos',
  'vinagre': 'Temperos',
  'sal': 'Temperos',
  'pimenta': 'Temperos',
  'colorau': 'Temperos',
  'maionese': 'Temperos',
  'ketchup': 'Temperos',
  'mostarda': 'Temperos',
  'molho': 'Temperos',
}

/** Rótulo exibido na tag da lista (e no subtítulo do WhatsApp). O gasto continua
 *  sendo lançado em Alimentação → Supermercado (categorização independente). */
export const LISTA_GASTO_ROTULO = 'Compras'

export const CATEGORIA_EMOJI = {
  'Grãos e Cereais': '🌾',
  'Laticínios': '🥛',
  'Carnes': '🥩',
  'Hortifruti': '🥦',
  'Limpeza': '🧹',
  'Higiene': '🧴',
  'Bebidas': '🥤',
  'Padaria': '🍞',
  'Biscoitos': '🍪',
  'Doces': '🍬',
  'Temperos': '🧂',
  'Outros': '🛒',
}

export function detectarCategoria(nome) {
  const lower = nome.toLowerCase()
  for (const [key, cat] of Object.entries(CATEGORIAS_LOOKUP)) {
    if (lower.includes(key)) return cat
  }
  return 'Outros'
}

// localStorage: id da última lista aberta/editada (para reabrir ao voltar à aba)
export const LISTA_ULTIMA_KEY = 'lista_compras_ultima'

export function dataHojeIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Procura subcategoria "Mercado" / "Supermercado" dentro da categoria selecionada.
 * Match em ordem: equivalência exata → contém "supermercado" → contém "mercado".
 * Diacríticos ignorados; útil pois a base default usa acentos.
 */
export function encontrarSubcategoriaMercado(cat) {
  const subs = Array.isArray(cat?.subcategorias) ? cat.subcategorias : []
  if (!subs.length) return null
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  return (
    subs.find((s) => norm(s.nome) === 'supermercado') ||
    subs.find((s) => norm(s.nome) === 'mercado') ||
    subs.find((s) => norm(s.nome).includes('supermercado')) ||
    subs.find((s) => norm(s.nome).includes('mercado')) ||
    null
  )
}
