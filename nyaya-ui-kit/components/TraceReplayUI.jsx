import React, { useState } from 'react';
import TracePanel from './TracePanel';
import FormatterGate from './FormatterGate';

// Mock test data for different enforcement scenarios
const TEST_CASES = {
  ALLOW: {
    trace_id: "test-allow-uuid-12345",
    jurisdiction: "India",
    domain: "Civil Law",
    legal_route: ["Initial Assessment", "Legal Research", "Document Review", "Clearance Granted"],
    confidence: 0.85,
    reasoning_trace: {
      confidence_breakdown: {
        overall: 0.85,
        jurisdiction: 0.90,
        domain: 0.80,
        enforcement: 0.85
      },
      observer_steps: [
        "Legal query received and validated",
        "Jurisdiction router activated for Indian law",
        "Civil law domain agent consulted",
        "Confidence threshold met (0.85 > 0.80)",
        "Response formatted with ALLOW decision"
      ]
    },
    enforcement_status: {
      state: "clear",
      verdict: "ENFORCEABLE",
      reason: "High confidence pathway identified",
      barriers: [],
      trace_id: "test-allow-uuid-12345"
    },
    metadata: {
      Formatted: true,
      timestamp: new Date().toISOString(),
      version: "1.0"
    }
  },

  BLOCK: {
    trace_id: "test-block-uuid-67890",
    jurisdiction: "UK",
    domain: "Criminal Law",
    legal_route: ["Emergency Assessment", "Immediate Block", "Legal Barriers Identified"],
    confidence: 0.25,
    reasoning_trace: {
      confidence_breakdown: {
        overall: 0.25,
        jurisdiction: 0.30,
        domain: 0.20,
        enforcement: 0.25
      },
      observer_steps: [
        "High-risk criminal query detected",
        "Emergency blocking protocol activated",
        "Legal barriers confirmed",
        "Confidence below threshold (0.25 < 0.40)",
        "BLOCK decision enforced"
      ]
    },
    enforcement_status: {
      state: "block",
      verdict: "NON_ENFORCEABLE",
      reason: "Criminal activity detected",
      barriers: ["Legal prohibition", "Public safety risk", "Enforcement required"],
      blocked_path: "criminal_proceedings",
      trace_id: "test-block-uuid-67890"
    },
    metadata: {
      Formatted: true,
      timestamp: new Date().toISOString(),
      version: "1.0"
    }
  },

  ESCALATE: {
    trace_id: "test-escalate-uuid-abcde",
    jurisdiction: "UAE",
    domain: "Commercial Law",
    legal_route: ["Complex Assessment", "Multi-jurisdiction Review", "Expert Consultation Required"],
    confidence: 0.55,
    reasoning_trace: {
      confidence_breakdown: {
        overall: 0.55,
        jurisdiction: 0.60,
        domain: 0.50,
        enforcement: 0.55
      },
      observer_steps: [
        "Complex commercial dispute identified",
        "Multi-jurisdiction complexity detected",
        "Confidence in medium range (0.40-0.65)",
        "Expert review recommended",
        "ESCALATE decision triggered"
      ]
    },
    enforcement_status: {
      state: "escalate",
      verdict: "PENDING_REVIEW",
      reason: "Complex matter requires expert review",
      barriers: ["Multi-jurisdiction complexity"],
      escalation_required: true,
      escalation_target: "senior_legal_counsel",
      trace_id: "test-escalate-uuid-abcde"
    },
    metadata: {
      Formatted: true,
      timestamp: new Date().toISOString(),
      version: "1.0"
    }
  }
};

const TraceReplayUI = () => {
  const [selectedTestCase, setSelectedTestCase] = useState('ALLOW');
  const [showAttackTest, setShowAttackTest] = useState(false);
  const [attackTestResult, setAttackTestResult] = useState(null);

  const currentTestData = TEST_CASES[selectedTestCase];

  // Attack test scenarios
  const runAttackTest = (attackType) => {
    let tamperedData;
    let expectedResult;

    switch (attackType) {
      case 'missing_formatted':
        tamperedData = { ...currentTestData };
        delete tamperedData.metadata.Formatted;
        expectedResult = 'should be blocked';
        break;
      case 'formatted_false':
        tamperedData = { ...currentTestData, metadata: { ...currentTestData.metadata, Formatted: false } };
        expectedResult = 'should be blocked';
        break;
      case 'missing_metadata':
        tamperedData = { ...currentTestData };
        delete tamperedData.metadata;
        expectedResult = 'should be blocked';
        break;
      case 'raw_backend':
        tamperedData = {
          result: "Some raw backend response",
          status: "success"
          // No metadata.Formatted
        };
        expectedResult = 'should be blocked';
        break;
      case 'tampered_schema':
        tamperedData = { ...currentTestData };
        tamperedData.extra_field = "This should not exist";
        tamperedData.metadata = { ...tamperedData.metadata, Formatted: true };
        expectedResult = 'should be blocked (extra fields)';
        break;
      default:
        return;
    }

    setAttackTestResult({
      attackType,
      data: tamperedData,
      expectedResult,
      testRun: true
    });
  };

  const resetAttackTest = () => {
    setAttackTestResult(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ padding: '40px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: '40px'
          }}>
            <h1 style={{
              color: 'white',
              fontSize: '2.5rem',
              fontWeight: '700',
              marginBottom: '10px',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              🔬 Trace Replay & Attack Testing
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '1.2rem',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              Test the Formatter Gate and Trace Visibility with controlled scenarios.
              Verify attack resistance and audit trail integrity.
            </p>
          </div>

          {/* Test Case Selector */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '30px',
            marginBottom: '30px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              color: '#2c3e50',
              marginBottom: '20px',
              fontWeight: '600'
            }}>
              Test Case Selection
            </h2>

            <div style={{
              display: 'flex',
              gap: '15px',
              flexWrap: 'wrap',
              marginBottom: '20px'
            }}>
              {Object.keys(TEST_CASES).map((testCase) => (
                <button
                  key={testCase}
                  onClick={() => setSelectedTestCase(testCase)}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    background: selectedTestCase === testCase ?
                      (testCase === 'ALLOW' ? '#28a745' :
                       testCase === 'BLOCK' ? '#dc3545' : '#fd7e14') :
                      '#e9ecef',
                    color: selectedTestCase === testCase ? 'white' : '#495057'
                  }}
                >
                  {testCase} Case
                </button>
              ))}
            </div>

            <div style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <strong>Current Test Case:</strong> {selectedTestCase}
              <br />
              <strong>Confidence:</strong> {(currentTestData.confidence * 100).toFixed(1)}%
              <br />
              <strong>Enforcement State:</strong> {currentTestData.enforcement_status.state}
              <br />
              <strong>Verdict:</strong> {currentTestData.enforcement_status.verdict}
            </div>
          </div>

          {/* Attack Testing Controls */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '30px',
            marginBottom: '30px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                color: '#2c3e50',
                fontWeight: '600'
              }}>
                🛡️ Attack Testing Suite
              </h2>
              <button
                onClick={() => setShowAttackTest(!showAttackTest)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #667eea',
                  background: showAttackTest ? '#667eea' : 'white',
                  color: showAttackTest ? 'white' : '#667eea',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {showAttackTest ? 'Hide Tests' : 'Show Attack Tests'}
              </button>
            </div>

            {showAttackTest && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '15px',
                marginBottom: '20px'
              }}>
                <button
                  onClick={() => runAttackTest('missing_formatted')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #dc3545',
                    background: '#fff5f5',
                    color: '#c53030',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}
                >
                  Missing Formatted Flag
                </button>
                <button
                  onClick={() => runAttackTest('formatted_false')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #dc3545',
                    background: '#fff5f5',
                    color: '#c53030',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}
                >
                  Formatted: false
                </button>
                <button
                  onClick={() => runAttackTest('missing_metadata')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #dc3545',
                    background: '#fff5f5',
                    color: '#c53030',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}
                >
                  Missing Metadata
                </button>
                <button
                  onClick={() => runAttackTest('raw_backend')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #dc3545',
                    background: '#fff5f5',
                    color: '#c53030',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}
                >
                  Raw Backend Response
                </button>
                <button
                  onClick={() => runAttackTest('tampered_schema')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #dc3545',
                    background: '#fff5f5',
                    color: '#c53030',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}
                >
                  Tampered Schema
                </button>
              </div>
            )}

            {attackTestResult && (
              <div style={{
                background: '#fff5f5',
                border: '2px solid #fed7d7',
                borderRadius: '8px',
                padding: '20px',
                marginTop: '20px'
              }}>
                <h3 style={{
                  color: '#c53030',
                  fontSize: '1.2rem',
                  fontWeight: '600',
                  marginBottom: '15px'
                }}>
                  🛡️ Attack Test Result: {attackTestResult.attackType.replace(/_/g, ' ').toUpperCase()}
                </h3>
                <p style={{
                  color: '#742a2a',
                  marginBottom: '15px',
                  fontSize: '16px'
                }}>
                  <strong>Expected:</strong> {attackTestResult.expectedResult}
                </p>
                <div style={{
                  background: '#f7fafc',
                  borderRadius: '6px',
                  padding: '15px',
                  marginBottom: '15px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#2d3748',
                    marginBottom: '10px',
                    fontWeight: '600'
                  }}>
                    Test Data Preview:
                  </div>
                  <pre style={{
                    fontSize: '12px',
                    color: '#4a5568',
                    overflow: 'auto',
                    maxHeight: '150px'
                  }}>
                    {JSON.stringify(attackTestResult.data, null, 2)}
                  </pre>
                </div>
                <button
                  onClick={resetAttackTest}
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Clear Test Result
                </button>
              </div>
            )}
          </div>

          {/* Trace Panel Display */}
          <div style={{ marginBottom: '30px' }}>
            {attackTestResult ? (
              <FormatterGate responseData={attackTestResult.data}>
                <TracePanel
                  decisionContract={attackTestResult.data}
                  observerSteps={attackTestResult.data.reasoning_trace?.observer_steps}
                />
              </FormatterGate>
            ) : (
              <FormatterGate responseData={currentTestData}>
                <TracePanel
                  decisionContract={currentTestData}
                  observerSteps={currentTestData.reasoning_trace?.observer_steps}
                />
              </FormatterGate>
            )}
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px'
          }}>
            <p>
              🔒 High-Trust Interface • Attack-Resistant • Audit-Ready
              <br />
              Nyaya Trace Replay System • {new Date().toISOString().split('T')[0]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraceReplayUI;