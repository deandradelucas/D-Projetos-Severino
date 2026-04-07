import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#22c55e', '#ef4444', '#d4a84b', '#3b82f6', '#8b5cf6']

const expenseData = [
  { name: 'Alimentação', valor: 2400 },
  { name: 'Transporte', valor: 1398 },
  { name: 'Moradia', valor: 3800 },
  { name: 'Lazer', valor: 890 },
  { name: 'Outros', valor: 430 },
]

const monthlyData = [
  { mes: 'Jan', receitas: 5000, despesas: 3200 },
  { mes: 'Fev', receitas: 5500, despesas: 2800 },
  { mes: 'Mar', receitas: 4800, despesas: 3500 },
  { mes: 'Abr', receitas: 6200, despesas: 3100 },
  { mes: 'Mai', receitas: 5900, despesas: 3600 },
  { mes: 'Jun', receitas: 6500, despesas: 2900 },
]

export default function ExpenseChart() {
  return (
    <section className="content-section">
      <div className="section-header">
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Visão Geral</h2>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Despesas por Categoria
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={expenseData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="valor"
              >
                {expenseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>
            Receitas vs Despesas
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
              <Tooltip 
                formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)'
                }}
              />
              <Bar dataKey="receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
