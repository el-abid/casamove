# Casablanca network data

The canonical topology is `content/network/casablanca.ts`, version `2026-11-26.1`. The station order and French and Arabic labels were transcribed from the six supplied diagrams. Diagram identifiers refer to the filename suffixes. The repository copy of the operator's information guide, sections 9 and 16, corroborates the sequence and all 13 transfer pairs. The latest operator map was checked on 26 November 2026. [Casatramway network map](https://www.casatramway.ma/se-deplacer/carte-reseau)

| Line | Diagram suffix | Stations | Boarding unconfirmed |
| --- | --- | ---: | ---: |
| T1 | 10.32.57 AM (3) | 37 | 0 |
| T2 | 10.32.58 AM | 33 | 2 |
| T3 | 10.32.58 AM (1) | 20 | 0 |
| T4 | 10.32.57 AM | 19 | 0 |
| BW1 | 10.32.57 AM (1) | 20 | 0 |
| BW2 | 10.32.57 AM (2) | 22 | 0 |
| Total | | 151 | 2 |

The validator computed 145 adjacent ride segments and 13 interchanges, all bidirectional. A transfer connects two stable, line-specific station IDs. Station names are available in French and Arabic, with accent-insensitive search and aliases for variants such as Mohamed/Mohammed Diouri and Khayam/Khayyam.

Anfa Park and Cimetière Achouhada appear grey on the supplied T2 diagram. The 2023 timetable includes both and the later service information lacks station-level confirmation. They remain on the schematic and can be passed through. The planner excludes boarding, alighting and transfers at them pending current confirmation. [2023 T2 timetable](https://files.casatramway.ma/s3fs-public/documents/Fiche%20Horaires%20Ligne%20T2%202023.pdf?VersionId=YdE_42aS8pH_HGur96QObDTIoNApiQ51) [2026 service timetables](https://www.casatramway.ma/informations/info-horaires-0)

## Geographic coverage and attribution

The separate `content/network/geography.json` extract has 143 points. Each coordinate identifies an exact OSM node and its source route relation. The route relations were checked for the correct line reference. Named stop or platform members matched the diagram station via a normalised name or an identifiable spelling variant. The diagrams determine service order where OSM membership or ordering differs. [Casablanca route relations](https://wiki.openstreetmap.org/wiki/Casablanca#Casa_Tramway_and_CasaBusway_Network_(RATP_Dev_Casablanca))

Eight stations have no point in the extract. T1 Technopark, T3 Idriss El Allam, T4 Driss El Harti and Zone industrielle, BW1 Jardin Sunday, and BW2 Yaacoub Al Mansour, Aéropostale and Abouab Oulfa. A shared OSM label for El Allam and El Harti was insufficient to assign separate positions. The nearest plausible alternative names were excluded where the match could not be established. The geographic view uses points only. The schematic's display coordinates come from each diagram's order.

Coordinate extract © OpenStreetMap contributors, licensed under ODbL 1.0. Leaflet fetches visible map tiles from OpenStreetMap on demand. The service worker excludes the tile origin. [OSM attribution](https://www.openstreetmap.org/copyright) [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) [Tile usage policy](https://operations.osmfoundation.org/policies/tiles/)

All physical accessibility fields remain unknown pending a verified station and transfer dataset. No live operational feed is connected. The traffic page links to the operator for current service.

## Repeatable import

The first database-backed mobility request creates the schema and imports the bundled version in one transaction. For explicit verification, run `node scripts/import-mobility-network.ts` against the development database or run it in the Compose tools image.

```powershell
docker compose run --rm --build seed node scripts/import-mobility-network.ts
```

The command prints validator counts. Repeating it preserves the imported version and historical station IDs. Changes to station definitions require advancing the canonical version.
