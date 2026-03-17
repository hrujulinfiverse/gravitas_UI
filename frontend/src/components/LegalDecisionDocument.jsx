import React, { useState, useEffect } from 'react'
import { legalQueryService } from '../services/nyayaApi.js'

const LegalDecisionDocument = ({ onResponseReceived }) => {
  const [intakeData, setIntakeData] = useState({
    caseDescription: '',
    jurisdiction: 'India',
    parties: { plaintiff: '', defendant: '' },
    caseType: '',
    dateOfIncident: ''
  })
  const [decision, setDecision] = useState(null)
  const [loading, setLoading] = useState(false)
  const [traceId, setTraceId] = useState(null)
  const [error, setError] = useState(null)
  const [currentStep, setCurrentStep] = useState(1)

  const handleIntakeChange = (field, value) => {
    setIntakeData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePartyChange = (party, value) => {
    setIntakeData(prev => ({
      ...prev,
      parties: { ...prev.parties, [party]: value }
    }))
  }

  const handleGenerateDecision = async () => {
    if (!intakeData.caseDescription.trim()) {
      setError('Case description is required for generating decision')
      return
    }

    setLoading(true)
    setError(null)
    setCurrentStep(2)

    try {
      const result = await legalQueryService.submitQuery({
        query: intakeData.caseDescription,
        jurisdiction_hint: intakeData.jurisdiction,
        domain_hint: intakeData.caseType
      })

      if (result.success) {
        setTraceId(result.trace_id)
        setDecision(result.data)
        setCurrentStep(3)
        if (onResponseReceived) {
          onResponseReceived(result.data)
        }
      } else {
        setError(result.error || 'Failed to generate decision')
        setCurrentStep(1)
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend')
      setCurrentStep(1)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setIntakeData({
      caseDescription: '',
      jurisdiction: 'India',
      parties: { plaintiff: '', defendant: '' },
      caseType: '',
      dateOfIncident: ''
    })
    setDecision(null)
    setTraceId(null)
    setError(null)
    setCurrentStep(1)
  }

  const PendingIndicator = ({ label }) => (
    <div style={{
      padding: '8px 12px',
      background: 'rgba(255, 193, 7, 0.1)',
      border: '1px dashed rgba(255, 193, 7, 0.4)',
      borderRadius: '4px',
      color: '#ffc107',
      fontSize: '12px',
      fontStyle: 'italic'
    }}>
      [PENDING INTAKE: {label}]
    </div>
  )

  const SectionHeader = ({ number, title }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '2px solid rgba(59, 130, 246, 0.5)'
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: '#3b82f6',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: '700'
      }}>
        {number}
      </div>
      <h3 style={{
        color: '#fff',
        fontSize: '16px',
        fontWeight: '600',
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}>
        {title}
      </h3>
    </div>
  )

  const DocumentSection = ({ children, bgColor = 'rgba(255, 255, 255, 0.03)' }) => (
    <div style={{
      background: bgColor,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      {children}
    </div>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Case Intake Form */}
      <DocumentSection bgColor="rgba(59, 130, 246, 0.05)">
        <SectionHeader number="0" title="Case Intake" />
        
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
              JURISDICTION
            </label>
            <select
              value={intakeData.jurisdiction}
              onChange={(e) => handleIntakeChange('jurisdiction', e.target.value)}
              disabled={loading || currentStep > 1}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px'
              }}
            >
              <option value="India" style={{color:'#000'}}>India</option>
              <option value="UK" style={{color:'#000'}}>United Kingdom</option>
              <option value="UAE" style={{color:'#000'}}>United Arab Emirates</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                PLAINTIFF / APPLICANT
              </label>
              <input
                type="text"
                value={intakeData.parties.plaintiff}
                onChange={(e) => handlePartyChange('plaintiff', e.target.value)}
                placeholder="Enter plaintiff name"
                disabled={loading || currentStep > 1}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                DEFENDANT / RESPONDENT
              </label>
              <input
                type="text"
                value={intakeData.parties.defendant}
                onChange={(e) => handlePartyChange('defendant', e.target.value)}
                placeholder="Enter defendant name"
                disabled={loading || currentStep > 1}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
              CASE DESCRIPTION / FACTS
            </label>
            <textarea
              value={intakeData.caseDescription}
              onChange={(e) => handleIntakeChange('caseDescription', e.target.value)}
              placeholder="Describe the case facts, circumstances, and relief sought..."
              disabled={loading || currentStep > 1}
              rows={5}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          {currentStep === 1 && (
            <button
              onClick={handleGenerateDecision}
              disabled={loading || !intakeData.caseDescription.trim()}
              style={{
                padding: '14px 28px',
                background: loading || !intakeData.caseDescription.trim() 
                  ? 'rgba(59, 130, 246, 0.5)' 
                  : '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading || !intakeData.caseDescription.trim() ? 'not-allowed' : 'pointer',
                marginTop: '8px'
              }}
            >
              {loading ? 'GENERATING DECISION...' : 'GENERATE LEGAL DECISION'}
            </button>
          )}
        </div>
      </DocumentSection>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '16px',
          background: 'rgba(220, 53, 69, 0.1)',
          border: '1px solid rgba(220, 53, 69, 0.3)',
          borderRadius: '8px',
          color: '#f8d7da',
          marginBottom: '20px'
        }}>
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <DocumentSection>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ 
              width: '40px', 
              height: '40px', 
              border: '3px solid rgba(59,130,246,0.3)',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              Analyzing case data and generating decision...
            </p>
          </div>
        </DocumentSection>
      )}

      {/* Structured Legal Decision Document */}
      {decision && !loading && (
        <div style={{ animation: 'fadeIn 0.5s ease' }}>
          <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          {/* Enforcement Banner */}
          <div style={{
            padding: '16px 20px',
            background: decision.enforcement_decision === 'ALLOW' ? 'rgba(40, 167, 69, 0.15)' :
                       decision.enforcement_decision === 'BLOCK' ? 'rgba(220, 53, 69, 0.15)' :
                       decision.enforcement_decision === 'ESCALATE' ? 'rgba(253, 126, 20, 0.15)' :
                       'rgba(111, 66, 193, 0.15)',
            border: `2px solid ${
              decision.enforcement_decision === 'ALLOW' ? '#28a745' :
              decision.enforcement_decision === 'BLOCK' ? '#dc3545' :
              decision.enforcement_decision === 'ESCALATE' ? '#fd7e14' : '#6f42c1'
            }`,
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ 
                color: decision.enforcement_decision === 'ALLOW' ? '#28a745' :
                       decision.enforcement_decision === 'BLOCK' ? '#dc3545' :
                       decision.enforcement_decision === 'ESCALATE' ? '#fd7e14' : '#6f42c1',
                fontSize: '14px',
                fontWeight: '600',
                letterSpacing: '1px'
              }}>
                ENFORCEMENT STATUS
              </div>
              <div style={{ 
                color: '#fff', 
                fontSize: '20px', 
                fontWeight: '700',
                marginTop: '4px'
              }}>
                {decision.enforcement_decision}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>TRACE ID</div>
              <div style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
                {traceId}
              </div>
            </div>
          </div>

          {/* SECTION 1: Case Header */}
          <DocumentSection>
            <SectionHeader number="I" title="Case Header" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>
                  CASE ID
                </div>
                <div style={{ color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}>
                  {decision.trace_id || <PendingIndicator label="CASE ID" />}
                </div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>
                  DATE OF DECISION
                </div>
                <div style={{ color: '#fff', fontSize: '14px' }}>
                  {new Date().toLocaleDateString('en-GB', { 
                    day: '2-digit', month: 'long', year: 'numeric' 
                  })}
                </div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>
                  JURISDICTION
                </div>
                <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                  {decision.jurisdiction_detected || decision.jurisdiction || <PendingIndicator label="JURISDICTION" />}
                </div>
              </div>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>
                  DOMAIN
                </div>
                <div style={{ color: '#fff', fontSize: '14px', textTransform: 'capitalize' }}>
                  {decision.domain || <PendingIndicator label="DOMAIN" />}
                </div>
              </div>
            </div>
          </DocumentSection>

          {/* SECTION 2: Findings of Fact */}
          <DocumentSection>
            <SectionHeader number="II" title="Findings of Fact" />
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>
                PLAINTIFF / APPLICANT
              </div>
              <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                {intakeData.parties.plaintiff || <PendingIndicator label="PLAINTIFF NAME" />}
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>
                DEFENDANT / RESPONDENT
              </div>
              <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600' }}>
                {intakeData.parties.defendant || <PendingIndicator label="DEFENDANT NAME" />}
              </div>
            </div>

            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '8px' }}>
                CASE FACTS (AS PROVIDED)
              </div>
              <div style={{
                padding: '14px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '6px',
                borderLeft: '3px solid #3b82f6'
              }}>
                <p style={{ color: '#fff', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
                  {intakeData.caseDescription}
                </p>
              </div>
            </div>
          </DocumentSection>

          {/* SECTION 3: Analysis / Reasoning */}
          <DocumentSection>
            <SectionHeader number="III" title="Analysis & Reasoning" />
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '8px' }}>
                LEGAL ANALYSIS
              </div>
              <div style={{
                padding: '14px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '6px'
              }}>
                <pre style={{ 
                  color: 'rgba(255,255,255,0.9)', 
                  fontSize: '13px', 
                  lineHeight: '1.7', 
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit'
                }}>
                  {decision.reasoning_trace?.legal_analysis || <PendingIndicator label="LEGAL ANALYSIS" />}
                </pre>
              </div>
            </div>

            {decision.reasoning_trace?.procedural_steps && decision.reasoning_trace.procedural_steps.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '8px' }}>
                  PROCEDURAL STEPS
                </div>
                <ol style={{ 
                  margin: 0, 
                  paddingLeft: '20px', 
                  color: 'rgba(255,255,255,0.9)', 
                  fontSize: '13px',
                  lineHeight: '1.8' 
                }}>
                  {decision.reasoning_trace.procedural_steps.map((step, idx) => (
                    <li key={idx} style={{ marginBottom: '8px' }}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {decision.confidence && (
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '8px' }}>
                  CONFIDENCE ASSESSMENT
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                  {Object.entries(decision.confidence).map(([key, value]) => (
                    <div key={key} style={{
                      padding: '10px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      textAlign: 'center'
                    }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', textTransform: 'capitalize' }}>
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>
                        {Math.round(value * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DocumentSection>

          {/* SECTION 4: Conclusion / Order */}
          <DocumentSection bgColor="rgba(40, 167, 69, 0.05)">
            <SectionHeader number="IV" title="Conclusion & Order" />
            
            <div style={{
              padding: '20px',
              background: decision.enforcement_decision === 'BLOCK' ? 'rgba(220, 53, 69, 0.1)' :
                         decision.enforcement_decision === 'ESCALATE' ? 'rgba(253, 126, 20, 0.1)' :
                         'rgba(40, 167, 69, 0.1)',
              border: `2px solid ${
                decision.enforcement_decision === 'BLOCK' ? '#dc3545' :
                decision.enforcement_decision === 'ESCALATE' ? '#fd7e14' : '#28a745'
              }`,
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ 
                color: decision.enforcement_decision === 'BLOCK' ? '#dc3545' :
                       decision.enforcement_decision === 'ESCALATE' ? '#fd7e14' : '#28a745',
                fontSize: '18px',
                fontWeight: '700',
                textAlign: 'center',
                letterSpacing: '2px'
              }}>
                {decision.enforcement_decision === 'ALLOW' ? 'PROCEED WITH RECOMMENDED ROUTE' :
                 decision.enforcement_decision === 'BLOCK' ? 'PATHWAY BLOCKED' :
                 decision.enforcement_decision === 'ESCALATE' ? 'ESCALATION REQUIRED' :
                 'REDIRECT RECOMMENDED'}
              </div>
            </div>

            {decision.reasoning_trace?.remedies && decision.reasoning_trace.remedies.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '8px' }}>
                  AVAILABLE REMEDIES
                </div>
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: '20px', 
                  color: 'rgba(255,255,255,0.9)', 
                  fontSize: '13px',
                  lineHeight: '1.8' 
                }}>
                  {decision.reasoning_trace.remedies.map((remedy, idx) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{remedy}</li>
                  ))}
                </ul>
              </div>
            )}

            {decision.legal_route && decision.legal_route.length > 0 && (
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '8px' }}>
                  LEGAL ROUTE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {decision.legal_route.map((agent, idx) => (
                    <React.Fragment key={idx}>
                      <span style={{
                        padding: '6px 12px',
                        background: 'rgba(139, 92, 246, 0.2)',
                        border: '1px solid rgba(139, 92, 246, 0.4)',
                        borderRadius: '4px',
                        color: '#a78bfa',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {agent.replace(/_/g, ' ')}
                      </span>
                      {idx < decision.legal_route.length - 1 && (
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </DocumentSection>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            NEW CASE INTAKE
          </button>
        </div>
      )}
    </div>
  )
}

export default LegalDecisionDocument
