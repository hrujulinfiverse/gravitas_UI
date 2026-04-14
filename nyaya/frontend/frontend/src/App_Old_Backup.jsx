import React, { useState, useEffect, useCallback } from 'react'
import LegalQueryCard from './components/LegalQueryCard.jsx'
import MultiJurisdictionCard from './components/MultiJurisdictionCard.jsx'
import LegalConsultationCard from './components/LegalConsultationCard.jsx'
import CaseSummaryCard from './components/CaseSummaryCard.jsx'
import LegalRouteCard from './components/LegalRouteCard.jsx'
import TimelineCard from './components/TimelineCard.jsx'
import GlossaryCard from './components/GlossaryCard.jsx'
import JurisdictionInfoBar from './components/JurisdictionInfoBar.jsx'
import EnforcementStatusCard from './components/EnforcementStatusCard.jsx'
import SkeletonLoader from './components/SkeletonLoader.jsx'
import GlareHover from './components/GlareHover.jsx'
import AnimatedText from './components/AnimatedText.jsx'
import { casePresentationService } from './services/nyayaApi.js'

// Sample data for testing case presentation components
const sampleCaseSummary = {
  caseId: "CASE-2024-001",
  title: "Breach of Contract Dispute - Software Development Services",
  overview: "A dispute arising from alleged non-performance of software development services under a fixed-price contract valued at INR 2,500,000.",
  keyFacts: [
    "Contract signed on 15th March 2024 with delivery deadline of 30th June 2024",
    "Plaintiff alleges incomplete delivery and poor quality of deliverables",
    "Defendant claims force majeure due to COVID-19 related restrictions",
    "Multiple email communications and project management records available"
  ],
  jurisdiction: "India",
  confidence: 0.87,
  summaryAnalysis: "This appears to be a straightforward breach of contract case under Indian law. The Indian Contract Act, 1872, and relevant provisions of the Specific Relief Act, 1963, would govern the dispute. Key considerations include force majeure clauses, limitation periods, and availability of specific performance as a remedy.",
  dateFiled: "2024-07-15",
  status: "Pre-litigation",
  parties: {
    plaintiff: "TechSolutions Pvt Ltd",
    defendant: "DevCorp India"
  }
};

const sampleLegalRoutes = {
  routes: [
    {
      name: "Mediation",
      description: "Non-binding dispute resolution through a neutral third-party mediator who facilitates negotiation between parties.",
      recommendation: "Highly recommended as first step due to lower cost and faster resolution. Suitable for commercial disputes where relationship preservation is important.",
      suitability: 0.95,
      estimatedDuration: "2-4 weeks",
      estimatedCost: "INR 50,000-100,000",
      pros: [
        "Confidential process",
        "Preserves business relationships",
        "Lower cost than litigation",
        "Flexible outcomes"
      ],
      cons: [
        "Non-binding nature",
        "Requires mutual agreement to participate"
      ]
    },
    {
      name: "Arbitration",
      description: "Binding dispute resolution through private arbitration tribunal, often faster than court litigation.",
      recommendation: "Strong alternative to litigation for commercial contracts. Consider if contract contains arbitration clause.",
      suitability: 0.85,
      estimatedDuration: "3-6 months",
      estimatedCost: "INR 200,000-500,000",
      pros: [
        "Binding decision",
        "Expert arbitrators in technical fields",
        "Confidential proceedings",
        "Enforceable under New York Convention"
      ],
      cons: [
        "Limited appeal options",
        "May still be costly for small claims"
      ]
    },
    {
      name: "Civil Litigation",
      description: "Formal court proceedings through the Indian civil court system, including district courts and high courts.",
      recommendation: "Consider only after exhausting ADR options. Suitable when specific performance or injunction is required.",
      suitability: 0.60,
      estimatedDuration: "1-3 years",
      estimatedCost: "INR 300,000-1,000,000+",
      pros: [
        "Binding court judgment",
        "Right to appeal",
        "Public record",
        "Wide range of remedies available"
      ],
      cons: [
        "Lengthy process",
        "High costs",
        "Public nature may damage reputation",
        "Court backlog in India"
      ]
    }
  ],
  jurisdiction: "India",
  caseType: "Commercial Contract Dispute"
};

const sampleTimeline = {
  events: [
    {
      id: "contract-signing",
      date: "2024-03-15",
      title: "Contract Signing",
      description: "Fixed-price software development contract signed between TechSolutions Pvt Ltd and DevCorp India for INR 2,500,000.",
      type: "milestone",
      status: "completed",
      documents: ["Contract_Agreement_2024.pdf"],
      parties: ["TechSolutions Pvt Ltd", "DevCorp India"]
    },
    {
      id: "project-deadline",
      date: "2024-06-30",
      title: "Project Delivery Deadline",
      description: "Original deadline for project completion as per contract terms.",
      type: "deadline",
      status: "completed",
      documents: ["Project_Scope_Document.pdf"]
    },
    {
      id: "delay-notification",
      date: "2024-07-05",
      title: "Delay Notification",
      description: "TechSolutions notified DevCorp of project delays and quality issues via email.",
      type: "event",
      status: "completed",
      documents: ["Delay_Notice_Email_2024.pdf"]
    },
    {
      id: "force-majeure-claim",
      date: "2024-07-10",
      title: "Force Majeure Claim",
      description: "DevCorp invoked force majeure clause citing COVID-19 restrictions affecting development team.",
      type: "event",
      status: "completed",
      documents: ["Force_Majeure_Notice.pdf"]
    },
    {
      id: "mediation-request",
      date: "2024-07-15",
      title: "Mediation Request",
      description: "Formal request for mediation filed with Indian Institute of Arbitration and Mediation.",
      type: "step",
      status: "pending",
      documents: ["Mediation_Request_Form.pdf"]
    },
    {
      id: "limitation-deadline",
      date: "2025-06-30",
      title: "Limitation Period Expires",
      description: "Three-year limitation period under Indian Limitation Act, 1963, for contract disputes.",
      type: "deadline",
      status: "pending"
    }
  ],
  jurisdiction: "India",
  caseId: "CASE-2024-001"
};

const sampleGlossary = {
  terms: [
    {
      term: "Breach of Contract",
      definition: "Violation of any term or condition of a contract without lawful excuse. Under Indian law, breach occurs when a party fails to perform their obligations as stipulated in the agreement.",
      context: "The plaintiff alleges that the defendant committed breach by failing to deliver the software within the agreed timeframe and to the specified quality standards.",
      relatedTerms: ["Material Breach", "Anticipatory Breach", "Remedies for Breach"],
      jurisdiction: "India"
    },
    {
      term: "Force Majeure",
      definition: "A clause in contracts that frees both parties from liability or obligation when an extraordinary event or circumstance beyond their control occurs, such as natural disasters, wars, or pandemics.",
      context: "The defendant has invoked the force majeure clause citing COVID-19 restrictions as preventing timely project completion.",
      relatedTerms: ["Act of God", "Frustration of Contract"],
      jurisdiction: "India"
    },
    {
      term: "Specific Performance",
      definition: "A court-ordered remedy requiring a party to perform their contractual obligations exactly as agreed, rather than paying damages. Available under Section 10 of the Specific Relief Act, 1963.",
      context: "The plaintiff may seek specific performance to compel the defendant to complete the software development work.",
      relatedTerms: ["Injunction", "Damages", "Quantum Meruit"],
      jurisdiction: "India"
    },
    {
      term: "Limitation Period",
      definition: "The maximum time period within which a legal action must be initiated after the cause of action arises. For contract disputes in India, this is generally three years under Article 55 of the Limitation Act, 1963.",
      context: "The limitation period for this contract dispute began from the date of the alleged breach (June 30, 2024) and will expire on June 30, 2027.",
      relatedTerms: ["Cause of Action", "Statute of Limitations"],
      jurisdiction: "India"
    },
    {
      term: "Arbitration Agreement",
      definition: "A clause in a contract that requires disputes to be resolved through arbitration rather than litigation. Governed by the Arbitration and Conciliation Act, 1996 in India.",
      context: "The contract contains an arbitration clause requiring disputes to be resolved through the Indian Council of Arbitration.",
      relatedTerms: ["Arbitral Tribunal", "Arbitral Award"],
      jurisdiction: "India"
    }
  ],
  jurisdiction: "India",
  caseType: "Commercial Contract Dispute"
};

const sampleJurisdictionInfo = {
  country: "India",
  courtSystem: "Indian Judicial System",
  authorityFraming: "Formal and procedural, emphasizing due process and evidence-based decisions",
  emergencyGuidance: "File FIR at nearest Police Station, contact local magistrate for immediate orders"
};

// Case Presentation Component - Wires components to real backend data
const CasePresentation = ({ traceId, jurisdiction, caseType, caseId, useDemoData = false }) => {
  const [caseData, setCaseData] = useState({
    caseSummary: null,
    legalRoutes: null,
    timeline: null,
    glossary: null,
    jurisdictionInfo: null,
    enforcementStatus: null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentJurisdiction, setCurrentJurisdiction] = useState(jurisdiction || 'India')
  const [retryCount, setRetryCount] = useState(0)

  // Fetch all case data from backend including enforcement status
  const fetchCaseData = useCallback(async () => {
    // Demo mode: Use sample data only when explicitly enabled
    if (useDemoData || !traceId) {
      setCaseData({
        caseSummary: sampleCaseSummary,
        legalRoutes: sampleLegalRoutes,
        timeline: sampleTimeline,
        glossary: sampleGlossary,
        jurisdictionInfo: sampleJurisdictionInfo,
        enforcementStatus: null
      })
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch case data and enforcement status in parallel
      const [caseResult, enforcementResult] = await Promise.all([
        casePresentationService.getAllCaseData(traceId, currentJurisdiction, caseType, caseId),
        casePresentationService.getEnforcementStatus(traceId, currentJurisdiction)
      ])

      // Get enforcement status data
      const enforcementStatus = enforcementResult.success ? enforcementResult.data : null

      if (caseResult.success) {
        // Use real backend data - no fallback to sample data
        setCaseData({
          caseSummary: caseResult.data.caseSummary,
          legalRoutes: caseResult.data.legalRoutes,
          timeline: caseResult.data.timeline,
          glossary: caseResult.data.glossary,
          jurisdictionInfo: caseResult.data.jurisdictionInfo,
          enforcementStatus: enforcementStatus
        })
      } else {
        // Real error - no fallback to sample data
        setError(caseResult.error || 'Failed to load case data from backend')
        setCaseData({
          caseSummary: null,
          legalRoutes: null,
          timeline: null,
          glossary: null,
          jurisdictionInfo: null,
          enforcementStatus: enforcementStatus
        })
      }
    } catch (err) {
      setError(err.message || 'Failed to load case data')
      setCaseData({
        caseSummary: null,
        legalRoutes: null,
        timeline: null,
        glossary: null,
        jurisdictionInfo: null,
        enforcementStatus: null
      })
    } finally {
      setLoading(false)
    }
  }, [traceId, currentJurisdiction, caseType, caseId, useDemoData, retryCount])

  // Fetch data on mount and when jurisdiction changes
  useEffect(() => {
    fetchCaseData()
  }, [fetchCaseData])

  // Handle jurisdiction change
  const handleJurisdictionChange = (newJurisdiction) => {
    setCurrentJurisdiction(newJurisdiction)
    setRetryCount(0) // Reset retry count on jurisdiction change
    fetchCaseData()
  }

  // Handle retry on error
  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {/* Loading skeleton for case presentation */}
        <div className="consultation-card" style={{ padding: '30px' }}>
          <SkeletonLoader type="card" count={5} />
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p style={{ color: '#6c757d', fontSize: '14px' }}>
              Fetching case data from backend for {currentJurisdiction} jurisdiction...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Error notification with retry option */}
      {error && (
        <div style={{
          padding: '20px',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          border: '1px solid rgba(220, 53, 69, 0.3)',
          borderRadius: '8px',
          color: '#721c24'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            gap: '15px'
          }}>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Error Loading Case Data
              </strong>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
                {error}. The backend may be unreachable or returned an unexpected response.
              </p>
            </div>
            <button
              onClick={handleRetry}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                whiteSpace: 'nowrap'
              }}
            >
              Retry ({retryCount})
            </button>
          </div>
        </div>
      )}

      {/* Jurisdiction Switcher */}
      <div className="consultation-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
          <h3 style={{ margin: 0, color: '#2c3e50', fontWeight: '600' }}>Select Jurisdiction</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['India', 'UK', 'UAE'].map((j) => (
              <button
                key={j}
                onClick={() => handleJurisdictionChange(j)}
                style={{
                  padding: '10px 20px',
                  border: currentJurisdiction === j ? '2px solid #007bff' : '2px solid #e9ecef',
                  borderRadius: '8px',
                  backgroundColor: currentJurisdiction === j ? 'rgba(0, 123, 255, 0.1)' : '#fff',
                  color: currentJurisdiction === j ? '#007bff' : '#495057',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
              >
                {j}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Enforcement Status Card - Shows BLOCK, ESCALATE, SOFT_REDIRECT states */}
      <EnforcementStatusCard 
        enforcementStatus={caseData.enforcementStatus} 
        traceId={traceId}
      />

      {/* Jurisdiction Info Bar */}
      <JurisdictionInfoBar jurisdiction={caseData.jurisdictionInfo} />

      {/* Case Summary Card */}
      <CaseSummaryCard {...caseData.caseSummary} traceId={traceId} />

      {/* Legal Route Card */}
      <LegalRouteCard {...caseData.legalRoutes} traceId={traceId} />

      {/* Timeline Card */}
      <TimelineCard {...caseData.timeline} traceId={traceId} />

      {/* Glossary Card */}
      <GlossaryCard {...caseData.glossary} traceId={traceId} />
    </div>
  )
}

function App() {
  const [activeCard, setActiveCard] = useState('query')
  const [queryResult, setQueryResult] = useState(null)
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('India')

  // Handle query submission and extract trace ID
  const handleQuerySubmit = async (queryData) => {
    try {
      const result = await casePresentationService.submitQuery(queryData)
      if (result.success) {
        setQueryResult(result)
      }
    } catch (error) {
      console.error('Query submission error:', error)
    }
  }

  // Handle jurisdiction selection from query results
  const handleJurisdictionSelect = (jurisdiction) => {
    setSelectedJurisdiction(jurisdiction)
    setActiveCard('case')
  }

  const renderActiveCard = () => {
    switch (activeCard) {
      case 'query':
        return <LegalQueryCard onSubmit={handleQuerySubmit} onJurisdictionSelect={handleJurisdictionSelect} />
      case 'multi':
        return <MultiJurisdictionCard />
      case 'consultation':
        return <LegalConsultationCard />
      case 'case':
        return (
          <CasePresentation
            traceId={queryResult?.trace_id || null}
            jurisdiction={selectedJurisdiction}
            caseType="General Legal Matter"
            caseId="CASE-2024-001"
          />
        )
      case 'test':
        return (
          <CasePresentation
            traceId={null}
            jurisdiction={selectedJurisdiction}
            caseType="General Legal Matter"
            caseId="CASE-2024-001"
          />
        )
      default:
        return <LegalQueryCard onSubmit={handleQuerySubmit} onJurisdictionSelect={handleJurisdictionSelect} />
    }
  }

  return (
    <div className="container" style={{ paddingTop: '100px' }}>
      {/* Floating Pill-Shaped Glassmorphism Navbar */}
      <nav style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '10px',
        padding: '12px 24px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '9999px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px'
        }}>
          ⚖️
        </div>
        <span style={{
          fontSize: '16px',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Nyaya AI
        </span>
      </nav>

      {/* Active Consultation Card */}
      <div className="consultation-grid">
        {renderActiveCard()}
      </div>
    </div>
  )
}

export default App