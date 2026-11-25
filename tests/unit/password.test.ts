import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("mots de passe", () => {
  it("vérifie le bon mot de passe", () => {
    const stored = hashPassword("CasaMove2026!");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("CasaMove2026!", stored)).toBe(true);
  });

  it("refuse un mauvais mot de passe", () => {
    const stored = hashPassword("CasaMove2026!");
    expect(verifyPassword("CasaMove2027!", stored)).toBe(false);
  });

  it("refuse un hash malformé", () => {
    expect(verifyPassword("test", "pas-un-hash")).toBe(false);
  });

  it("produit deux sels différents", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });
});
