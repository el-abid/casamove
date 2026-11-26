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
          try {
            sessionStorage.removeItem("casamove-active-journey");
            sessionStorage.removeItem("casamove-recent-stations");
          } catch {
            // Sign-out still works when browser storage is disabled.
          }
          window.location.assign(redirectTo);
        }
      }}
    >
      {label}
    </button>
  );
}
