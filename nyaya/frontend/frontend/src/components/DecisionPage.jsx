import React from 'react'
import { queryNyayaDecision } from '../services/nyayaBackendApi.js'
import { useDecisionData } from '../hooks/useDecisionData.js'
import './DecisionPage.css'

/**
 * DecisionPage - Standalone Legal Decision Display
 * 
 * This is a standalone page that queries the real Nyaya backend
 * and displays structured legal decisions as authority, not chat.
 * 
 * Debug Mode: Press 'Ctrl+Shift+D' to toggle debug information
 */
function DecisionPage() {
  const [query, setQuery] = React.useState('')
  const { decision, loading, error, isValid, setLoading, validateAndSetDecision, clearDecision } = useDecisionData()
  const [expandedSections, setExpandedSections] = React.useState({})
  const [debugMode, setDebugMode] = React.useState(false)

  // Debug mode keyboard shortcut - Ctrl+Shift+D
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setDebugMode(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const handleSubmitQuery = async (e) => {
    e.preventDefault()

    if (!query.trim()) {
      // Note: error is handled by the hook
      return
    }

    setLoading(true)
    clearDecision()
    setExpandedSections({})

    try {
      const result = await queryNyayaDecision(query.trim())

      if (!result.success) {
        throw new Error(result.error)
      }

      // Validate and set decision data - only renders if valid
      const isValid = validateAndSetDecision(result.data)
      if (isValid) {
        console.log('DecisionContract validated:', result.data.trace_id)
      }
    } catch (err) {
      console.error('Query error:', err)
      // Error handled by hook
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const getEnforcementColor = (verdict) => {
    switch (verdict) {
      case 'ENFORCEABLE':
        return '#28a745'
      case 'NON_ENFORCEABLE':
        return '#dc3545'
      case 'PENDING_REVIEW':
        return '#fd7e14'
      default:
        return '#6c757d'
    }
  }

  const getEnforcementLabel = (verdict) => {
    switch (verdict) {
      case 'ENFORCEABLE':
        return '✅ ENFORCEABLE'
      case 'NON_ENFORCEABLE':
        return '🚫 NON-ENFORCEABLE'
      case 'PENDING_REVIEW':
        return '📈 PENDING REVIEW'
      default:
        return '⚠️ UNKNOWN'
    }
  }



  return (
    <div className="decision-page">
      {/* Header */}
      <div className="decision-header">
        <h1>Nyaya Legal Agent</h1>
        <p>Real-time structured legal decisions with enforcement authority</p>
      </div>

      {/* Query Section */}
      <div className="decision-query-section">
        <div className="query-container">
          <form onSubmit={handleSubmitQuery}>
            <div className="form-group">
              <label htmlFor="query">Enter Your Legal Query</label>
              <textarea
                id="query"
                className="query-textarea"
                placeholder="Example: What are the procedures for filing a civil suit in India?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                rows={4}
              />
            </div>

            <button
              type="submit"
              className="query-button"
              disabled={loading || !query.trim()}
            >
              {loading ? 'Processing Decision...' : 'Get Legal Decision'}
            </button>
          </form>

          {error && (
            <div className="error-message">
              <span>⚠️</span>
              <p>{error}</p>
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}
        </div>
      </div>

      {/* Decision Display - Only renders if DecisionContract is valid */}
      {decision && isValid && (
        <div className="decision-display">
          {/* Enforcement Status Banner */}
          <div
            className="enforcement-banner"
            style={{ borderLeftColor: getEnforcementColor(decision.enforcement_status.verdict) }}
          >
            <div className="enforcement-content">
              <h2 style={{ color: getEnforcementColor(decision.enforcement_status.verdict) }}>
                {getEnforcementLabel(decision.enforcement_status.verdict)}
              </h2>
              <p className="enforcement-state">{decision.enforcement_status.state}</p>
            </div>
          </div>

          {/* Decision Summary */}
          <div className="decision-section header-section">
            <div className="section-info">
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">Domain</div>
                  <div className="info-value">{decision.domain.toUpperCase()}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Jurisdiction</div>
                  <div className="info-value">{decision.jurisdiction}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Confidence</div>
                  <div className="info-value">
                    {Math.round(decision.confidence * 100)}%
                  </div>
                </div>
                <div className="info-item">
                  <div className="info-label">Trace ID</div>
                  <div className="info-value trace-id">{decision.trace_id}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Analysis */}
          <div className="decision-section">
            <h3 className="section-title">Legal Analysis</h3>
            <div className="section-content">
              <p>{decision.reasoning_trace?.agent_processing?.analysis || 'Analysis processed through Observer Pipeline'}</p>
            </div>
          </div>

          {/* Reasoning Trace */}
          <div className="decision-section">
            <button
              className="section-toggle"
              onClick={() => toggleSection('reasoning')}
            >
              <h3 className="section-title">Reasoning Trace</h3>
              <span className={`toggle-icon ${expandedSections.reasoning ? 'open' : ''}`}>▼</span>
            </button>
            {expandedSections.reasoning && (
              <div className="section-content">
                <pre style={{ fontSize: '0.9rem', background: '#f8f9fa', padding: '10px', borderRadius: '4px' }}>
                  {JSON.stringify(decision.reasoning_trace, null, 2)}
                </pre>
              </div>
            )}
          </div>



          {/* Legal Route */}
          <div className="decision-section">
            <button
              className="section-toggle"
              onClick={() => toggleSection('route')}
            >
              <h3 className="section-title">Legal Route</h3>
              <span className={`toggle-icon ${expandedSections.route ? 'open' : ''}`}>▼</span>
            </button>
            {expandedSections.route && (
              <div className="section-content">
                <div className="legal-route">
                  {decision.legal_route.map((agent, idx) => (
                    <React.Fragment key={idx}>
                      <div className="route-step">{agent}</div>
                      {idx < decision.legal_route.length - 1 && (
                        <div className="route-arrow">→</div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>



          {/* Footer Actions */}
          <div className="decision-footer">
            <button 
              className="action-button"
              onClick={() => {
                const dataStr = JSON.stringify(decision, null, 2)
                const dataBlob = new Blob([dataStr], { type: 'application/json' })
                const url = URL.createObjectURL(dataBlob)
                const link = document.createElement('a')
                link.href = url
                link.download = `decision-${decision.trace_id}.json`
                link.click()
              }}
            >
              📥 Export Decision
            </button>
            <button
              className="action-button secondary"
              onClick={() => {
                clearDecision()
                setQuery('')
              }}
            >
              🔄 New Query
            </button>
          </div>

          {/* Debug Mode - Development Only */}
          {debugMode && (
            <div style={{
              marginTop: '30px',
              padding: '16px',
              background: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              color: '#666'
            }}>
              <strong>DEBUG INFO (DecisionContract):</strong><br/>
              Enforcement Verdict: <strong>{decision.enforcement_status.verdict}</strong><br/>
              Trace ID: <strong>{decision.trace_id}</strong><br/>
              Confidence: <strong>{Math.round(decision.confidence * 100)}%</strong><br/>
              Jurisdiction: <strong>{decision.jurisdiction}</strong><br/>
              Domain: <strong>{decision.domain}</strong><br/>
              Schema Valid: <strong>{isValid ? '✅' : '❌'}</strong><br/>
              Timestamp: {new Date().toISOString()}
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="decision-loading">
          <div className="spinner"></div>
          <p>Analyzing legal decision...</p>
        </div>
      )}

      {/* Empty State */}
      {!decision && !loading && !error && (
        <div className="decision-empty">
          <p>Submit a legal query to receive a structured legal decision</p>
        </div>
      )}
    </div>
  )
}

export default DecisionPage
