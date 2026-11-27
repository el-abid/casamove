import type { IconKey } from "@/content/site";

export function Icon({ name, size = 20 }: { name: IconKey; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "tram") {
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="15" rx="3" />
        <path d="M5 11h14M9 21l1.5-3M15 21l-1.5-3" />
        <circle cx="9" cy="14" r="1" />
        <circle cx="15" cy="14" r="1" />
      </svg>
    );
  }

  if (name === "bus") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="14" rx="3" />
        <path d="M4 11h16M8 18v2M16 18v2M8 8h8" />
        <circle cx="8" cy="14.5" r="1" />
        <circle cx="16" cy="14.5" r="1" />
      </svg>
    );
  }

  if (name === "train") {
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="13" rx="3" />
        <path d="M5 10h14M9 16l-2 4M15 16l2 4M8 6h8" />
        <circle cx="9" cy="13" r="1" />
        <circle cx="15" cy="13" r="1" />
      </svg>
    );
  }

  if (name === "plane") {
    return (
      <svg {...common}>
        <path d="M10.5 13.5 3 10l2-2 6 1 4-4 2-1 1 1-1 2-4 4 1 6-2 2-3.5-7.5Z" />
      </svg>
    );
  }

  if (name === "ship") {
    return (
      <svg {...common}>
        <path d="M4 15h16l-2 5H6l-2-5ZM6 15V9h12v6M12 9V4M9 6h6" />
      </svg>
    );
  }

  if (name === "map") {
    return (
      <svg {...common}>
        <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
        <path d="M9 4v14M15 6v14" />
      </svg>
    );
  }

  if (name === "shop") {
    return (
      <svg {...common}>
        <path d="M4 10h16v9H4z" />
        <path d="M3 10 5 5h14l2 5M9 19v2M15 19v2M8 14h8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}
