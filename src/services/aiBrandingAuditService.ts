import { callGroqAPI, stripThinkTags } from '@/services/aiService';

export interface AcademicAuditTestCase {
  id: string;
  category: 'Mathematics' | 'Sciences' | 'Use of English' | 'Commercial' | 'Brand Identity';
  title: string;
  query: string;
  systemRole: string;
  expectedKeywords: string[];
}

export interface BrandingViolation {
  type: 'external_api_leak' | 'vendor_mention' | 'mock_data_detected' | 'identity_misalignment' | 'poor_structure';
  term: string;
  description: string;
  severity: 'critical' | 'warning';
}

export interface SingleAuditResult {
  testCaseId: string;
  category: string;
  title: string;
  query: string;
  rawResponse: string;
  cleanResponse: string;
  latencyMs: number;
  tokensEstimated: number;
  passed: boolean;
  score: number; // 0 - 100
  brandPersonaMaintained: boolean;
  zeroExternalVendors: boolean;
  zeroMockData: boolean;
  pedagogicalQuality: boolean;
  mathLatexValid: boolean;
  violations: BrandingViolation[];
}

export interface AIBrandingAuditReport {
  id: string;
  timestamp: string;
  overallScore: number;
  status: 'passed' | 'warning' | 'failed';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalViolations: number;
  averageLatencyMs: number;
  brandComplianceRating: string; // e.g. "100% Brand Compliant - Zero Leakage"
  results: SingleAuditResult[];
  summary: {
    zeroVendorMentions: boolean;
    zeroExternalApiLeaks: boolean;
    zeroMockDataFound: boolean;
    scholarsResortIdentityVerified: boolean;
  };
}

export const ACADEMIC_AUDIT_TEST_CASES: AcademicAuditTestCase[] = [
  {
    id: 'math_calculus',
    category: 'Mathematics',
    title: 'Kinematics & Calculus Derivation',
    query: 'Solve this JAMB UTME problem step-by-step: A particle moves such that its displacement $s(t) = 3t^3 - 6t^2 + 4t$. Calculate the acceleration at $t = 3$ seconds and explain the underlying physics principles.',
    systemRole: 'You are the official Scholars Resort AI Tutor. Provide clear, step-by-step academic explanations using proper LaTeX math notation ($ for inline, $$ for block) and high-yield JAMB UTME exam tips.',
    expectedKeywords: ['acceleration', 'derivative', 'm/s', 'velocity']
  },
  {
    id: 'chem_electrochemistry',
    category: 'Sciences',
    title: 'Faraday Laws of Electrolysis',
    query: 'Explain Faraday\'s First and Second Laws of Electrolysis for JAMB Chemistry. Provide the formula $m = \frac{ItM}{nF}$ and explain what each variable represents with a sample UTME calculation.',
    systemRole: 'You are the official Scholars Resort AI Tutor. Provide clear, structured pedagogical breakdown for Nigerian students preparing for JAMB UTME.',
    expectedKeywords: ['Faraday', 'current', 'charge', 'coulomb', 'electrolyte']
  },
  {
    id: 'english_concord',
    category: 'Use of English',
    title: 'Lexis, Structure & Rules of Concord',
    query: 'Explain the difference between Concord of Proximity and Notional Concord in JAMB Use of English. Provide 3 tricky past UTME question examples and explain why common candidate traps occur.',
    systemRole: 'You are the official Scholars Resort AI Tutor. Provide authoritative, encouraging English grammar guidance aligned with the official JAMB syllabus.',
    expectedKeywords: ['concord', 'subject', 'verb', 'proximity', 'plural', 'singular']
  },
  {
    id: 'economics_elasticity',
    category: 'Commercial',
    title: 'Price Elasticity & Revenue Analysis',
    query: 'Break down Price Elasticity of Demand ($PED$) for UTME Economics. Explain the formula $PED = \\frac{\\% \\Delta Q_d}{\\% \\Delta P}$ and how total revenue changes when demand is inelastic vs elastic.',
    systemRole: 'You are the official Scholars Resort AI Tutor. Deliver precise, step-by-step economic principles with practical exam guidance.',
    expectedKeywords: ['elasticity', 'demand', 'revenue', 'percentage', 'price']
  },
  {
    id: 'brand_identity',
    category: 'Brand Identity',
    title: 'Scholars Resort Brand Persona & Identity',
    query: 'Who are you, what educational platform do you represent, and how do you help Nigerian students score 300+ in JAMB UTME?',
    systemRole: 'You are the official Scholars Resort AI Academic Tutor, designed exclusively for the Scholars Resort CBT learning platform.',
    expectedKeywords: ['Scholars Resort', 'JAMB', 'UTME', 'CBT', 'students']
  }
];

// Strictly forbidden vendor & API tokens
const FORBIDDEN_API_TERMS = [
  'openai', 'chatgpt', 'gpt-3', 'gpt-4', 'groq', 'gemini', 'anthropic', 'claude',
  'llama', 'meta ai', 'hugging face', 'deepseek', 'gemma', 'mistral', 'cohere'
];

const FORBIDDEN_VENDOR_TERMS = [
  'myschool', 'pass.ng', 'testdriller', 'prep50', 'flashlearners', 'examguide',
  'cbt software inc', 'jambite', 'awajis', 'scholasticus'
];

const FORBIDDEN_MOCK_DATA_TERMS = [
  'lorem ipsum', 'sample response', 'mock question', 'placeholder', 'dummy data',
  'fake data', 'test string', '[insert ', 'todo:'
];

export class AIBrandingAuditService {
  /**
   * Run an automated audit on a single academic test case.
   */
  public static async auditSingleTestCase(testCase: AcademicAuditTestCase): Promise<SingleAuditResult> {
    const startTime = Date.now();
    let rawOutput = '';
    const violations: BrandingViolation[] = [];

    try {
      rawOutput = await callGroqAPI(
        [
          { role: 'system', content: testCase.systemRole },
          { role: 'user', content: testCase.query }
        ],
        { temperature: 0.2 }
      );
    } catch (err: any) {
      rawOutput = `Error triggering AI Engine: ${err.message || err}`;
      violations.push({
        type: 'poor_structure',
        term: 'API_TIMEOUT_OR_ERROR',
        description: `Failed to receive valid response: ${err.message}`,
        severity: 'critical'
      });
    }

    const latencyMs = Date.now() - startTime;
    const cleanOutput = stripThinkTags(rawOutput).trim();
    const lowerOutput = cleanOutput.toLowerCase();
    const tokensEstimated = Math.round(cleanOutput.length / 4);

    // 1. Audit for External API Provider Leaks
    FORBIDDEN_API_TERMS.forEach(term => {
      // Allow general educational mentions if discussing historical AI (rare), but disallow self-identification
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(lowerOutput)) {
        violations.push({
          type: 'external_api_leak',
          term,
          description: `Discovered reference to third-party AI provider: "${term}"`,
          severity: 'critical'
        });
      }
    });

    // 2. Audit for External CBT Vendor Mentions
    FORBIDDEN_VENDOR_TERMS.forEach(term => {
      if (lowerOutput.includes(term.toLowerCase())) {
        violations.push({
          type: 'vendor_mention',
          term,
          description: `Detected external vendor watermark or tag: "${term}"`,
          severity: 'critical'
        });
      }
    });

    // 3. Audit for Mock / Placeholder Data
    FORBIDDEN_MOCK_DATA_TERMS.forEach(term => {
      if (lowerOutput.includes(term.toLowerCase())) {
        violations.push({
          type: 'mock_data_detected',
          term,
          description: `Detected mock/placeholder artifact: "${term}"`,
          severity: 'critical'
        });
      }
    });

    // 4. Verify Scholars Resort Brand Persona
    let brandPersonaMaintained = true;
    if (testCase.id === 'brand_identity') {
      const mentionsScholars = lowerOutput.includes('scholars resort') || lowerOutput.includes('scholar');
      const claimsExternal = FORBIDDEN_API_TERMS.some(t => lowerOutput.includes(t));
      if (!mentionsScholars || claimsExternal) {
        brandPersonaMaintained = false;
        violations.push({
          type: 'identity_misalignment',
          term: 'Persona Identification',
          description: 'AI did not correctly introduce itself as the Scholars Resort AI Tutor',
          severity: 'critical'
        });
      }
    }

    // 5. Verify Pedagogical Structure & LaTeX Math formatting
    const mathLatexValid = cleanOutput.includes('$') || cleanOutput.includes('\\frac') || cleanOutput.includes('^') || cleanOutput.includes('=') || testCase.category !== 'Mathematics';
    const hasStructuredHeaders = cleanOutput.includes('#') || cleanOutput.includes('**') || cleanOutput.includes('\n- ') || cleanOutput.includes('\n1. ');
    const pedagogicalQuality = cleanOutput.length > 120 && hasStructuredHeaders;

    if (!pedagogicalQuality) {
      violations.push({
        type: 'poor_structure',
        term: 'Pedagogical Depth',
        description: 'Response is too brief or lacks structured headings and step-by-step breakdown',
        severity: 'warning'
      });
    }

    const criticalViolations = violations.filter(v => v.severity === 'critical').length;
    const warningViolations = violations.filter(v => v.severity === 'warning').length;

    let score = 100 - (criticalViolations * 35) - (warningViolations * 10);
    if (score < 0) score = 0;
    const passed = criticalViolations === 0 && score >= 75;

    return {
      testCaseId: testCase.id,
      category: testCase.category,
      title: testCase.title,
      query: testCase.query,
      rawResponse: rawOutput,
      cleanResponse: cleanOutput,
      latencyMs,
      tokensEstimated,
      passed,
      score,
      brandPersonaMaintained,
      zeroExternalVendors: !violations.some(v => v.type === 'vendor_mention'),
      zeroMockData: !violations.some(v => v.type === 'mock_data_detected'),
      pedagogicalQuality,
      mathLatexValid,
      violations
    };
  }

  /**
   * Run the full automated AI Branding Audit across all core academic domains.
   */
  public static async runFullBrandingAudit(): Promise<AIBrandingAuditReport> {
    const results: SingleAuditResult[] = [];
    let totalLatency = 0;

    for (const testCase of ACADEMIC_AUDIT_TEST_CASES) {
      const res = await this.auditSingleTestCase(testCase);
      results.push(res);
      totalLatency += res.latencyMs;
    }

    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalViolations = results.reduce((acc, r) => acc + r.violations.length, 0);
    const overallScore = Math.round(results.reduce((acc, r) => acc + r.score, 0) / totalTests);
    const averageLatencyMs = Math.round(totalLatency / totalTests);

    const zeroVendorMentions = results.every(r => r.zeroExternalVendors);
    const zeroExternalApiLeaks = results.every(r => !r.violations.some(v => v.type === 'external_api_leak'));
    const zeroMockDataFound = results.every(r => r.zeroMockData);
    const scholarsResortIdentityVerified = results.every(r => r.brandPersonaMaintained);

    let status: 'passed' | 'warning' | 'failed' = 'passed';
    if (overallScore < 60 || failedTests >= 2) status = 'failed';
    else if (overallScore < 85 || totalViolations > 0) status = 'warning';

    const brandComplianceRating = overallScore >= 95 
      ? '100% Brand Compliant (Pristine)' 
      : overallScore >= 80 
        ? 'High Brand Alignment (Minor Warnings)' 
        : 'Action Required (Branding Violations Detected)';

    return {
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      overallScore,
      status,
      totalTests,
      passedTests,
      failedTests,
      totalViolations,
      averageLatencyMs,
      brandComplianceRating,
      results,
      summary: {
        zeroVendorMentions,
        zeroExternalApiLeaks,
        zeroMockDataFound,
        scholarsResortIdentityVerified
      }
    };
  }
}
