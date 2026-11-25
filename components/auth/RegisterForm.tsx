"use client";

import { useState } from "react";

const ERRORS: Record<string, string> = {
  email_taken: "Un compte existe déjà avec cet email.",
  weak_password: "Le mot de passe doit contenir au moins 8 caractères.",
  invalid_email: "Adresse email invalide.",
  invalid_name: "Indiquez votre nom complet.",
};

export function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (password.length < 8) {
      setError(ERRORS.weak_password);
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, password }),
      });

      const data = (await response.json()) as {
        redirect?: string;
        error?: string;
      };

      if (!response.ok || !data.redirect) {
        setError(ERRORS[data.error ?? ""] ?? "Inscription impossible.");
        return;
      }

      window.location.assign(data.redirect);
    } catch {
      setError("Inscription impossible. Vérifiez le serveur.");
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
        <span>Nom complet</span>
        <input
          required
          minLength={2}
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Youssef Berrada"
        />
      </label>

      <label className="auth-field">
        <span>Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="vous@exemple.ma"
        />
      </label>

      <label className="auth-field">
        <span>Téléphone</span>
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="06 00 00 00 00"
        />
      </label>

      <label className="auth-field">
        <span>Mot de passe</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="8 caractères minimum"
        />
      </label>

      <label className="auth-field">
        <span>Confirmation</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="Répétez le mot de passe"
        />
      </label>

      <button className="btn auth-submit" type="submit" disabled={busy}>
        {busy ? "Création…" : "Créer mon compte"}
      </button>

      <p className="auth-hint">
        Le compte usager permet de suivre vos dossiers. La console reste
        réservée aux administrateurs.
      </p>
    </form>
  );
}
