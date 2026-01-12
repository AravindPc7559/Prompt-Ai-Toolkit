/**
 * Removes unwanted prefixes from AI-generated text
 * @param {string} text - The text to clean
 * @param {string[]} prefixes - Array of regex patterns for prefixes to remove
 * @returns {string} - Cleaned text
 */
export const removePrefixes = (text, prefixes) => {
  let cleaned = text.trim();
  
  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '');
  }
  
  return cleaned.trim();
};

/**
 * Common prefixes to remove from rewritten prompts
 */
export const REWRITE_PREFIXES = [
  /^\*\*Improved Prompt:\*\*\s*/i,
  /^Improved Prompt:\s*/i,
  /^\*\*Rewritten Prompt:\*\*\s*/i,
  /^Rewritten Prompt:\s*/i,
  /^\*\*Rewritten:\*\*\s*/i,
  /^Rewritten:\s*/i,
  /^\*\*Enhanced Prompt:\*\*\s*/i,
  /^Enhanced Prompt:\s*/i,
];

/**
 * Common prefixes to remove from grammarized text
 */
export const GRAMMAR_PREFIXES = [
  /^\*\*Corrected Text:\*\*\s*/i,
  /^Corrected Text:\s*/i,
  /^\*\*Grammarized:\*\*\s*/i,
  /^Grammarized:\s*/i,
  /^\*\*Corrected:\*\*\s*/i,
  /^Corrected:\s*/i,
];

/**
 * Common prefixes to remove from formatted emails
 */
export const EMAIL_PREFIXES = [
  /^\*\*Formatted Email:\*\*\s*/i,
  /^Formatted Email:\s*/i,
  /^\*\*Email:\*\*\s*/i,
  /^Email:\s*/i,
  /^\*\*Formatted:\*\*\s*/i,
  /^Formatted:\s*/i,
];
