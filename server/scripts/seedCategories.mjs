import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const DEFAULT_CATEGORIES = [
  // DESPESAS
  {
    nome: 'Alimentação', tipo: 'DESPESA', cor: '#ef4444',
    subcategorias: ['Supermercado', 'Restaurantes e Lanches', 'Padaria e Cafeteira', 'Delivery (iFood, etc)', 'Feira e Sacolão']
  },
  {
    nome: 'Moradia', tipo: 'DESPESA', cor: '#f97316',
    subcategorias: ['Aluguel', 'Conta de Luz', 'Conta de Água', 'Condomínio', 'Internet e TV', 'Gás', 'IPTU', 'Manutenção e Reformas', 'Seguro Residencial']
  },
  {
    nome: 'Transporte', tipo: 'DESPESA', cor: '#eab308',
    subcategorias: ['Combustível', 'App de Transporte (Uber, 99)', 'Transporte Público', 'Estacionamento', 'Pedágio', 'Manutenção Veicular', 'IPVA e Licenciamento', 'Seguro Auto', 'Financiamento do Veículo']
  },
  {
    nome: 'Saúde', tipo: 'DESPESA', cor: '#14b8a6',
    subcategorias: ['Plano de Saúde', 'Medicamentos', 'Consultas Médicas', 'Exames', 'Odontologia', 'Terapia / Psicologia', 'Academia e Esportes']
  },
  {
    nome: 'Educação', tipo: 'DESPESA', cor: '#3b82f6',
    subcategorias: ['Mensalidade', 'Cursos e Certificações', 'Material Escolar / Artigos', 'Livros e Apostilas']
  },
  {
    nome: 'Lazer e Entretenimento', tipo: 'DESPESA', cor: '#8b5cf6',
    subcategorias: ['Assinaturas (Netflix, Spotify, etc)', 'Cinema, Shows e Teatro', 'Bares e Baladas', 'Viagens e Passeios', 'Jogos e Hobbies']
  },
  {
    nome: 'Cuidados Pessoais', tipo: 'DESPESA', cor: '#ec4899',
    subcategorias: ['Salão de Beleza / Barbearia', 'Cosméticos e Perfumaria', 'Vestuário e Calçados', 'Acessórios']
  },
  {
    nome: 'Pets e Dependentes', tipo: 'DESPESA', cor: '#06b6d4',
    subcategorias: ['Ração e Alimentação PET', 'Veterinário e Petshop', 'Mesada', 'Gastos Extras com Filhos/PETs']
  },
  {
    nome: 'Despesas Financeiras', tipo: 'DESPESA', cor: '#64748b',
    subcategorias: ['Parcela de Empréstimo', 'Pagamento de Fatura (Não Categorizado)', 'Taxas e Tarifas Bancárias', 'Impostos', 'Seguros Variados', 'Juros e Multas']
  },

  // RECEITAS
  {
    nome: 'Renda Principal', tipo: 'RECEITA', cor: '#22c55e',
    subcategorias: ['Salário', 'Pró-labore', 'Férias', '13º Salário', 'PLR / Bônus']
  },
  {
    nome: 'Renda Extra', tipo: 'RECEITA', cor: '#10b981',
    subcategorias: ['Freelance / Serviços Extras', 'Vendas e Comissionamentos', 'Aluguéis Recebidos', 'Restituição de Imposto']
  },
  {
    nome: 'Rendimentos', tipo: 'RECEITA', cor: '#059669',
    subcategorias: ['Rendimento de Investimentos', 'Dividendos (Ações e FIIs)', 'Juros Recebidos']
  }
]

async function seedCategoriesForUser(usuario_id) {
  console.log(`Starting seed for user: ${usuario_id}`)
  
  for (const cat of DEFAULT_CATEGORIES) {
    console.log(`- Insert category: ${cat.nome}`)
    const { data: categoriaData, error: errCat } = await supabase
      .from('categorias')
      .insert({
        usuario_id,
        nome: cat.nome,
        tipo: cat.tipo,
        cor: cat.cor
      })
      .select('id')
      .single()

    if (errCat) {
      console.error(`ERROR on insert category ${cat.nome}:`, errCat.message)
      continue
    }

    const categoryId = categoriaData.id
    const subsToInsert = cat.subcategorias.map(subName => ({
      categoria_id: categoryId,
      nome: subName
    }))

    const { error: errSubs } = await supabase
      .from('subcategorias')
      .insert(subsToInsert)

    if (errSubs) {
      console.error(`ERROR on insert subcategories for ${cat.nome}:`, errSubs.message)
    }
  }

  console.log('Seed completed successfully.')
}

async function run() {
  // Pegar todos os usuários existentes e popular (já que não foi feito no signup)
  const { data: users, error } = await supabase.from('usuarios').select('id')
  if (error) {
    console.error('Falha ao obter usuarios:', error)
    return
  }

  // Se nao existir usuarios na tabela, nao tem em quem inserir
  if (!users || users.length === 0) {
    console.log('Nenhum usuario encontrado na tabela public.usuarios')
    return
  }

  // Deleta as categorias anteriores para recriar (isso apagará as transações ligadas que estejam ON DELETE CASCADE/SET NULL)
  // Avisarei o usuario se ele se importa, no caso apenas damos seed
  for (const user of users) {
    console.log(`Deletando antigas para ${user.id}`)
    await supabase.from('categorias').delete().eq('usuario_id', user.id)
    await seedCategoriesForUser(user.id)
  }
  
  process.exit(0)
}

run()
