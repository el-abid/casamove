# Upgrade changelog

- Digitised T1, T2, T3, T4, BW1 and BW2. Added bilingual station search, versioned diagram topology and a separately attributed geographic extract.
- Added estimated route alternatives, closure-aware planning, schematic and geographic maps, a responsive passenger homepage, passenger traffic pages and Travel Companion.
- Extended the authenticated account with favourites, saved routes, completed journeys with consent, preferences, notifications, report history and a demo card backed by existing subscriptions.
- Added the Control Tower for simulated incident management, audit history, network supervision and report moderation. Passenger routes update from the same persisted constraints.
- Added a PWA manifest, icon assets, a public-only offline cache and a static fallback. Docker's standalone stage copies required public assets. The tools stage includes the network import script dependencies.
- Added repeatable mobility migrations and tests. Existing agent, authentication, complaint, VoC and subscription implementations continue to serve their original entry points.

## Coverage decisions

- Operational status in CasaMove comes from administrator simulations. The official traffic page is available as a separate source. The project has no operator live feed, verified station-accessibility feed, vehicle tracker or ticket validation integration.
- The geographic map covers 143 of 151 stations and omits unverified positions and track geometries. The schematic covers the full source topology. Two T2 stations are currently excluded from boarding.
- Travel Companion uses passenger-confirmed progress and keeps an active session in its browser tab. Account history stores completions with consent. Notification read state persists. The feed shows recent account and saved-route events, and affected active journeys receive an in-page alert.
- The passenger interface is localised in French, Arabic and English. The administrative workbench follows the existing French console.

The homepage tram scene was generated for this project with the built-in ImageGen tool. The optimised asset is `public/casamove-boulevard.webp`.

> Editorial photorealistic landscape photograph for a Casablanca urban mobility website. A single modern silver and deep burgundy Casablanca-inspired tram travels toward camera on a broad green tram reservation, on the right half of frame. Actual-looking Casablanca city fabric: warm white art deco apartment blocks, subtle Moroccan details, mature palms along the boulevard, a few pedestrians, warm late-afternoon sun and a muted pale blue sky. Refined architectural travel photography, realistic track geometry, clean highlights, restrained navy and warm stone color grade, human scale, strong perspective. Wide cinematic crop, scene fills the frame. No readable text, logos, numbers, watermarks, overlays, or graphic elements. Illustrative scene rather than a named real station.
