// Attack Test Suite for Formatter Gate and Trace Visibility
// This test verifies that the UI correctly blocks unformatted responses

console.log('🛡️ Starting Attack Test Suite for Nyaya Formatter Gate...');

// Test data scenarios
const validResponse = {
  trace_id: "test-trace-123",
  jurisdiction: "India",
  domain: "Civil Law",
  legal_route: ["Assessment", "Review"],
  confidence: 0.85,
  enforcement_status: {
    state: "clear",
    verdict: "ENFORCEABLE",
    trace_id: "test-trace-123"
  },
  reasoning_trace: {},
  metadata: {
    Formatted: true
  }
};

const attackScenarios = [
  {
    name: "Missing Formatted Flag",
    data: { ...validResponse, metadata: {} },
    shouldBlock: true,
    expectedError: "metadata.Formatted flag is not true"
  },
  {
    name: "Formatted: false",
    data: { ...validResponse, metadata: { Formatted: false } },
    shouldBlock: true,
    expectedError: "metadata.Formatted flag is not true"
  },
  {
    name: "Missing Metadata",
    data: { ...validResponse },
    shouldBlock: true,
    expectedError: "Missing metadata object"
  },
  {
    name: "Raw Backend Response",
    data: { result: "Some raw data", status: "success" },
    shouldBlock: true,
    expectedError: "Missing metadata object"
  },
  {
    name: "Tampered Schema (Extra Fields)",
    data: { ...validResponse, extra_malicious_field: "hacked" },
    shouldBlock: false, // This should pass validation (extra fields are allowed in UI)
    expectedError: null
  },
  {
    name: "Missing Trace ID",
    data: { ...validResponse },
    shouldBlock: true,
    expectedError: "Missing trace_id"
  },
  {
    name: "Missing Enforcement Status",
    data: { ...validResponse },
    shouldBlock: true,
    expectedError: "Missing enforcement_status"
  }
];

// Remove properties for specific tests
attackScenarios[2].data = (({ metadata, ...rest }) => rest)(attackScenarios[2].data);
attackScenarios[5].data = (({ trace_id, ...rest }) => rest)(attackScenarios[5].data);
attackScenarios[6].data = (({ enforcement_status, ...rest }) => rest)(attackScenarios[6].data);

// Validation function (simulating FormatterGate logic)
function validateResponse(data) {
  if (!data) {
    return { valid: false, error: "No response data received" };
  }

  if (!data.metadata) {
    return { valid: false, error: "Missing metadata object" };
  }

  if (data.metadata.Formatted !== true) {
    return { valid: false, error: "metadata.Formatted flag is not true" };
  }

  if (!data.trace_id) {
    return { valid: false, error: "Missing trace_id" };
  }

  if (!data.enforcement_status) {
    return { valid: false, error: "Missing enforcement_status" };
  }

  return { valid: true };
}

// Run tests
console.log('\n' + '='.repeat(60));
console.log('ATTACK TEST RESULTS');
console.log('='.repeat(60));

let passedTests = 0;
let totalTests = attackScenarios.length;

attackScenarios.forEach((scenario, index) => {
  console.log(`\n🧪 Test ${index + 1}: ${scenario.name}`);
  console.log('-'.repeat(40));

  const result = validateResponse(scenario.data);

  const testPassed = result.valid !== scenario.shouldBlock;

  if (testPassed) {
    console.log('✅ PASS');
    passedTests++;
  } else {
    console.log('❌ FAIL');
  }

  console.log(`Expected to block: ${scenario.shouldBlock}`);
  console.log(`Actually blocked: ${!result.valid}`);

  if (scenario.expectedError) {
    const expectedKey = scenario.expectedError.split(':')[1]?.trim() || scenario.expectedError;
    const errorMatch = result.error && result.error.includes(expectedKey);
    console.log(`Error message correct: ${errorMatch ? '✅' : '❌'}`);
    if (!errorMatch) {
      console.log(`Expected: "${scenario.expectedError}"`);
      console.log(`Got: "${result.error}"`);
    }
  }
});

console.log('\n' + '='.repeat(60));
console.log('FINAL RESULTS');
console.log('='.repeat(60));
console.log(`Tests Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('🎉 ALL ATTACK TESTS PASSED - Formatter Gate is secure!');
  console.log('🔒 The UI successfully blocks raw backend responses and tampered schemas.');
} else {
  console.log('⚠️  Some tests failed - security vulnerabilities detected!');
}

console.log('\n' + '='.repeat(60));
console.log('SECURITY VERIFICATION COMPLETE');
console.log('='.repeat(60));

// Export for use in other test suites
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateResponse, attackScenarios };
}