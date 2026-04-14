import { z } from 'zod'

// Zod schemas for Decision Contract validation

export const EnforcementStateSchema = z.enum([
  'clear',
  'block',
  'escalate',
  'soft_redirect',
  'conditional'
])

export const EnforcementVerdictSchema = z.enum([
  'ENFORCEABLE',
  'PENDING_REVIEW',
  'NON_ENFORCEABLE'
])

export const EnforcementStatusSchema = z.object({
  state: EnforcementStateSchema,
  verdict: EnforcementVerdictSchema,
  reason: z.string().default(''),
  barriers: z.array(z.string()).default([]),
  blocked_path: z.string().nullable().optional(),
  escalation_required: z.boolean().default(false),
  escalation_target: z.string().nullable().optional(),
  redirect_suggestion: z.string().nullable().optional(),
  safe_explanation: z.string().default(''),
  trace_id: z.string().min(1, 'trace_id must be non-empty')
})

export const DecisionContractSchema = z.object({
  trace_id: z.string().min(1, 'trace_id must be non-empty'),
  jurisdiction: z.string().min(1, 'jurisdiction must be non-empty'),
  domain: z.string().min(1, 'domain must be non-empty'),
  legal_route: z.array(z.string()).min(1, 'legal_route must be non-empty'),
  reasoning_trace: z.record(z.any()),
  enforcement_status: EnforcementStatusSchema,
  confidence: z.number().min(0).max(1)
}).strict() // No extra fields allowed

// TypeScript interfaces
export interface EnforcementStatus {
  state: 'clear' | 'block' | 'escalate' | 'soft_redirect' | 'conditional'
  verdict: 'ENFORCEABLE' | 'PENDING_REVIEW' | 'NON_ENFORCEABLE'
  reason?: string
  barriers?: string[]
  blocked_path?: string | null
  escalation_required?: boolean
  escalation_target?: string | null
  redirect_suggestion?: string | null
  safe_explanation?: string
  trace_id: string
}

export interface DecisionContract {
  trace_id: string
  jurisdiction: string
  domain: string
  legal_route: string[]
  reasoning_trace: Record<string, any>
  enforcement_status: EnforcementStatus
  confidence: number
}

// Validation function for programmatic gatekeeper
export function validateDecisionContract(data: unknown): DecisionContract {
  return DecisionContractSchema.parse(data)
}

// Type guard
export function isDecisionContract(data: unknown): data is DecisionContract {
  return DecisionContractSchema.safeParse(data).success
}