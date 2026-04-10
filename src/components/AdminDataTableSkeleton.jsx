import React from 'react'

/**
 * Cabeçalhos reais + linhas placeholder — evita só o texto "Carregando…" solto.
 */
export default function AdminDataTableSkeleton({
  headers,
  rows = 8,
  tableClassName = 'data-table',
}) {
  const n = headers.length
  return (
    <div style={{ overflowX: 'auto' }} aria-busy="true" aria-label="Carregando dados">
      <table className={tableClassName}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: n }).map((_, ci) => (
                <td key={ci}>
                  <span
                    className="skeleton skeleton-pulse admin-table-skel-cell"
                    style={{ width: ci === n - 1 ? '70%' : '100%' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
