import React, { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import LegalActionPanel from './components/LegalActionPanel.jsx'
import LegalQuestionInterface from './components/LegalQuestionInterface.jsx'
import DocumentUpload from './components/DocumentUpload.jsx'

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [activeAction, setActiveAction] = useState(null)

  const renderMainContent = () => {
    // If an action is selected, show the action interface
    if (activeAction) {
      switch (activeAction) {
        case 'ask':
          return <LegalQuestionInterface />
        case 'upload':
          return <DocumentUpload />
        case 'draft':
          return (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✍️</div>
              <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '12px' }}>
                Generate Legal Draft
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                Coming soon - Create contracts, notices, and legal documents
              </p>
            </div>
          )
        case 'summarize':
          return (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
              <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '12px' }}>
                Summarize Case Law
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                Coming soon - Extract key insights from judgments
              </p>
            </div>
          )
        case 'compliance':
          return (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '32px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
              <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '12px' }}>
                Check Compliance
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                Coming soon - Verify regulatory compliance
              </p>
            </div>
          )
        default:
          return null
      }
    }

    // Otherwise show view-based content
    switch (activeView) {
      case 'dashboard':
        return (
          <>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
                Legal Research Operating System
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                Multi-jurisdictional legal intelligence powered by sovereign AI
              </p>
            </div>
            <LegalActionPanel onActionSelect={setActiveAction} />
            <Dashboard />
          </>
        )
      case 'research':
        return (
          <>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
                Legal Research
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                Ask questions and get instant legal analysis
              </p>
            </div>
            <LegalQuestionInterface />
          </>
        )
      case 'documents':
        return (
          <>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
                Document Analysis
              </h1>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                Upload and analyze legal documents
              </p>
            </div>
            <DocumentUpload />
          </>
        )
      default:
        return (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '12px' }}>
              {activeView.charAt(0).toUpperCase() + activeView.slice(1)}
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
              This section is under development
            </p>
          </div>
        )
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 50%, #16213e 100%)',
      display: 'flex'
    }}>
      {/* Sidebar Navigation */}
      <Sidebar activeView={activeView} onViewChange={(view) => {
        setActiveView(view)
        setActiveAction(null)
      }} />

      {/* Main Content Area */}
      <div style={{
        marginLeft: '240px',
        flex: 1,
        padding: '32px',
        minHeight: '100vh'
      }}>
        {/* Back Button */}
        {activeAction && (
          <button
            onClick={() => setActiveAction(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '13px',
              cursor: 'pointer',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ← Back to Dashboard
          </button>
        )}

        {renderMainContent()}
      </div>
    </div>
  )
}

export default App
