import React, { useState } from "react";
import { logIn } from "../lib/api";

// The whole app is behind this, so it is the only thing a signed-out visitor
// ever sees. There is no sign-up link: accounts are made from the console.
export default function LoginPage({ notice, onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      onSignedIn(await logIn(email, password));
    } catch (failure) {
      // 401 is the ordinary "wrong details" answer; anything else means the
      // request never got that far.
      setError(
        failure.status === 401
          ? failure.errors?.base?.[0] || "Email or password is incorrect."
          : "Could not sign in. Is the server running?",
      );
      setSubmitting(false);
    }
  };

  return (
    <form className="card login" onSubmit={handleSubmit} noValidate>
      <h1 className="login__heading">Company Manager</h1>
      <p className="login__intro muted">Sign in to continue.</p>

      {/* Why you are looking at this form again, when you had not signed out. */}
      {notice && !error && <p className="alert alert--notice">{notice}</p>}

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          autoComplete="username"
          autoFocus
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <button type="submit" className="button" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
