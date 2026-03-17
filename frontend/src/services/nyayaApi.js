// Nyaya AI API Integration Service
// Connects frontend to the existing Nyaya AI backend

import axios from 'axios'
import { BASE_URL } from '../lib/apiConfig'

const API_BASE_URL = BASE_URL

// Global failure listeners — registered by useResiliency
const _failureListeners = new Set()
export const onBackendFailure = (fn) => { _failureListeners.add(fn); return () => _failureListeners.delete(fn) }
const _emitFailure = (error) => _failureListeners.forEach(fn => fn(error))

// Configure axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Global interceptor — detects 5xx errors and ECONNREFUSED/timeout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const isServerError = status >= 500
    const isNetworkError = !error.response && (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK' || error.message === 'Network Error')
    const isTimeout = error.code === 'ECONNABORTED'

    if (isServerError || isNetworkError || isTimeout) {
      _emitFailure(error)
    }

    return Promise.reject(error)
  }
)

function generateTraceId() {
  return 'frontend_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// Case Presentation Service - for case presentation components
export const casePresentationService = {
  // Fetch case summary from backend
  async getCaseSummary(traceId, jurisdiction) {
    try {
      const response = await apiClient.get('/nyaya/case_summary', {
        params: { trace_id: traceId, jurisdiction }
      })
      
      return {
        success: true,
        data: this._validateCaseSummary(response.data),
        trace_id: traceId
      }
    } catch (error) {
      // Return empty state with error info for graceful degradation
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch case summary',
        trace_id: traceId,
        data: null
      }
    }
  },

  // Fetch legal routes from backend
  async getLegalRoutes(traceId, jurisdiction, caseType) {
    try {
      const response = await apiClient.get('/nyaya/legal_routes', {
        params: { trace_id: traceId, jurisdiction, case_type: caseType }
      })
      
      return {
        success: true,
        data: this._validateLegalRoutes(response.data),
        trace_id: traceId
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch legal routes',
        trace_id: traceId,
        data: null
      }
    }
  },

  // Fetch timeline events from backend
  async getTimeline(traceId, jurisdiction, caseId) {
    try {
      const response = await apiClient.get('/nyaya/timeline', {
        params: { trace_id: traceId, jurisdiction, case_id: caseId }
      })
      
      return {
        success: true,
        data: this._validateTimeline(response.data),
        trace_id: traceId
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch timeline',
        trace_id: traceId,
        data: null
      }
    }
  },

  // Fetch glossary terms from backend
  async getGlossary(traceId, jurisdiction, caseType) {
    try {
      const response = await apiClient.get('/nyaya/glossary', {
        params: { trace_id: traceId, jurisdiction, case_type: caseType }
      })
      
      return {
        success: true,
        data: this._validateGlossary(response.data),
        trace_id: traceId
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch glossary',
        trace_id: traceId,
        data: null
      }
    }
  },

  // Fetch jurisdiction info from backend
  async getJurisdictionInfo(jurisdiction) {
    try {
      const response = await apiClient.get('/nyaya/jurisdiction_info', {
        params: { jurisdiction }
      })
      
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch jurisdiction info',
        data: null
      }
    }
  },

  // Fetch enforcement status from backend
  async getEnforcementStatus(traceId, jurisdiction) {
    try {
      const response = await apiClient.get('/nyaya/enforcement_status', {
        params: { trace_id: traceId, jurisdiction }
      })
      
      return {
        success: true,
        data: this._validateEnforcementStatus(response.data),
        trace_id: traceId
      }
    } catch (error) {
      // Return empty status on error - don't break the UI
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch enforcement status',
        trace_id: traceId,
        data: { state: 'clear', reason: '', safe_explanation: '' }
      }
    }
  },

  // Validate enforcement status
  _validateEnforcementStatus(data) {
    if (!data || typeof data !== 'object') {
      return {
        state: 'clear',
        reason: '',
        blocked_path: null,
        escalation_required: false,
        escalation_target: null,
        redirect_suggestion: null,
        safe_explanation: '',
        trace_id: null
      }
    }
    
    return {
      state: ['block', 'escalate', 'soft_redirect', 'conditional', 'clear'].includes(data.state) ? data.state : 'clear',
      reason: data.reason || '',
      blocked_path: data.blocked_path || null,
      escalation_required: Boolean(data.escalation_required),
      escalation_target: data.escalation_target || null,
      redirect_suggestion: data.redirect_suggestion || null,
      safe_explanation: data.safe_explanation || '',
      trace_id: data.trace_id || null
    }
  },

  // Fetch all case presentation data in parallel
  async getAllCaseData(traceId, jurisdiction, caseType, caseId) {
    try {
      const [caseSummary, legalRoutes, timeline, glossary, jurisdictionInfo] = await Promise.all([
        this.getCaseSummary(traceId, jurisdiction),
        this.getLegalRoutes(traceId, jurisdiction, caseType),
        this.getTimeline(traceId, jurisdiction, caseId),
        this.getGlossary(traceId, jurisdiction, caseType),
        this.getJurisdictionInfo(jurisdiction)
      ])
      
      return {
        success: true,
        data: {
          caseSummary: caseSummary.data,
          legalRoutes: legalRoutes.data,
          timeline: timeline.data,
          glossary: glossary.data,
          jurisdictionInfo: jurisdictionInfo.data
        },
        trace_id: traceId
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch case data',
        data: null
      }
    }
  },

  // Validation methods for empty/partial/edge cases
  _validateCaseSummary(data) {
    if (!data || typeof data !== 'object') {
      return {
        caseId: null,
        title: null,
        overview: null,
        keyFacts: [],
        jurisdiction: null,
        confidence: null,
        summaryAnalysis: null,
        dateFiled: null,
        status: null,
        parties: null
      }
    }
    
    return {
      caseId: data.caseId || null,
      title: data.title || null,
      overview: data.overview || null,
      keyFacts: Array.isArray(data.keyFacts) ? data.keyFacts : [],
      jurisdiction: data.jurisdiction || null,
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
      summaryAnalysis: data.summaryAnalysis || null,
      dateFiled: data.dateFiled || null,
      status: data.status || null,
      parties: data.parties || null
    }
  },

  _validateLegalRoutes(data) {
    if (!data || typeof data !== 'object') {
      return {
        routes: [],
        jurisdiction: null,
        caseType: null
      }
    }
    
    return {
      routes: Array.isArray(data.routes) ? data.routes.map(route => ({
        name: route.name || 'Unknown Route',
        description: route.description || '',
        recommendation: route.recommendation || '',
        suitability: typeof route.suitability === 'number' ? route.suitability : 0.5,
        estimatedDuration: route.estimatedDuration || null,
        estimatedCost: route.estimatedCost || null,
        pros: Array.isArray(route.pros) ? route.pros : [],
        cons: Array.isArray(route.cons) ? route.cons : []
      })) : [],
      jurisdiction: data.jurisdiction || null,
      caseType: data.caseType || null
    }
  },

  _validateTimeline(data) {
    if (!data || typeof data !== 'object') {
      return {
        events: [],
        jurisdiction: null,
        caseId: null
      }
    }
    
    return {
      events: Array.isArray(data.events) ? data.events.map(event => ({
        id: event.id || `event_${Math.random().toString(36).substr(2, 9)}`,
        date: event.date || new Date().toISOString(),
        title: event.title || 'Untitled Event',
        description: event.description || '',
        type: ['event', 'deadline', 'milestone', 'step'].includes(event.type) ? event.type : 'event',
        status: ['completed', 'pending', 'overdue'].includes(event.status) ? event.status : 'pending',
        documents: Array.isArray(event.documents) ? event.documents : [],
        parties: Array.isArray(event.parties) ? event.parties : []
      })) : [],
      jurisdiction: data.jurisdiction || null,
      caseId: data.caseId || null
    }
  },

  _validateGlossary(data) {
    if (!data || typeof data !== 'object') {
      return {
        terms: [],
        jurisdiction: null,
        caseType: null
      }
    }
    
    return {
      terms: Array.isArray(data.terms) ? data.terms.map(term => ({
        term: term.term || 'Unknown Term',
        definition: term.definition || '',
        context: term.context || null,
        relatedTerms: Array.isArray(term.relatedTerms) ? term.relatedTerms : [],
        jurisdiction: term.jurisdiction || null,
        confidence: typeof term.confidence === 'number' ? term.confidence : null
      })) : [],
      jurisdiction: data.jurisdiction || null,
      caseType: data.caseType || null
    }
  }
}

// Legal Query Service
export const legalQueryService = {
  // Single jurisdiction query
  async submitQuery(queryData) {
    try {
      const payload = {
        query: queryData.query,
        jurisdiction_hint: queryData.jurisdiction_hint || 'India',
        user_context: {
          role: 'citizen',
          confidence_required: true
        }
      }
      
      // Only add domain_hint if provided
      if (queryData.domain_hint) {
        payload.domain_hint = queryData.domain_hint
      }
      
      console.log('API Request Payload:', payload)
      
      const response = await apiClient.post('/nyaya/query', payload)
      
      return {
        success: true,
        data: response.data,
        trace_id: response.data.trace_id
      }
    } catch (error) {
      console.error('API Error Details:', error.response?.data)
      
      // Extract error message from FastAPI validation error
      let errorMessage = 'Query failed'
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          // FastAPI validation errors are arrays
          errorMessage = error.response.data.detail.map(err => 
            `${err.loc.join('.')}: ${err.msg}`
          ).join(', ')
        } else if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      }
      
      return {
        success: false,
        error: errorMessage,
        trace_id: error.response?.data?.trace_id
      }
    }
  },

  // Multi-jurisdiction query
  async submitMultiJurisdictionQuery(queryData) {
    try {
      const response = await apiClient.post('/nyaya/multi_jurisdiction', {
        query: queryData.query,
        jurisdictions: queryData.jurisdictions
      })
      
      return {
        success: true,
        data: response.data,
        trace_id: response.data.trace_id
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Multi-jurisdiction query failed',
        trace_id: error.response?.data?.trace_id
      }
    }
  },

  // Explain reasoning
  async explainReasoning(traceId, explanationLevel = 'detailed') {
    try {
      const response = await apiClient.post('/nyaya/explain_reasoning', {
        trace_id: traceId,
        explanation_level: explanationLevel
      })
      
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Reasoning explanation failed'
      }
    }
  },

  // Submit feedback for RL engine
  async submitFeedback(feedbackData) {
    try {
      const response = await apiClient.post('/nyaya/feedback', {
        trace_id: feedbackData.trace_id,
        rating: feedbackData.rating,
        feedback_type: feedbackData.feedback_type || 'correctness',
        comment: feedbackData.comment
      })
      
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Feedback submission failed'
      }
    }
  },

  // Get trace information
  async getTrace(traceId) {
    try {
      const response = await apiClient.get(`/nyaya/trace/${traceId}`)

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Trace retrieval failed'
      }
    }
  },

  // Send RL training signal
  async sendRLSignal({ trace_id, helpful, clear, match }) {
    // Validate input - no UI-side learning logic
    if (!trace_id || typeof trace_id !== 'string' || trace_id.trim().length === 0) {
      return {
        success: false,
        error: 'Invalid trace_id - RL signal cannot be sent'
      }
    }

    // Validate boolean fields
    if (typeof helpful !== 'boolean' || typeof clear !== 'boolean' || typeof match !== 'boolean') {
      return {
        success: false,
        error: 'Invalid signal values - all signals must be boolean'
      }
    }

    try {
      const response = await apiClient.post('/nyaya/rl_signal', {
        trace_id,
        helpful,
        clear,
        match
      })

      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'RL signal send failed'
      }
    }
  }
}

// Health check service
export const healthService = {
  async checkHealth() {
    try {
      const response = await apiClient.get('/health')
      return {
        success: true,
        data: response.data
      }
    } catch (error) {
      return {
        success: false,
        error: 'Backend service unavailable'
      }
    }
  }
}

// Procedure Service - New endpoints
export const procedureService = {
  async analyzeProcedure(data) {
    try {
      const response = await apiClient.post('/nyaya/procedures/analyze', data)
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async getProcedureSummary(country, domain) {
    try {
      const response = await apiClient.get(`/nyaya/procedures/summary/${country}/${domain}`)
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async assessEvidence(data) {
    try {
      const response = await apiClient.post('/nyaya/procedures/evidence/assess', data)
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async analyzeFailure(data) {
    try {
      const response = await apiClient.post('/nyaya/procedures/failure/analyze', data)
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async compareProcedures(data) {
    try {
      const response = await apiClient.post('/nyaya/procedures/compare', data)
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async listProcedures() {
    try {
      const response = await apiClient.get('/nyaya/procedures/list')
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async getSchemas() {
    try {
      const response = await apiClient.get('/nyaya/procedures/schemas')
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async getEnhancedAnalysis(jurisdiction, domain) {
    try {
      const response = await apiClient.get(`/nyaya/procedures/enhanced_analysis/${jurisdiction}/${domain}`)
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async getDomainClassification(jurisdiction) {
    try {
      const response = await apiClient.get(`/nyaya/procedures/domain_classification/${jurisdiction}`)
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  },

  async getLegalSections(jurisdiction, domain) {
    try {
      const response = await apiClient.get(`/nyaya/procedures/legal_sections/${jurisdiction}/${domain}`)
      return { success: true, data: response.data }
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message }
    }
  }
}

export default {
  legalQuery: legalQueryService,
  casePresentation: casePresentationService,
  health: healthService,
  procedure: procedureService
}

// Export the sendRLSignal function directly for convenience
export const sendRLSignal = legalQueryService.sendRLSignal