import React, { useState, useEffect } from 'react';

const FormatterGate = ({ children, responseData }) => {
  const [validationState, setValidationState] = useState('validating');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Strict Formatter Gate Enforcement
    // Immediately reject any payload missing metadata.Formatted: true

    if (!responseData) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: No response data received');
      return;
    }

    // Check for metadata object
    if (!responseData.metadata) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing metadata object');
      return;
    }

    // Check for Formatted flag
    if (responseData.metadata.Formatted !== true) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: metadata.Formatted flag is not true');
      return;
    }

    // Additional security checks
    if (!responseData.trace_id) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing trace_id');
      return;
    }

    if (!responseData.enforcement_status) {
      setValidationState('error');
      setErrorMessage('UNFORMATTED RESPONSE BLOCKED: Missing enforcement_status');
      return;
    }

    // If all checks pass, allow rendering
    setValidationState('valid');
  }, [responseData]);

  // Render blocked state
  if (validationState === 'error') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '40px',
          maxWidth: '600px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {/* Security Alert Icon */}
          <div style={{
            fontSize: '4rem',
            marginBottom: '20px',
            color: '#dc3545'
          }}>
            🚫
          </div>

          {/* Error Title */}
          <h1 style={{
            color: '#dc3545',
            fontSize: '2rem',
            fontWeight: '700',
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Security Breach Detected
          </h1>

          {/* Error Message */}
          <div style={{
            background: '#fff5f5',
            border: '2px solid #fed7d7',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '30px'
          }}>
            <h3 style={{
              color: '#c53030',
              fontSize: '1.2rem',
              fontWeight: '600',
              marginBottom: '10px'
            }}>
              UNFORMATTED RESPONSE BLOCKED
            </h3>
            <p style={{
              color: '#742a2a',
              fontSize: '16px',
              lineHeight: '1.6',
              fontFamily: 'monospace',
              wordBreak: 'break-word'
            }}>
              {errorMessage}
            </p>
          </div>

          {/* Security Information */}
          <div style={{
            background: '#f7fafc',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '30px',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{
              color: '#2d3748',
              fontSize: '1.1rem',
              fontWeight: '600',
              marginBottom: '15px'
            }}>
              🔒 Security Protocol Activated
            </h4>
            <ul style={{
              color: '#4a5568',
              textAlign: 'left',
              lineHeight: '1.8',
              fontSize: '14px'
            }}>
              <li>• All responses must be processed through the Formatter pipeline</li>
              <li>• metadata.Formatted: true flag is required for trust validation</li>
              <li>• Raw backend responses are never displayed to users</li>
              <li>• Tampered or malformed schemas trigger immediate blocking</li>
              <li>• This interface maintains high-trust auditability</li>
            </ul>
          </div>

          {/* Trace ID Display (if available) */}
          {responseData && responseData.trace_id && (
            <div style={{
              background: '#e6fffa',
              border: '1px solid #81e6d9',
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '14px',
                color: '#234e52',
                marginBottom: '5px',
                fontWeight: '600'
              }}>
                Trace ID (for debugging):
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#2c7a7b',
                wordBreak: 'break-all'
              }}>
                {responseData.trace_id}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '15px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            >
              🔄 Retry Request
            </button>

            <button
              onClick={() => window.history.back()}
              style={{
                background: '#e2e8f0',
                color: '#4a5568',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => e.target.style.background = '#cbd5e0'}
              onMouseOut={(e) => e.target.style.background = '#e2e8f0'}
            >
              ← Go Back
            </button>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #e2e8f0',
            fontSize: '12px',
            color: '#718096'
          }}>
            Nyaya Security Gate • High-Trust Interface Active
            <br />
            Timestamp: {new Date().toISOString()}
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while validating
  if (validationState === 'validating') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '20px'
          }}>
            🔍
          </div>
          <h3 style={{
            color: '#2c3e50',
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '10px'
          }}>
            Validating Response Integrity
          </h3>
          <p style={{
            color: '#6c757d',
            fontSize: '16px'
          }}>
            Checking formatter gate compliance...
          </p>
        </div>
      </div>
    );
  }

  // Render children if validation passes
  return children;
};

export default FormatterGate;