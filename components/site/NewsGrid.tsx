import Link from "next/link";
import type { Dict } from "@/content/dictionary";

const bands = ["", "card__band--blue", "card__band--red"];

export function NewsGrid({ dict }: { dict: Dict }) {
  return (
    <section className="section" id="actualites">
      <div className="container">
        <div className="sectionHead">
          <h2>{dict.news.heading}</h2>
          <Link href="#actualites">{dict.news.all}</Link>
        </div>

        <div className="news">
          {dict.news.items.map((item, index) => (
            <article className="card" key={item.title}>
              <div className={`card__band ${bands[index] ?? ""}`} />
              <div className="card__body">
                <div className="card__meta">
                  <span className="tag">{item.tag}</span>
                  <time>{item.date}</time>
                </div>
                <h3>{item.title}</h3>
                <p>{item.excerpt}</p>
                <Link className="card__link" href="#actualites">
                  {dict.news.read} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
