import { describe, expect, it } from 'vitest'
import { getTransacaoCategoriaIconKey } from './transacaoCategoriaIconResolve.js'

describe('getTransacaoCategoriaIconKey', () => {
  it('Transporte + Combustível → mesmo PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Transporte', 'Combustível')).toBe('transportePng')
  })

  it('combustível fora de Transporte → fuel', () => {
    expect(getTransacaoCategoriaIconKey('Outros', 'Gasolina')).toBe('fuel')
  })

  it('Alimentação + Restaurantes → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Alimentação', 'Restaurantes e Lanches')).toBe('alimentacaoPng')
  })

  it('restaurante fora de Alimentação → utensils', () => {
    expect(getTransacaoCategoriaIconKey('Outros', 'Restaurante')).toBe('utensils')
  })

  it('nome exato categoria Transporte → PNG de transportes', () => {
    expect(getTransacaoCategoriaIconKey('Transporte', '—')).toBe('transportePng')
  })

  it('Transporte + Uber → PNG de transportes', () => {
    expect(getTransacaoCategoriaIconKey('Transporte', 'Uber')).toBe('transportePng')
  })

  it('Compras e Varejo → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Compras e Varejo', '—')).toBe('comprasVarejoPng')
  })

  it('Compras e Varejo + subcategoria → mesmo PNG', () => {
    expect(getTransacaoCategoriaIconKey('Compras e Varejo', 'Roupas')).toBe('comprasVarejoPng')
  })

  it('Cuidados Pessoais → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Cuidados Pessoais', '—')).toBe('cuidadosPessoaisPng')
  })

  it('Cuidados Pessoais + farmácia → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Cuidados Pessoais', 'Farmácia')).toBe('cuidadosPessoaisPng')
  })

  it('Despesas Financeiras → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Despesas Financeiras', '—')).toBe('despesasFinanceirasPng')
  })

  it('Despesas Financeiras + tarifa bancária → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Despesas Financeiras', 'Tarifa bancária')).toBe('despesasFinanceirasPng')
  })

  it('Doações e Presentes → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Doações e Presentes', '—')).toBe('doacoesPresentesPng')
  })

  it('Doações e Presentes + presente na subcategoria → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Doações e Presentes', 'Presentes')).toBe('doacoesPresentesPng')
  })

  it('Documentação e Impostos → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Documentação e Impostos', '—')).toBe('documentacaoImpostosPng')
  })

  it('Documentação e Impostos + IPVA → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Documentação e Impostos', 'IPVA')).toBe('documentacaoImpostosPng')
  })

  it('Educação → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Educação', '—')).toBe('educacaoPng')
  })

  it('Educação + escola na subcategoria → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Educação', 'Mensalidade escolar')).toBe('educacaoPng')
  })

  it('Investimentos e Patrimônio → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Investimentos e Patrimônio', '—')).toBe('investimentosPatrimonioPng')
  })

  it('Investimentos e Patrimônio + dividendos → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Investimentos e Patrimônio', 'Dividendos')).toBe('investimentosPatrimonioPng')
  })

  it('Lazer e Entreterimento → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Lazer e Entreterimento', '—')).toBe('lazerEntreterimentoPng')
  })

  it('Lazer e Entretenimento (grafia correta) → mesmo PNG', () => {
    expect(getTransacaoCategoriaIconKey('Lazer e Entretenimento', '—')).toBe('lazerEntreterimentoPng')
  })

  it('Lazer e Entreterimento + Netflix → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Lazer e Entreterimento', 'Netflix')).toBe('lazerEntreterimentoPng')
  })

  it('Moradia → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Moradia', '—')).toBe('moradiaPng')
  })

  it('Moradia + aluguel → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Moradia', 'Aluguel')).toBe('moradiaPng')
  })

  it('Pets e Dependentes → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Pets e Dependentes', '—')).toBe('petsDependentesPng')
  })

  it('Pets e Dependentes + ração → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Pets e Dependentes', 'Ração')).toBe('petsDependentesPng')
  })

  it('Pets e Dependentes + creche → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Pets e Dependentes', 'Creche')).toBe('petsDependentesPng')
  })

  it('Saúde → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Saúde', '—')).toBe('saudePng')
  })

  it('Saúde + farmácia → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Saúde', 'Farmácia')).toBe('saudePng')
  })

  it('Serviços e Assinaturas → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Serviços e Assinaturas', '—')).toBe('servicosAssinaturasPng')
  })

  it('Serviços e Assinaturas + assinatura → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Serviços e Assinaturas', 'Assinatura Spotify')).toBe('servicosAssinaturasPng')
  })

  it('Tecnologia e Gadgets → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Tecnologia e Gadgets', '—')).toBe('tecnologiaGadgetsPng')
  })

  it('Tecnologia e Gadgets + smartphone → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Tecnologia e Gadgets', 'Smartphone')).toBe('tecnologiaGadgetsPng')
  })

  it('Trabalho e Negócios → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Trabalho e Negócios', '—')).toBe('trabalhoNegociosPng')
  })

  it('Trabalho e Negócios + salário → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Trabalho e Negócios', 'Salário')).toBe('trabalhoNegociosPng')
  })

  it('Viagens → PNG da categoria', () => {
    expect(getTransacaoCategoriaIconKey('Viagens', '—')).toBe('viagensPng')
  })

  it('Viagem → mesmo PNG', () => {
    expect(getTransacaoCategoriaIconKey('Viagem', '—')).toBe('viagensPng')
  })

  it('Viagens + hotel → mesmo PNG (prioridade da categoria)', () => {
    expect(getTransacaoCategoriaIconKey('Viagens', 'Hotel')).toBe('viagensPng')
  })

  it('sem match → null', () => {
    expect(getTransacaoCategoriaIconKey('Xyz Desconhecida', 'Foo')).toBe(null)
  })
})
