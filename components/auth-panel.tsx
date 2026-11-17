"use client";
import { useState, type FormEvent, type ReactNode } from "react";
type Mode = "login" | "signup" | "reset" | "password";
export default function AuthPanel({
  mode,
  busy,
  feedback,
  onSubmit,
  onMode,
}: {
  mode: Mode;
  busy: boolean;
  feedback: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onMode: (mode: Mode) => void;
}) {
  const [password, setPassword] = useState("");
  const rules = [
    ["8 to 12 characters", password.length >= 8 && password.length <= 12],
    ["One uppercase letter", /[A-Z]/.test(password)],
    ["One lowercase letter", /[a-z]/.test(password)],
    ["One number", /[0-9]/.test(password)],
  ] as const;
  const [show, setShow] = useState(false);
  const change = (next: Mode) => {
    setShow(false);
    setPassword("");
    onMode(next);
  };
  return (
    <main className={`company-auth${mode === "signup" ? " company-signup" : ""}`}>
      <section className="company-auth-card" aria-labelledby="auth-title">
        <div
          className="company-logo"
          role="img"
          aria-label="Selangor Properties logo"
        />
        <h1 id="auth-title">
          {mode === "login"
            ? "Tenancy Agreement Tracker"
            : mode === "signup"
              ? "Create your account"
              : mode === "reset"
                ? "Reset your password"
                : "Choose a new password"}
        </h1>
        <p className="company-name">Selangor Properties Sdn. Bhd.</p>
        {mode !== "signup" && (
          <p className="company-intro">
            {mode === "login"
              ? "Sign in to track and manage your tenancy agreements."
              : mode === "reset"
                ? "Enter your email to receive a password reset link."
                : "Enter your new password below."}
          </p>
        )}
        {feedback}
        <form onSubmit={onSubmit}>
          {mode === "signup" && (
            <div className="company-name-fields">
              <label>First name<input name="first_name" autoComplete="given-name" placeholder="First name" required maxLength={100} pattern=".*\S.*" /></label>
              <label>Last name<input name="last_name" autoComplete="family-name" placeholder="Last name" required maxLength={100} pattern=".*\S.*" /></label>
            </div>
          )}
          {mode !== "password" && (
            <label>
              {" "}
              {mode === "login" || mode === "signup" ? "Username" : "Email address"}
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Email address"
                required
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Password
              <div className="company-password">
                <input
                  id="account-password"
                  name="password"
                  type={show ? "text" : "password"}
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={mode === "signup" ? 12 : undefined}
                  pattern={mode === "signup" ? "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,12}" : undefined}
                  aria-describedby={mode === "signup" ? "password-rules" : undefined}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
                <button
                  type="button"
                  aria-controls="account-password"
                  aria-pressed={show}
                  onClick={() => setShow(!show)}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </label>
          )}
          {mode === "signup" && (
            <ul id="password-rules" className="company-password-rules">
              {rules.map(([text, met]) => <li key={text} className={met ? "met" : ""}><span aria-hidden="true">{met ? "✓" : "○"}</span> {text}<span className="sr-only">{met ? " — met" : " — required"}</span></li>)}
            </ul>
          )}
          {mode === "login" && (
            <button
              type="button"
              className="company-forgot"
              onClick={() => change("reset")}
            >
              Forgot password?
            </button>
          )}
          <button className="company-submit" disabled={busy || (mode === "signup" && !rules.every(([, met]) => met))}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Save password"}
          </button>
        </form>
        <button
          className="company-switch"
          disabled={busy}
          onClick={() => change(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "New user? Create an account" : mode === "signup" ? "Already have an account? Sign in" : "Back to sign in"}
        </button>
        <p className="company-help">Need help? Contact IT Support</p>
        <footer>
          © {new Date().getFullYear()} Selangor Properties Sdn. Bhd. · Developed
          by IT Department
        </footer>
      </section>
    </main>
  );
}
