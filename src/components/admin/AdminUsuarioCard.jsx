import React from 'react'
import UserAdminStatusBadge from './UserAdminStatusBadge'
import AssinaturaPagamentoCell from './AssinaturaPagamentoCell'
import UltimoAcessoCell from './UltimoAcessoCell'
import { formatPhoneBRDisplay } from '../../lib/formatPhoneBR'
import { formatCurrencyBRL } from '../../lib/formatCurrency'
import { formatDatePtBr, formatDateTimePtBr } from '../../lib/usersAdmin'
import { normalizeRoleKey, roleDisplayLabel, rolePillClassName } from '../../lib/adminUsuariosUtils.js'

export default function AdminUsuarioCard({
  row,
  isEditing,
  isPrincipal,
  principalPodeDarAdmin,
  roleOptionsEdit,
  editForm,
  onChangeField,
  onSaveUser,
  onCancelEdit,
  onOpenDetail,
  onStartEdit,
  onWhatsapp,
  onDelete,
  getUserConnectionBadge,
}) {
  const cardClass = [
    'page-admin-usuario-card',
    row.isOverdue ? 'page-admin-usuario-card--alert' : '',
    isEditing ? 'page-admin-usuario-card--editing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={cardClass} aria-label={row.nome || row.email || 'Usuário'}>
      <header className="page-admin-usuario-card__head">
        <div className="page-admin-usuario-card__head-text">
          {isEditing ? (
            <input
              type="text"
              className="page-admin-inline-input page-admin-usuario-card__input-name"
              value={editForm.nome}
              onChange={(e) => onChangeField('nome', e.target.value)}
              aria-label="Nome"
            />
          ) : (
            <h3 className="page-admin-usuario-card__name">{row.nome || '—'}</h3>
          )}
          {isEditing ? (
            <input
              type="email"
              className="page-admin-inline-input page-admin-usuario-card__input-email"
              value={editForm.email}
              onChange={(e) => onChangeField('email', e.target.value)}
              disabled={isPrincipal}
              title={isPrincipal ? 'E-mail da conta administradora principal não pode ser alterado.' : undefined}
              aria-label="E-mail"
            />
          ) : (
            <p className="page-admin-usuario-card__email page-admin-email-text">{row.email}</p>
          )}
        </div>
        <div className="page-admin-usuario-card__head-status">
          <UserAdminStatusBadge paymentStatus={row.paymentStatus} isOverdue={row.isOverdue} />
          {row.daysToExpire != null && row.daysToExpire >= 0 ? (
            <span className="page-admin-usuario-card__trial-hint admin-subline">{row.daysToExpire} d</span>
          ) : null}
        </div>
      </header>

      <div className="page-admin-usuario-card__grid">
        <div className="page-admin-usuario-card__field">
          <span className="page-admin-usuario-card__label">Telefone</span>
          <div className="page-admin-usuario-card__value">
            {isEditing ? (
              <input
                type="text"
                className="page-admin-inline-input"
                value={editForm.telefone}
                onChange={(e) => onChangeField('telefone', e.target.value)}
                placeholder="DDD + número"
              />
            ) : (
              formatPhoneBRDisplay(row.telefone)
            )}
          </div>
        </div>

        <div className="page-admin-usuario-card__field">
          <span className="page-admin-usuario-card__label">Papel · conta</span>
          <div className="page-admin-usuario-card__value">
            <div className="page-admin-usuarios-perfil-stack">
              <div className="page-admin-usuarios-perfil-stack__role">
                {isEditing ? (
                  isPrincipal ? (
                    <span className={rolePillClassName('ADMIN')} title="A conta principal permanece como administradora.">
                      {roleDisplayLabel('ADMIN')}
                    </span>
                  ) : !principalPodeDarAdmin && normalizeRoleKey(editForm.role) === 'ADMIN' ? (
                    <span
                      className={rolePillClassName('ADMIN')}
                      title="Somente o administrador principal pode alterar ou rebaixar outro Admin."
                    >
                      {roleDisplayLabel('ADMIN')}
                    </span>
                  ) : (
                    <select
                      className="page-admin-filter-select page-admin-filter-select--inline page-admin-filter-select--perfil"
                      value={editForm.role || 'USER'}
                      onChange={(e) => onChangeField('role', e.target.value)}
                      aria-label="Papel"
                    >
                      {roleOptionsEdit.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  <span className={rolePillClassName(isPrincipal ? 'ADMIN' : row.role)}>
                    {roleDisplayLabel(isPrincipal ? 'ADMIN' : row.role)}
                  </span>
                )}
              </div>
              <div className="page-admin-usuarios-perfil-stack__conta">
                {isEditing ? (
                  <label className="page-admin-checkbox-ativo">
                    <input type="checkbox" checked={editForm.is_active} onChange={(e) => onChangeField('is_active', e.target.checked)} />
                    Conta ativa
                  </label>
                ) : row.is_active === false ? (
                  <span className="admin-badge-conta admin-badge-conta--off">Desativado</span>
                ) : (
                  <span className="admin-badge-conta admin-badge-conta--on">Ativo</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="page-admin-usuario-card__field page-admin-usuario-card__field--wide">
          <span className="page-admin-usuario-card__label">Assinatura / pagamento</span>
          <div className="page-admin-usuario-card__value">
            <AssinaturaPagamentoCell row={row} isEditing={isEditing} editForm={editForm} onField={onChangeField} />
          </div>
        </div>

        <div className="page-admin-usuario-card__field">
          <span className="page-admin-usuario-card__label">Trial / cobrança</span>
          <div className="page-admin-usuario-card__value">
            <div className="page-admin-usuarios-compact-block">
              <div className="page-admin-usuarios-compact-row">
                <span className="page-admin-usuarios-compact-k">Trial</span>
                <span className="page-admin-usuarios-compact-v">{formatDatePtBr(row.trial_ends_at)}</span>
              </div>
              <div className="page-admin-usuarios-compact-row">
                <span className="page-admin-usuarios-compact-k">Cobr.</span>
                <span className="page-admin-usuarios-compact-v">{formatDateTimePtBr(row.nextPaymentDate)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="page-admin-usuario-card__field">
          <span className="page-admin-usuario-card__label">Receita</span>
          <div className="page-admin-usuario-card__value">
            <div className="page-admin-usuarios-compact-block">
              <div className="page-admin-usuarios-compact-row">
                <span className="page-admin-usuarios-compact-k">Acum.</span>
                <span className="page-admin-usuarios-compact-v page-admin-usuarios-compact-v--num">{formatCurrencyBRL(row.accumulatedRevenue)}</span>
              </div>
              <div className="page-admin-usuarios-compact-row">
                <span className="page-admin-usuarios-compact-k">Mês</span>
                <span className="page-admin-usuarios-compact-v page-admin-usuarios-compact-v--num">{formatCurrencyBRL(row.monthlyRevenue)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="page-admin-usuario-card__field page-admin-usuario-card__field--wide">
          <span className="page-admin-usuario-card__label">Último acesso</span>
          <div className="page-admin-usuario-card__value">
            <UltimoAcessoCell row={row} getUserConnectionBadge={getUserConnectionBadge} />
          </div>
        </div>
      </div>

      <footer className="page-admin-usuario-card__footer">
        <div className="admin-acoes-btns page-admin-usuario-card__actions">
          {isEditing ? (
            <>
              <button type="button" className="btn-primary admin-acoes-btn" onClick={onSaveUser}>
                Salvar
              </button>
              <button type="button" className="btn-secondary admin-acoes-btn" onClick={onCancelEdit}>
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => onOpenDetail(row)}>
                Detalhes
              </button>
              <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => onStartEdit(row)}>
                Editar
              </button>
            </>
          )}
          <button type="button" className="btn-secondary admin-acoes-btn" onClick={() => void onWhatsapp(row)}>
            WhatsApp
          </button>
          {isPrincipal ? (
            <span className="admin-acoes-protegido" title="A conta administradora principal não pode ser excluída pelo painel.">
              Protegido
            </span>
          ) : (
            <button type="button" className="btn-secondary admin-acoes-btn admin-acoes-btn--danger" onClick={() => onDelete(row)}>
              Excluir
            </button>
          )}
        </div>
      </footer>
    </article>
  )
}
