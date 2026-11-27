"use client";

export function LogoutButton({
  label,
  redirectTo,
  className = "btn btn--ghost",
}: {
  label: string;
  redirectTo: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
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
