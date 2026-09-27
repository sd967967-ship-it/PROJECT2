# Source Registry — verified 2026-09-27 by live probe (HTTP 200 + shape check)

Every entry below was fetched from this machine before integration. No scraped,
reverse-engineered, or ToS-violating source is used. Anything without a verified
open source stays parked behind env slots (see `server/.env.example`).

| Category | Provider / source | Official docs | License / attribution | Cost | Freshness | Coverage | Default | Fallback |
|---|---|---|---|---|---|---|---|---|
| Aviation | OpenSky REST (`openskyAdapter.js`) | https://openskynet.github.io/openskynet/rest.html | Community ToS, credit required | free (auth raises quota) | ~10s states | global, Mode-S gaps | primary | adsb.lol sweep |
| Aviation | adsb.lol v2 (`adsbLolAdapter.js`) | https://api.adsb.lol/docs | ODbL, attribution required | free, fair-use | per poll | best-effort patches | fallback | demo tracks |
| Space | CelesTrak GP (`space/tle.js`) | https://celestrak.org/NORAD/documentation/gp-data-formats.php | Courtesy CelesTrak | free keyless | hourly refresh | catalogued objects | on (Space) | demo elements |
| Space | JPL approximate elements (`space/solar.js`) | https://ssd.jpl.nasa.gov/planets/approx_pos.html | Public domain (US Gov) | free | per request | Sun–Pluto + Moon | on (Space) | n/a (math) |
| Hazards | USGS FDSNWS event (`geo/quakes.js`) | https://earthquake.usgs.gov/fdsnws/event/1/ | Public domain, credit USGS | free keyless | 5 min poll | global M4.5+ (configurable) | on | unavailable badge |
| Hazards | NASA EONET v2.1 (`geo/events.js`) | https://eonet.gsfc.nasa.gov/docs/v3 (v2.1 probed live) | Public domain, credit NASA | free keyless | 30 min poll | global, category-filtered | off | unavailable badge |
| Weather | Open-Meteo forecast + air quality (`geo/wx.js`) | https://open-meteo.com/en/docs | Free non-commercial, attribution required | free keyless | 10 min TTL | global, point queries | on demand | unavailable badge |
| SpaceWx | NOAA SWPC Kp (`geo/spacewx.js`) | https://www.swpc.noaa.gov/products/planetary-k-index | Public domain, credit SWPC | free keyless | 15 min poll | global index | readout | unavailable badge |
| Space | CNEOS fireballs (`geo/spacewx.js`) | https://ssd-api.jpl.nasa.gov/doc/fireball.html | Public domain | free keyless | hourly poll | reported events | off | unavailable badge |
| Streets | Finland Digitraffic rail (`streets/finrail.js`) | https://www.digitraffic.fi/en/ | Open data (CC 4.0 BY), keyless, attribution | free keyless | 30s poll | Finland | live trains | empty = unavailable |
| Streets | Irish Rail realtime (`streets/irishrail.js`) | http://api.irishrail.ie/realtime/ | Open data, keyless | free keyless | 60s poll | Ireland | live trains | empty = unavailable |
| Streets | Entur JourneyPlanner (`streets/entur.js`) | https://developer.entur.org/ | Open data, keyless, ET-Client-Name required, attribution | free keyless | 60s board TTL | Norway | live boards | empty = coverage note |
| Sea | AIS live path (`sea/aisAdapter.js`) | provider docs at configured URL | per provider | key iff configured | 60s poll | per feed | parked | sample vessels |
| Streets | Transit JSON feed (`streets/transitAdapter.js`) | agency docs at configured URL | per agency | key iff configured | 30s poll | per city | parked | sample vehicles |
| Imagery | Google satellite (default), Esri World Imagery + reference, OSM | https://developers.google.com/maps/terms, https://www.esri.com/.../attribution, https://www.openstreetmap.org/copyright | Terms/ODbL as marked | free tiers | tiles | global | Google default | Esri/OSM buttons |
| Flags | flagcdn | https://flagcdn.com | free | free | static | world | on | hidden img |

## Parked (no verified open source — disabled cards, never fake data)
- Live AIS worldwide (aiscast.com unreachable from here; `AIS_URL`/`AIS_KEY` slots).
- Live transit vehicle dots per city (GTFS-RT protobuf; `TRANSIT_URL` slot for JSON feeds). Live departure boards work today via Entur (Norway).
- Rocket launches (no verified keyless documented feed; card omitted, not faked).
- Public webcams/news (no compliant keyless API adopted; omitted).
- Wildfire hotspots beyond EONET (NASA FIRMS needs a personal key; user-paste slot noted, agent never creates accounts).

## Fetch rules (all server-side; browser never calls providers)
- Fixed URL allowlist, enforced in `fetchJson` (SSRF defense; anything else → FEED_FORBIDDEN): opensky-network.org, api.adsb.lol, celestrak.org,
  earthquake.usgs.gov, eonet.gsfc.nasa.gov, api.open-meteo.com,
  air-quality-api.open-meteo.com, services.swpc.noaa.gov, ssd-api.jpl.nasa.gov,
  api.entur.io, rata.digitraffic.fi, api.irishrail.ie, localhost.
  No user input ever enters a URL except numeric lat/lon (validated ranges).
- Timeouts 8–12s, response parsed with shape validation, typed feed errors.
- Polite cadences per table; backoff on 429; stale-while-revalidate via Poller.
