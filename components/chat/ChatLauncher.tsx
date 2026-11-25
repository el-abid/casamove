import type { Dict } from "@/content/dictionary";

export function ChatLauncher({
  dict,
  onOpen,
}: {
  dict: Dict;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="launcher"
      onClick={onOpen}
      aria-label={dict.chat.open}
    >
      <span className="launcher__icon" aria-hidden>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        >
          <path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      </span>
      <span className="launcher__label">{dict.chat.launcher}</span>
    </button>
  );
}
