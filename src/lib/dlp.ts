/**
 * DLP (Data Loss Prevention) utility — REQ-SEC-EMP-01
 *
 * Scans content for PII patterns:
 *   - Credit Card numbers (Visa, MC, Amex)
 *   - SSN (US format: XXX-XX-XXXX)
 *   - Aadhaar (India: XXXX XXXX XXXX)
 *   - PAN (India: AAAAA9999A)
 *   - Email addresses (optionally)
 *
 * Returns action: 'allow' | 'flag' | 'block'
 *   - allow: no PII found
 *   - flag: PII detected but content can be posted with a warning
 *   - block: high-risk PII (e.g. credit card in announcement channel)
 */

export interface DLPResult {
  patterns: string[];
  riskScore: number; // 0-100
  action: 'allow' | 'flag' | 'block';
  reason?: string;
}

const PATTERNS = [
  {
    name: 'CREDIT_CARD',
    // Visa | MC | Amex — 13-16 digits, optionally space/dash-separated
    regex: /\b(?:\d[ -]*?){13,16}\b/g,
    validate: (s: string) => {
      const digits = s.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 16) return false;
      // Luhn check
      let sum = 0;
      let isEven = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let d = parseInt(digits[i], 10);
        if (isEven) {
          d *= 2;
          if (d > 9) d -= 9;
        }
        sum += d;
        isEven = !isEven;
      }
      return sum % 10 === 0;
    },
    riskScore: 90,
  },
  {
    name: 'SSN_US',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    riskScore: 80,
  },
  {
    name: 'AADHAAR_IN',
    regex: /\b\d{4}\s\d{4}\s\d{4}\b/g,
    riskScore: 80,
  },
  {
    name: 'PAN_IN',
    regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    riskScore: 70,
  },
  {
    name: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    riskScore: 30, // Emails are usually fine in business context
  },
  {
    name: 'PHONE',
    regex: /\b\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
    riskScore: 40,
  },
];

export function scanContentForPII(content: string): DLPResult {
  const detected: string[] = [];
  let maxRisk = 0;
  const reasons: string[] = [];

  for (const pattern of PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      // For credit cards, run Luhn validation to reduce false positives
      if (pattern.name === 'CREDIT_CARD' && pattern.validate) {
        const valid = matches.filter((m) => pattern.validate!(m));
        if (valid.length > 0) {
          detected.push(pattern.name);
          maxRisk = Math.max(maxRisk, pattern.riskScore);
          reasons.push(`Credit card number detected (${valid.length} occurrence${valid.length > 1 ? 's' : ''})`);
        }
      } else {
        detected.push(pattern.name);
        maxRisk = Math.max(maxRisk, pattern.riskScore);
        reasons.push(`${pattern.name} pattern detected (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
      }
    }
  }

  if (detected.length === 0) {
    return { patterns: [], riskScore: 0, action: 'allow' };
  }

  // High-risk PII (credit card, SSN, Aadhaar) → block
  const highRiskPatterns = detected.filter((p) =>
    ['CREDIT_CARD', 'SSN_US', 'AADHAAR_IN'].includes(p)
  );

  if (highRiskPatterns.length > 0) {
    return {
      patterns: detected,
      riskScore: maxRisk,
      action: 'block',
      reason: reasons.join('; '),
    };
  }

  // Medium-risk (PAN, phone) → flag
  return {
    patterns: detected,
    riskScore: maxRisk,
    action: 'flag',
    reason: reasons.join('; '),
  };
}
