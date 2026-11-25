"use client";

export function LogoutButton({
  label,
  redirectTo,
}: {
  label: string;
  redirectTo: string;
}) {
  return (
    <button
      type="button"
      className="btn btn--ghost"
      onClick={async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          window.location.assign(redirectTo);
        }
      }}
    >
      {label}
    </button>
  );
}
