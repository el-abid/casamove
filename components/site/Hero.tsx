import Link from "next/link";
import type { Dict } from "@/content/dictionary";

export function Hero({ dict }: { dict: Dict }) {
  return (
    <section className="hero" id="se-deplacer">
      <div className="container hero__grid">
        <div>
          <span className="kicker">{dict.hero.kicker}</span>
          <h1>{dict.hero.title}</h1>
          <p className="hero__sub">{dict.hero.sub}</p>

          <div className="searchcard">
            <div className="field">
              <label>{dict.hero.from}</label>
              <b>{dict.hero.fromValue}</b>
            </div>
            <div className="field">
              <label>{dict.hero.to}</label>
              <b>{dict.hero.toValue}</b>
            </div>
            <Link className="btn" href="#lignes">
              {dict.hero.cta}
            </Link>
          </div>
        </div>

        <div className="hero__map" id="carte">
          <span className="mapchip">{dict.hero.mapTitle}</span>
          <svg
            viewBox="0 0 520 340"
            preserveAspectRatio="xMidYMid slice"
            fill="none"
            role="img"
            aria-label={dict.hero.mapTitle}
          >
            <path
              d="M 10 268 L 130 224 L 248 236 L 366 158 L 512 128"
              stroke="#F5A524"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 30 78 L 168 118 L 300 84 L 424 140 L 508 236"
              stroke="#7FD1C0"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 74 314 L 188 262 L 292 284 L 392 238 L 486 258"
              stroke="#F27D5E"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g fill="#fff">
              <circle cx="130" cy="224" r="5" />
              <circle cx="248" cy="236" r="5" />
              <circle cx="366" cy="158" r="5" />
              <circle cx="168" cy="118" r="5" />
              <circle cx="300" cy="84" r="5" />
              <circle cx="424" cy="140" r="5" />
              <circle cx="188" cy="262" r="5" />
              <circle cx="292" cy="284" r="5" />
              <circle cx="392" cy="238" r="5" />
            </g>
            <circle
              cx="366"
              cy="158"
              r="9"
              stroke="#F5A524"
              strokeWidth="2"
              fill="#1b2a4a"
            />
          </svg>

          <div className="maplegend" aria-hidden>
            <span>
              <i style={{ background: "#F5A524" }} />
              {dict.hero.legend1}
            </span>
            <span>
              <i style={{ background: "#7FD1C0" }} />
              {dict.hero.legend2}
            </span>
            <span>
              <i style={{ background: "#F27D5E" }} />
              {dict.hero.legend3}
            </span>
          </div>

          <div className="mapstats">
            <span>{dict.hero.stats}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
