import { log } from './logger.mjs'
import { getSupabaseAdmin } from './supabase-admin.mjs'

/** Escapa curingas do LIKE (% e _) e a barra de escape, evitando wildcard injection na busca livre. */
function escapeIlike(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Normaliza `tipo` vindo do banco ou do front para o CHECK da tabela (`DESPESA` | `RECEITA`). */
export function normalizeTipoCategoria(t) {
  const u = String(t ?? '').trim().toUpperCase()
  if (u === 'RECEITA' || u === 'DESPESA') return u
  return u.length ? u : 'DESPESA'
}

// Retorna TODAS as categorias (incl. arquivadas) — o sync precisa enxergar as
// arquivadas para não ressuscitá-las; getCategorias filtra as ativas na resposta.
async function _fetchCategoriasUsuario(supabaseAdmin, usuario_id) {
  const { data, error } = await supabaseAdmin
    .from('categorias')
    .select('id, nome, tipo, cor, icone, arquivada_em')
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

  // Resposta só com ATIVAS (arquivadas preservam histórico mas saem da seleção).
  const ativas = categorias.filter((c) => !c.arquivada_em)
  if (ativas.length === 0) return []

  const categoriaIds = ativas.map((c) => c.id)
  const { data: subcategorias, error: subError } = await supabaseAdmin
    .from('subcategorias')
    .select('id, categoria_id, nome, arquivada_em')
    .in('categoria_id', categoriaIds)
    .order('nome', { ascending: true })

  if (subError) throw subError

  const comSubs = ativas.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: normalizeTipoCategoria(c.tipo),
    cor: c.cor,
    icone: c.icone ?? null,
    subcategorias: (subcategorias || []).filter((sub) => sub.categoria_id === c.id && !sub.arquivada_em),
  }))

  /* Uma linha por (nome, tipo): evita duplicados no UI quando o banco tem categorias repetidas (ex.: RECEITA). */
  const visto = new Set()
  const dedup = []
  for (const c of comSubs) {
    const k = _categoriaChaveUnica(c.nome, c.tipo)
    if (visto.has(k)) continue
    visto.add(k)
    dedup.push(c)
  }
  return dedup.sort((a, b) =>
    String(a.nome ?? '').localeCompare(String(b.nome ?? ''), 'pt', { sensitivity: 'base' }),
  )
}
/** Fonte única para seed + fallback de IA (WhatsApp). Manter nomes alinhados. */
export const DEFAULT_CATEGORIES = [
  // DESPESAS GERAIS
  { nome: 'Alimentação', tipo: 'DESPESA', cor: '#ef4444', subcategorias: ['Supermercado', 'Restaurantes e Lanches', 'Padaria e Cafeteira', 'Delivery (iFood, etc)', 'Feira e Sacolão', 'Açougue e Peixaria', 'Atacadista', 'Bebidas', 'Doces e Sobremesas', 'Fast Food', 'Hortifruti', 'Mercearia', 'Comida Saudável', 'Marmitas', 'Cesta Básica', 'Almoço no Trabalho', 'Conveniência', 'Sorveteria', 'Churrasco'] },
  { nome: 'Moradia', tipo: 'DESPESA', cor: '#f97316', subcategorias: ['Aluguel', 'Conta de Luz', 'Conta de Água', 'Condomínio', 'Internet e TV', 'Gás', 'IPTU', 'Manutenção e Reformas', 'Seguro Residencial', 'Material de Limpeza', 'Decoração de Interiores', 'Jardinagem/Paisagismo', 'Eletrodomésticos', 'Móveis', 'Prestação do Imóvel', 'Financiamento Imobiliário', 'Energia Solar', 'Dedetização', 'Mudança e Frete', 'Portaria e Segurança', 'Utensílios Domésticos'] },
  { nome: 'Transporte', tipo: 'DESPESA', cor: '#eab308', subcategorias: ['Combustível', 'App de Transporte (Uber, 99)', 'Transporte Público', 'Estacionamento', 'Pedágio', 'Manutenção Veicular', 'IPVA e Licenciamento', 'Seguro Auto', 'Financiamento do Veículo', 'Lavagem e Estética Automotiva', 'Táxi', 'Aluguel de Veículos e Carsharing', 'Bicicleta/Manutenção', 'Moto', 'Pneus', 'Óleo e Revisão', 'Multas de Trânsito', 'Guincho', 'Balsa/Barca', 'Recarga de Veículo Elétrico'] },
  { nome: 'Saúde', tipo: 'DESPESA', cor: '#14b8a6', subcategorias: ['Plano de Saúde', 'Medicamentos', 'Consultas Médicas', 'Exames', 'Odontologia / Dentista', 'Terapia / Psicologia', 'Academia e Esportes', 'Suplementos e Vitaminas', 'Óculos e Lentes', 'Fisioterapia', 'Nutricionista', 'Terapias Alternativas (Acupuntura, etc)', 'Pilates/Yoga', 'Hospital e Pronto Atendimento', 'Vacinas', 'Cirurgias e Procedimentos', 'Dermatologia', 'Psiquiatria', 'Check-up', 'Equipamentos Médicos', 'Seguro Saúde Internacional'] },
  { nome: 'Educação', tipo: 'DESPESA', cor: '#3b82f6', subcategorias: ['Mensalidade (Escola/Faculdade)', 'Cursos e Certificações', 'Material Escolar / Artigos', 'Livros e Apostilas', 'Idiomas', 'Papelaria', 'Fardamento / Uniformes', 'Mentorias e Consultorias', 'Transporte Escolar', 'Pós-graduação / MBA', 'Cursos Online', 'Workshops e Eventos', 'Taxas de Prova', 'Intercâmbio', 'Aulas Particulares', 'Creche / Berçário'] },
  { nome: 'Lazer e Entretenimento', tipo: 'DESPESA', cor: '#8b5cf6', subcategorias: ['Assinaturas (Netflix, Spotify, etc)', 'Cinema, Shows e Teatro', 'Bares e Baladas', 'Viagens e Passeios', 'Jogos e Hobbies', 'Livros Não-Didáticos', 'Revistas e Jornais', 'Eventos Esportivos', 'Festas', 'Colecionáveis', 'Praias e Parques', 'Museus e Exposições', 'Streaming de Música', 'Streaming de Vídeo', 'Passeios em Família', 'Clubes e Associações', 'Instrumentos Musicais'] },
  
  // PESSOAIS E ESPECÍFICOS
  { nome: 'Cuidados Pessoais', tipo: 'DESPESA', cor: '#ec4899', subcategorias: ['Salão de Beleza / Barbearia', 'Cosméticos e Perfumaria', 'Vestuário (Roupas do Dia a Dia)', 'Sapatos e Tênis', 'Roupas Sociais', 'Semijóias e Relógios', 'Tratamentos Estéticos', 'Maquiagem', 'Acessórios', 'Skincare', 'Perfumes', 'Depilação', 'Massagem', 'Tatuagem e Piercing', 'Lavanderia', 'Costura e Ajustes'] },
  { nome: 'Pets e Dependentes', tipo: 'DESPESA', cor: '#06b6d4', subcategorias: ['Ração e Alimentação PET', 'Veterinário e Petshop', 'Mesada', 'Gastos Extras com Filhos/PETs', 'Brinquedos PET', 'Remédios PET', 'Banho e Tosa', 'Adestramento', 'Pensão e Gastos Judiciais', 'Vestuário Infantil', 'Lanche Escolar', 'Atividades Extracurriculares (Natação, Balé)', 'Creche / Escola Infantil', 'Fraldas e Higiene', 'Material Infantil', 'Babá / Cuidador', 'Plano de Saúde PET', 'Hotelzinho PET'] },
  { nome: 'Compras e Varejo', tipo: 'DESPESA', cor: '#a855f7', subcategorias: ['Marketplace (Amazon, Mercado Livre)', 'Shopping', 'Loja de Departamento', 'Eletrônicos de Consumo', 'Presentes Diversos', 'Utilidades', 'Compras Online', 'Importados', 'Outlet', 'Cashback Usado', 'Assinatura de Clube de Compras'] },
  { nome: 'Serviços e Assinaturas', tipo: 'DESPESA', cor: '#6366f1', subcategorias: ['Telefone / Celular', 'Plano de Internet Móvel', 'Armazenamento em Nuvem', 'Softwares e SaaS', 'Antivírus / Segurança Digital', 'Correios e Entregas', 'Manutenção de Equipamentos', 'Serviços Domésticos', 'Diarista / Faxina', 'Contador Pessoal', 'Advogado / Serviços Jurídicos', 'Consultorias'] },
  { nome: 'Documentações e Impostos', tipo: 'DESPESA', cor: '#57534e', subcategorias: ['Renovação CNH / Multas', 'Emissão de Passaporte', 'Cartório e Certidões', 'Imposto de Renda (Pagamento)', 'MEI / DAS', 'Simples Nacional', 'Taxas Municipais', 'Taxas Estaduais', 'Taxas Federais', 'Registro de Imóveis', 'Procurações', 'Certificado Digital'] },
  { nome: 'Viagens', tipo: 'DESPESA', cor: '#0284c7', subcategorias: ['Passagens Aéreas / Ônibus', 'Hospedagem / Hotel', 'Alimentação em Viagem', 'Passeios Turísticos / Ingressos', 'Seguro Viagem', 'Aluguel de Carro (Viagem)', 'Bagagem Extra', 'Câmbio / Moeda Estrangeira', 'Visto / Documentação', 'Cruzeiro', 'Transfer / Táxi Viagem', 'Compras em Viagem', 'Roaming Internacional'] },
  { nome: 'Tecnologia e Gadgets', tipo: 'DESPESA', cor: '#334155', subcategorias: ['Celular Novo e Acessórios', 'Assinatura de Softwares (Office, Adobe)', 'Computadores e Periféricos', 'Jogos Digitais / Consoles', 'Hospedagem / Domínios', 'Apps Mobile', 'Manutenção de Celular', 'Manutenção de Computador', 'Peças e Componentes', 'Impressora e Suprimentos', 'Smartwatch e Wearables', 'Casa Inteligente', 'IA / Ferramentas de Produtividade'] },
  { nome: 'Doações e Presentes', tipo: 'DESPESA', cor: '#db2777', subcategorias: ['Carnês / Dízimo', 'Arrecadações', 'Ajuda a Familiares e Amigos', 'ONGs / Patrocínios', 'Presentes de Aniversário', 'Natal e Festas Comemorativas', 'Amigo Oculto', 'Casamentos', 'Chá de Bebê', 'Vaquinhas Online', 'Gorjetas', 'Doações Recorrentes'] },
  { nome: 'Trabalho e Negócios', tipo: 'DESPESA', cor: '#0f766e', subcategorias: ['Coworking', 'Ferramentas de Trabalho', 'Marketing e Anúncios', 'Tráfego Pago', 'Design e Branding', 'Eventos e Networking', 'Viagens a Trabalho', 'Equipamentos Profissionais', 'Uniformes / EPIs', 'Taxas de Plataforma', 'Comissões Pagas', 'Fretes de Venda'] },
  
  // FINANCEIROS
  { nome: 'Despesas Financeiras', tipo: 'DESPESA', cor: '#64748b', subcategorias: ['Parcela de Empréstimo', 'Pagamento de Fatura (Não Categorizado)', 'Taxas e Tarifas Bancárias', 'Seguros Variados', 'Juros e Multas', 'Taxa de Corretagem', 'Contabilidade', 'Juros Cartão de Crédito', 'PIX e TEDs Pagos', 'IOF', 'Anuidade de Cartão', 'Renegociação de Dívida', 'Cheque Especial', 'Consórcio', 'Taxas de Investimento', 'Tarifa de Conta PJ'] },
  { nome: 'Investimentos e Patrimônio', tipo: 'DESPESA', cor: '#0ea5e9', subcategorias: ['Aporte em Investimentos', 'Compra de Ações / FIIs', 'Tesouro Direto', 'CDB / Renda Fixa', 'Criptomoedas', 'Previdência Privada', 'Reserva de Emergência', 'Compra de Imóvel', 'Compra de Veículo', 'Seguro de Vida', 'Consórcio / Carta de Crédito'] },
  { nome: 'Pix', tipo: 'DESPESA', cor: '#00BCBA', subcategorias: ['Gastos com Pix'] },
  { nome: 'Outros', tipo: 'DESPESA', cor: '#94a3b8', subcategorias: ['Outros'] },

  // RECEITAS
  { nome: 'Saldo', tipo: 'RECEITA', cor: '#d4a84b', subcategorias: ['Saldo Atual'] },
  { nome: 'Renda Principal', tipo: 'RECEITA', cor: '#22c55e', subcategorias: ['Salário', 'Férias', '13º Salário', 'PLR / Bônus', 'Aposentadoria / INSS', 'BPC', 'Adiantamento Salarial', 'Horas Extras', 'Comissão CLT', 'Vale / Benefício em Dinheiro'] },
  { nome: 'Rendas PJ / Empresa', tipo: 'RECEITA', cor: '#15803d', subcategorias: ['Pró-labore', 'Distribuição de Lucros', 'Reembolso de Despesas Empresariais', 'Vendas Corporativas', 'Serviços Prestados', 'Consultoria', 'Contrato Mensal', 'Royalties / Licenciamento', 'Comissão de Vendas PJ'] },
  { nome: 'Renda Extra', tipo: 'RECEITA', cor: '#10b981', subcategorias: ['Freelance / Serviços Extras', 'Vendas e Comissionamentos', 'Aluguéis Recebidos', 'Restituição de Imposto', 'Venda de Bens/Ativos Usados', 'Bicos / Diárias', 'Afiliados', 'Aulas Particulares', 'Conteúdo Digital', 'Cashback Recebido', 'Reembolso Pessoal'] },
  { nome: 'Rendimentos e Benefícios', tipo: 'RECEITA', cor: '#059669', subcategorias: ['Rendimento de Investimentos', 'Dividendos (Ações e FIIs)', 'Juros Recebidos', 'Resgate de Benefício (Previdência)', 'Auxílios Governamentais', 'FGTS', 'Seguro-Desemprego', 'Abono Salarial', 'Mesada Recebida', 'Rendimento de Cripto', 'Rendimento de CDB', 'Tesouro Direto', 'Juros sobre Capital Próprio'] },
  { nome: 'Receitas Eventuais', tipo: 'RECEITA', cor: '#84cc16', subcategorias: ['Presente Recebido', 'Sorteio / Prêmio', 'Herança', 'Indenização', 'Seguro Recebido', 'Devolução / Estorno', 'Venda de Garagem', 'Vaquinha Recebida', 'Ajuda Familiar Recebida'] },
  { nome: 'Pix', tipo: 'RECEITA', cor: '#00BCBA', subcategorias: ['Ganhos com Pix'] },
  { nome: 'Outros', tipo: 'RECEITA', cor: '#94a3b8', subcategorias: ['Outros'] },
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

function _subcategoriaChaveUnica(nome) {
  return String(nome || '').trim().toLowerCase()
}

/** Usuários antigos: completar categorias do catálogo padrão que ainda não existem (ex.: novas linhas em `DEFAULT_CATEGORIES`). */
async function _syncMissingDefaultCategories(usuario_id, supabaseAdmin, categoriasAtuais) {
  const lista = categoriasAtuais || []
  const categoriasPorChave = new Map(lista.map((c) => [_categoriaChaveUnica(c.nome, c.tipo), c]))
  for (const cat of DEFAULT_CATEGORIES) {
    const k = _categoriaChaveUnica(cat.nome, cat.tipo)
    if (categoriasPorChave.has(k)) continue
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
    categoriasPorChave.set(k, { id: categoriaData.id, nome: cat.nome, tipo, cor: cat.cor })
    const subsToInsert = cat.subcategorias.map((nome) => ({ categoria_id: categoriaData.id, nome }))
    await _insertSubcategoriasRobusto(supabaseAdmin, subsToInsert, { etapa: 'sync', categoria_id: categoriaData.id })
  }

  const categoriasPadraoExistentes = DEFAULT_CATEGORIES
    .map((cat) => categoriasPorChave.get(_categoriaChaveUnica(cat.nome, cat.tipo)))
    .filter((cat) => cat?.id)

  if (!categoriasPadraoExistentes.length) return

  const { data: subsAtuais, error: subError } = await supabaseAdmin
    .from('subcategorias')
    .select('categoria_id, nome')
    .in('categoria_id', categoriasPadraoExistentes.map((cat) => cat.id))

  if (subError) {
    log.warn('categorias sync: não foi possível conferir subcategorias existentes', { usuario_id, message: subError.message })
    return
  }

  const subsPorCategoria = new Map()
  for (const sub of subsAtuais || []) {
    if (!subsPorCategoria.has(sub.categoria_id)) subsPorCategoria.set(sub.categoria_id, new Set())
    subsPorCategoria.get(sub.categoria_id).add(_subcategoriaChaveUnica(sub.nome))
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const categoriaAtual = categoriasPorChave.get(_categoriaChaveUnica(cat.nome, cat.tipo))
    if (!categoriaAtual?.id) continue
    if (categoriaAtual.arquivada_em) continue // não ressuscitar subs de categoria que o usuário arquivou
    const existentes = subsPorCategoria.get(categoriaAtual.id) || new Set()
    const subsToInsert = cat.subcategorias
      .filter((nome) => !existentes.has(_subcategoriaChaveUnica(nome)))
      .map((nome) => ({ categoria_id: categoriaAtual.id, nome }))
    if (!subsToInsert.length) continue
    await _insertSubcategoriasRobusto(supabaseAdmin, subsToInsert, { etapa: 'sync-subcategorias', categoria_id: categoriaAtual.id })
  }
}

export async function inserirTransacao({
  usuario_id,
  conta_id,
  categoria_id,
  subcategoria_id,
  cartao_id,
  tipo,
  valor,
  descricao,
  data_transacao,
  status,
  recorrencia,
  lancado_por_usuario_id,
  origem_hash,
}) {
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
  if (cartao_id) basePayload.cartao_id = cartao_id
  const lp = lancado_por_usuario_id ? String(lancado_por_usuario_id).trim() : ''
  if (lp) basePayload.lancado_por_usuario_id = lp
  const oh = origem_hash ? String(origem_hash).trim() : ''
  if (oh) basePayload.origem_hash = oh

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

async function fetchNomeUsuarioResumo(supabaseAdmin, usuarioId) {
  const uid = String(usuarioId || '').trim()
  if (!uid) return null
  const { data, error } = await supabaseAdmin.from('usuarios').select('nome').eq('id', uid).maybeSingle()
  if (error || !data) return null
  const n = data.nome != null ? String(data.nome).trim() : ''
  return n || null
}

/** Resolve `lancado_por_nome`; sem ID usa nome do titular da conta (lançamentos legados). */
async function enrichTransacoesLancadorNome(supabaseAdmin, rows, titularFallbackNome = null) {
  if (!rows?.length) return rows
  const ids = [...new Set(rows.map((r) => r.lancado_por_usuario_id).filter(Boolean).map(String))]
  const nomePorId = new Map()
  if (ids.length) {
    const { data: users, error } = await supabaseAdmin.from('usuarios').select('id, nome').in('id', ids)
    if (error) {
      log.warn('[enrichTransacoesLancadorNome]', error.message || error)
    } else {
      for (const u of users || []) {
        const id = u?.id ? String(u.id) : ''
        if (!id) continue
        nomePorId.set(id, u.nome ? String(u.nome).trim() || null : null)
      }
    }
  }
  return rows.map((r) => {
    const lid = r.lancado_por_usuario_id ? String(r.lancado_por_usuario_id) : ''
    const nomeFromId = lid ? nomePorId.get(lid) ?? null : null
    const resolved =
      nomeFromId ?? (!lid && titularFallbackNome ? titularFallbackNome : null)
    return { ...r, lancado_por_nome: resolved }
  })
}

async function enrichTransacoesComCategorias(supabaseAdmin, rows, titularFallbackNome = null) {
  if (!rows?.length) return []
  const catIds = [...new Set(rows.map((r) => r.categoria_id).filter(Boolean))]
  const subIds = [...new Set(rows.map((r) => r.subcategoria_id).filter(Boolean))]
  const catMap = new Map()
  const subMap = new Map()
  if (catIds.length) {
    const { data: cats } = await supabaseAdmin.from('categorias').select('id, nome, cor, icone').in('id', catIds)
    for (const c of cats || []) catMap.set(c.id, { nome: c.nome, cor: c.cor, icone: c.icone ?? null })
  }
  if (subIds.length) {
    const { data: subs } = await supabaseAdmin.from('subcategorias').select('id, nome').in('id', subIds)
    for (const s of subs || []) subMap.set(s.id, { nome: s.nome })
  }
  const mapped = rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    valor: r.valor,
    descricao: r.descricao,
    data_transacao: r.data_transacao,
    data_compra: r.data_compra ?? null,
    status: r.status,
    categoria_id: r.categoria_id,
    subcategoria_id: r.subcategoria_id,
    lancado_por_usuario_id: r.lancado_por_usuario_id ?? null,
    recorrente_grupo_id: r.recorrente_grupo_id ?? null,
    recorrente_index: r.recorrente_index ?? null,
    recorrente_total: r.recorrente_total ?? null,
    recorrencia_mensal_id: r.recorrencia_mensal_id ?? null,
    categorias: r.categoria_id ? catMap.get(r.categoria_id) ?? null : null,
    subcategorias: r.subcategoria_id ? subMap.get(r.subcategoria_id) ?? null : null,
  }))
  return await enrichTransacoesLancadorNome(supabaseAdmin, mapped, titularFallbackNome)
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

  const { dataInicio, dataFim, tipo, categoria_id, status, busca, somenteRecorrentes, somenteParceladas } = filters
  const { off, rangeEnd } = parseTransacoesListPagination(filters)

  // Na visão padrão (sem filtro de data/status), parceladas são buscadas separadamente
  const isDefaultView = !dataInicio && !dataFim && !somenteParceladas && !somenteRecorrentes && !status

  const applyFilters = (q) => {
    let query = q.eq('usuario_id', uid)
    if (dataInicio) query = query.gte('data_transacao', dataInicio)
    if (dataFim) {
      // lte contra 'YYYY-MM-DD' corta às 00h — usar lt no dia seguinte para incluir o dia inteiro
      const d = new Date(dataFim + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 1)
      query = query.lt('data_transacao', d.toISOString().split('T')[0])
    }
    if (tipo) query = query.eq('tipo', tipo)
    if (categoria_id) query = query.eq('categoria_id', categoria_id)
    if (status) query = query.eq('status', status)
    if (busca) query = query.ilike('descricao', `%${escapeIlike(busca)}%`)

    if (somenteParceladas) {
      /* Filtro explícito: parcelas de compras parceladas + recorrências
       * mensais sem prazo (assinatura/stream lançada via "Prazo indeterminado").
       * Ambos os modelos representam compras que se desdobram em vários
       * pagamentos no tempo, então os agrupamos na mesma aba. */
      query = query.or('recorrente_grupo_id.not.is.null,recorrencia_mensal_id.not.is.null')
    } else if (somenteRecorrentes) {
      /* Recorrentes: parcelas + regras mensais */
      query = query.or('recorrencia_mensal_id.not.is.null,recorrente_grupo_id.not.is.null')
    } else if (isDefaultView) {
      /* Padrão sem filtro de data: busca apenas transações não-parceladas.
       * A próxima parcela PENDENTE de cada grupo parcelado é injetada abaixo. */
      query = query.is('recorrente_grupo_id', null)
    }
    return query
  }

  const selectComEmbed = `
      id, tipo, valor, descricao, data_transacao, data_compra, status, categoria_id, subcategoria_id,
      cartao_id,
      recorrente_grupo_id, recorrente_index, recorrente_total, recorrencia_mensal_id,
      lancado_por_usuario_id,
      categorias(nome, cor, icone),
      subcategorias(nome),
      cartoes(nome, dia_vencimento),
      lancado_por:usuarios!lancado_por_usuario_id(nome)
    `

  // Retorna a próxima parcela PENDENTE de cada grupo parcelado do usuário.
  // Usado na visão padrão para exibir automaticamente a parcela atual de cada compra.
  const fetchNextPendingParceladas = async (select) => {
    let q = supabaseAdmin
      .from('transacoes')
      .select(select)
      .eq('usuario_id', uid)
      .not('recorrente_grupo_id', 'is', null)
      .eq('status', 'PENDENTE')
    if (tipo) q = q.eq('tipo', tipo)
    if (categoria_id) q = q.eq('categoria_id', categoria_id)
    if (busca) q = q.ilike('descricao', `%${escapeIlike(busca)}%`)
    const { data: parcelasData } = await q
      .order('recorrente_grupo_id', { ascending: true })
      .order('recorrente_index', { ascending: true })
    const seen = new Set()
    return (parcelasData || []).filter((t) => {
      if (seen.has(t.recorrente_grupo_id)) return false
      seen.add(t.recorrente_grupo_id)
      return true
    })
  }

  const txQuery = applyFilters(supabaseAdmin.from('transacoes').select(selectComEmbed))
    .order('data_transacao', { ascending: false })
    .range(off, rangeEnd)

  // Executa em paralelo: nome do titular + busca de transações
  const [titularNomeLista, { data, error }] = await Promise.all([
    fetchNomeUsuarioResumo(supabaseAdmin, uid),
    txQuery,
  ])

  if (error) {
    log.warn('[getTransacoes] embed falhou, fallback sem join:', error.message || error)
    const baseCols =
      'id, tipo, valor, descricao, data_transacao, data_compra, status, categoria_id, subcategoria_id, cartao_id, recorrente_grupo_id, recorrente_index, recorrente_total, lancado_por_usuario_id'

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
      return await enrichTransacoesComCategorias(supabaseAdmin, rows, titularNomeLista)
    }
    return await enrichTransacoesComCategorias(supabaseAdmin, r2.data || [], titularNomeLista)
  }

  let rows = Array.isArray(data) ? data : []

  if (isDefaultView) {
    const nextPending = await fetchNextPendingParceladas(selectComEmbed)
    rows = [...rows, ...nextPending]
    rows.sort((a, b) => new Date(b.data_transacao) - new Date(a.data_transacao))
  }

  return rows.map((r) => {
    const { lancado_por: lp, ...rest } = r
    const nomeEmbed = lp?.nome ? String(lp.nome).trim() || null : null
    return {
      ...rest,
      lancado_por_nome: nomeEmbed ?? (!r.lancado_por_usuario_id && titularNomeLista ? titularNomeLista : null),
    }
  })
}

/**
 * Sinal leve de versão das transações do usuário — para o front decidir se vale
 * baixar a lista completa no poll periódico ("mudou algo?").
 *
 * Combina contagem total (pega inserts/deletes) com o máximo de `atualizado_em`
 * (pega edições in-place). Duas queries indexadas e minúsculas, sem trazer linhas.
 *
 * @returns {Promise<{ count: number, latest: string|null }>}
 */
export async function getTransacoesVersion(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) return { count: 0, latest: null }

  const [{ count, error: cErr }, { data: top, error: tErr }] = await Promise.all([
    supabaseAdmin
      .from('transacoes')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', uid),
    supabaseAdmin
      .from('transacoes')
      .select('atualizado_em')
      .eq('usuario_id', uid)
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (cErr) throw cErr
  if (tErr) throw tErr

  return { count: count ?? 0, latest: top?.atualizado_em ?? null }
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
    // Marca a edição para o sinal de versão (poll leve "mudou algo?") detectar.
    atualizado_em: new Date().toISOString(),
  }
  // Só altera o cartão se o campo veio no body (evita desvincular sem querer).
  if ('cartao_id' in body) update.cartao_id = body.cartao_id || null

  // Permite alterar o índice da parcela (ex.: 1/10 → 2/10)
  const ri = body.recorrente_index != null ? parseInt(body.recorrente_index, 10) : null
  if (ri != null && Number.isInteger(ri) && ri >= 1) {
    update.recorrente_index = ri
  }

  const { data, error } = await supabaseAdmin
    .from('transacoes')
    .update(update)
    .eq('id', id)
    .eq('usuario_id', uid)
    .select('id, recorrencia_mensal_id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Transação não encontrada.')

  // Transação de assinatura (vinculada a regra mensal): propaga os campos de
  // IDENTIDADE pra regra — renomear "Netflix" na transação renomeia a assinatura,
  // e trocar o cartão muda onde os próximos meses debitam. Valor fica de fora
  // (um mês pode divergir legitimamente: desconto, proporcional). Best-effort.
  if (data.recorrencia_mensal_id) {
    try {
      const ruleUpdate = { updated_at: new Date().toISOString() }
      if (typeof update.descricao === 'string' && update.descricao.trim()) ruleUpdate.descricao = update.descricao.trim()
      if ('categoria_id' in update) ruleUpdate.categoria_id = update.categoria_id
      if ('subcategoria_id' in update) ruleUpdate.subcategoria_id = update.subcategoria_id
      if ('cartao_id' in update) ruleUpdate.cartao_id = update.cartao_id
      if (Object.keys(ruleUpdate).length > 1) {
        await supabaseAdmin
          .from('recorrencias_mensais')
          .update(ruleUpdate)
          .eq('id', data.recorrencia_mensal_id)
          .eq('usuario_id', uid)
      }
    } catch (e) {
      log.warn('[atualizarTransacao] sync regra recorrente falhou', e?.message)
    }
  }
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

export async function deletarGrupoParcelado(grupoId, usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  const { error } = await supabaseAdmin
    .from('transacoes')
    .delete()
    .eq('recorrente_grupo_id', grupoId)
    .eq('usuario_id', uid)

  if (error) throw error
  return true
}

export async function deletarTodasTransacoes(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const uid = String(usuarioId || '').trim()
  if (!uid) throw new Error('usuarioId obrigatório')
  const { error } = await supabaseAdmin
    .from('transacoes')
    .delete()
    .eq('usuario_id', uid)

  if (error) throw error
  return true
}
