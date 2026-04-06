import { getSupabaseAdmin } from './supabase-admin.mjs'

export async function getCategorias(usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  let { data: categorias, error: catError } = await supabaseAdmin
    .from('categorias')
    .select('id, nome, tipo, cor')
    .eq('usuario_id', usuarioId)

  if (catError) throw catError

  if (!categorias || categorias.length === 0) {
    // Self-healing: if user has no categories, seed them automatically
    await _seedCategoriesForUser(usuarioId, supabaseAdmin)
    
    // Fetch again after seed
    const { data: newCats, error: newErr } = await supabaseAdmin
      .from('categorias')
      .select('id, nome, tipo, cor')
      .eq('usuario_id', usuarioId)
      
    if (newErr) throw newErr
    if (!newCats || newCats.length === 0) return []
    
    categorias = newCats
  }

  const categoriaIds = categorias.map(c => c.id)
  const { data: subcategorias, error: subError } = await supabaseAdmin
    .from('subcategorias')
    .select('id, categoria_id, nome')
    .in('categoria_id', categoriaIds)

  if (subError) throw subError

  // agrupar subcategorias por categoria
  return categorias.map(c => {
    return {
      ...c,
      subcategorias: subcategorias.filter(sub => sub.categoria_id === c.id) || []
    }
  })
}
const DEFAULT_CATEGORIES = [
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
    const { data: categoriaData, error: errCat } = await supabaseAdmin
      .from('categorias')
      .insert({ usuario_id, nome: cat.nome, tipo: cat.tipo, cor: cat.cor })
      .select('id').single()

    if (errCat) continue

    const subsToInsert = cat.subcategorias.map(nome => ({ categoria_id: categoriaData.id, nome }))
    await supabaseAdmin.from('subcategorias').insert(subsToInsert)
  }
}

export async function inserirTransacao({ usuario_id, conta_id, categoria_id, subcategoria_id, tipo, valor, descricao, data_transacao, status }) {
  const supabaseAdmin = getSupabaseAdmin()
  const valNum = parseFloat(valor)
  
  if (isNaN(valNum) || valNum <= 0) {
    throw new Error('Valor inválido.')
  }

  const payload = {
    usuario_id,
    tipo,
    valor: valNum,
    descricao,
    data_transacao,
    status: status || 'EFETIVADA'
  }

  if (conta_id) payload.conta_id = conta_id
  if (categoria_id) payload.categoria_id = categoria_id
  if (subcategoria_id) payload.subcategoria_id = subcategoria_id

  const { data, error } = await supabaseAdmin
    .from('transacoes')
    .insert([payload])
    .select()

  if (error) throw error

  return data[0]
}

export async function getTransacoes(usuarioId, filters = {}) {
  const supabaseAdmin = getSupabaseAdmin()
  const { dataInicio, dataFim, tipo, categoria_id, status, busca, limit = 500 } = filters

  let query = supabaseAdmin
    .from('transacoes')
    .select(`
      id, tipo, valor, descricao, data_transacao, status,
      categorias(nome, cor),
      subcategorias(nome)
    `)
    .eq('usuario_id', usuarioId)

  if (dataInicio) query = query.gte('data_transacao', dataInicio)
  if (dataFim) query = query.lte('data_transacao', dataFim)
  if (tipo) query = query.eq('tipo', tipo)
  if (categoria_id) query = query.eq('categoria_id', categoria_id)
  if (status) query = query.eq('status', status)
  if (busca) query = query.ilike('descricao', `%${busca}%`)

  const { data, error } = await query
    .order('data_transacao', { ascending: false })
    .limit(limit)

  if (error) throw error

  return data
}

export async function deletarTransacao(id, usuarioId) {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('transacoes')
    .delete()
    .eq('id', id)
    .eq('usuario_id', usuarioId)

  if (error) throw error
  return true
}
