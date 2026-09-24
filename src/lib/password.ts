// Pure password rules (no Prisma/Next) — shared by the create-password page,
// the change-password form and their server actions, so the rule shown while
// typing is exactly the rule enforced.
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordCheck {
  longEnough: boolean;
  hasLetterAndDigit: boolean;
}

export function checkPassword(password: string): PasswordCheck {
  return {
    longEnough: password.length >= MIN_PASSWORD_LENGTH,
    hasLetterAndDigit: /[A-Za-z]/.test(password) && /\d/.test(password),
  };
}

// null = acceptable, otherwise the message to show.
export function validatePassword(password: string): string | null {
  const check = checkPassword(password);
  if (!check.longEnough) return `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  if (!check.hasLetterAndDigit) return "Kata sandi harus mengandung huruf dan angka.";
  return null;
}
