import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { tiles } from "@/content/site";
import type { Dict } from "@/content/dictionary";

export function QuickAccess({ dict }: { dict: Dict }) {
  return (
    <section className="tiles" id="lignes">
      <div className="container tiles__grid">
        {tiles.map((tile) => (
          <Link key={tile.key} className="tile" href={tile.href}>
            <span className="tile__icon">
              <Icon name={tile.icon} />
            </span>
            <span>
              <b>{dict.tiles[tile.key].title}</b>
              <span>{dict.tiles[tile.key].desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
