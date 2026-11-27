# Audit données ALSA / Casabus

Date : 27 novembre 2026
Source principale : `https://www.casabus.ma/` (réseau Casabus opéré par ALSA)
Périmètre : agglomération de Casablanca et Mohammedia, 57 lignes.

## Verdict

Go. Les données réseau sont accessibles via une API publique non authentifiée et des fichiers GTFS JSON hébergés sur Azure. Aucun scraping HTML n'est nécessaire pour les lignes, arrêts, tracés et horaires. Le HTML reste utile pour les tarifs, la FAQ et les incidents.

## Sources

| Source | Type | Accès | Remarque |
|---|---|---|---|
| `https://api.alsaalbaida.ma` | API JSON | POST public, sans clé | Répond avec un `Origin` casabus |
| `https://storageacntcasabusonly.blob.core.windows.net/gtfs` | GTFS JSON | GET public | `stops.json`, `shapes.json`, `shape/{routeId}.json` |
| `https://www.casabus.ma` | Site | Public, protégé par Imperva | Pages tarifs, FAQ, incidents, agences |
| `robots.txt` alsa.ma | Texte | Public | `User-Agent: * Disallow:` sauf Amazonbot |
| `robots.txt` casabus.ma | Absent | 404 | À traiter comme « pas d'interdiction explicite » |

## API réseau

Toutes les requêtes sont en `POST` JSON, sans authentification. Un en-tête `Origin: https://www.casabus.ma` suffit.

### `POST /api/Routes/busList`

Corps : `{"keyword":""}`

Réponse : 57 lignes.

```json
{
  "success": true,
  "data": {
    "busList": [
      {
        "routeId": "1",
        "routeShortName": "L001",
        "routeColor": "FF00CC",
        "routeTextColor": "FFFFFF"
      }
    ]
  }
}
```

### `POST /api/Routes/routeHeader`

Corps : `{"routeId":"1"}`

Réponse : terminus, horaires, fréquence, durée.

```json
{
  "success": true,
  "data": {
    "route_id": "1",
    "departure_stop": "TERMINUS CASA PORT",
    "arrival_stop": "_TERMINUS A EROPORT MOHAMED V",
    "departure_time": "04:40:00",
    "arrival_time": "04:05:00",
    "frequency": 30,
    "duree_trajet": 1465
  }
}
```

### `POST /api/Routes/routedetail`

Corps : `{"routeId":"1"}`

Réponse : détails de la ligne et 16 arrêts avec coordonnées, ordre et heure de passage.

```json
{
  "routeId": "1",
  "routeShortName": "L001",
  "departureStop": "TERMINUS CASA PORT",
  "arrivalStop": "_TERMINUS A EROPORT MOHAMED V",
  "stopInfos": [
    {
      "stopId": "0:TERMINUS CASA PORT",
      "stopName": "TERMINUS CASA PORT",
      "stopSequence": "1",
      "departureTime": "15:55:00",
      "stopLat": "33.5986523",
      "stopLon": "-7.613113"
    }
  ]
}
```

### Autres endpoints repérés

| Endpoint | Usage | Statut |
|---|---|---|
| `/api/Routes/routedetailSwitch` | Variante de tracé par direction | À qualifier |
| `/api/Stops/GetHoraireCalendar` | Horaires par arrêt | Répond vide sans `stopId` |
| `/api/Stops/GetGroupedHoraireCalendar` | Horaires groupés | À qualifier |
| `/umbraco/api/HomePageContentElementsApi/GetEnDirect/fr-fr/{routeId}` | Info trafic par ligne | À qualifier |
| `/umbraco/api/HomePageContentElementsApi/Agences/fr-fr` | Agences commerciales | OK, 4 agences |

## GTFS JSON

| Fichier | Taille | Contenu |
|---|---|---|
| `gtfs/stops.json` | 821 Ko | Arrêts par ligne et direction, `StopId`, `StopName`, `RouteId`, `LigneName`, `RouteColor`, `StopLat`, `StopLon` |
| `gtfs/shapes.json` | 3,2 Mo | Tracés de toutes les lignes |
| `gtfs/shape/{routeId}.json` | 10 à 100 Ko | Tracé d'une ligne, `RoutePolylines` avec latitude, longitude, séquence |

Exemple d'arrêt :

```json
{
  "StopId": "0:112 Boulevard D'Anfa",
  "StopName": "112 Boulevard D Anfa",
  "DirectionId": "1",
  "RouteId": "13",
  "LigneName": "L013",
  "RouteColor": "3300FF",
  "RouteTextColor": "FFFFFF",
  "StopLat": "33.5920589",
  "StopLon": "-7.6339546"
}
```

## Données à importer

1. `network.json` : 57 lignes, couleurs, terminus, fréquence, durée.
2. `stops.json` normalisé : arrêts uniques, coordonnées, lignes desservies.
3. `shapes/{routeId}.json` : tracés pour la carte.
4. `fares.json` : tarifs depuis la page publique, avec date et source.
5. `corpus.json` : 25 fiches vérifiées (horaires, tarifs, carte étudiant, abonnements, objets perdus, accessibilité, incidents, agences, AEROBUS).
6. `incidents.json` : état du trafic par ligne, si l'endpoint `GetEnDirect` répond.

## Contraintes

- API non documentée : elle peut changer sans préavis. Le scraper doit tolérer les erreurs et conserver le dernier snapshot valide.
- Données horaires datées (exemple `tripId` du 22/10/2026). Afficher la date de collecte dans l'interface.
- Débit limité à 1 requête par seconde, cache local, pas d'appel depuis le navigateur de l'usager.
- Attribution visible : « Données Casabus / ALSA, collectées le JJ/MM/AAAA ».
- Pas de redistribution commerciale des horaires sans accord. Le PFE reste un usage pédagogique.

## Décision

On utilise l'API et les GTFS pour le réseau, et le HTML public pour les tarifs et la FAQ. L'import est un script hors ligne qui écrit des snapshots versionnés dans `content/providers/alsa/`. L'agent ALSA lit le corpus normalisé, pas les réponses brutes.

Prochaine étape : script `scripts/import-alsa.ts`, normalisation, puis page bus et agent dédié.
