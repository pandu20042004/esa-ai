"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthFormState } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="login-form">
      <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>

      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </label>

      {mode === "signup" ? (
        <label>
          Confirm password
          <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
        </label>
      ) : null}

      {state?.error ? <p className="login-error">{state.error}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? "Please wait..." : mode === "signin" ? "Sign in" : "Sign up"}
      </button>

      <button
        type="button"
        className="login-toggle"
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
