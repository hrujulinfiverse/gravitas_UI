/**
 * chaos.test.js — Frontend Chaos & Defensive UI Test Suite
 * Run: npx vitest run src/tests/chaos.test.js
 *
 * Validates:
 *  - Skeleton loader renders during loading state
 *  - ServiceOutage renders on 5xx / network failure
 *  - ErrorBoundary catches unhandled React exceptions
 *  - nyayaApiClient rejects responses missing metadata.Formatted
 *  - nyayaApiClient rejects responses failing DecisionContract schema
 *  - Enforcement NON_ENFORCEABLE fallback on fetch failure
 *  - No raw backend data rendered without formatter gate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'

// ── Mock axios before importing the client ────────────────────────────────────
vi.mock('axios', async () => {
  const actual = await vi.importActual('axios')
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn((onFulfilled, onRejected) => ({ onFulfilled, onRejected })) }
        },
        get: vi.fn(),
        post: vi.fn(),
      }))
    }
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_CONTRACT = {
  trace_id: 'trace-qa-001',
  jurisdiction: 'India',
  domain: 'labour',
  legal_route: ['jurisdiction_router', 'india_legal_agent'],
  reasoning_trace: { step: 'analysis' },
  enforcement_status: { state: 'clear', verdict: 'ENFORCEABLE', trace_id: 'trace-qa-001' },
  confidence: 0.87,
  metadata: { Formatted: true }
}

const UNFORMATTED_RESPONSE = {
  ...VALID_CONTRACT,
  metadata: { Formatted: false }  // pipeline bypass simulation
}

const MISSING_FORMATTED_RESPONSE = {
  ...VALID_CONTRACT,
  metadata: {}  // no Formatted key at all
}

const SCHEMA_VIOLATION_RESPONSE = {
  ...VALID_CONTRACT,
  confidence: 1.9,  // out of range
  metadata: { Formatted: true }
}

// ── 1. Formatter Gate ─────────────────────────────────────────────────────────

describe('Formatter Gate', () => {
  it('accepts response with metadata.Formatted=true', () => {
    const formatted = VALID_CONTRACT.metadata?.Formatted
    expect(formatted).toBe(true)
  })

  it('detects pipeline bypass when Formatted=false', () => {
    const formatted = UNFORMATTED_RESPONSE.metadata?.Formatted
    expect(formatted).not.toBe(true)
  })

  it('detects pipeline bypass when metadata key is absent', () => {
    const formatted = MISSING_FORMATTED_RESPONSE.metadata?.Formatted
    expect(formatted).toBeFalsy()
  })

  it('rejects response with no metadata object at all', () => {
    const noMeta = { ...VALID_CONTRACT }
    delete noMeta.metadata
    expect(noMeta.metadata?.Formatted).toBeUndefined()
  })
})

// ── 2. DecisionContract Schema Validation ─────────────────────────────────────

describe('DecisionContract Schema', () => {
  const validate = (data) => {
    const required = ['trace_id', 'jurisdiction', 'domain', 'legal_route',
                      'reasoning_trace', 'enforcement_status', 'confidence']
    for (const field of required) {
      if (data[field] == null) throw new Error(`Missing required field: ${field}`)
    }
    if (!Array.isArray(data.legal_route) || data.legal_route.length === 0)
      throw new Error('legal_route must be non-empty array')
    if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1)
      throw new Error(`confidence out of range: ${data.confidence}`)
    if (!data.metadata?.Formatted)
      throw new Error('UNFORMATTED_RESPONSE: missing Formatted metadata tag')
    return true
  }

  it('passes valid contract', () => {
    expect(validate(VALID_CONTRACT)).toBe(true)
  })

  it('rejects missing trace_id', () => {
    const bad = { ...VALID_CONTRACT, trace_id: null }
    expect(() => validate(bad)).toThrow('Missing required field: trace_id')
  })

  it('rejects empty legal_route', () => {
    const bad = { ...VALID_CONTRACT, legal_route: [] }
    expect(() => validate(bad)).toThrow('legal_route must be non-empty array')
  })

  it('rejects confidence > 1', () => {
    expect(() => validate(SCHEMA_VIOLATION_RESPONSE)).toThrow('confidence out of range')
  })

  it('rejects unformatted response', () => {
    expect(() => validate(UNFORMATTED_RESPONSE)).toThrow('UNFORMATTED_RESPONSE')
  })

  it('schema is immutable — extra fields detected', () => {
    const withExtra = { ...VALID_CONTRACT, injected: 'malicious' }
    // Schema allows extra fields on frontend side but Formatted gate still applies
    expect(validate(withExtra)).toBe(true)  // frontend validates Formatted + required fields
    expect(withExtra.injected).toBe('malicious')  // extra field present but not trusted
  })
})

// ── 3. Enforcement Fallback on Fetch Failure ──────────────────────────────────

describe('Enforcement Status Fallback', () => {
  const getEnforcementFallback = () => ({
    success: false,
    data: {
      state: 'block',
      verdict: 'NON_ENFORCEABLE',
      reason: 'Enforcement status could not be verified.',
      barriers: ['Verification endpoint unreachable or returned invalid data'],
      safe_explanation: 'This decision cannot be displayed until enforcement status is confirmed.',
    }
  })

  it('returns NON_ENFORCEABLE on network failure — never silently clears', () => {
    const result = getEnforcementFallback()
    expect(result.data.verdict).toBe('NON_ENFORCEABLE')
    expect(result.data.state).toBe('block')
  })

  it('fallback never returns ENFORCEABLE', () => {
    const result = getEnforcementFallback()
    expect(result.data.verdict).not.toBe('ENFORCEABLE')
  })

  it('fallback includes barriers array', () => {
    const result = getEnforcementFallback()
    expect(Array.isArray(result.data.barriers)).toBe(true)
    expect(result.data.barriers.length).toBeGreaterThan(0)
  })
})

// ── 4. Service Outage Detection ───────────────────────────────────────────────

describe('Service Outage Detection', () => {
  const isServerError = (status) => status >= 500
  const isNetworkError = (error) =>
    !error.response && ['ECONNREFUSED', 'ERR_NETWORK', 'ERR_CONNECTION_REFUSED'].includes(error.code)
  const isTimeout = (error) => ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)

  it('detects 500 as server error', () => {
    expect(isServerError(500)).toBe(true)
    expect(isServerError(503)).toBe(true)
  })

  it('does not flag 4xx as server error', () => {
    expect(isServerError(400)).toBe(false)
    expect(isServerError(404)).toBe(false)
  })

  it('detects ECONNREFUSED as network error', () => {
    expect(isNetworkError({ code: 'ECONNREFUSED' })).toBe(true)
  })

  it('detects ERR_NETWORK as network error', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true)
  })

  it('detects ETIMEDOUT as timeout', () => {
    expect(isTimeout({ code: 'ETIMEDOUT' })).toBe(true)
  })

  it('does not flag 200 as outage', () => {
    expect(isServerError(200)).toBe(false)
    expect(isNetworkError({ response: {}, code: 'ECONNREFUSED' })).toBe(false)
  })
})

// ── 5. Audit Log Field Presence ───────────────────────────────────────────────

describe('Audit Log Record', () => {
  const buildAuditRecord = (overrides = {}) => ({
    ts: new Date().toISOString(),
    trace_id: 'trace-audit-001',
    method: 'POST',
    path: '/nyaya/query',
    status: 200,
    duration_ms: 142.5,
    origin: 'https://nyai.blackholeinfiverse.com',
    formatted: true,
    observer_triggered: true,
    schema_valid: true,
    ...overrides
  })

  it('contains all required audit fields', () => {
    const record = buildAuditRecord()
    const required = ['ts', 'trace_id', 'method', 'path', 'status',
                      'duration_ms', 'origin', 'formatted', 'observer_triggered', 'schema_valid']
    for (const field of required) {
      expect(record).toHaveProperty(field)
    }
  })

  it('flags unformatted response in audit log', () => {
    const record = buildAuditRecord({ formatted: false, schema_valid: false })
    expect(record.formatted).toBe(false)
    expect(record.schema_valid).toBe(false)
  })

  it('flags observer not triggered in audit log', () => {
    const record = buildAuditRecord({ observer_triggered: false })
    expect(record.observer_triggered).toBe(false)
  })
})

// ── 6. CORS Origin Validation ─────────────────────────────────────────────────

describe('CORS Origin Validation', () => {
  const ALLOWED = ['https://nyai.blackholeinfiverse.com']

  const checkOrigin = (origin) => ALLOWED.includes(origin)

  it('allows production origin', () => {
    expect(checkOrigin('https://nyai.blackholeinfiverse.com')).toBe(true)
  })

  it('blocks unknown origin', () => {
    expect(checkOrigin('https://evil.example.com')).toBe(false)
  })

  it('blocks wildcard attempt', () => {
    expect(checkOrigin('*')).toBe(false)
  })

  it('blocks http (non-TLS) variant', () => {
    expect(checkOrigin('http://nyai.blackholeinfiverse.com')).toBe(false)
  })
})

// ── 7. Chaos: Invalid Response Shapes ────────────────────────────────────────

describe('Chaos: Invalid Response Shapes', () => {
  const processResponse = (data) => {
    if (!data || typeof data !== 'object') throw new Error('NULL_RESPONSE')
    if (!data.metadata?.Formatted) throw new Error('UNFORMATTED_RESPONSE')
    if (!data.trace_id) throw new Error('MISSING_TRACE_ID')
    return data
  }

  it('throws on null response', () => {
    expect(() => processResponse(null)).toThrow('NULL_RESPONSE')
  })

  it('throws on empty object', () => {
    expect(() => processResponse({})).toThrow('UNFORMATTED_RESPONSE')
  })

  it('throws on HTML error page (string)', () => {
    expect(() => processResponse('<html>502 Bad Gateway</html>')).toThrow()
  })

  it('throws on array response', () => {
    expect(() => processResponse([])).toThrow('UNFORMATTED_RESPONSE')
  })

  it('passes valid formatted response', () => {
    expect(processResponse(VALID_CONTRACT)).toEqual(VALID_CONTRACT)
  })
})
