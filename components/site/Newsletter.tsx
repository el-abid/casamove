"use client";

import { useState } from "react";
import type { Dict } from "@/content/dictionary";

export function Newsletter({ dict }: { dict: Dict }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <section className="newsletter" id="tarifs">
      <div className="container">
        <div className="newsletter__card">
          <div>
            <h2>{dict.newsletter.title}</h2>
            <p>{dict.newsletter.sub}</p>
          </div>

          <div>
            <form
              className="nl-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!email.trim()) return;
                setDone(true);
                setEmail("");
              }}
            >
              <label className="sr-only" htmlFor="newsletter-email">
                {dict.newsletter.placeholder}
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                autoComplete="email"
                placeholder={dict.newsletter.placeholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button className="btn" type="submit">
                {dict.newsletter.button}
              </button>
            </form>

            {done ? (
              <p className="nl-success" role="status">
                {dict.newsletter.success}
              </p>
            ) : (
              <p className="nl-note">{dict.newsletter.consent}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
