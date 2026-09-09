/**
 * 3Boxes HRMS — Centralized Validation Utilities
 *
 * Standard validation functions for all Indian business formats
 * and common field types. Used by both client-side forms and
 * server-side API routes.
 *
 * Every function returns { valid: boolean, error?: string }
 * so callers can show specific error messages.
 *
 * Indian Standard Formats:
 *   Aadhaar: 12 digits + Luhn checksum (UIDAI standard)
 *   PAN: AAAAA9999A — 5 letters + 4 digits + 1 letter (IT standard)
 *   GST: 15 chars — 2 digit state code + PAN + 1 entity + Z + 1 checksum
 *   CIN: 21 chars — [LU] + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits
 *   IFSC: 11 chars — 4 bank code + 0 (always) + 6 branch code
 *   Phone: +91 [6-9]XXXXXXXXX (10-digit Indian mobile)
 */

// ─── Email ──────────────────────────────────────────────────────────────

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || !email.trim()) return { valid: false, error: 'Email is required' };
  const trimmed = email.trim();
  // RFC 5322 simplified — covers 99.9% of real-world emails
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return { valid: false, error: 'Invalid email format (e.g., name@domain.com)' };
  if (trimmed.length > 254) return { valid: false, error: 'Email is too long (max 254 characters)' };
  return { valid: true };
}

// ─── Password ───────────────────────────────────────────────────────────

export interface PasswordStrength {
  valid: boolean;
  error?: string;
  score: number;       // 0-4
  label: string;       // 'Weak' | 'Fair' | 'Good' | 'Strong'
  checks: {
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    digit: boolean;
    special: boolean;
  };
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const checks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const labels: Record<number, string> = { 0: 'Weak', 1: 'Weak', 2: 'Fair', 3: 'Good', 4: 'Strong' };

  if (!password) return { valid: false, error: 'Password is required', score: 0, label: 'Weak', checks };
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters', score, label: labels[score] || 'Weak', checks };
  if (!checks.uppercase) return { valid: false, error: 'Password must contain at least one uppercase letter', score, label: labels[score] || 'Weak', checks };
  if (!checks.digit) return { valid: false, error: 'Password must contain at least one digit', score, label: labels[score] || 'Weak', checks };
  if (!checks.special) return { valid: false, error: 'Password must contain at least one special character', score, label: labels[score] || 'Weak', checks };
  if (password.length > 128) return { valid: false, error: 'Password is too long (max 128 characters)', score, label: labels[score] || 'Weak', checks };

  return { valid: true, score, label: labels[score] || 'Strong', checks };
}

export function validatePasswordRequired(password: string): { valid: boolean; error?: string } {
  if (!password || !password.trim()) return { valid: false, error: 'Password is required' };
  if (password.length < 1) return { valid: false, error: 'Password is required' };
  return { valid: true };
}

// ─── Aadhaar Card ───────────────────────────────────────────────────────

/**
 * Validate Aadhaar number with Luhn checksum.
 *
 * Aadhaar format (UIDAI):
 *   - Exactly 12 digits
 *   - No leading zeroes (first digit 1-9)
 *   - Last digit is Luhn check digit
 *   - Common formats: XXXX XXXX XXXX, XXXX-XXXX-XXXX, XXXXXXXXXXXX
 *
 * The Luhn algorithm is the same as credit card validation
 * but applied to 12 digits instead of 16.
 */
export function validateAadhaar(value: string): { valid: boolean; error?: string; formatted?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field — empty is OK

  // Strip all non-digits (spaces, dashes, etc.)
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 12) return { valid: false, error: 'Aadhaar number must be exactly 12 digits' };
  if (digits[0] === '0') return { valid: false, error: 'Aadhaar number cannot start with 0' };

  // Luhn checksum validation
  if (!luhnCheck(digits)) return { valid: false, error: 'Invalid Aadhaar number (checksum failed)' };

  // Return formatted version: XXXX XXXX XXXX
  const formatted = `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  return { valid: true, formatted };
}

/**
 * Luhn algorithm — validates check digit.
 * Used by Aadhaar (12 digits) and credit cards (16 digits).
 */
function luhnCheck(numStr: string): boolean {
  let sum = 0;
  let alternate = false;
  // Process from right to left
  for (let i = numStr.length - 1; i >= 0; i--) {
    let n = parseInt(numStr[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

// ─── PAN Card ───────────────────────────────────────────────────────────

/**
 * Validate PAN (Permanent Account Number).
 *
 * PAN format (Income Tax of India):
 *   - Exactly 10 characters: AAAAA9999A
 *   - Characters 1-3: Any alphabet (AAO/AAB/etc.)
 *   - Character 4: Entity type — must be one of:
 *     A = Association of Persons, B = Body of Individuals,
 *     C = Company, F = Firm, G = Government, H = HUF,
 *     L = Local Authority, J = Artificial Juridical Person,
 *     P = Individual, T = Trust
 *   - Character 5: First letter of surname/person name
 *   - Characters 6-9: Sequential number (0001-9999)
 *   - Character 10: Check digit (any alphabet)
 */
export function validatePAN(value: string): { valid: boolean; error?: string; normalized?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field

  const trimmed = value.trim().toUpperCase();

  if (trimmed.length !== 10) return { valid: false, error: 'PAN must be exactly 10 characters (e.g., ABCDE1234F)' };

  // Overall format: 5 letters + 4 digits + 1 letter
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRegex.test(trimmed)) return { valid: false, error: 'Invalid PAN format (e.g., ABCDE1234F — 5 letters + 4 digits + 1 letter)' };

  // 4th character entity type check
  const validEntityTypes = ['A', 'B', 'C', 'F', 'G', 'H', 'L', 'J', 'P', 'T'];
  const entityType = trimmed[3];
  if (!validEntityTypes.includes(entityType)) {
    return { valid: false, error: `Invalid PAN entity type '${entityType}' at position 4. Must be one of: A/B/C/F/G/H/L/J/P/T` };
  }

  return { valid: true, normalized: trimmed };
}

// ─── GST Number ─────────────────────────────────────────────────────────

/**
 * Validate GST Identification Number (GSTIN).
 *
 * GSTIN format (CBIC):
 *   - 15 characters total
 *   - Position 1-2: State code (01-37)
 *   - Position 3-12: PAN number (embedded)
 *   - Position 13: Entity registration number (1-9 or A-Z)
 *   - Position 14: Always 'Z'
 *   - Position 15: Checksum character (0-9 or A-Z)
 */
export function validateGST(value: string): { valid: boolean; error?: string; normalized?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field

  const trimmed = value.trim().toUpperCase();

  if (trimmed.length !== 15) return { valid: false, error: 'GSTIN must be exactly 15 characters' };

  // Format: 2 digits + 5 letters + 4 digits + 1 letter + 1 entity + Z + 1 checksum
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstRegex.test(trimmed)) return { valid: false, error: 'Invalid GSTIN format (e.g., 29AABCU9603R1ZM)' };

  // Validate state code (01-37 as per GST state codes)
  const stateCode = parseInt(trimmed.slice(0, 2), 10);
  const validStateCodes = [
    1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37
  ];
  if (!validStateCodes.includes(stateCode)) {
    return { valid: false, error: `Invalid GST state code '${trimmed.slice(0, 2)}'. Must be 01-37` };
  }

  return { valid: true, normalized: trimmed };
}

// ─── CIN (Corporate Identity Number) ────────────────────────────────────

/**
 * Validate CIN (Corporate Identity Number).
 *
 * CIN format (MCA):
 *   - 21 characters: [LU] + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits
 *   - First char: L (Listed) or U (Unlisted)
 *   - Example: L12345MH2014PLC070314
 */
export function validateCIN(value: string): { valid: boolean; error?: string; normalized?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field

  const trimmed = value.trim().toUpperCase();

  if (trimmed.length !== 21) return { valid: false, error: 'CIN must be exactly 21 characters' };

  const cinRegex = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
  if (!cinRegex.test(trimmed)) return { valid: false, error: 'Invalid CIN format (e.g., L12345MH2014PLC070314)' };

  return { valid: true, normalized: trimmed };
}

// ─── IFSC Code ──────────────────────────────────────────────────────────

/**
 * Validate IFSC (Indian Financial System Code).
 *
 * IFSC format (RBI):
 *   - 11 characters: 4 bank code + 0 (always) + 6 branch code
 *   - First 4: Alphabetic bank code (e.g., SBIN, HDFC, ICIC)
 *   - 5th: Always '0' (reserved for future use)
 *   - Last 6: Alphanumeric branch code
 *   - Example: SBIN0001234
 */
export function validateIFSC(value: string): { valid: boolean; error?: string; normalized?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field

  const trimmed = value.trim().toUpperCase();

  if (trimmed.length !== 11) return { valid: false, error: 'IFSC must be exactly 11 characters' };

  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(trimmed)) return { valid: false, error: 'Invalid IFSC format (e.g., SBIN0001234 — 4 bank letters + 0 + 6 branch chars)' };

  return { valid: true, normalized: trimmed };
}

// ─── Phone/Mobile Number ────────────────────────────────────────────────

/**
 * Validate Indian mobile number.
 *
 * Indian mobile format (TRAI):
 *   - 10 digits starting with 6-9
 *   - Optional prefix: +91, 91, +91-, +91 space, 0
 *   - Example: +91 9876543210, 9876543210, 09876543210
 */
export function validatePhone(value: string): { valid: boolean; error?: string; normalized?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field

  // Strip all non-digits
  const digits = value.replace(/\D/g, '');

  // Handle country code prefix
  let localDigits = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    localDigits = digits.slice(2); // Strip +91
  } else if (digits.length === 11 && digits.startsWith('0')) {
    localDigits = digits.slice(1); // Strip leading 0
  }

  if (localDigits.length !== 10) return { valid: false, error: 'Phone number must be 10 digits' };
  if (!/^[6-9]/.test(localDigits)) return { valid: false, error: 'Indian mobile number must start with 6, 7, 8, or 9' };

  return { valid: true, normalized: `+91${localDigits}` };
}

// ─── Name Validation ────────────────────────────────────────────────────

export function validateName(value: string, field = 'Name', minLength = 2): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: false, error: `${field} is required` };
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: `${field} must be at least ${minLength} character${minLength === 1 ? '' : 's'}`,
    };
  }
  if (trimmed.length > 100) return { valid: false, error: `${field} is too long (max 100 characters)` };
  // Allow letters, spaces, hyphens, apostrophes, dots (for names like O'Brien, J. Smith, etc.)
  if (!/^[a-zA-Z\s\-'.]+$/.test(trimmed)) return { valid: false, error: `${field} can only contain letters, spaces, hyphens, and apostrophes` };
  return { valid: true };
}

// ─── Employee ID ────────────────────────────────────────────────────────

export function validateEmployeeId(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: false, error: 'Employee ID is required' };
  const trimmed = value.trim();
  if (trimmed.length < 2) return { valid: false, error: 'Employee ID must be at least 2 characters' };
  if (trimmed.length > 20) return { valid: false, error: 'Employee ID is too long (max 20 characters)' };
  // Allow alphanumeric + hyphens
  if (!/^[A-Za-z0-9\-]+$/.test(trimmed)) return { valid: false, error: 'Employee ID can only contain letters, numbers, and hyphens' };
  return { valid: true };
}

// ─── Search Input Sanitization ───────────────────────────────────────────

/**
 * Sanitize search input for safe use.
 * - Trims whitespace
 * - Limits length (default 200 chars)
 * - Removes control characters
 * - Does NOT escape HTML (React handles that via JSX)
 */
export function sanitizeSearch(value: string, maxLength = 200): string {
  if (!value) return '';
  return value
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .slice(0, maxLength);
}

// ─── UAN (Universal Account Number - EPFO) ──────────────────────────────

/**
 * Validate UAN (Universal Account Number).
 *
 * UAN format (EPFO):
 *   - 12 digits
 *   - Issued by EPFO for provident fund
 */
export function validateUAN(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field

  const digits = value.replace(/\D/g, '');

  if (digits.length !== 12) return { valid: false, error: 'UAN must be exactly 12 digits' };

  return { valid: true };
}

// ─── Bank Account Number ────────────────────────────────────────────────

/**
 * Validate bank account number.
 * Indian bank account numbers are typically 9-18 digits.
 */
export function validateBankAccount(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field

  const digits = value.replace(/\D/g, '');

  if (digits.length < 9) return { valid: false, error: 'Bank account number must be at least 9 digits' };
  if (digits.length > 18) return { valid: false, error: 'Bank account number must be at most 18 digits' };

  return { valid: true };
}

// ─── Composite Validators ───────────────────────────────────────────────

/**
 * Validate all fields of an employee form at once.
 * Returns an object with field-specific errors.
 */
export function validateEmployeeForm(form: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  ifscCode?: string;
  bankAccountNumber?: string;
  uan?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  const nameResult = validateName(form.firstName || '', 'First name');
  if (!nameResult.valid) errors.firstName = nameResult.error!;

  const lastNameResult = validateName(form.lastName || '', 'Last name', 1);
  if (!lastNameResult.valid) errors.lastName = lastNameResult.error!;

  const emailResult = validateEmail(form.email || '');
  if (!emailResult.valid) errors.email = emailResult.error!;

  if (form.phone) {
    const phoneResult = validatePhone(form.phone);
    if (!phoneResult.valid) errors.phone = phoneResult.error!;
  }

  if (form.aadhaarNumber) {
    const aadhaarResult = validateAadhaar(form.aadhaarNumber);
    if (!aadhaarResult.valid) errors.aadhaarNumber = aadhaarResult.error!;
  }

  if (form.panNumber) {
    const panResult = validatePAN(form.panNumber);
    if (!panResult.valid) errors.panNumber = panResult.error!;
  }

  if (form.ifscCode) {
    const ifscResult = validateIFSC(form.ifscCode);
    if (!ifscResult.valid) errors.ifscCode = ifscResult.error!;
  }

  if (form.bankAccountNumber) {
    const bankResult = validateBankAccount(form.bankAccountNumber);
    if (!bankResult.valid) errors.bankAccountNumber = bankResult.error!;
  }

  if (form.uan) {
    const uanResult = validateUAN(form.uan);
    if (!uanResult.valid) errors.uan = uanResult.error!;
  }

  return errors;
}

/**
 * Validate registration form fields.
 */
export function validateRegistrationForm(form: {
  name: string;
  email: string;
  password: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  const nameResult = validateName(form.name, 'Name');
  if (!nameResult.valid) errors.name = nameResult.error!;

  const emailResult = validateEmail(form.email);
  if (!emailResult.valid) errors.email = emailResult.error!;

  const passwordResult = validatePasswordStrength(form.password);
  if (!passwordResult.valid) errors.password = passwordResult.error!;

  return errors;
}

// ─── ZIP / Postal Code ──────────────────────────────────────────────────

/**
 * Validate Indian ZIP / Postal code.
 * Indian PIN codes: exactly 6 digits, first digit 1-8.
 */
export function validateZipCode(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field
  const trimmed = value.trim();
  if (!/^\d{6}$/.test(trimmed)) return { valid: false, error: 'PIN code must be exactly 6 digits' };
  if (!/^[1-8]/.test(trimmed)) return { valid: false, error: 'Invalid PIN code (first digit must be 1-8)' };
  return { valid: true };
}

// ─── Nationality ────────────────────────────────────────────────────────

/**
 * Validate nationality field — letters and spaces only.
 */
export function validateNationality(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field
  const trimmed = value.trim();
  if (!/^[a-zA-Z\s]+$/.test(trimmed)) return { valid: false, error: 'Nationality can only contain letters and spaces' };
  if (trimmed.length < 2) return { valid: false, error: 'Nationality must be at least 2 characters' };
  return { valid: true };
}

// ─── PF Number ──────────────────────────────────────────────────────────

/**
 * Validate Provident Fund number.
 * PF numbers are alphanumeric, typically region/office/establishment format.
 */
export function validatePFNumber(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field
  const trimmed = value.trim();
  if (trimmed.length < 5) return { valid: false, error: 'PF number must be at least 5 characters' };
  if (trimmed.length > 25) return { valid: false, error: 'PF number is too long (max 25 characters)' };
  // Allow alphanumeric, slashes, and hyphens (PF format: XX/XXX/XXXXX)
  if (!/^[A-Za-z0-9\/\-]+$/.test(trimmed)) return { valid: false, error: 'PF number can only contain letters, numbers, slashes, and hyphens' };
  return { valid: true };
}

// ─── ESI Number ─────────────────────────────────────────────────────────

/**
 * Validate ESI (Employee State Insurance) number.
 * ESI numbers are typically 17 digits: XX-XX-XXXXXX-XXXXX-X
 */
export function validateESINumber(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10) return { valid: false, error: 'ESI number must be at least 10 digits' };
  if (digits.length > 17) return { valid: false, error: 'ESI number is too long (max 17 digits)' };
  return { valid: true };
}

// ─── Website URL ────────────────────────────────────────────────────────

/**
 * Validate website URL.
 */
export function validateWebsite(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: true }; // Optional field
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (!url.hostname.includes('.')) return { valid: false, error: 'Enter a valid website URL (e.g., https://example.com)' };
    return { valid: true };
  } catch {
    return { valid: false, error: 'Enter a valid website URL (e.g., https://example.com)' };
  }
}

// ─── Input Restriction Helpers (for real-time keystroke filtering) ─────

/**
 * Strip non-digit characters from a string (for phone, Aadhaar, bank account, etc.)
 * Used in onChange handlers to prevent alphabets/special chars from being entered.
 */
export function onlyDigits(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/**
 * Strip non-letter characters (allows spaces, hyphens, apostrophes).
 * Used for name fields, nationality, etc.
 */
export function onlyLetters(value: string): string {
  return value.replace(/[^a-zA-Z\s\-'.]/g, '');
}

/**
 * Strip non-alphanumeric characters (allows letters, digits, hyphens).
 * Used for employee ID, department code, etc.
 */
export function onlyAlphanumeric(value: string): string {
  return value.replace(/[^a-zA-Z0-9\-]/g, '');
}

/**
 * Limit string length (for real-time input max enforcement).
 */
export function limitLength(value: string, max: number): string {
  return value.slice(0, max);
}

/**
 * For phone input: only digits, max 10 digits (local) or 13 (with +91 prefix).
 */
export function phoneInputFilter(value: string): string {
  // Allow digits and leading + only
  let filtered = value.replace(/[^\d+]/g, '');
  // If starts with +, keep it but limit to +91 + 10 digits = 13 chars
  if (filtered.startsWith('+')) {
    filtered = '+' + filtered.slice(1).replace(/[^\d]/g, '');
    return filtered.slice(0, 13);
  }
  // Otherwise just digits, max 12 (to allow 91 prefix + 10 digits)
  return filtered.replace(/[^\d]/g, '').slice(0, 12);
}
