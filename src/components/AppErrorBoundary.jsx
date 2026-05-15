import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100dvh',
            padding: '2rem',
            textAlign: 'center',
            gap: '1rem',
          }}
        >
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Algo deu errado.</p>
          <p style={{ opacity: 0.7 }}>Recarregue a página para continuar.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1.5rem',
              borderRadius: '0.5rem',
              border: '1px solid currentColor',
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
