"use client";

import { useState } from "react";

export function LoginForm({
  denied,
  next,
}: {
  denied: boolean;
  next?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    denied ? "Ce compte n'a pas accès à la console." : ""
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next }),
      });

      const data = (await response.json()) as {
        redirect?: string;
        error?: string;
      };

      if (!response.ok || !data.redirect) {
        setError(
          data.error === "invalid_credentials"
            ? "Email ou mot de passe incorrect."
            : "Connexion impossible. Réessayez."
        );
        return;
      }

      window.location.assign(data.redirect);
    } catch {
      setError("Connexion impossible. Vérifiez le serveur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <label className="auth-field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="vous@exemple.ma"
        />
      </label>

      <label className="auth-field">
        <span>Mot de passe</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Votre mot de passe"
        />
      </label>

      <button className="btn auth-submit" type="submit" disabled={busy}>
        {busy ? "Connexion…" : "Se connecter"}
      </button>

      <p className="auth-hint">
        Console agents : connectez-vous avec un compte administrateur.
      </p>
    </form>
  );
}
