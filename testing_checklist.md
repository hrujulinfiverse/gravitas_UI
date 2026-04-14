# Nyaya API Stability Testing Checklist

## Pre-Flight Checks
- [ ] Backend service starts without errors
- [ ] All imports resolve correctly
- [ ] DecisionContract validation functions load
- [ ] Observer Pipeline initializes

## Endpoint Tests

### POST /nyaya/query
- [ ] Accepts valid QueryRequest JSON
- [ ] Rejects malformed JSON (400)
- [ ] Rejects non-application/json (400)
- [ ] Successful response includes all DecisionContract fields
- [ ] Response validates against DecisionContract schema
- [ ] Observer Pipeline is traversed (check logs)
- [ ] trace_id is unique and returned
- [ ] Error responses use standardized JSON format
- [ ] No raw stack traces in error responses

### GET /nyaya/enforcement_status?trace_id={trace_id}
- [ ] Accepts valid trace_id query parameter
- [ ] Rejects missing trace_id (400)
- [ ] Rejects invalid trace_id format (400)
- [ ] Returns enforcement status for valid trace_id
- [ ] Returns 404 for non-existent trace_id
- [ ] Response includes DecisionContract fields
- [ ] Uses trace_id as primary key for lookups

### GET /nyaya/trace/{trace_id}
- [ ] Accepts valid trace_id path parameter
- [ ] Rejects invalid trace_id format (400)
- [ ] Returns full trace for valid trace_id
- [ ] Returns 404 for non-existent trace_id
- [ ] Response is JSON, no raw data leaks

## Error Handling Tests
- [ ] 500 errors return standardized JSON, not stack traces
- [ ] ValidationError returns 400 with details
- [ ] Contract validation failure returns 500 with INVALID_CONTRACT
- [ ] HTTPException preserves status codes
- [ ] All error responses include trace_id

## Middleware Tests
- [ ] Request validation rejects non-JSON POSTs
- [ ] Response validation enforces DecisionContract
- [ ] Trace ID middleware adds unique trace_id to requests
- [ ] CORS headers present (if enabled)

## Observer Pipeline Integration
- [ ] /nyaya/query calls ObserverPipeline.process_result
- [ ] Observer output includes observation metadata
- [ ] Formatted responses have "Formatted": true metadata

## Load & Stress Tests
- [ ] Concurrent requests handle trace_id isolation
- [ ] Memory usage stable under load
- [ ] No race conditions in trace storage

## Security Tests
- [ ] No sensitive data in responses
- [ ] Input validation prevents injection
- [ ] Error messages don't leak internal details
- [ ] Rate limiting (if implemented) works

## Schema Compliance
- [ ] All responses pass DecisionContract validation
- [ ] No extra fields in DecisionContract responses
- [ ] Required fields always present
- [ ] Type validation enforced

## Integration Tests
- [ ] Frontend can parse all response formats
- [ ] API client handles all error codes
- [ ] End-to-end flow: Query -> Observer -> Format -> UI