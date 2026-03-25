import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const traceId = this.props.traceId || window.__gravitas_active_trace_id || null
      const message = this.state.error?.message || 'An unexpected error occurred'

      return (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '24px',
          margin: '20px',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#ef4444', marginBottom: '12px' }}>Something went wrong</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', marginBottom: '16px' }}>
            {message}
          </p>

          {traceId && (
            <div style={{
              display: 'inline-block',
              padding: '6px 12px',
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.6)',
              marginBottom: '16px',
              wordBreak: 'break-all'
            }}>
              Reference ID: {traceId}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                background: '#ef4444',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Try Again
            </button>
            {traceId && (
              <button
                onClick={() => {
                  const subject = encodeURIComponent(`Gravitas UI Error — Trace ${traceId}`)
                  const body = encodeURIComponent(`Reference ID: ${traceId}\nError: ${message}\n\nPlease investigate.`)
                  window.open(`mailto:support@nyaya.ai?subject=${subject}&body=${body}`)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.5)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Report Issue
              </button>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
