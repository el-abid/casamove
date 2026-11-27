"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Locale } from "@/content/dictionary";
import {
  mobilityText,
  mobilityValue,
  type MobilityLabel,
} from "@/content/mobility";
import { Icon } from "@/components/ui/Icon";
import {
  lines,
  network,
  stationById,
  type LineId,
} from "@/lib/mobility/network";
import {
  affectsJourney,
  planJourney,
  preferences,
  type Journey,
  type PlanInput,
} from "@/lib/mobility/routing";
import type { PassengerSpace } from "@/lib/mobility/store";
import {
  activeJourneyKey,
  formatTime,
  MobilityRequestError,
  mobilityRequest,
  recentStationsKey,
  sessionValue,
  storeSession,
  useNetworkStatus,
} from "./client";
import {
  LineBadge,
  NetworkMap,
  stationName,
  StationPicker,
} from "./NetworkMap";

type Tracking = {
  journey: Journey;
  input: PlanInput;
  current: string;
  paused: boolean;
  key: string;
  version: string;
};

function remaining(journey: Journey, current: string): Journey {
  const start = journey.stations.indexOf(current);
  const stations = journey.stations.slice(Math.max(0, start));
  const legs = journey.legs.flatMap((leg): Journey["legs"] => {
    if (leg.kind === "transfer")
      return stations.includes(leg.from) && stations.includes(leg.to)
        ? [leg]
        : [];
    const kept = leg.stations.filter((stop) => stations.includes(stop));
    return kept.length > 1
      ? [
          {
            ...leg,
            stations: kept,
            passThrough: leg.passThrough.filter(
              (stop) => stop !== current && kept.includes(stop)
            ),
            minutes:
              (leg.minutes * (kept.length - 1)) / (leg.stations.length - 1),
          },
        ]
      : [];
  });
  return {
    ...journey,
    stations,
    legs,
    minutes: Math.ceil(legs.reduce((total, leg) => total + leg.minutes, 0)),
    stops: legs.reduce(
      (total, leg) =>
        total +
        (leg.kind === "ride"
          ? leg.stations.length - 1 - leg.passThrough.length
          : 0),
      0
    ),
    transfers: legs.filter((leg) => leg.kind === "transfer").length,
  };
}

function itineraryPath(locale: Locale, input: PlanInput) {
  const query = new URLSearchParams({
    from: input.from,
    to: input.to,
    preference: input.preference,
  });
  return `/${locale}/journey?${query}`;
}

export function StatusPanel({
  locale,
  state,
  compact = false,
}: {
  locale: Locale;
  state: ReturnType<typeof useNetworkStatus>;
  compact?: boolean;
}) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  const { connection, status, lastSync } = state;
  return (
    <div className="mob-status">
      <div className="mob-inline mob-status-head">
        <span className="mob-tag">
          <i aria-hidden />
          {t("demo")}
        </span>
        {lastSync && (
          <small>
            {t("synced")} {formatTime(lastSync, locale)}
          </small>
        )}
      </div>
      {connection === "unavailable" || connection === "offline" ? (
        <p>
          {connection === "offline" && (
            <>
              <strong>{t("offline")}</strong> ·{" "}
            </>
          )}
          {t("stale")}
        </p>
      ) : connection === "loading" ? (
        <p role="status">{t("checking")}</p>
      ) : status?.incidents.length ? (
        <ul className="mob-alerts">
          {status.incidents
            .slice(0, compact ? 3 : undefined)
            .map((incident) => (
              <li key={incident.id}>
                <LineBadge id={incident.line} />
                <div>
                  <strong>
                    {incident.title || mobilityValue(locale, incident.effect)}
                  </strong>
                  <span>
                    {mobilityValue(locale, incident.effect)}
                    {incident.station &&
                      ` · ${stationName(incident.station, locale)}`}
                    {incident.endStation &&
                      ` ↔ ${stationName(incident.endStation, locale)}`}
                  </span>
                  {!compact && incident.description && (
                    <p>{incident.description}</p>
                  )}
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <p>{t("clear")}</p>
      )}
      <a href={network.operatorTraffic}>{t("official")}</a>
    </div>
  );
}

export function RouteTimeline({
  journey,
  locale,
}: {
  journey: Journey;
  locale: Locale;
}) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  return (
    <ol className="mob-timeline">
      {journey.legs.map((leg, index) =>
        leg.kind === "transfer" ? (
          <li className="mob-walk" key={index}>
            <span className="mob-step-marker" aria-hidden>
              ↔
            </span>
            <div>
              <strong>{t("transfer")}</strong>
              <p>
                {stationName(leg.from, locale)} <span aria-hidden>↔</span>{" "}
                {stationName(leg.to, locale)}
              </p>
            </div>
          </li>
        ) : (
          <li key={index}>
            <span className="mob-step-marker">
              <LineBadge id={leg.line} />
            </span>
            <div>
              <strong>
                {t("toward")} {stationName(leg.toward, locale)}
              </strong>
              <p>
                {stationName(leg.stations[0], locale)}{" "}
                <span className="mob-arrow" aria-hidden>
                  →
                </span>{" "}
                {stationName(leg.stations.at(-1)!, locale)}
              </p>
              <details>
                <summary>
                  {t("showStops")} ·{" "}
                  {leg.stations.length - 1 - leg.passThrough.length}
                </summary>
                <ol>
                  {leg.stations.map((id) => (
                    <li key={id}>
                      {stationName(id, locale)}
                      {leg.passThrough.includes(id) && (
                        <small> · {t("passThrough")}</small>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          </li>
        )
      )}
    </ol>
  );
}

function SaveJourney({ locale, input }: { locale: Locale; input: PlanInput }) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  const [feedback, setFeedback] = useState<
    "success" | "failure" | "signInSave" | "serviceOffline"
  >();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await mobilityRequest("routes/saved", "POST", {
        ...input,
        name: form.get("name"),
        notify: true,
      });
      setFeedback("success");
    } catch (error) {
      setFeedback(
        error instanceof MobilityRequestError && error.status === 401
          ? "signInSave"
          : !navigator.onLine
            ? "serviceOffline"
            : "failure"
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="mob-save">
      <summary>{t("saveRoute")}</summary>
      <form onSubmit={submit} className="mob-inline">
        <label>
          {t("routeName")}
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={stationName(input.to, locale)}
          />
        </label>
        <button className="mob-button" disabled={busy}>
          {t("save")}
        </button>
      </form>
      {feedback && (
        <p role="status">
          {t(feedback)}{" "}
          {feedback === "signInSave" && (
            <Link
              href={`/login?next=${encodeURIComponent(itineraryPath(locale, input))}`}
            >
              {t("signIn")}
            </Link>
          )}
        </p>
      )}
    </details>
  );
}

export function JourneyPlanner({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const t = (label: MobilityLabel) => mobilityText(locale, label);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preference, setPreference] =
    useState<PlanInput["preference"]>("fastest");
  const [avoidLines, setAvoidLines] = useState<LineId[]>([]);
  const [avoidStation, setAvoidStation] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanInput>();
  const [initial, setInitial] = useState<{
    journey: Journey;
    version: string;
  }>();
  const [alternative, setAlternative] = useState(0);
  const [error, setError] = useState<MobilityLabel>();
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [acknowledged, setAcknowledged] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [completeState, setCompleteState] = useState<
    "completed" | "failure" | "serviceOffline"
  >();
  const [initializing, setInitializing] = useState(false);
  const state = useNetworkStatus(!compact);
  const version = state.status?.version ?? network.version;
  const impacts = state.status?.incidents;

  useEffect(() => {
    const cached = sessionValue<string[]>(recentStationsKey);
    if (Array.isArray(cached))
      setRecent(cached.filter((id) => stationById.has(id)).slice(0, 5));
    if (compact) return;
    const query = new URLSearchParams(window.location.search);
    const start = query.get("from") ?? "";
    const end = query.get("to") ?? "";
    const requestedPreference = preferences.find(
      (item) => item === query.get("preference")
    );
    if (stationById.has(start)) setFrom(start);
    if (stationById.has(end)) setTo(end);
    if (requestedPreference) setPreference(requestedPreference);
    const saved = sessionValue<Tracking>(activeJourneyKey);
    const restore =
      saved?.current &&
      stationById.has(saved.current) &&
      (!start || start === saved.input.from) &&
      (!end || end === saved.input.to) &&
      (!requestedPreference || requestedPreference === saved.input.preference);
    if (restore) {
      setTracking(saved);
      setPlan(saved.input);
      setFrom(saved.input.from);
      setTo(saved.input.to);
      setPreference(saved.input.preference);
      setAvoidLines(saved.input.avoidLines ?? []);
      setAvoidStation(saved.input.avoidStations?.[0] ?? "");
      return;
    }
    if (stationById.has(start) && stationById.has(end)) {
      setPlan({
        from: start,
        to: end,
        preference: requestedPreference ?? "fastest",
      });
    } else if (!requestedPreference) {
      let cancelled = false;
      void mobilityRequest<PassengerSpace>("space")
        .then(({ preferences }) => {
          if (!cancelled && preferences.accessibility)
            setPreference("accessible");
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
  }, [compact]);

  const result = useMemo(
    () => (plan ? planJourney(plan, impacts) : undefined),
    [plan, impacts]
  );
  const selected = result?.journeys[alternative] ?? result?.journeys[0];
  useEffect(() => {
    if (selected && !initial) setInitial({ journey: selected, version });
  }, [selected, initial, version]);

  const base = tracking
    ? remaining(tracking.journey, tracking.current)
    : initial?.journey;
  const baseVersion = tracking?.version ?? initial?.version;
  const impacting =
    base && baseVersion !== version
      ? (impacts?.filter((impact) => affectsJourney(base, [impact])) ?? [])
      : [];
  const impactKey = impacting
    .map(({ id, revision }) => `${id}.${revision}`)
    .join("|");
  const alternativeFromHere = useMemo(
    () =>
      tracking && plan
        ? planJourney({ ...plan, from: tracking.current }, impacts, 1)
            .journeys[0]
        : selected,
    [tracking, plan, impacts, selected]
  );
  const route = tracking
    ? ((impacting.length && !showOriginal ? alternativeFromHere : base) ?? base)
    : ((showOriginal ? base : selected) ??
      (impacting.length ? base : undefined));

  function updateTracking(value: Tracking | null) {
    setTracking(value);
    storeSession(activeJourneyKey, value);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!from || !to || from === to) {
      setError(from && to ? "same-station" : "unknown-station");
      return;
    }
    const input = {
      from,
      to,
      preference,
      avoidLines,
      avoidStations: avoidStation ? [avoidStation] : [],
    };
    const nextRecent = [...new Set([from, to, ...recent])].slice(0, 5);
    setRecent(nextRecent);
    storeSession(recentStationsKey, nextRecent);
    if (compact) {
      window.location.assign(itineraryPath(locale, input));
      return;
    }
    setInitializing(true);
    setPlan(input);
    setInitial(undefined);
    setAlternative(0);
    setAcknowledged("");
    setShowOriginal(false);
    setCompleteState(undefined);
    window.setTimeout(() => setInitializing(false), 0);
  }

  async function advance(next: string | undefined) {
    if (!tracking || !next) return;
    if (next !== tracking.input.to) {
      updateTracking({ ...tracking, current: next });
      return;
    }
    updateTracking(null);
    setCompleteState("completed");
    try {
      if (navigator.onLine) {
        await mobilityRequest("journeys/complete", "POST", {
          ...tracking.input,
          key: tracking.key,
        });
      }
    } catch (error) {
      if (!(error instanceof MobilityRequestError && error.status === 401))
        setCompleteState("failure");
    }
  }

  const passThrough = new Set(
    tracking?.journey.legs.flatMap((leg) =>
      leg.kind === "ride" ? leg.passThrough : []
    )
  );
  for (const incident of impacts ?? []) {
    if (incident.effect === "station-closure" && incident.station)
      passThrough.add(incident.station);
  }
  const next = base?.stations.slice(1).find((id) => !passThrough.has(id));

  return (
    <div
      className={compact ? "mob-planner mob-planner--compact" : "mob-planner"}
      data-reveal={compact ? undefined : true}
    >
      <div className="mob-card mob-planner-card">
        <h2>
          <Icon name="tram" /> {t("plannerTitle")}
        </h2>
        <form onSubmit={submit}>
          <div className="mob-route-fields">
            <StationPicker
              locale={locale}
              label={t("from")}
              selected={from}
              onChange={setFrom}
              recent={recent}
              required
            />
            <button
              type="button"
              className="mob-swap"
              aria-label={t("swap")}
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
            >
              ⇅
            </button>
            <StationPicker
              locale={locale}
              label={t("to")}
              selected={to}
              onChange={setTo}
              recent={recent}
              required
            />
          </div>
          {!compact && (
            <div className="mob-plan-options">
              <label>
                {t("preference")}
                <select
                  value={preference}
                  onChange={(event) => {
                    const value = preferences.find(
                      (item) => item === event.target.value
                    );
                    if (value) setPreference(value);
                  }}
                >
                  {preferences.map((item) => (
                    <option key={item} value={item}>
                      {t(item)}
                    </option>
                  ))}
                </select>
              </label>
              <details>
                <summary>{t("avoid")}</summary>
                <div className="mob-inline mob-avoid">
                  {lines.map((line) => (
                    <label key={line.id}>
                      <input
                        type="checkbox"
                        checked={avoidLines.includes(line.id)}
                        onChange={(event) => {
                          setAvoidLines((current) =>
                            event.target.checked
                              ? [...current, line.id]
                              : current.filter((id) => id !== line.id)
                          );
                        }}
                      />
                      <LineBadge id={line.id} />
                    </label>
                  ))}
                </div>
                <StationPicker
                  locale={locale}
                  label={t("station")}
                  selected={avoidStation}
                  onChange={setAvoidStation}
                />
              </details>
            </div>
          )}
          <button
            className="mob-button mob-primary"
            disabled={!!tracking || initializing}
          >
            {t("plan")}{" "}
            <span className="mob-arrow" aria-hidden>
              →
            </span>
          </button>
        </form>
        {error && (
          <p className="mob-error" role="alert">
            {t(error)}
          </p>
        )}
        {compact && (
          <Link
            className="mob-example"
            href={itineraryPath(locale, {
              from: "t3-casa-port",
              to: "bw1-sidi-maarouf",
              preference: "fastest",
            })}
          >
            <LineBadge id="T3" />
            <LineBadge id="BW1" /> {stationName("t3-casa-port", locale)}{" "}
            <span aria-hidden>↔</span> {stationName("bw1-sidi-maarouf", locale)}
          </Link>
        )}
      </div>
      {!compact && (
        <>
          <StatusPanel locale={locale} state={state} compact />
          {impactKey && acknowledged !== impactKey && (
            <section className="mob-impact" role="status">
              <span className="mob-tag">{t("demo")}</span>
              <h2>{t("impact")}</h2>
              <p>
                {impacting
                  .map(
                    (incident) =>
                      `${incident.line} · ${incident.title || mobilityValue(locale, incident.effect)}`
                  )
                  .join(" / ")}
              </p>
              {!alternativeFromHere && (
                <p>
                  <strong>{t("noAlternative")}</strong>
                </p>
              )}
              <div className="mob-inline">
                {alternativeFromHere && (
                  <button
                    type="button"
                    className="mob-button"
                    onClick={() => setShowOriginal(!showOriginal)}
                  >
                    {t(showOriginal ? "revised" : "original")}
                  </button>
                )}
                <button
                  type="button"
                  className="mob-button"
                  onClick={() => setAcknowledged(impactKey)}
                >
                  {t("acknowledge")}
                </button>
              </div>
            </section>
          )}
          {tracking && (
            <section className="mob-card mob-companion" data-reveal>
              <span className="mob-tag">{t("manual")}</span>
              <h2>{t("companion")}</h2>
              <p>
                {t("current")} ·{" "}
                <strong>{stationName(tracking.current, locale)}</strong>
              </p>
              {next && (
                <p>
                  <strong>{stationName(next, locale)}</strong>
                </p>
              )}
              <div className="mob-inline">
                {impactKey && alternativeFromHere && (
                  <button
                    className="mob-button mob-primary"
                    onClick={() => {
                      updateTracking({
                        ...tracking,
                        journey: alternativeFromHere,
                        version,
                        paused: false,
                      });
                      setAcknowledged(impactKey);
                      setShowOriginal(false);
                    }}
                  >
                    {t("reroute")}
                  </button>
                )}
                <button
                  className="mob-button mob-primary"
                  disabled={tracking.paused || !!impactKey || !next}
                  onClick={() => void advance(next)}
                >
                  {t("next")}
                </button>
                <button
                  className="mob-button"
                  onClick={() =>
                    updateTracking({ ...tracking, paused: !tracking.paused })
                  }
                >
                  {t(tracking.paused ? "resume" : "pause")}
                </button>
                <button
                  className="mob-button"
                  onClick={() => {
                    updateTracking(null);
                    setShowOriginal(false);
                  }}
                >
                  {t("end")}
                </button>
              </div>
            </section>
          )}
          {completeState && (
            <p className="mob-card" role="status">
              {t(completeState)}
            </p>
          )}
          {!!result && result.status !== "ok" && !tracking && (
            <p className="mob-error" role="status">
              {t(result.status)}
            </p>
          )}
          {route && plan && (
            <section className="mob-card mob-route-result" data-reveal>
              {!tracking && result && result.journeys.length > 1 && (
                <div className="mob-filters">
                  {result.journeys.map((journey, index) => (
                    <button
                      key={journey.stations.join("/")}
                      type="button"
                      aria-pressed={index === alternative}
                      onClick={() => {
                        setAlternative(index);
                        if (!impactKey) setInitial({ journey, version });
                      }}
                    >
                      {t("alternative")} {index + 1} · {journey.minutes} min
                    </button>
                  ))}
                </div>
              )}
              <h2>
                {stationName(route.stations[0], locale)}{" "}
                <span className="mob-arrow" aria-hidden>
                  →
                </span>{" "}
                {stationName(route.stations.at(-1)!, locale)}
              </h2>
              <div className="mob-route-metrics">
                <strong>{route.minutes} min</strong>
                <span>
                  {route.stops} {t(route.stops === 1 ? "stop" : "stops")}
                </span>
                <span>
                  {route.transfers}{" "}
                  {t(route.transfers === 1 ? "transferCount" : "transfers")}
                </span>
              </div>
              <p className="mob-muted">
                {t("estimates")}{" "}
                {t(
                  route.accessibility === "restricted"
                    ? "accessRestricted"
                    : "accessUnknown"
                )}
              </p>
              {!tracking && selected && !showOriginal && (
                <div className="mob-inline">
                  <button
                    className="mob-button mob-primary"
                    onClick={() =>
                      updateTracking({
                        input: plan,
                        journey: selected,
                        current: selected.stations[0],
                        key: crypto.randomUUID(),
                        paused: false,
                        version,
                      })
                    }
                  >
                    {t("start")}
                  </button>
                  <SaveJourney
                    key={`${plan.from}:${plan.to}`}
                    locale={locale}
                    input={plan}
                  />
                </div>
              )}
              <RouteTimeline journey={route} locale={locale} />
              <NetworkMap
                locale={locale}
                journey={route}
                impacts={impacts}
                showDirectory={false}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
