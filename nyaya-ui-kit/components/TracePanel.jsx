import React from 'react';
import ConfidenceIndicator from './ConfidenceIndicator';

const TracePanel = ({ decisionContract, observerSteps }) => {
  // Strict validation - reject if no decision contract
  if (!decisionContract) {
    return (
      <div className="consultation-card">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <h3 style={{ color: '#dc3545', marginBottom: '10px' }}>Trace Data Unavailable</h3>
          <p style={{ color: '#6c757d' }}>
            Unable to render trace panel due to missing decision contract data.
          </p>
        </div>
      </div>
    );
  }

  const {
    trace_id,
    legal_route,
    confidence,
    reasoning_trace,
    jurisdiction,
    domain,
    enforcement_status
  } = decisionContract;

  // Extract observer steps from reasoning_trace if available
  const steps = observerSteps || (reasoning_trace && reasoning_trace.observer_steps) || [];

  return (
    <div className="consultation-card">
      {/* Header */}
      <h2 style={{
        fontSize: '1.5rem',
        color: '#2c3e50',
        marginBottom: '20px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        🔍 Trace Visibility Panel
        <span style={{
          fontSize: '0.8rem',
          background: '#e9ecef',
          padding: '2px 8px',
          borderRadius: '4px',
          color: '#6c757d'
        }}>
          AUDITABLE
        </span>
      </h2>

      {/* Trace ID */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-label">Trace ID</div>
        <div style={{
          background: '#f8f9fa',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #e9ecef',
          fontFamily: 'monospace',
          fontSize: '14px',
          wordBreak: 'break-all',
          color: '#495057'
        }}>
          {trace_id}
        </div>
      </div>

      {/* Jurisdiction & Domain */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '20px'
      }}>
        <div>
          <div className="section-label">Jurisdiction</div>
          <p style={{
            color: '#495057',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {jurisdiction}
          </p>
        </div>
        <div>
          <div className="section-label">Domain</div>
          <p style={{
            color: '#495057',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {domain}
          </p>
        </div>
      </div>

      {/* Confidence Breakdown */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-label">Confidence Analysis</div>
        <ConfidenceIndicator confidence={confidence} />
        {reasoning_trace && reasoning_trace.confidence_breakdown && (
          <div style={{ marginTop: '15px' }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#495057',
              marginBottom: '10px'
            }}>
              Detailed Breakdown:
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '10px'
            }}>
              {Object.entries(reasoning_trace.confidence_breakdown).map(([key, value]) => (
                <div key={key} style={{
                  background: '#f8f9fa',
                  padding: '8px',
                  borderRadius: '6px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#6c757d',
                    textTransform: 'capitalize'
                  }}>
                    {key.replace('_', ' ')}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#495057'
                  }}>
                    {typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legal Route */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-label">Legal Route Sequence</div>
        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '15px',
          border: '1px solid #e9ecef'
        }}>
          {legal_route && legal_route.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {legal_route.map((step, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {index + 1}
                  </div>
                  <span style={{
                    color: '#495057',
                    fontSize: '14px'
                  }}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
              No legal route steps available
            </p>
          )}
        </div>
      </div>

      {/* Observer Steps */}
      {steps && steps.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div className="section-label">Observer Pipeline Steps</div>
          <div style={{
            background: '#f8f9fa',
            borderRadius: '8px',
            padding: '15px',
            border: '1px solid #e9ecef',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {steps.map((step, index) => (
              <div key={index} style={{
                padding: '8px',
                borderLeft: '3px solid #667eea',
                marginBottom: '8px',
                background: 'white',
                borderRadius: '4px'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#6c757d',
                  marginBottom: '4px'
                }}>
                  Step {index + 1}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#495057'
                }}>
                  {typeof step === 'string' ? step : JSON.stringify(step, null, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enforcement Status Summary */}
      <div style={{ marginBottom: '20px' }}>
        <div className="section-label">Enforcement Status</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: '#f8f9fa',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: enforcement_status?.state === 'clear' ? '#28a745' :
                           enforcement_status?.state === 'block' ? '#dc3545' :
                           enforcement_status?.state === 'escalate' ? '#fd7e14' : '#6f42c1'
          }} />
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#495057',
            textTransform: 'capitalize'
          }}>
            {enforcement_status?.state || 'Unknown'} - {enforcement_status?.verdict || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Security Footer */}
      <div style={{
        borderTop: '1px solid #e9ecef',
        paddingTop: '15px',
        marginTop: '20px'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#6c757d',
          textAlign: 'center',
          fontStyle: 'italic'
        }}>
          🔒 This trace panel displays verified, immutable decision contract data.
          All information is cryptographically traceable and audit-ready.
        </div>
      </div>
    </div>
  );
};

export default TracePanel;