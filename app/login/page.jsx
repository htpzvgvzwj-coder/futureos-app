"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { email, password, displayName } : { email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          data.error === "email_taken"
            ? "That email is already registered."
            : data.error === "invalid_credentials"
              ? "Incorrect email or password."
              : "Something went wrong. Please try again."
        );
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="stage theme-light">
      <section className="phone" aria-label="FutureOS sign in">
        <div style={{ padding: "32px 22px", display: "grid", gap: "16px" }}>
          <div className="brandMark" style={{ justifySelf: "start" }}>
            OCBC
          </div>
          <div className="pageHeader">
            <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p>
              {mode === "login"
                ? "Sign in to continue to FutureOS."
                : "Set up FutureOS to start understanding where your life is heading."}
            </p>
          </div>

          <form onSubmit={submit} style={{ display: "grid", gap: "12px" }}>
            {mode === "signup" ? (
              <label className="inputField">
                <span>Display name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
              </label>
            ) : null}
            <label className="inputField">
              <span>Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="inputField">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "signup" ? 8 : undefined}
                required
              />
            </label>

            {error ? (
              <section className="adviceOnlyPanel">
                <p>{error}</p>
              </section>
            ) : null}

            <button type="submit" className="primaryButton" disabled={submitting}>
              {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}
