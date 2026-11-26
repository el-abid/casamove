# Mobility API contracts

All examples use the local base URL `http://localhost:3000/api/mobility`. JSON writes require `Content-Type: application/json`. Errors have an `error` code and the relevant HTTP status. Private reads and writes require CasaMove's existing session. Administrative writes also require the admin role. The status and plan endpoints are deterministic and available without an NVIDIA key.

| Method and path | Purpose |
| --- | --- |
| GET `/network` | Version, attribution, lines, ordered stations, ride and transfer edges |
| GET `/lines` | Six ordered line records |
| GET `/stations?q=…` | French, Arabic or alias station search |
| GET `/stations/{id}` | Station, provenance-backed coordinate and accessibility state |
| GET `/network/status`, `/disruptions` | Current simulated constraints, status version and timestamp |
| POST `/routes/plan`, `/routes/recalculate` | Deterministic alternatives constrained by active incidents |
| GET `/space`, `/routes/saved`, `/reports`, `/notifications` | Current user's mobility data and specific account collections |
| POST `/routes/saved` | Store a named itinerary with alert preference |
| PATCH, DELETE `/routes/saved/{id}` | Edit name and alert preference or remove the current user's itinerary |
| POST `/favourites` | Set or clear a station favourite with `{station, add}` |
| PATCH `/preferences` | Set accessibility, history consent, saved-route notifications and preferred language |
| POST `/journeys/complete` | Write an owner-scoped completion when consent is enabled, deduplicated by UUID `key` |
| PATCH `/notifications` | Mark all shown notices read, or a selected `ids` array |
| POST `/reports` | Submit a category, station, optional endStation, severity and description |
| GET `/tower` | Admin counts, incidents, reports, audit activity and complaint distribution |
| POST `/disruptions` | Admin simulation with effect, IDs, title, category, severity and optional expiry |
| PATCH `/disruptions/{id}` | Update complete incident fields with `revision`, or resolve with `{action:"resolve", revision}` |
| PATCH `/reports/{id}` | Admin moderation using `status`, `revision` and optional `incidentId` |

### Plan a trip

```json
{
  "from": "t3-casa-port",
  "to": "bw1-sidi-maarouf",
  "preference": "fastest",
  "avoidLines": [],
  "avoidStations": []
}
```

The result includes `status`, `networkVersion`, `source`, `estimated` and up to three `journeys`. Each journey contains the complete path with line-specific IDs, ordered ride and walking legs, counts and accessibility status. A ride includes the correct destination terminus in `toward`, ordered `stations` and `passThrough` stations. A no-route or same-station outcome is a valid planning result. Bad input returns 400, session failures 401 or 403, stale edit revisions 409, submission limits 429 and unavailable storage 503.

### Example demonstration incident

```json
{
  "line": "T3",
  "station": "t3-dar-attouzani",
  "endStation": "t3-bd-mohammed-vi",
  "effect": "segment-closure",
  "severity": "major",
  "category": "operations",
  "title": "Fermeture simulée du segment",
  "description": "Exercice de supervision CasaMove.",
  "published": true
}
```

For future agent integration, call station search, status and planning through the read-side contract. Preserve the journey's estimate and simulation labels in responses. Treat a network status version as a snapshot, and recalculate when needed. This contract does not require changes to existing agents.
