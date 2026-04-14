import axios from 'axios'
import { validateDecisionContract } from '../../../packages/shared/decision_contract'

// Centralized Axios configuration for Nyaya frontend
const NYAYA_API_BASE = 'https://nyaya-ai-0f02.onrender.com'

export const nyayaApiClient = axios.create({
  baseURL: NYAYA_API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Type': 'nyaya-frontend',
    'X-Request-Source': 'unified-pipeline'
  }
})

// Request interceptor to add unified pipeline metadata
nyayaApiClient.interceptors.request.use(
  (config) => {
    // Add pipeline entry point metadata
    config.headers['X-Pipeline-Entry'] = 'black-box-execution'
    config.headers['X-No-Bypass'] = 'true'
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for unified error handling and validation
nyayaApiClient.interceptors.response.use(
  (response) => {
    // First, check Formatted metadata (pipeline integrity)
    if (!response.data?.metadata?.Formatted) {
      console.error('Security Alert: Response did not pass through Formatter. Raw data leak detected.')
      throw new Error('UNFORMATTED_RESPONSE: Response rejected due to missing Formatted metadata tag')
    }

    // Validate against DecisionContract schema (data integrity)
    try {
      validateDecisionContract(response.data)
      console.log('✅ DecisionContract: Schema validation passed')
    } catch (validationError) {
      console.error('Schema Validation Error:', validationError.message)
      throw new Error(`INVALID_CONTRACT: ${validationError.message}`)
    }

    // Log successful validated response
    console.log('✅ Unified Pipeline: Response validated against DecisionContract')
    return response
  },
  (error) => {
    // Enhanced error handling for pipeline failures
    if (error.response?.data?.message?.includes('Formatted')) {
      console.error('Pipeline Security: Raw data leak prevented')
    }

    console.error('Nyaya API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default nyayaApiClient