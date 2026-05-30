export function BankBadge({ banco }) {
  if (!banco) return null

  return (
    <span
      className="bank-badge"
      style={{
        backgroundColor: banco.cor,
        color: banco.corTexto,
      }}
      title={banco.nome}
    >
      {banco.sigla}
    </span>
  )
}
