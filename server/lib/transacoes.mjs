import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

/** Normaliza `tipo` vindo do banco ou do front para o CHECK da tabela (`DESPESA` | `RECEITA`). */
export function normalizeTipoCategoria(t) {
  const u = String(t ?? '').trim().toUpperCase()
  if (u === 'RECEITA' || u === 'DESPESA') return u
  return u.length ? u : 'DESPESA'
}

async function _fetchCategoriasUsuario(supabaseAdmin, usuario_id) {
  const { data, error } = await supabaseAdmin
    .from('categorias')
    .select('id, nome, tipo, cor')
    .eq('usuario_id', usuario_id)
    .order('nome', { ascending: true })
  if (error) throw error
  return data || []
}

async function _insertSubcategoriasRobusto(supabaseAdmin, subsToInsert, contexto) {
  if (!subsToInsert?.length) return
  const { error: errBatch } = await supabaseAdmin.from('subcategorias').insert(subsToInsert)
  if (!errBatch) return
  log.warn('subcategorias: insert em lote falhou, tentando uma a uma', { ...contexto, message: errBatch.message })
  for (const row of subsToInsert) {
    const { error: e1 } = await supabaseAdmin.from('subcategorias').insert(row)
    if (e1) log.warn('subcategorias: linha ignorada', { ...contexto, nome: row.nome, message: e1.message })
  }
}

export async function getCategorias(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) return []

  let categorias = await _fetchCategoriasUsuario(supabaseAdmin, uid)

  if (categorias.length === 0) {
    await _seedCategoriesForUser(uid, supabaseAdmin)
    categorias = await _fetchCategoriasUsuario(supabaseAdmin, uid)
  }

  await _syncMissingDefaultCategories(uid, supabaseAdmin, categorias)
  categorias = await _fetchCategoriasUsuario(supabaseAdmin, uid)

  if (categorias.length === 0) return []

  const categoriaIds = categorias.map((c) => c.id)
  const { data: subcategorias, error: subError } = await supabaseAdmin
    .from('subcategorias')
    .select('id, categoria_id, nome')
    .in('categoria_id', categoriaIds)
    .order('nome', { ascending: true })

  if (subError) throw subError

  return categorias.map((c) => {
    return {
      ...c,
      tipo: normalizeTipoCategoria(c.tipo),
      subcategorias: (subcategorias || []).filter((sub) => sub.categoria_id === c.id),
    }
  })
}
/** Fonte única para seed + fallback de IA (WhatsApp). Manter nomes alinhados. */
export const DEFAULT_CATEGORIES = [
  // DESPESAS GERAIS
  { nome: 'Alimentação', tipo: 'DESPESA', cor: '#ef4444', subcategorias: ['Supermercado', 'Restaurantes e Lanches', 'Padaria e Cafeteira', 'Delivery (iFood, etc)', 'Feira e Sacolão', 'Açougue e Peixaria', 'Atacadista', 'Bebidas', 'Doces e Sobremesas', 'Fast Food', 'Hortifruti'] },
  { nome: 'Moradia', tipo: 'DESPESA', cor: '#f97316', subcategorias: ['Aluguel', 'Conta de Luz', 'Conta de Água', 'Condomínio', 'Internet e TV', 'Gás', 'IPTU', 'Manutenção e Reformas', 'Seguro Residencial', 'Material de Limpeza', 'Decoração de Interiores', 'Jardinagem/Paisagismo', 'Eletrodomésticos', 'Móveis'] },
  { nome: 'Transporte', tipo: 'DESPESA', cor: '#eab308', subcategorias: ['Combustível', 'App de Transporte (Uber, 99)', 'Transporte Público', 'Estacionamento', 'Pedágio', 'Manutenção Veicular', 'IPVA e Licenciamento', 'Seguro Auto', 'Financiamento do Veículo', 'Lavagem e Estética Automotiva', 'Táxi', 'Aluguel de Veículos e Carsharing', 'Bicicleta/Manutenção'] },
  { nome: 'Saúde', tipo: 'DESPESA', cor: '#14b8a6', subcategorias: ['Plano de Saúde', 'Medicamentos', 'Consultas Médicas', 'Exames', 'Odontologia / Dentista', 'Terapia / Psicologia', 'Academia e Esportes', 'Suplementos e Vitaminas', 'Óculos e Lentes', 'Fisioterapia', 'Nutricionista', 'Terapias Alternativas (Acupuntura, etc)', 'Pilates/Yoga'] },
  { nome: 'Educação', tipo: 'DESPESA', cor: '#3b82f6', subcategorias: ['Mensalidade (Escola/Faculdade)', 'Cursos e Certificações', 'Material Escolar / Artigos', 'Livros e Apostilas', 'Idiomas', 'Papelaria', 'Fardamento / Uniformes', 'Mentorias e Consultorias', 'Transporte Escolar'] },
  { nome: 'Lazer e Entretenimento', tipo: 'DESPESA', cor: '#8b5cf6', subcategorias: ['Assinaturas (Netflix, Spotify, etc)', 'Cinema, Shows e Teatro', 'Bares e Baladas', 'Viagens e Passeios', 'Jogos e Hobbies', 'Livros Não-Didáticos', 'Revistas e Jornais', 'Eventos Esportivos', 'Festas', 'Colecionáveis', 'Praias e Parques'] },
  
  // PESSOAIS E ESPECÍFICOS
  { nome: 'Cuidados Pessoais', tipo: 'DESPESA', cor: '#ec4899', subcategorias: ['Salão de Beleza / Barbearia', 'Cosméticos e Perfumaria', 'Vestuário (Roupas do Dia a Dia)', 'Sapatos e Tênis', 'Roupas Sociais', 'Semijóias e Relógios', 'Tratamentos Estéticos', 'Maquiagem', 'Acessórios'] },
  { nome: 'Pets e Dependentes', tipo: 'DESPESA', cor: '#06b6d4', subcategorias: ['Ração e Alimentação PET', 'Veterinário e Petshop', 'Mesada', 'Gastos Extras com Filhos/PETs', 'Brinquedos PET', 'Remédios PET', 'Banho e Tosa', 'Adestramento', 'Pensão e Gastos Judiciais', 'Vestuário Infantil', 'Lanche Escolar', 'Atividades Extracurriculares (Natação, Balé)'] },
  { nome: 'Documentações e Impostos', tipo: 'DESPESA', cor: '#57534e', subcategorias: ['Renovação CNH / Multas', 'Emissão de Passaporte', 'Cartório e Certidões', 'Imposto de Renda (Pagamento)', 'MEI / DAS', 'Simples Nacional'] },
  { nome: 'Viagens', tipo: 'DESPESA', cor: '#0284c7', subcategorias: ['Passagens Aéreas / Ônibus', 'Hospedagem / Hotel', 'Alimentação em Viagem', 'Passeios Turísticos / Ingressos', 'Seguro Viagem', 'Aluguel de Carro (Viagem)'] },
  { nome: 'Tecnologia e Gadgets', tipo: 'DESPESA', cor: '#334155', subcategorias: ['Celular Novo e Acessórios', 'Assinatura de Softwares (Office, Adobe)', 'Computadores e Periféricos', 'Jogos Digitais / Consoles', 'Hospedagem / Domínios', 'Apps Mobile'] },
  { nome: 'Doações e Presentes', tipo: 'DESPESA', cor: '#db2777', subcategorias: ['Carnês / Dízimo', 'Arrecadações', 'Ajuda a Familiares e Amigos', 'ONGs / Patrocínios', 'Presentes de Aniversário', 'Natal e Festas Comemorativas', 'Amigo Oculto'] },
  
  // FINANCEIROS
  { nome: 'Despesas Financeiras', tipo: 'DESPESA', cor: '#64748b', subcategorias: ['Parcela de Empréstimo', 'Pagamento de Fatura (Não Categorizado)', 'Taxas e Tarifas Bancárias', 'Seguros Variados', 'Juros e Multas', 'Taxa de Corretagem', 'Contabilidade', 'Juros Cartão de Crédito', 'PIX e TEDs Pagos'] },

  // RECEITAS
  { nome: 'Renda Principal', tipo: 'RECEITA', cor: '#22c55e', subcategorias: ['Salário', 'Férias', '13º Salário', 'PLR / Bônus', 'Aposentadoria / INSS', 'BPC'] },
  { nome: 'Rendas PJ / Empresa', tipo: 'RECEITA', cor: '#15803d', subcategorias: ['Pró-labore', 'Distribuição de Lucros', 'Reembolso de Despesas Empresariais', 'Vendas Corporativas'] },
  { nome: 'Renda Extra', tipo: 'RECEITA', cor: '#10b981', subcategorias: ['Freelance / Serviços Extras', 'Vendas e Comissionamentos', 'Aluguéis Recebidos', 'Restituição de Imposto', 'Venda de Bens/Ativos Usados'] },
  { nome: 'Rendimentos e Benefícios', tipo: 'RECEITA', cor: '#059669', subcategorias: ['Rendimento de Investimentos', 'Dividendos (Ações e FIIs)', 'Juros Recebidos', 'Resgate de Benefício (Previdência)', 'Auxílios Governamentais', 'FGTS', 'Seguro-Desemprego', 'Abono Salarial', 'Mesada Recebida'] }
]

async function _seedCategoriesForUser(usuario_id, supabaseAdmin) {
  for (const cat of DEFAULT_CATEGORIES) {
    const tipo = normalizeTipoCategoria(cat.tipo)
    const { data: categoriaData, error: errCat } = await supabaseAdmin
      .from('categorias')
      .insert({ usuario_id, nome: cat.nome, tipo, cor: cat.cor })
      .select('id')
      .maybeSingle()

    if (errCat || !categoriaData?.id) {
      log.warn('seed categorias: insert ignorado', { nome: cat.nome, message: errCat?.message })
      continue
    }

    const subsToInsert = cat.subcategorias.map((nome) => ({ categoria_id: categoriaData.id, nome }))
    await _insertSubcategoriasRobusto(supabaseAdmin, subsToInsert, { etapa: 'seed', categoria_id: categoriaData.id })
  }
}

function _categoriaChaveUnica(nome, tipo) {
  return `${String(nome || '').trim().toLowerCase()}|||${normalizeTipoCategoria(tipo)}`
}

/** Usuários antigos: completar categorias do catálogo padrão que ainda não existem (ex.: novas linhas em `DEFAULT_CATEGORIES`). */
async function _syncMissingDefaultCategories(usuario_id, supabaseAdmin, categoriasAtuais) {
  const lista = categoriasAtuais || []
  const keys = new Set(lista.map((c) => _categoriaChaveUnica(c.nome, c.tipo)))
  for (const cat of DEFAULT_CATEGORIES) {
    const k = _categoriaChaveUnica(cat.nome, cat.tipo)
    if (keys.has(k)) continue
    const tipo = normalizeTipoCategoria(cat.tipo)
    const { data: categoriaData, error: errCat } = await supabaseAdmin
      .from('categorias')
      .insert({ usuario_id, nome: cat.nome, tipo, cor: cat.cor })
      .select('id')
      .maybeSingle()
    if (errCat || !categoriaData?.id) {
      log.warn('categorias sync: categoria padrão não criada', { usuario_id, nome: cat.nome, message: errCat?.message })
      continue
    }
    keys.add(k)
    const subsToInsert = cat.subcategorias.map((nome) => ({ categoria_id: categoriaData.id, nome }))
    await _insertSubcategoriasRobusto(supabaseAdmin, subsToInsert, { etapa: 'sync', categoria_id: categoriaData.id })
  }
}

export async function inserirTransacao({ usuario_id, conta_id, categoria_id, subcategoria_id, tipo, valor, descricao, data_transacao, status, recorrencia }) {
  const supabaseAdmin = getSupabaseAdmin()
  const valNum = parseFloat(valor)
  
  if (isNaN(valNum) || valNum <= 0) {
    throw new Error('Valor inválido.')
  }

  const basePayload = {
    usuario_id,
    tipo,
    valor: valNum,
    descricao,
    status: status || 'EFETIVADA'
  }

  if (conta_id) basePayload.conta_id = conta_id
  if (categoria_id) basePayload.categoria_id = categoria_id
  if (subcategoria_id) basePayload.subcategoria_id = subcategoria_id

  const payloads = []
  
  if (recorrencia && recorrencia.quantidade > 1) {
    const grupoId = crypto.randomUUID()
    const startDate = new Date(data_transacao)

    for (let i = 0; i < recorrencia.quantidade; i++) {
      const currentLabel = i + 1
      const pDate = new Date(startDate)
      
      if (recorrencia.frequencia === 'MENSAL') {
        pDate.setMonth(pDate.getMonth() + i)
      } else if (recorrencia.frequencia === 'SEMANAL') {
        pDate.setDate(pDate.getDate() + (i * 7))
      } else if (recorrencia.frequencia === 'ANUAL') {
        pDate.setFullYear(pDate.getFullYear() + i)
      }

      payloads.push({
        ...basePayload,
        data_transacao: pDate.toISOString(),
        recorrente_grupo_id: grupoId,
        recorrente_index: currentLabel,
        recorrente_total: recorrencia.quantidade
      })
    }
  } else {
    payloads.push({
      ...basePayload,
      data_transacao
    })
  }

  const { data, error } = await supabaseAdmin
    .from('transacoes')
    .insert(payloads)
    .select()

  if (error) throw error

  return data[0]
}

async function enrichTransacoesComCategorias(supabaseAdmin, rows) {
  if (!rows?.length) return []
  const catIds = [...new Set(rows.map((r) => r.categoria_id).filter(Boolean))]
  const subIds = [...new Set(rows.map((r) => r.subcategoria_id).filter(Boolean))]
  const catMap = new Map()
  const subMap = new Map()
  if (catIds.length) {
    const { data: cats } = await supabaseAdmin.from('categorias').select('id, nome, cor').in('id', catIds)
    for (const c of cats || []) catMap.set(c.id, { nome: c.nome, cor: c.cor })
  }
  if (subIds.length) {
    const { data: subs } = await supabaseAdmin.from('subcategorias').select('id, nome').in('id', subIds)
    for (const s of subs || []) subMap.set(s.id, { nome: s.nome })
  }
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    valor: r.valor,
    descricao: r.descricao,
    data_transacao: r.data_transacao,
    status: r.status,
    categoria_id: r.categoria_id,
    subcategoria_id: r.subcategoria_id,
    recorrente_grupo_id: r.recorrente_grupo_id ?? null,
    recorrente_index: r.recorrente_index ?? null,
    recorrente_total: r.recorrente_total ?? null,
    recorrencia_mensal_id: r.recorrencia_mensal_id ?? null,
    categorias: r.categoria_id ? catMap.get(r.categoria_id) ?? null : null,
    subcategorias: r.subcategoria_id ? subMap.get(r.subcategoria_id) ?? null : null,
  }))
}

function parseTransacoesListPagination(filters) {
  let lim =
    filters.limit !== undefined && filters.limit !== null && filters.limit !== ''
      ? parseInt(String(filters.limit), 10)
      : 500
  if (!Number.isFinite(lim) || lim < 1) lim = 500
  lim = Math.min(lim, 2000)

  let off =
    filters.offset !== undefined && filters.offset !== null && filters.offset !== ''
      ? parseInt(String(filters.offset), 10)
      : 0
  if (!Number.isFinite(off) || off < 0) off = 0
  off = Math.min(off, 50_000)

  return { lim, off, rangeEnd: off + lim - 1 }
}

export async function getTransacoes(usuarioId, filters = {}) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) return []

  const { dataInicio, dataFim, tipo, categoria_id, status, busca, somenteRecorrentes } = filters
  const { off, rangeEnd } = parseTransacoesListPagination(filters)

  const applyFilters = (q) => {
    let query = q.eq('usuario_id', uid)
    if (dataInicio) query = query.gte('data_transacao', dataInicio)
    if (dataFim) query = query.lte('data_transacao', dataFim)
    if (tipo) query = query.eq('tipo', tipo)
    if (categoria_id) query = query.eq('categoria_id', categoria_id)
    if (status) query = query.eq('status', status)
    if (busca) query = query.ilike('descricao', `%${busca}%`)
    /* Parcelas (recorrente_grupo_id) ou regra mensal (recorrencia_mensal_id) */
    if (somenteRecorrentes) {
      query = query.or('recorrencia_mensal_id.not.is.null,recorrente_grupo_id.not.is.null')
    }
    return query
  }

  const selectComEmbed = `
      id, tipo, valor, descricao, data_transacao, status, categoria_id, subcategoria_id,
      recorrente_grupo_id, recorrente_index, recorrente_total, recorrencia_mensal_id,
      categorias(nome, cor),
      subcategorias(nome)
    `

  let query = applyFilters(supabaseAdmin.from('transacoes').select(selectComEmbed))

  const { data, error } = await query.order('data_transacao', { ascending: false }).range(off, rangeEnd)

  if (error) {
    log.warn('[getTransacoes] embed falhou, fallback sem join:', error.message || error)
    const baseCols =
      'id, tipo, valor, descricao, data_transacao, status, categoria_id, subcategoria_id, recorrente_grupo_id, recorrente_index, recorrente_total'

    let qFlat = applyFilters(
      supabaseAdmin.from('transacoes').select(`${baseCols}, recorrencia_mensal_id`)
    )
    let r2 = await qFlat.order('data_transacao', { ascending: false }).range(off, rangeEnd)

    if (r2.error) {
      log.warn(
        '[getTransacoes] fallback com recorrencia_mensal_id falhou; colunas legadas:',
        r2.error.message || r2.error
      )
      qFlat = applyFilters(supabaseAdmin.from('transacoes').select(baseCols))
      r2 = await qFlat.order('data_transacao', { ascending: false }).range(off, rangeEnd)
      if (r2.error) throw r2.error
      const rows = (r2.data || []).map((r) => ({ ...r, recorrencia_mensal_id: null }))
      return enrichTransacoesComCategorias(supabaseAdmin, rows)
    }
    return enrichTransacoesComCategorias(supabaseAdmin, r2.data || [])
  }

  return Array.isArray(data) ? data : []
}

export async function atualizarTransacao(id, usuarioId, body) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const valNum = parseFloat(body.valor)
  if (isNaN(valNum) || valNum <= 0) {
    throw new Error('Valor inválido.')
  }

  const update = {
    tipo: body.tipo,
    valor: valNum,
    descricao: body.descricao ?? '',
    data_transacao: body.data_transacao,
    status: body.status || 'EFETIVADA',
    categoria_id: body.categoria_id || null,
    subcategoria_id: body.subcategoria_id || null,
  }

  const { data, error } = await supabaseAdmin
    .from('transacoes')
    .update(update)
    .eq('id', id)
    .eq('usuario_id', uid)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Transação não encontrada.')
  return data
}

export async function deletarTransacao(id, usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const { error } = await supabaseAdmin
    .from('transacoes')
    .delete()
    .eq('id', id)
    .eq('usuario_id', uid)

  if (error) throw error
  return true
}
