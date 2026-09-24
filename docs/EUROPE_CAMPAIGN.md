# European campaign

The campaign is open-ended. There is no time limit, scheduled reset, or automatic victory cutoff. Recruitment, buildings, movement, combat, capture and rebellion retain their existing individual timing rules.

## Cities and source

`src/data/europeCities.json` contains exactly the 16 requested cities and their city-centre latitude/longitude in WGS84. Names use Gijón, Köln (the requested “Kohln”) and Copenhagen (the requested “Copenhaghen”), with Roma/Milano and Brussels/London as requested.

Coordinates: [GeoNames geographical database](https://www.geonames.org/), [cities15000 daily extract](https://download.geonames.org/export/dump/cities15000.zip), retrieved 2026-09-24. GeoNames data is provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Each selected city's GeoNames identifier is retained in the bundled subset. Fields are reduced to id, display name, source identifier, coordinates and country; only display names are adapted. Game populations are rounded strategic balance values, not a current census.

| City | Latitude | Longitude | GeoNames ID |
| --- | ---: | ---: | ---: |
| Gijón | 43.53573 | -5.66152 | 3121424 |
| Barcelona | 41.38879 | 2.15899 | 3128760 |
| Madrid | 40.41650 | -3.70256 | 3117735 |
| Paris | 48.85341 | 2.34880 | 2988507 |
| Marseille | 43.29695 | 5.38107 | 2995469 |
| Roma | 41.89193 | 12.51133 | 3169070 |
| Milano | 45.46427 | 9.18951 | 3173435 |
| Berlin | 52.52437 | 13.41053 | 2950159 |
| Köln | 50.93333 | 6.95000 | 2886242 |
| Amsterdam | 52.37403 | 4.88969 | 2759794 |
| Maastricht | 50.84833 | 5.68889 | 2751283 |
| Brussels | 50.85045 | 4.34878 | 2800866 |
| Copenhagen | 55.67594 | 12.56553 | 2618425 |
| London | 51.50853 | -0.12574 | 2643743 |
| Birmingham | 52.48142 | -1.89983 | 2655603 |
| Manchester | 53.48095 | -2.23743 | 2643123 |

## Starting position and travel

New campaigns give the player the three Spanish cities with Madrid as capital. The Continental Accord has Paris as its capital; the British League has London. These are fictional game factions, not representations of current political alliances. City resource production supports the existing population-based consumption rules. Existing unit/building prices, speeds and completion durations are unchanged.

Twenty bidirectional corridors connect all 16 cities. Lengths are the summed great-circle distances along authored waypoints, rounded up to kilometres; they are strategic travel approximations, not road navigation. Terrain still modifies travel time. The Paris–London corridor explicitly passes through the Channel Tunnel. Copenhagen connects through Jutland and the Danish bridge corridor. Infantry does not cross open water as a naval unit.

Army interpolation follows the same waypoints in either direction, using the stored departure/arrival times. Artillery's existing connected-route range check still uses 150 km; large European gaps cannot be bombarded. The map clusters nearby cities at overview zoom without changing their geographic positions. A city finder provides direct access to all 16.

## Save migration

Payload schema 3 accepts schema 1 and 2 through explicit migrations, after validating their contents. The known miniature is remapped:

| Old city | New city |
| --- | --- |
| Haven | Madrid |
| Ashford | Gijón |
| Greenfield | Barcelona |
| Ironridge | Paris |
| Eastwatch | Marseille |
| Sunmere | Milano |

Existing ownership, resources, population balance, buildings, integrity, morale, stability, occupation/capture/unrest timers, units and queues are retained. Army locations, route references, faction capitals, battles, resource sites and event city references are remapped. Resource sites follow their parent city. The ten additional cities and British garrison enter at the last saved timestamp. Subsequent offline catch-up advances the expanded campaign from that timestamp; no history before it is recalculated.

Existing movement orders retain their previously promised arrival times. New movement orders use geographic distances. Existing artillery orders stop so the player can choose valid targets on the larger map. The campaign start time and RNG state are retained. Reopening a schema 3 save does not seed or remap anything again. The six-city fixture used in regression tests is itself schema 3 and remains valid.

## Notifications

The notification inbox is separate persisted UI state, scoped to the campaign seed/start time. Completion and military events identify their affected factions at event time, so losing a city still alerts its previous owner. Routine queued orders and other factions' events are excluded. Unread state and an event cursor survive reloads; offline batches produce at most one device summary, prioritising threats. The inbox keeps 50 entries; the simulation's recent event history remains bounded.

System notifications are opt-in and require HTTPS, browser support and permission. They use `ServiceWorkerRegistration.showNotification`, not the mobile-incompatible constructor. Clicking a device alert opens the relevant city. These notifications are generated only while the app is executing; background tabs may be throttled and closed-app push is not implemented. On the local HTTP Wi-Fi URL, the in-game inbox works but device notifications are unavailable. Nothing depends on timers running while the app is closed.

Sources: [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API), [mobile notification guidance](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API).
