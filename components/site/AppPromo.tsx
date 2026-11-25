import { storeLinks } from "@/content/site";
import type { Dict } from "@/content/dictionary";

export function AppPromo({ dict }: { dict: Dict }) {
  return (
    <section className="app" id="application">
      <div className="container app__grid">
        <div>
          <span className="kicker">{dict.app.kicker}</span>
          <h2>{dict.app.title}</h2>
          <p className="app__sub">{dict.app.sub}</p>

          <div className="app__features">
            {dict.app.features.map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>

          <div className="stores">
            <a className="store" href={storeLinks.apple}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M16.4 12.9c0-2 1.6-3 1.7-3.1-.9-1.4-2.3-1.6-2.8-1.6-1.2-.1-2.3.7-2.9.7-.6 0-1.5-.7-2.5-.7-1.3 0-2.5.8-3.1 1.9-1.3 2.3-.3 5.7 1 7.6.6.9 1.4 1.8 2.4 1.8 1 0 1.3-.6 2.5-.6s1.5.6 2.5.6c1 0 1.7-.9 2.3-1.8.7-1 1-2 1-2.1-.1 0-2.1-.8-2.1-2.7ZM14.6 6.7c.5-.6.8-1.5.7-2.4-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.3.8.1 1.6-.4 2.2-1Z" />
              </svg>
              <span>
                <small>{dict.app.apple}</small>
                <b>iOS</b>
              </span>
            </a>
            <a className="store" href={storeLinks.google}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M4 3.6v16.8c0 .5.6.9 1 .6l9.3-8.4-9.3-8.4c-.4-.3-1 0-1 .6Zm11.6 7.1 2.5 2.3-2.5 2.3-2.6-2.3 2.6-2.3Zm1.3-1.2 3.2 2.9c.5.4.5 1.1 0 1.5l-3.2 2.9-2.9-2.6 2.9-2.7-2.9-2.6 2.9-.4Z" />
              </svg>
              <span>
                <small>{dict.app.google}</small>
                <b>Android</b>
              </span>
            </a>
          </div>
        </div>

        <div className="phone" aria-hidden>
          <div className="phone__screen">
            <div className="phone__top">CasaMove</div>
            <div className="phone__body">
              <div className="phone__msg phone__msg--bot">
                {dict.chat.greeting}
              </div>
              <div className="phone__msg phone__msg--user">Ligne 1</div>
              <div className="phone__msg phone__msg--bot">
                {dict.chat.answers.itinerary}
              </div>
            </div>
            <div className="phone__input">{dict.chat.placeholder}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
