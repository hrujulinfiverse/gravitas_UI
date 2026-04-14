import { useState, useCallback } from 'react'
import { validateDecisionContract, DecisionContractSchema } from '../../../packages/shared/decision_contract.ts'

/**
 * Custom hook for managing validated DecisionContract data
 * Ensures UI only renders Observer-formatted, schema-compliant data
 */
export const useDecisionData = () => {
  const [decision, setDecision] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isValid, setIsValid] = useState(false)

  const validateAndSetDecision = useCallback((data) => {
    try {
      // Validate against DecisionContract schema
      const validatedData = validateDecisionContract(data)

      // Additional runtime checks
      if (!validatedData.trace_id || !validatedData.jurisdiction) {
        throw new Error('Missing required DecisionContract fields')
      }

      setDecision(validatedData)
      setIsValid(true)
      setError(null)
      return true
    } catch (validationError) {
      console.error('DecisionContract validation failed:', validationError.message)
      setError(`Invalid decision data: ${validationError.message}`)
      setDecision(null)
      setIsValid(false)
      return false
    }
  }, [])

  const clearDecision = useCallback(() => {
    setDecision(null)
    setLoading(false)
    setError(null)
    setIsValid(false)
  }, [])

  return {
    decision,
    loading,
    error,
    isValid,
    setLoading,
    validateAndSetDecision,
    clearDecision
  }
}