/** Remove acentos e normaliza para comparação. */
function norm(s) {
  if (s == null) return ''
  const t = String(s).trim()
  if (!t || t === '—') return ''
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Identificador do ícone (ou null = seta receita/despesa padrão).
 * Ordem: pistas na subcategoria + texto combinado, depois nome exato da categoria (normalizado).
 */
export function getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome) {
  const c = norm(categoriaNome)
  const s = norm(subcategoriaNome)
  const hay = `${c} ${s}`

  if (c === 'saldo' || s === 'saldo' || /\bsaldo\b/.test(hay)) return 'saldoPng'

  /* Antes de PNG genérico «Trabalho e Negócios» e heurísticas de carteira. */
  if (/\brenda principal\b/.test(hay) || c === 'renda principal' || s === 'renda principal') {
    return 'rendaPrincipalPng'
  }
  if (/\brenda extra\b/.test(hay) || c === 'renda extra' || s === 'renda extra') {
    return 'rendaExtraPng'
  }
  if (
    /\brendimentos e beneficios\b/.test(hay) ||
    c === 'rendimentos e beneficios' ||
    s === 'rendimentos e beneficios'
  ) {
    return 'rendimentosBeneficiosPng'
  }
  if (
    /\breceitas eventuais\b/.test(hay) ||
    c === 'receitas eventuais' ||
    s === 'receitas eventuais'
  ) {
    return 'receitasEventuaisPng'
  }
  if (
    /\brendas pj\b|\brenda pj\b/.test(hay) ||
    /\brendas pj\s*\/\s*empresa\b/.test(hay) ||
    c === 'rendas pj' ||
    s === 'rendas pj' ||
    c === 'renda pj' ||
    s === 'renda pj' ||
    c === 'empresa' ||
    s === 'empresa'
  ) {
    return 'rendasPjPng'
  }

  const test = (patterns, key) => {
    for (const p of patterns) {
      if (p.test(hay) || p.test(s) || p.test(c)) return key
    }
    return null
  }

  const byCat =
    {
      alimentacao: 'utensils',
      transporte: 'car',
      moradia: 'home',
      saude: 'health',
      educacao: 'education',
      lazer: 'leisure',
      compras: 'shopping',
      pets: 'pet',
      viagem: 'plane',
      servicos: 'subscription',
    }[c] || null

  const resolved =
    test([/combustivel|gasolina|etanol|gnv|posto|abastec/, /\bfuel\b/], 'fuel') ||
    test(
      [/restaurante|lanches|lanche|supermercado|mercado|delivery|ifood|padaria|feira|nutricao/, /\bfood\b/],
      'utensils',
    ) ||
    test(
      [/estacionament|pedagio|uber|99pop|99\b|taxi|onibus|metro|passagem|transporte publico|locacao de veiculo|manutencao veicular/],
      'car',
    ) ||
    test([/agua\b|luz\b|energia|internet|telefone|celular|condominio|iptu|aluguel|moradia|reforma|\bcasa\b/], 'home') ||
    test([/farmacia|medico|hospital|clinica|plano de saude|odonto|dentista|exame|psicologo/], 'health') ||
    test([/escola|faculdade|curso|livro|mensalidade escolar|educacao|estudo|material escolar/], 'education') ||
    test([/cinema|show|streaming|netflix|spotify|jogo|video game|bar\b|balada|lazer|hobby|entretenimento/], 'leisure') ||
    test([/roupa|vestuario|calcado|acessorio|shopping|\bcompra|ecommerce|e-commerce|marketplace/], 'shopping') ||
    test([/tecnologia|gadget|eletronic|smartphone|notebook|computador|software|hardware|assinatura digital/], 'tech') ||
    test([/mensalidade fixa|servico recorrente|streaming fixo/, /^assinatura\b/], 'subscription') ||
    test([/academia|crossfit|musculacao|pilates|corrida|esporte/], 'fitness') ||
    test([/imposto|taxa|boleto|tributo|iptu|ipva|irpf|contabilidade/], 'receipt') ||
    test([/pet\b|racao|veterinario|cachorro|gato\b/], 'pet') ||
    test([/viagem|hotel|passagem aerea|airbnb|turismo/], 'plane') ||
    test([/presente|doacao|caridade/], 'gift') ||
    test([/salario|ordenado|holerite|pagamento pj|rendimento trabalho/], 'wallet') ||
    test([/freela|freelance|consultoria|projeto\b|trabalho extra|honorario/], 'work') ||
    test([/investimento|acao\b|fundo|crypto|cripto|dividendo|cdb|tesouro/], 'investment') ||
    test([/filho|filha|infantil|escola infantil|creche|fralda/], 'child') ||
    test([/tarifa bancaria|saque|transferencia entre contas|pix.*taxa/, /\bbanco\b/], 'bank') ||
    null

  const key = resolved || byCat || null
  /* PNG único para toda a categoria Transporte (inclui combustível). */
  if (c === 'transporte') return 'transportePng'
  if (c === 'compras e varejo') return 'comprasVarejoPng'
  if (c === 'alimentacao') return 'alimentacaoPng'
  if (c === 'cuidados pessoais') return 'cuidadosPessoaisPng'
  if (c === 'despesas financeiras') return 'despesasFinanceirasPng'
  if (c === 'doacoes e presentes') return 'doacoesPresentesPng'
  if (c === 'documentacao e impostos') return 'documentacaoImpostosPng'
  if (c === 'educacao') return 'educacaoPng'
  if (c === 'investimentos e patrimonio') return 'investimentosPatrimonioPng'
  /* Ficheiro «Entreterimento»; aceita também a grafia correta «entretenimento». */
  if (c === 'lazer e entreterimento' || c === 'lazer e entretenimento') return 'lazerEntreterimentoPng'
  if (c === 'moradia') return 'moradiaPng'
  if (c === 'pets e dependentes') return 'petsDependentesPng'
  if (c === 'saude') return 'saudePng'
  if (c === 'servicos e assinaturas') return 'servicosAssinaturasPng'
  if (c === 'tecnologia e gadgets') return 'tecnologiaGadgetsPng'
  if (c === 'trabalho e negocios') return 'trabalhoNegociosPng'
  if (c === 'viagens' || c === 'viagem') return 'viagensPng'
  if (c === 'pix') return 'pixPng'
  return key
}

/** Ícone raster para transações na categoria Transporte (mobilidade). */
const TRANSPORTE_CATEGORIA_ICON_SRC = '/images/icons/Transportes.png'

/** Ícone raster para a categoria «Compras e Varejo» (nome do ficheiro com espaços). */
const COMPRAS_E_VAREJO_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Compras e Varejo.png')

/** Ícone raster para a categoria «Alimentação». */
const ALIMENTACAO_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Alimentação-3D.png')

/** Ícone raster para a categoria «Cuidados Pessoais». */
const CUIDADOS_PESSOAIS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Cuidados Pessoais.png')

/** Ícone raster para a categoria «Despesas Financeiras». */
const DESPESAS_FINANCEIRAS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Despesas Financeiras.png')

/** Ícone raster para a categoria «Doações e Presentes». */
const DOACOES_E_PRESENTES_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Doações e Presentes.png')

/** Ícone raster para a categoria «Documentação e Impostos». */
const DOCUMENTACAO_E_IMPOSTOS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Documentação e Impostos.png')

/** Ícone raster para a categoria «Educação». */
const EDUCACAO_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Educação.png')

/** Ícone raster para a categoria «Investimentos e Patrimônio». */
const INVESTIMENTOS_E_PATRIMONIO_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Investimentos e Patrimônio.png')

/** Ícone raster — nome do ficheiro usa «Entreterimento». */
const LAZER_E_ENTRETERIMENTO_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Lazer e Entreterimento.png')

/** Ícone raster para a categoria «Moradia». */
const MORADIA_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Moradia.png')

/** Ícone raster para a categoria «Pets e Dependentes». */
const PETS_E_DEPENDENTES_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Pets e Dependentes.png')

/** Ícone raster para a categoria «Saúde». */
const SAUDE_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Saúde.png')

/** Ícone raster para a categoria «Serviços e Assinaturas». */
const SERVICOS_E_ASSINATURAS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Serviços e Assinaturas.png')

/** Ícone raster para a categoria «Tecnologia e Gadgets». */
const TECNOLOGIA_E_GADGETS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Tecnologia e Gadgets.png')

/** Ícone raster para a categoria «Trabalho e Negócios». */
const TRABALHO_E_NEGOCIOS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Trabalho e Negócios.png')

/** Ícone raster para a categoria «Viagens» (também «Viagem» no `byCat`). */
const VIAGENS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Viagens.png')

/** Ícone raster — «Saldo» (categoria de ajuste de saldo). */
const SALDO_CATEGORIA_ICON_SRC = '/images/icons/saldo.png'

/** Ícone raster — «Renda principal» (receitas). */
const RENDA_PRINCIPAL_CATEGORIA_ICON_SRC = '/images/icons/RendaPrincipal.png'

/** Ícone raster — «Renda extra» (receitas). */
const RENDA_EXTRA_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Renda Extra.png')

/** Ícone raster — «Rendimentos e Benefícios» (receitas). */
const RENDIMENTOS_E_BENEFICIOS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Rendimentos e Benefícios.png')

/** Ícone raster — «Receitas eventuais» (receitas). */
const RECEITAS_EVENTUAIS_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Receitas Eventuais.png')

/** Ícone raster — «Rendas PJ» / Empresa (receitas). */
const RENDAS_PJ_CATEGORIA_ICON_SRC =
  '/images/icons/' + encodeURIComponent('Rendas PJ.png')

/** Ícone raster — «Pix» (despesas e receitas via Pix). */
const PIX_CATEGORIA_ICON_SRC = '/images/icons/Pix.png'

/** Chaves que renderizam `<img>` em `TransacaoCategoriaIcon`. */
export const RASTER_CATEGORIA_ICON_SRC_BY_KEY = {
  saldoPng: SALDO_CATEGORIA_ICON_SRC,
  transportePng: TRANSPORTE_CATEGORIA_ICON_SRC,
  comprasVarejoPng: COMPRAS_E_VAREJO_CATEGORIA_ICON_SRC,
  alimentacaoPng: ALIMENTACAO_CATEGORIA_ICON_SRC,
  cuidadosPessoaisPng: CUIDADOS_PESSOAIS_CATEGORIA_ICON_SRC,
  despesasFinanceirasPng: DESPESAS_FINANCEIRAS_CATEGORIA_ICON_SRC,
  doacoesPresentesPng: DOACOES_E_PRESENTES_CATEGORIA_ICON_SRC,
  documentacaoImpostosPng: DOCUMENTACAO_E_IMPOSTOS_CATEGORIA_ICON_SRC,
  educacaoPng: EDUCACAO_CATEGORIA_ICON_SRC,
  investimentosPatrimonioPng: INVESTIMENTOS_E_PATRIMONIO_CATEGORIA_ICON_SRC,
  lazerEntreterimentoPng: LAZER_E_ENTRETERIMENTO_CATEGORIA_ICON_SRC,
  moradiaPng: MORADIA_CATEGORIA_ICON_SRC,
  petsDependentesPng: PETS_E_DEPENDENTES_CATEGORIA_ICON_SRC,
  rendaPrincipalPng: RENDA_PRINCIPAL_CATEGORIA_ICON_SRC,
  rendaExtraPng: RENDA_EXTRA_CATEGORIA_ICON_SRC,
  rendimentosBeneficiosPng: RENDIMENTOS_E_BENEFICIOS_CATEGORIA_ICON_SRC,
  receitasEventuaisPng: RECEITAS_EVENTUAIS_CATEGORIA_ICON_SRC,
  rendasPjPng: RENDAS_PJ_CATEGORIA_ICON_SRC,
  saudePng: SAUDE_CATEGORIA_ICON_SRC,
  servicosAssinaturasPng: SERVICOS_E_ASSINATURAS_CATEGORIA_ICON_SRC,
  tecnologiaGadgetsPng: TECNOLOGIA_E_GADGETS_CATEGORIA_ICON_SRC,
  trabalhoNegociosPng: TRABALHO_E_NEGOCIOS_CATEGORIA_ICON_SRC,
  viagensPng: VIAGENS_CATEGORIA_ICON_SRC,
  pixPng: PIX_CATEGORIA_ICON_SRC,
}

/**
 * Classes Line Awesome (Icons8) — https://icons8.com/line-awesome
 * No JSX: importável em testes. Usar com prefixo `las` no componente.
 */
export const LINE_AWESOME_CLASS_BY_ICON_ID = {
  utensils: 'la-utensils',
  fuel: 'la-gas-pump',
  car: 'la-car',
  home: 'la-home',
  health: 'la-stethoscope',
  education: 'la-graduation-cap',
  leisure: 'la-film',
  shopping: 'la-shopping-bag',
  tech: 'la-mobile-alt',
  subscription: 'la-credit-card',
  fitness: 'la-dumbbell',
  receipt: 'la-file-invoice-dollar',
  pet: 'la-paw',
  plane: 'la-plane',
  gift: 'la-gift',
  wallet: 'la-wallet',
  work: 'la-briefcase',
  investment: 'la-chart-line',
  child: 'la-baby',
  bank: 'la-landmark',
  arrowUp: 'la-arrow-up',
  arrowDown: 'la-arrow-down',
}

