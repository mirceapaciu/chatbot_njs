/**
 * Validation service for user input
 * Checks for profanity and potential prompt injection attacks
 */

// Common prompt injection patterns to detect
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions/i,
  /disregard\s+(previous|above|all)\s+(instructions|prompts)/i,
  /forget\s+(previous|all)\s+instructions/i,
  /new\s+instructions:/i,
  /system\s*:\s*/i,
  /act\s+as\s+(a\s+)?different/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /override\s+your\s+instructions/i,
];

// Basic profanity list (add more as needed)
const PROFANITY_WORDS = [
  'damn',
  'hell',
  'crap',
  'shit',
  'fuck',
  'bitch',
  'asshole',
  // Add more words as needed
];

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate user input for profanity and prompt injection
 */
export function validateUserInput(input: string): ValidationResult {
  const errors: string[] = [];

  // Check for empty input
  if (!input || input.trim().length === 0) {
    errors.push('Input cannot be empty');
    return { isValid: false, errors };
  }

  // Check for excessive length
  if (input.length > 5000) {
    errors.push('Input is too long (maximum 5000 characters)');
  }

  // Check for prompt injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially harmful instructions');
      break;
    }
  }

  // Check for profanity
  const lowerInput = input.toLowerCase();
  const foundProfanity = PROFANITY_WORDS.some(word => {
    // Use word boundaries to avoid false positives
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerInput);
  });

  if (foundProfanity) {
    errors.push('Input contains inappropriate language');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize input by removing potentially harmful characters
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes and other control characters
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}
