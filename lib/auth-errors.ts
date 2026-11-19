type AuthFailure = { status?: number; message?: string; code?: string };
export function authErrorMessage(error: AuthFailure, mode: string): string {
  const message = error.message ?? "Account request failed.";
  if (error.status === 504 || /\b504\b|timed?\s*out/i.test(message)) {
    return mode === "signup"
      ? "Registration timed out. We could not confirm whether your account was created. Check your inbox and junk folder for a confirmation email before trying again. If no email arrives, contact your administrator to check the registration and email service."
      : "The account service took too long to respond. Please wait a moment and try again.";
  }
  if (error.code === "over_email_send_rate_limit" || error.status === 429)
    return "Too many account requests. Please wait a few minutes before trying again.";
  return message;
}
