
// Display name validation
export function validateDisplayName(displayName: string): string | null {
  if (!displayName || displayName.trim() === '') {
    return "Display name cannot be empty";
  }
  
  if (displayName.length < 2) {
    return "Display name must be at least 2 characters";
  }
  
  if (displayName.length > 50) {
    return "Display name must be less than 50 characters";
  }
  
  return null; // No errors
}

// Email validation
export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email || email.trim() === '') {
    return "Email cannot be empty";
  }
  
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address";
  }
  
  return null; // No errors
}

// Password validation
export function validatePassword(password: string): string | null {
  if (!password) {
    return "Password cannot be empty";
  }
  
  if (password.length < 6) {
    return "Password must be at least 6 characters, contain one uppercase letter and one number";
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  
  if (!hasUpperCase || !hasNumber) {
    return "Password must be at least 6 characters, contain one uppercase letter and one number";
  }
  
  return null; // No errors
}

// Confirm password validation
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) {
    return "Please confirm your password";
  }
  
  if (password !== confirmPassword) {
    return "Passwords do not match";
  }
  
  return null; // No errors
}
