import AdminDataTableSkeleton from '../AdminDataTableSkeleton.jsx'
import MpStatusBadge from '../MpStatusBadge.jsx'
import { pagamentoStatusLabelPt, referenciaPagamentoCurta } from '../../lib/pagamentoPageModel.js'

const HEADERS = ['Data', 'Valor', 'Status', 'Detalhe', 'Referência']

export default function PagamentoHistorico({ historico, loading, formatCurrency, historicoRef }) {
  return (
    <article ref={historicoRef} className="ref-panel page-pagamento-historico" aria-labelledby="pagamento-hist-heading">
      <div className="ref-panel__head page-pagamento-historico__head">
        <div>
          <h2 id="pagamento-hist-heading" className="ref-panel__title">
            Histórico de cobranças
          </h2>
          <p className="ref-panel__subtitle">Últimas movimentações registradas pelo Mercado Pago nesta conta</p>
        </div>
      </div>
      {loading ? (
        <AdminDataTableSkeleton headers={HEADERS} rows={5} />
      ) : historico.length === 0 ? (
        <div className="pagamento-empty-state">
          <p className="pagamento-empty-state__title">Nenhuma cobrança ainda</p>
          <p className="pagamento-empty-state__text">
            Quando você autorizar a assinatura no Mercado Pago, as cobranças aparecerão aqui com data, valor e status.
          </p>
        </div>
      ) : (
        <>
          <div className="pagamento-hist-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map((row) => (
                  <tr key={row.id}>
                    <td className="pagamento-hist-cell--muted">
                      {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td>{row.amount != null ? formatCurrency(Number(row.amount)) : '—'}</td>
                    <td>
                      <MpStatusBadge status={row.status} label={pagamentoStatusLabelPt(row.status)} className="pagamento-hist-badge" />
                    </td>
                    <td className="pagamento-hist-cell--detail">{row.status_detail || row.description || '—'}</td>
                    <td className="pagamento-hist-cell--ref">{referenciaPagamentoCurta(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="pagamento-hist-cards" aria-label="Histórico de pagamentos (lista)">
            {historico.map((row) => (
              <li key={row.id} className="pagamento-hist-card">
                <div className="pagamento-hist-card__row">
                  <span className="pagamento-hist-card__label">Data</span>
                  <span className="pagamento-hist-card__val">
                    {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—'}
                  </span>
                </div>
                <div className="pagamento-hist-card__row">
                  <span className="pagamento-hist-card__label">Valor</span>
                  <span className="pagamento-hist-card__val">{row.amount != null ? formatCurrency(Number(row.amount)) : '—'}</span>
                </div>
                <div className="pagamento-hist-card__row">
                  <span className="pagamento-hist-card__label">Status</span>
                  <span className="pagamento-hist-card__val">
                    <MpStatusBadge status={row.status} label={pagamentoStatusLabelPt(row.status)} className="pagamento-hist-badge" />
                  </span>
                </div>
                <div className="pagamento-hist-card__row">
                  <span className="pagamento-hist-card__label">Detalhe</span>
                  <span className="pagamento-hist-card__val pagamento-hist-card__val--detail">
                    {row.status_detail || row.description || '—'}
                  </span>
                </div>
                <div className="pagamento-hist-card__row">
                  <span className="pagamento-hist-card__label">Referência</span>
                  <span className="pagamento-hist-card__val pagamento-hist-card__val--detail">{referenciaPagamentoCurta(row)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
