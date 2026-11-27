import type { ProviderId } from "@/content/providers";

export function BrandMark({
  provider,
  brand,
  accent,
}: {
  provider: ProviderId;
  brand: string;
  accent: string;
}) {
  if (provider === "tram") {
    return <span className="brand__mark" aria-hidden />;
  }

  return (
    <span
      className="brand__mark brand__mark--plain"
      style={{ background: accent }}
      aria-hidden
    >
      {brand.charAt(0)}
    </span>
  );
}
