
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
    return "Password must be at least 6 characters";
  }
  
  return null; // No errors
}
