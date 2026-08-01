export function validateLoginId(input: string): { isValid: boolean; error?: string } {
  const clean = input.trim();
  if (!clean) {
    return { isValid: false, error: 'Please enter your Login ID' };
  }
  if (clean.length < 4) {
    return { isValid: false, error: 'Login ID must be at least 4 digits' };
  }
  return { isValid: true };
}
