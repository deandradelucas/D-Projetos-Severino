import { DEFAULT_CATEGORIES } from '../transacoes.mjs'

/**
 * Normaliza texto para comparação (remove acentos e espaços).
 */
export function normTxt(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Resolve categoria pelo nome exato do seed (`DEFAULT_CATEGORIES`). */
export function findCategoryBySeedNome(cats, categoriaNome) {
  const nref = normTxt(categoriaNome)
  return cats.find((c) => c.nome === categoriaNome || normTxt(c.nome) === nref)
}

/**
 * Escolhe subcategoria na ordem de preferência (rótulos iguais ou contidos no nome do banco).
 * Rótulos devem coincidir com `subcategorias` em `DEFAULT_CATEGORIES`.
 */
export function findSubPreferida(cat, subLabels) {
  if (!cat?.subcategorias?.length || !subLabels?.length) return null
  for (const label of subLabels) {
    const n = normTxt(label)
    const s = cat.subcategorias.find((sub) => {
      const sn = normTxt(sub.nome)
      return sn === n || sn.includes(n) || n.includes(sn)
    })
    if (s) return s
  }
  return null
}

/** Nomes de categorias válidos no seed (evita typo nas regras). */
export const SEED_CAT_NOMES = new Set(DEFAULT_CATEGORIES.map((c) => c.nome))

/**
 * Regras alinhadas a `DEFAULT_CATEGORIES` — ordem: mais específicas primeiro.
 */
export const DESPESA_RULES = [
  // ── Alimentação ───────────────────────────────────────────────────────────
  { re: /atacad|assai|atacadao|makro/i, categoriaNome: 'Alimentação', subLabels: ['Atacadista', 'Supermercado'] },
  { re: /feira|sacolao|sacolão|hortifrut|hortifruti|verdur/i, categoriaNome: 'Alimentação', subLabels: ['Feira e Sacolão', 'Hortifruti', 'Supermercado'] },
  { re: /mercado|supermercado|carrefour|walmart|hiper|pao de acucar|pão de açúcar/i, categoriaNome: 'Alimentação', subLabels: ['Supermercado', 'Atacadista'] },
  { re: /padaria|pao|pão|cafeteria|cafe\b|café/i, categoriaNome: 'Alimentação', subLabels: ['Padaria e Cafeteira'] },
  { re: /açougue|acougue|peixaria|peixe\b/i, categoriaNome: 'Alimentação', subLabels: ['Açougue e Peixaria'] },
  { re: /bebida|cerveja|vinho|refrigerante/i, categoriaNome: 'Alimentação', subLabels: ['Bebidas'] },
  { re: /ifood|rappi|delivery|uber\s*eats|zap\s*food|99\s*food/i, categoriaNome: 'Alimentação', subLabels: ['Delivery (iFood, etc)', 'Restaurantes e Lanches', 'Fast Food'] },
  { re: /restaurante|lanche|almoco|almoço|jantar|mcdonald|burguer|burger|pizza|bk\b/i, categoriaNome: 'Alimentação', subLabels: ['Restaurantes e Lanches', 'Fast Food', 'Delivery (iFood, etc)'] },
  { re: /churrasco\b|churrascaria|espeto\b.*carne/i, categoriaNome: 'Alimentação', subLabels: ['Churrasco', 'Restaurantes e Lanches'] },
  { re: /marmita|quentinha|fit\s*food|comida\s*saudavel|comida\s*saudável/i, categoriaNome: 'Alimentação', subLabels: ['Marmitas', 'Comida Saudável'] },
  { re: /acai|açaí/i, categoriaNome: 'Alimentação', subLabels: ['Comida Saudável', 'Doces e Sobremesas'] },
  { re: /sorvete|sorveteria|confeitaria|geladinho|doce\b|brigadeiro/i, categoriaNome: 'Alimentação', subLabels: ['Doces e Sobremesas', 'Sorveteria'] },
  { re: /mercearia|emporio\b|minimercado|conveniencia\b|conveniência\b/i, categoriaNome: 'Alimentação', subLabels: ['Mercearia', 'Conveniência'] },
  { re: /cesta\s*basica|cesta\s*básica/i, categoriaNome: 'Alimentação', subLabels: ['Cesta Básica', 'Supermercado'] },
  // ── Transporte ────────────────────────────────────────────────────────────
  { re: /combust|gasolina|etanol|posto|diesel|shell|ipiranga|petrobras/i, categoriaNome: 'Transporte', subLabels: ['Combustível'] },
  { re: /\buber\b|\b99\b(?!\s*food)|taxi|táxi|cabify|indriver|bolt\b|99pop/i, categoriaNome: 'Transporte', subLabels: ['App de Transporte (Uber, 99)', 'Táxi'] },
  { re: /onibus|ônibus|metro|metrô|vlt|bilhete unico|integracao/i, categoriaNome: 'Transporte', subLabels: ['Transporte Público'] },
  { re: /estaciona|zona azul/i, categoriaNome: 'Transporte', subLabels: ['Estacionamento'] },
  { re: /pedagio|pedágio/i, categoriaNome: 'Transporte', subLabels: ['Pedágio'] },
  { re: /troca\s*de\s*oleo|oleo\s*motor|troca.*oleo|oleo.*filtro|revisao\b(?!.*apartamento)/i, categoriaNome: 'Transporte', subLabels: ['Óleo e Revisão', 'Manutenção Veicular'] },
  { re: /pneu\b/i, categoriaNome: 'Transporte', subLabels: ['Pneus', 'Manutenção Veicular'] },
  { re: /manutencao.*carro|manutencao.*moto|manutencao.*veiculo|mecanico\b|oficina\b|auto\s*center|borracharia|alinhamento\b|balanceamento\b/i, categoriaNome: 'Transporte', subLabels: ['Manutenção Veicular', 'Óleo e Revisão'] },
  { re: /ipva\b|licenciamento\b|dpvat\b|vistoria\b.*carro|vistoria\b.*veiculo/i, categoriaNome: 'Transporte', subLabels: ['IPVA e Licenciamento'] },
  { re: /seguro.*carro|seguro.*auto|seguro.*moto|seguro.*veiculo/i, categoriaNome: 'Transporte', subLabels: ['Seguro Auto'] },
  { re: /financiamento.*carro|financiamento.*veiculo|financiamento.*moto|parcela.*carro|parcela.*moto|parcela.*veiculo/i, categoriaNome: 'Transporte', subLabels: ['Financiamento do Veículo'] },
  { re: /lavagem\b.*carro|lava\s*rapido|lava\s*rápido|polimento\b|higienizacao.*carro|estetica.*carro/i, categoriaNome: 'Transporte', subLabels: ['Lavagem e Estética Automotiva'] },
  { re: /bicicleta\b|bike\b|patinete\b|ciclismo\b/i, categoriaNome: 'Transporte', subLabels: ['Bicicleta/Manutenção'] },
  { re: /\bmoto\b(?!.*foto)/i, categoriaNome: 'Transporte', subLabels: ['Moto', 'Combustível'] },
  { re: /multa.*transito|multa.*veiculo|infracao.*transito|detran\b/i, categoriaNome: 'Transporte', subLabels: ['Multas de Trânsito', 'IPVA e Licenciamento'] },
  { re: /guincho\b|reboque\b/i, categoriaNome: 'Transporte', subLabels: ['Guincho'] },
  { re: /recarga.*eletrico|carro\s*eletrico|veiculo\s*eletrico/i, categoriaNome: 'Transporte', subLabels: ['Recarga de Veículo Elétrico'] },
  { re: /aluguel.*carro|carsharing\b|locacao.*carro|locacão.*veiculo/i, categoriaNome: 'Transporte', subLabels: ['Aluguel de Veículos e Carsharing'] },
  // ── Saúde ─────────────────────────────────────────────────────────────────
  { re: /farmacia|drogaria|remedio|remédio|medicamento|droga\b/i, categoriaNome: 'Saúde', subLabels: ['Medicamentos'] },
  { re: /plano de saude|plano de saúde|unimed|amil|bradesco saude/i, categoriaNome: 'Saúde', subLabels: ['Plano de Saúde'] },
  { re: /dentista|odontologia|odontoi/i, categoriaNome: 'Saúde', subLabels: ['Odontologia / Dentista'] },
  { re: /consulta|clinico|clínico|medico\b|médico\b|hospital(?!idade)/i, categoriaNome: 'Saúde', subLabels: ['Consultas Médicas', 'Exames'] },
  { re: /academia|smartfit|musculacao|musculação/i, categoriaNome: 'Saúde', subLabels: ['Academia e Esportes'] },
  { re: /terapia\b|psicologo|psicóloga|psicoterapia|sessao.*psico|psicanalise/i, categoriaNome: 'Saúde', subLabels: ['Terapia / Psicologia'] },
  { re: /suplemento|whey\b|creatina\b|proteina\b|omega\b|vitamina\b|colageno\b|colágeno\b/i, categoriaNome: 'Saúde', subLabels: ['Suplementos e Vitaminas'] },
  { re: /oculo|óculos|lente\s*de\s*contato/i, categoriaNome: 'Saúde', subLabels: ['Óculos e Lentes'] },
  { re: /fisioterapia\b|fisioterapeuta\b|\bfisio\b/i, categoriaNome: 'Saúde', subLabels: ['Fisioterapia'] },
  { re: /nutricionista\b/i, categoriaNome: 'Saúde', subLabels: ['Nutricionista'] },
  { re: /pilates\b|yoga\b|meditacao\b|meditação\b/i, categoriaNome: 'Saúde', subLabels: ['Pilates/Yoga', 'Academia e Esportes'] },
  { re: /pronto.?socorro|upa\b|pronto.?atendimento/i, categoriaNome: 'Saúde', subLabels: ['Hospital e Pronto Atendimento'] },
  { re: /vacina\b|imunizacao\b|imunização\b/i, categoriaNome: 'Saúde', subLabels: ['Vacinas'] },
  { re: /cirurgia\b|procedimento.*medico|lipoaspiracao|lipoaspiração|implante\b/i, categoriaNome: 'Saúde', subLabels: ['Cirurgias e Procedimentos'] },
  { re: /dermato\b|dermatologista\b/i, categoriaNome: 'Saúde', subLabels: ['Dermatologia'] },
  { re: /psiquiatra\b|psiquiatria\b/i, categoriaNome: 'Saúde', subLabels: ['Psiquiatria'] },
  { re: /check.?up\b|exame\s*de\s*rotina/i, categoriaNome: 'Saúde', subLabels: ['Check-up', 'Exames'] },
  // ── Educação ──────────────────────────────────────────────────────────────
  { re: /mensalidade.*escola|faculdade|universidade|col[eé]gio|matricula\b|matrícula/i, categoriaNome: 'Educação', subLabels: ['Mensalidade (Escola/Faculdade)'] },
  { re: /curso\b|certificacao|certificação|udemy|alura/i, categoriaNome: 'Educação', subLabels: ['Cursos e Certificações'] },
  { re: /material\s*escolar|caderno\b|lapis\b|caneta\b(?!.*pix)|mochila.*escola|borracha\b.*escola/i, categoriaNome: 'Educação', subLabels: ['Material Escolar / Artigos'] },
  { re: /papelaria\b/i, categoriaNome: 'Educação', subLabels: ['Papelaria', 'Material Escolar / Artigos'] },
  { re: /idioma\b|ingles\b|inglês\b|espanhol\b|frances\b|mandarim\b|japones\b|alemao\b|fluency\b/i, categoriaNome: 'Educação', subLabels: ['Idiomas'] },
  { re: /uniforme\b|fardamento\b/i, categoriaNome: 'Educação', subLabels: ['Fardamento / Uniformes'] },
  { re: /mentoria\b|coaching\b/i, categoriaNome: 'Educação', subLabels: ['Mentorias e Consultorias'] },
  { re: /transporte\s*escolar|van\s*escolar/i, categoriaNome: 'Educação', subLabels: ['Transporte Escolar'] },
  { re: /pos.?graduacao|pos.?grad\b|mba\b|especializacao\b/i, categoriaNome: 'Educação', subLabels: ['Pós-graduação / MBA'] },
  { re: /workshop\b|webinar\b|congresso\b|simposio\b/i, categoriaNome: 'Educação', subLabels: ['Workshops e Eventos', 'Cursos e Certificações'] },
  { re: /intercambio\b|intercâmbio\b|exchange\b/i, categoriaNome: 'Educação', subLabels: ['Intercâmbio'] },
  { re: /aula\s*particular|professor\s*particular|reforco\b|reforço\b/i, categoriaNome: 'Educação', subLabels: ['Aulas Particulares'] },
  // ── Lazer e Entretenimento ────────────────────────────────────────────────
  { re: /netflix|spotify|prime video|disney\+|hbo|globoplay|assinatura/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Assinaturas (Netflix, Spotify, etc)', 'Streaming de Vídeo', 'Streaming de Música'] },
  { re: /cinema|show\b|teatro|ingresso.*show/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Cinema, Shows e Teatro'] },
  { re: /bar\b|balada|cervejaria/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Bares e Baladas'] },
  { re: /poker|apostas?|bingo|cassino|loteria\b|\bbet\b|betano|pixbet|blaze\b|roleta|sportingbet|esport.*aposta|aposta.*esport/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Jogos e Hobbies'] },
  { re: /hobby|passeio\b|parque\b|praia\b|museu\b|exposicao|exposição|festival\b|trilha\b|surf\b|skate\b|paintball|kart\b|boliche|sinuca/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Praias e Parques', 'Museus e Exposições', 'Jogos e Hobbies', 'Clubes e Associações'] },
  { re: /livro\b(?!.*didati|.*apostila|.*escolar|.*faculdade|.*curso)/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Livros Não-Didáticos'] },
  { re: /revista\b|jornal\b/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Revistas e Jornais'] },
  { re: /ingresso.*esport|partida\b.*time|estadio\b|estádio\b|arena\b(?!.*game)/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Eventos Esportivos'] },
  { re: /festa\b|buffet\b|salgado\b.*festa|decoracao.*festa|festa.*aniversario/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Festas'] },
  { re: /guitarra\b|violao\b|violão\b|teclado\b(?!.*computador|.*not[eo]book)|bateria\b(?!.*carro|.*veiculo)|piano\b|flauta\b|instrumento\s*musical/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Instrumentos Musicais'] },
  { re: /deezer\b|tidal\b|apple\s*music|streaming.*musica/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Streaming de Música', 'Assinaturas (Netflix, Spotify, etc)'] },
  // ── Cuidados Pessoais ─────────────────────────────────────────────────────
  { re: /salao|salão|barbearia|cabelo|manicure/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Salão de Beleza / Barbearia'] },
  { re: /roupa|camisa|calca|calça|tenis|tênis|vestuario/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Vestuário (Roupas do Dia a Dia)', 'Sapatos e Tênis'] },
  { re: /maquiagem|batom\b|blush\b|rimmel|rimel|primer\b.*rosto|base\b.*maquiagem|sombra\b.*olho/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Maquiagem', 'Cosméticos e Perfumaria'] },
  { re: /perfume\b|colonia\b|eau\s*de/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Perfumes', 'Cosméticos e Perfumaria'] },
  { re: /skincare|creme\b.*rosto|hidratante\b|protetor\s*solar|serum\b|toner\b|esfoliante\b/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Skincare'] },
  { re: /depilacao\b|depilação\b|epilacao\b|cera\b.*depil/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Depilação'] },
  { re: /massagem\b|\bspa\b|ofuro\b/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Massagem'] },
  { re: /tatuagem\b|tattoo\b|piercing\b/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Tatuagem e Piercing'] },
  { re: /lavanderia\b|tinturaria\b|lavagem\s*de\s*roupa/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Lavanderia'] },
  { re: /costura\b|alfaiate\b|ajuste\s*de\s*roupa/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Costura e Ajustes'] },
  { re: /roupa\s*social|terno\b|blazer\b|terninho\b/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Roupas Sociais'] },
  { re: /semijoias|semijóias|joia\b|jóia\b|brinco\b|pulseira\b|relogio\b(?!.*reuniao)|relógio\b/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Semijóias e Relógios'] },
  { re: /botox\b|preenchimento\b|harmonizacao\b|estetica\b(?!.*carro)|tratamento\s*estetico|lifting\b/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Tratamentos Estéticos'] },
  // ── Compras e Varejo ──────────────────────────────────────────────────────
  { re: /amazon|mercado\s*livre|shopee|shein|aliexpress|magalu|americanas|shopping|loja de departamento/i, categoriaNome: 'Compras e Varejo', subLabels: ['Marketplace (Amazon, Mercado Livre)', 'Compras Online', 'Shopping', 'Loja de Departamento'] },
  { re: /televisao\b|televisão\b|\btv\b(?!.*assinatura|.*streaming|.*net\b|.*sky\b|.*claro\b)|camera\b(?!.*seguranca)/i, categoriaNome: 'Compras e Varejo', subLabels: ['Eletrônicos de Consumo'] },
  // ── Doações e Presentes ───────────────────────────────────────────────────
  { re: /presente(?!.*receb)|lembrancinha|casamento|aniversario|aniversário|natal|amigo oculto/i, categoriaNome: 'Doações e Presentes', subLabels: ['Presentes de Aniversário', 'Natal e Festas Comemorativas', 'Casamentos', 'Presentes Diversos'] },
  { re: /dizimo\b|dízimo\b|oferta.*igreja|contribuicao.*igreja|missao.*doac/i, categoriaNome: 'Doações e Presentes', subLabels: ['Carnês / Dízimo'] },
  { re: /doacao\b|doação\b|ong\b|orfanato\b|instituto.*doa|ajuda\s*humanitaria/i, categoriaNome: 'Doações e Presentes', subLabels: ['ONGs / Patrocínios', 'Arrecadações'] },
  { re: /ajuda.*familiar|ajuda.*familia\b|mandei.*mae\b|mandei.*pai\b|transfer.*mae|transfer.*pai/i, categoriaNome: 'Doações e Presentes', subLabels: ['Ajuda a Familiares e Amigos'] },
  { re: /cha\s*de\s*bebe|cha\s*de\s*fralda/i, categoriaNome: 'Doações e Presentes', subLabels: ['Chá de Bebê'] },
  { re: /gorjeta\b/i, categoriaNome: 'Doações e Presentes', subLabels: ['Gorjetas'] },
  { re: /arrecadacao\b|arrecadação\b|rifa\b|rifas\b/i, categoriaNome: 'Doações e Presentes', subLabels: ['Arrecadações'] },
  // ── Pets e Dependentes ────────────────────────────────────────────────────
  { re: /racao|pet\b|dog|gato|veterinar|banho e tosa/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Ração e Alimentação PET', 'Veterinário e Petshop', 'Banho e Tosa'] },
  { re: /fralda|baba\b|babá|creche|bercario|berçário|filho|filha|lanche escolar/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Fraldas e Higiene', 'Babá / Cuidador', 'Creche / Escola Infantil', 'Lanche Escolar'] },
  { re: /brinquedo.*pet|petisco\b|remedio.*pet|remedios.*gato|remedios.*dog/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Brinquedos PET', 'Remédios PET'] },
  { re: /adestramento\b|hotel.*pet|hotelzinho\b/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Adestramento', 'Hotelzinho PET'] },
  { re: /atividade.*filho|natacao.*filho|bale\b|ballet\b|natacao\b|esporte.*filho/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Atividades Extracurriculares (Natação, Balé)'] },
  // ── Viagens ───────────────────────────────────────────────────────────────
  { re: /passagem|hotel|hospedagem|airbnb|booking/i, categoriaNome: 'Viagens', subLabels: ['Passagens Aéreas / Ônibus', 'Hospedagem / Hotel'] },
  { re: /visto|bagagem|cambio|câmbio|roaming|seguro viagem/i, categoriaNome: 'Viagens', subLabels: ['Visto / Documentação', 'Bagagem Extra', 'Câmbio / Moeda Estrangeira', 'Roaming Internacional', 'Seguro Viagem'] },
  { re: /cruzeiro\b/i, categoriaNome: 'Viagens', subLabels: ['Cruzeiro'] },
  { re: /passeio\s*turistic|ingresso\s*turistic|tour\b|excursao\b/i, categoriaNome: 'Viagens', subLabels: ['Passeios Turísticos / Ingressos'] },
  { re: /aluguel\s*carro.*viagem|locadora\b.*viagem/i, categoriaNome: 'Viagens', subLabels: ['Aluguel de Carro (Viagem)'] },
  // ── Tecnologia e Gadgets ──────────────────────────────────────────────────
  {
    re: /jogo[s]?\s*eletr[ôo]nic|jogos?\s*eletronic|videogame|video[-\s]?game|steam\b|epic\s*games|playstation|ps[45]\b|xbox|nintendo|switch\b|\bdlc\b|jogos?\s*digitais?|jogos?\s*digital|console(s)?\s*(de)?\s*jogo|riot\s*games|battle\.net|gog\.com|humble\s*bundle|microtransa[cç][aã]o|loot\s*box/i,
    categoriaNome: 'Tecnologia e Gadgets',
    subLabels: ['Jogos Digitais / Consoles'],
  },
  { re: /chatgpt|claude|cursor|midjourney|canva|notion|office|adobe|software|saas|dominio|domínio|hospedagem/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['IA / Ferramentas de Produtividade', 'Assinatura de Softwares (Office, Adobe)', 'Hospedagem / Domínios'] },
  { re: /notebook|celular novo|iphone|galaxy|computador|monitor\b|tecnologia|smartwatch|wearable|periferico|periférico/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['Computadores e Periféricos', 'Celular Novo e Acessórios', 'Smartwatch e Wearables'] },
  { re: /manutencao\s*celular|conserto\s*celular|tela\s*celular|troca\s*tela/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['Manutenção de Celular'] },
  { re: /manutencao\s*computador|conserto\s*computador|formatacao\b|formatação\b/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['Manutenção de Computador'] },
  { re: /impressora\b|cartucho\b|toner\b(?!.*skincare)|papel.*impressora/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['Impressora e Suprimentos'] },
  { re: /alexa\b|google\s*home|casa\s*inteligente|smart\s*home|lampada\s*inteligente/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['Casa Inteligente'] },
  // ── Serviços e Assinaturas ────────────────────────────────────────────────
  { re: /telefone|plano.*celular|nuvem|icloud|google drive|dropbox|antivirus|antivírus|correios|entrega|diarista|faxina|advogado/i, categoriaNome: 'Serviços e Assinaturas', subLabels: ['Telefone / Celular', 'Armazenamento em Nuvem', 'Antivírus / Segurança Digital', 'Correios e Entregas', 'Diarista / Faxina', 'Advogado / Serviços Jurídicos'] },
  { re: /contador\b|contabilidade\b|contabil\b/i, categoriaNome: 'Serviços e Assinaturas', subLabels: ['Contador Pessoal'] },
  { re: /manutencao\s*equipamento|conserto\b(?!.*celular|.*computador)|reparo\b/i, categoriaNome: 'Serviços e Assinaturas', subLabels: ['Manutenção de Equipamentos'] },
  // ── Trabalho e Negócios ───────────────────────────────────────────────────
  { re: /coworking|trafego pago|tráfego pago|anuncio|anúncio|marketing|branding|frete.*venda|taxa.*plataforma|equipamento profissional/i, categoriaNome: 'Trabalho e Negócios', subLabels: ['Coworking', 'Tráfego Pago', 'Marketing e Anúncios', 'Design e Branding', 'Fretes de Venda', 'Taxas de Plataforma', 'Equipamentos Profissionais'] },
  { re: /ferramenta.*trabalho|material.*escritorio|papel.*escritorio|toner.*escritorio/i, categoriaNome: 'Trabalho e Negócios', subLabels: ['Ferramentas de Trabalho'] },
  { re: /evento.*networking|networking\b|feira.*profissional|congresso.*profissional/i, categoriaNome: 'Trabalho e Negócios', subLabels: ['Eventos e Networking'] },
  { re: /viagem\b.*trabalho|passagem.*trabalho|hotel.*trabalho/i, categoriaNome: 'Trabalho e Negócios', subLabels: ['Viagens a Trabalho'] },
  { re: /\bepi\b|equipamento\s*de\s*protecao|capacete.*trabalho|uniforme.*trabalho/i, categoriaNome: 'Trabalho e Negócios', subLabels: ['Uniformes / EPIs'] },
  // ── Moradia ───────────────────────────────────────────────────────────────
  { re: /aluguel(?!.*receb)/i, categoriaNome: 'Moradia', subLabels: ['Aluguel'] },
  { re: /condominio|condomínio/i, categoriaNome: 'Moradia', subLabels: ['Condomínio'] },
  { re: /energia solar|placa[s]?\s*solar|painel\s*solar|instalac[aã]o\s*solar|sistema\s*solar|fotovoltai/i, categoriaNome: 'Moradia', subLabels: ['Energia Solar'] },
  { re: /luz\b|energia eletrica|energia elétrica|celesc|copel|enel/i, categoriaNome: 'Moradia', subLabels: ['Conta de Luz'] },
  { re: /agua\b|água\b|sanepar|cedae/i, categoriaNome: 'Moradia', subLabels: ['Conta de Água'] },
  { re: /internet\b|fibra|wifi|vivo fibra|net\b claro|oi fibra/i, categoriaNome: 'Moradia', subLabels: ['Internet e TV'] },
  { re: /\bgas\b|glp|botijao|botijão/i, categoriaNome: 'Moradia', subLabels: ['Gás'] },
  { re: /iptu\b/i, categoriaNome: 'Moradia', subLabels: ['IPTU'] },
  { re: /reforma\b|pintura\b.*casa|pedreiro\b|eletricista\b|encanamento\b|obra\b(?!.*trabalho)|reboco\b|azulejo\b|\bpiso\b/i, categoriaNome: 'Moradia', subLabels: ['Manutenção e Reformas'] },
  { re: /seguro.*residencial|seguro.*casa|seguro.*apartamento|seguro.*imovel/i, categoriaNome: 'Moradia', subLabels: ['Seguro Residencial'] },
  { re: /material\s*de\s*limpeza|produto\s*limpeza|detergente\b|sabao.*po|desinfetante\b|\brodo\b|vassoura\b|esponja\b/i, categoriaNome: 'Moradia', subLabels: ['Material de Limpeza'] },
  { re: /decoracao\b(?!.*festa)|decor\b|quadro\b(?!.*arte)|tapete\b|cortina\b|luminaria\b|lustre\b/i, categoriaNome: 'Moradia', subLabels: ['Decoração de Interiores'] },
  { re: /jardinagem\b|paisagismo\b|\bplanta\b(?!.*pet|\bfoto|\bpé)|\badubo\b|semente\b/i, categoriaNome: 'Moradia', subLabels: ['Jardinagem/Paisagismo'] },
  { re: /geladeira\b|fogao\b|fogão\b|microondas\b|maquina\s*de\s*lavar|lava\s*roupa|ar\s*condicionado|ventilador\b|freezer\b|lavadora\b/i, categoriaNome: 'Moradia', subLabels: ['Eletrodomésticos'] },
  { re: /\bsofa\b|sofá\b|\bcama\b|guarda.?roupa\b|prateleira\b|estante\b|armario\b/i, categoriaNome: 'Moradia', subLabels: ['Móveis'] },
  { re: /prestacao.*imovel|prestacao.*apartamento|parcela.*casa\b|parcela.*apartamento/i, categoriaNome: 'Moradia', subLabels: ['Prestação do Imóvel', 'Financiamento Imobiliário'] },
  { re: /financiamento.*imovel|financiamento.*apartamento|financiamento.*casa\b|hipoteca\b/i, categoriaNome: 'Moradia', subLabels: ['Financiamento Imobiliário'] },
  { re: /dedetizacao\b|dedetizar\b|controle\s*de\s*praga|fumigacao\b/i, categoriaNome: 'Moradia', subLabels: ['Dedetização'] },
  { re: /mudanca\b.*frete|frete.*mudanca|caminhao.*mudanca|mudei\s*de\s*casa/i, categoriaNome: 'Moradia', subLabels: ['Mudança e Frete'] },
  { re: /portaria\b|seguranca.*predio|vigilancia\b/i, categoriaNome: 'Moradia', subLabels: ['Portaria e Segurança'] },
  { re: /utensilios\b|panela\b|talher\b|\bprato\b(?!.*pix)|\bcolher\b|\bgarfo\b|\bcopo\b(?!.*unico)/i, categoriaNome: 'Moradia', subLabels: ['Utensílios Domésticos'] },
  // ── Documentações e Impostos ──────────────────────────────────────────────
  { re: /passaporte|cartorio|cartório|certidao|certidão|cnh|das\b|mei\b|simples nacional|imposto de renda.*pag/i, categoriaNome: 'Documentações e Impostos', subLabels: ['Emissão de Passaporte', 'Cartório e Certidões', 'Renovação CNH / Multas', 'MEI / DAS', 'Simples Nacional', 'Imposto de Renda (Pagamento)'] },
  { re: /certificado\s*digital|e.?cnpj\b|e.?cpf\b/i, categoriaNome: 'Documentações e Impostos', subLabels: ['Certificado Digital'] },
  { re: /registro\s*de\s*imovel|registro.*escritura/i, categoriaNome: 'Documentações e Impostos', subLabels: ['Registro de Imóveis'] },
  { re: /taxa\s*municipal|taxa\s*estadual|taxa\s*federal|taxa\s*prefeitura/i, categoriaNome: 'Documentações e Impostos', subLabels: ['Taxas Municipais', 'Taxas Estaduais', 'Taxas Federais'] },
  // ── Investimentos e Patrimônio ────────────────────────────────────────────
  { re: /aporte|investi|tesouro|cdb|acao|ação|fii|fiis|cripto|bitcoin|previdencia privada|previdência privada/i, categoriaNome: 'Investimentos e Patrimônio', subLabels: ['Aporte em Investimentos', 'Tesouro Direto', 'CDB / Renda Fixa', 'Compra de Ações / FIIs', 'Criptomoedas', 'Previdência Privada'] },
  { re: /reserva\s*emergencia|reserva\s*de\s*emergencia|caixinha\b(?!.*presente)/i, categoriaNome: 'Investimentos e Patrimônio', subLabels: ['Reserva de Emergência', 'Aporte em Investimentos'] },
  { re: /compra.*imovel|entrada.*imovel|terreno\b(?!.*aluguel)/i, categoriaNome: 'Investimentos e Patrimônio', subLabels: ['Compra de Imóvel'] },
  { re: /seguro\s*de\s*vida\b/i, categoriaNome: 'Investimentos e Patrimônio', subLabels: ['Seguro de Vida'] },
  { re: /consorcio\b(?!.*banco)/i, categoriaNome: 'Investimentos e Patrimônio', subLabels: ['Consórcio / Carta de Crédito'] },
  // ── Despesas Financeiras ──────────────────────────────────────────────────
  { re: /fatura|cartao|cartão|anuidade|ted|pix.*tarifa|tarifa banc/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Pagamento de Fatura (Não Categorizado)', 'Taxas e Tarifas Bancárias', 'Juros Cartão de Crédito'] },
  { re: /emprestimo|empréstimo|financiamento(?!.*veic|.*imovel|.*casa|.*apart|.*carro|.*moto)/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Parcela de Empréstimo'] },
  { re: /juros\b(?!.*receb)|multa.*banco|multa.*cartao|multa.*boleto|\bmora\b/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Juros e Multas', 'Juros Cartão de Crédito'] },
  { re: /\biof\b/i, categoriaNome: 'Despesas Financeiras', subLabels: ['IOF'] },
  { re: /taxa\s*de\s*corretagem|corretagem\b/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Taxa de Corretagem'] },
  { re: /renegociacao\b|renegociação\b|acordo.*divida|divida\b.*acordo/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Renegociação de Dívida'] },
  { re: /cheque\s*especial|limite.*negativo|negativo.*banco/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Cheque Especial'] },
]

export const RECEITA_RULES = [
  // ── Renda Principal ───────────────────────────────────────────────────────
  { re: /salario|salário|folha|clt|holerite/i, categoriaNome: 'Renda Principal', subLabels: ['Salário'] },
  { re: /ferias|férias/i, categoriaNome: 'Renda Principal', subLabels: ['Férias'] },
  { re: /13o|13º|decimo terceiro|décimo terceiro/i, categoriaNome: 'Renda Principal', subLabels: ['13º Salário'] },
  { re: /plr|bonus|bônus|gratificacao|gratificação/i, categoriaNome: 'Renda Principal', subLabels: ['PLR / Bônus'] },
  { re: /inss|aposentadoria|aposent\b|bpc\b/i, categoriaNome: 'Renda Principal', subLabels: ['Aposentadoria / INSS', 'BPC'] },
  { re: /adiantamento\b.*salari|adiantamento\b.*salarial|\badiant\b/i, categoriaNome: 'Renda Principal', subLabels: ['Adiantamento Salarial'] },
  { re: /hora\s*extra|horas\s*extras/i, categoriaNome: 'Renda Principal', subLabels: ['Horas Extras'] },
  { re: /vale\b.*dinheiro|beneficio\b.*dinheiro|auxilio\b.*vale|vale\s*alimentacao\b.*dinheiro/i, categoriaNome: 'Renda Principal', subLabels: ['Vale / Benefício em Dinheiro'] },
  // ── Rendas PJ / Empresa ───────────────────────────────────────────────────
  { re: /pro.?labore|prolabore|pró-labore/i, categoriaNome: 'Rendas PJ / Empresa', subLabels: ['Pró-labore', 'Distribuição de Lucros'] },
  { re: /reembolso.*empresa|reembolso.*pj|reembolso.*despesa\b(?!.*pessoal)/i, categoriaNome: 'Rendas PJ / Empresa', subLabels: ['Reembolso de Despesas Empresariais'] },
  { re: /royalt|licencia\b.*recebi|royalties\b/i, categoriaNome: 'Rendas PJ / Empresa', subLabels: ['Royalties / Licenciamento'] },
  // ── Renda Extra ───────────────────────────────────────────────────────────
  { re: /freelance|freela|pj\b|honorario|honorário|servico extra|serviço extra/i, categoriaNome: 'Renda Extra', subLabels: ['Freelance / Serviços Extras'] },
  { re: /venda\b|comiss[aã]o|comission/i, categoriaNome: 'Renda Extra', subLabels: ['Vendas e Comissionamentos', 'Venda de Bens/Ativos Usados'] },
  { re: /aluguel.*receb|rendimento.*aluguel/i, categoriaNome: 'Renda Extra', subLabels: ['Aluguéis Recebidos'] },
  { re: /restituicao|restituição|imposto.*restit/i, categoriaNome: 'Renda Extra', subLabels: ['Restituição de Imposto'] },
  { re: /\bbico\b|diaria\b.*recebi|diarista\b.*recebi/i, categoriaNome: 'Renda Extra', subLabels: ['Bicos / Diárias'] },
  { re: /afiliado\b|hotmart\b|kiwify\b|monetizze\b|comissao.*afiliado/i, categoriaNome: 'Renda Extra', subLabels: ['Afiliados'] },
  { re: /cashback\b(?!.*paguei|.*gast|.*us)/i, categoriaNome: 'Renda Extra', subLabels: ['Cashback Recebido'] },
  { re: /reembolso\b(?!.*empresa|.*pj).*recebi|me\s*reembolsaram/i, categoriaNome: 'Renda Extra', subLabels: ['Reembolso Pessoal'] },
  { re: /adsense\b|youtube.*monetiz|tiktok.*recebi|instagram.*recebi|conteudo.*recebi/i, categoriaNome: 'Renda Extra', subLabels: ['Conteúdo Digital', 'Afiliados'] },
  { re: /venda\s*de\s*garagem|brechó\b|brecho\b|bazar\b|vendi\b.*usado|segunda\s*mao.*vendi/i, categoriaNome: 'Receitas Eventuais', subLabels: ['Venda de Garagem', 'Venda de Bens/Ativos Usados'] },
  // ── Rendimentos e Benefícios ──────────────────────────────────────────────
  { re: /dividend|fii|fiis|acao|ação|cdb|tesouro|juros.*receb|rendimento.*invest/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['Dividendos (Ações e FIIs)', 'Rendimento de Investimentos', 'Juros Recebidos'] },
  { re: /fgts|seguro.desemprego|abono|auxilio|auxílio|mesada recebida/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['FGTS', 'Seguro-Desemprego', 'Abono Salarial', 'Auxílios Governamentais', 'Mesada Recebida'] },
  { re: /resgate.*previdencia|previdencia.*resgate|resgate.*fundo\b/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['Resgate de Benefício (Previdência)'] },
  { re: /cripto.*rendimento|bitcoin.*rendimento|eth\b.*rendimento|rendimento.*cripto/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['Rendimento de Cripto'] },
  // ── Receitas Eventuais ────────────────────────────────────────────────────
  { re: /presente.*receb|premio|prêmio|sorteio|heranca|herança|indenizacao|indenização|seguro.*receb|estorno|devolucao|devolução|vaquinha.*receb|ajuda.*familiar/i, categoriaNome: 'Receitas Eventuais', subLabels: ['Presente Recebido', 'Sorteio / Prêmio', 'Herança', 'Indenização', 'Seguro Recebido', 'Devolução / Estorno', 'Vaquinha Recebida', 'Ajuda Familiar Recebida'] },
]

export function rulesForTipo(tipo) {
  return tipo === 'RECEITA' ? RECEITA_RULES : DESPESA_RULES
}

/**
 * Se a IA deixou categoria/subcategoria vazias, tenta casar palavras da mensagem com nomes reais do usuário.
 */
export function enriquecerCategoriaPorTexto(message, extractedData, categoriasUsuario) {
  if (!extractedData || !categoriasUsuario?.length) return extractedData

  const tipo = extractedData.tipo
  if (tipo !== 'DESPESA' && tipo !== 'RECEITA') return extractedData

  const low = normTxt(message)
  const catsTipo = categoriasUsuario.filter((c) => c.tipo === tipo)

  if (extractedData.categoria_id && !extractedData.subcategoria_id) {
    const cat = categoriasUsuario.find((c) => c.id === extractedData.categoria_id && c.tipo === tipo)
    if (cat?.subcategorias?.length) {
      for (const rule of rulesForTipo(tipo)) {
        if (!rule.categoriaNome || !rule.subLabels?.length) continue
        if (!SEED_CAT_NOMES.has(rule.categoriaNome)) continue
        if (!rule.re.test(low)) continue
        if (findCategoryBySeedNome(catsTipo, rule.categoriaNome)?.id !== cat.id) continue
        const sub = findSubPreferida(cat, rule.subLabels)
        if (sub) {
          extractedData.subcategoria_id = sub.id
          return extractedData
        }
      }
    }
  }

  for (const rule of rulesForTipo(tipo)) {
    if (!rule.categoriaNome || !rule.subLabels?.length) continue
    if (!SEED_CAT_NOMES.has(rule.categoriaNome)) continue
    if (!rule.re.test(low)) continue
    const cat = findCategoryBySeedNome(catsTipo, rule.categoriaNome)
    if (!cat) continue
    const sub = findSubPreferida(cat, rule.subLabels)
    if (sub) {
      extractedData.categoria_id = cat.id
      extractedData.subcategoria_id = sub.id
      return extractedData
    }
  }

  return extractedData
}

export function inferTipoBasicoFromTexto(message) {
  const m = normTxt(message)
  if (/(recebi|ganhei|entrou|caiu na conta|salario|salário|deposito|dep[oó]sito|pix recebido)/.test(m)) {
    return 'RECEITA'
  }
  if (/(gastei|paguei|pago|pagando|comprei|enviei pix|fiz um pix|transferi|debito|d[eé]bito|saquei)/.test(m)) {
    return 'DESPESA'
  }
  if (/(gasto|conta|boleto|fatura|aluguel|iptu|luz|agua|água|gas|gás)/.test(m)) {
    return 'DESPESA'
  }
  return null
}

const _BR_NUM_MAP = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15,
  dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100,
  duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500,
  seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
}

// Requer dezena, centena ou "mil" — evita falso positivo em "um café", "dois pratos"
const _VERBAL_INDICATOR = /\b(?:mil|cem|cento|duzentos|duzentas|trezentos|trezentas|quatrocentos|quatrocentas|quinhentos|quinhentas|seiscentos|seiscentas|setecentos|setecentas|oitocentos|oitocentas|novecentos|novecentas|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa)\b/

function _somarChunk(s) {
  let soma = 0
  for (const tok of s.split(/\s+/)) {
    const v = _BR_NUM_MAP[tok]
    if (v !== undefined) soma += v
  }
  return soma
}

/**
 * Converte valor verbal BR em número.
 * "dois mil e quinhentos" → 2500 | "cento e cinquenta" → 150 | "cinquenta reais" → 50
 * Retorna null se nenhum padrão verbal reconhecido.
 */
export function parseBRVerbalValor(texto) {
  let s = normTxt(texto)
    .replace(/\b(reais|real|uns|umas)\b/g, ' ')
    .replace(/\b(de|e)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!_VERBAL_INDICATOR.test(s)) return null

  const milIdx = s.indexOf('mil')
  let total = 0

  if (milIdx !== -1) {
    const anteMil = s.slice(0, milIdx).trim()
    const aposMil = s.slice(milIdx + 3).trim()
    const mult = anteMil ? _somarChunk(anteMil) : 1
    const resto = aposMil ? _somarChunk(aposMil) : 0
    total = mult * 1000 + resto
  } else {
    total = _somarChunk(s)
  }

  return total > 0 ? total : null
}

export function extrairValorBasicoFromTexto(message) {
  const verbal = parseBRVerbalValor(message)
  if (verbal !== null) return verbal

  // Captura "2.000,50" | "2.000" | "89,90" | "50" (separadores BR)
  const m = message.match(/(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/)
  if (!m) return null

  let raw = m[1].trim()
  if (raw.includes('.') && raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else if (raw.includes('.') && /\.\d{3}$/.test(raw)) {
    // "2.000" — ponto seguido de 3 dígitos = separador de milhar BR
    raw = raw.replace(/\./g, '')
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.')
  }

  const val = parseFloat(raw)
  if (!isFinite(val) || val <= 0) return null
  return val
}

/**
 * Fallback local quando nem o JSON da IA vem parseável.
 */
export function fallbackParseMensagemSimples(message) {
  const tipo = inferTipoBasicoFromTexto(message)
  const valor = extrairValorBasicoFromTexto(message)
  if (!tipo || !valor) return null
  return {
    tipo,
    valor,
    descricao: message,
    categoria_id: null,
    subcategoria_id: null,
  }
}
