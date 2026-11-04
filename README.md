# FarmPilot

**Your AI farming co-pilot.** FarmPilot maps your land, plans your season, warns you before the weather hurts you, and tells you when to sell — built for smallholder farmers in Nigeria.

> Maps your land, plans your season, warns you before the weather hurts you, and tells you when to sell.

---

## What it does

| Area | What you get |
| --- | --- |
| **Onboarding** | Locate the farm by GPS or place search, confirm field boundaries on satellite imagery, and capture size, budget, experience, goal and soil. |
| **My farm** | A single profile that every other screen reads from — location, farming zone, hectares, soil (with source and confidence), rainfall pattern. |
| **Season plan** | Crop and variety choice with a deterministic economics engine: input costs, expected yields, margins and warnings. Every number is auditable. |
| **Calendar** | Nursery, planting and harvest windows laid out as a working calendar of tasks. |
| **Today** | A weather-aware daily advisor that checks upcoming tasks against the forecast, plus a date simulator to look ahead. |
| **Market** | *Market Pulse*: sell-or-store analysis built on seasonal price patterns from WFP market history, current prices and market news. |
| **Connect** | Shared trucks, produce grading, shared storage and equipment booking, plus listings and deal comparison between farmers. |
| **Ask FarmPilot** | A tool-using chat agent (text or voice) that answers only from your own farm data and FarmPilot's engines, and cites what it used. |
| **Farm report** | A plain-language farm intelligence report and a shareable poster. |

## Stack

- **Next.js 15** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS 4** for styling, **lucide-react** for icons
- **Leaflet / react-leaflet** over Esri satellite and street tiles
- **Meta models** through one OpenAI-compatible endpoint (`https://api.meta.ai/v1`):
  - Muse Spark — planning, chat agent, market reasoning, web search
  - Muse Wonder — long-form farm report writing
  - SAM 3.1 — field segmentation from satellite imagery
  - Muse Image — poster rendering
  - Muse Voice Transcribe — voice input

## Getting started

**Prerequisites:** Node.js 20+ (developed on Node 22) and npm.

```bash
git clone https://github.com/Alagapie/farmpilot.git
cd farmpilot
npm install
```

Create `.env` from the example and add your key:

```bash
cp .env.example .env
```

```dotenv
MODEL_API_KEY=your_meta_api_key
```

Then run the app:

```bash
npm run dev
```

Open <http://localhost:3000>. On first load you will be walked through onboarding; your farm profile is stored in the browser (`localStorage`) under `farmpilot.farm.v2`.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MODEL_API_KEY` | yes | — | API key for the Meta OpenAI-compatible endpoint. Server-side only. |
| `SPARK_MODEL` | no | `muse-spark-1.3` | Model id used for planning and chat. |
| `WONDER_MODEL` | no | `muse-wonder-1.0` | Model id used for the long-form farm report. |
| `SAM_FIELD_PROMPT` | no | built-in | Overrides the text prompt used to segment fields with SAM. |
| `DEMO_URL` | no | `http://localhost:3000` | Base URL used by the probe/e2e scripts. |
| `NEXT_DIST_DIR` | no | `.next` | Lets a production build run beside the dev server without sharing a build directory. |

Never commit `.env` — it is already ignored by `.gitignore`.

## Project structure

```
src/
  app/
    page.tsx            onboarding or dashboard entry
    api/                route handlers (plan, chat, market, connect, segment, ...)
  components/           dashboard tabs and maps
  data/                 crops, tasks, connect seed data, seasonality.json
  lib/
    economics.ts        cost and margin engine
    plan.ts             season planner
    advisor.ts          weather-aware task advice
    calendar.ts         nursery/planting/harvest windows
    market.ts           seasonal sell-or-store analysis
    connect-store.ts    server-side Connect state (JSON file)
    agent.ts            Ask FarmPilot tools and agent loop
    meta.ts             model ids and API client
    sam.ts              field segmentation
scripts/                data build, probes, e2e and video tooling
data/                   raw downloads (ignored; derived data is committed)
```

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/plan` | Build a season plan from a farm profile. |
| `POST /api/chat` | Ask FarmPilot agent turn. |
| `POST /api/summary` | Plain-language farm report. |
| `GET /api/forecast` | Weather forecast for the farm. |
| `GET /api/geocode` | Place search for onboarding. |
| `POST /api/segment` | SAM field boundaries for a point. |
| `POST /api/market` | Market Pulse analysis. |
| `GET /api/prices` | Current prices (Spark + web search). |
| `POST /api/market-news` | Market news. |
| `POST /api/poster` | Render a shareable poster. |
| `POST /api/transcribe` | Voice input transcription. |
| `GET /api/farm-data` | Farm data lookups. |
| `POST /api/briefing` | Daily briefing. |
| `GET /api/connect/state` | Current Connect state (listings, trips, bookings). |
| `POST/DELETE /api/connect/listings` | Create or remove a produce listing. |
| `POST /api/connect/grade`, `/parse` | Grade produce from a photo or text. |
| `POST /api/connect/deals`, `/book`, `/advance` | Compare deals, book a truck, advance a shipment. |
| `POST/DELETE /api/connect/reserve` | Reserve or cancel shared storage/equipment. |
| `POST /api/connect/reset` | Reset Connect demo data. |

## Data pipeline

Seasonal price patterns come from the **WFP "Nigeria — Food Prices"** dataset on HDX (CC BY-IGO):

<https://data.humdata.org/dataset/wfp-food-prices-for-nigeria>

Download the CSV into `data/` (ignored by git), then rebuild the committed index:

```bash
node scripts/build-seasonality.mjs
```

This writes `src/data/seasonality.json`, which is what the app reads at runtime.

## Scripts

```bash
npm run dev      # dev server on :3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

Helper scripts (most expect the dev server to be running):

| Script | Purpose |
| --- | --- |
| `node scripts/build-seasonality.mjs` | Rebuild `seasonality.json` from the WFP CSV. |
| `node scripts/probe-plan.mjs` | Build a plan for the demo farm and print it. |
| `node scripts/probe-chat.mjs` | Ask the agent questions against a demo farm. |
| `node scripts/probe-prices.mjs` | Fetch current prices via Spark + web search. |
| `node scripts/probe-sam.mjs` | Segment a field on a satellite tile. |
| `node scripts/probe-connect.mjs` | Walk listing → deal → booking. |
| `node scripts/e2e-onboarding.mjs` | Headless onboarding smoke test (fake GPS). |
| `node scripts/e2e-plan.mjs` | Onboard, then build a season plan. |
| `node scripts/e2e-season.mjs` | Onboard, plan, calendar, poster, advisor. |
| `node scripts/e2e-ask.mjs` | Ask FarmPilot by text and by voice. |
| `node scripts/e2e-connect.mjs` | Connect from listing to booked truck. |
| `node scripts/shots-plan.mjs` | Screenshot every season-plan tab. |
| `node scripts/video/*` | Animated explainer and scripted product demo rendering. |

## Design notes

- **Numbers are deterministic.** Planning, economics, calendar and market logic live in `src/lib` as pure TypeScript. The models write prose and choose tools; they do not invent figures.
- **The agent is grounded.** Ask FarmPilot can only reach your data through tools (`get_farm_profile`, `get_season_plan`, `get_calendar`, `get_weather`, `get_prices`, ...) and reports which tools and sources it used.
- **No database required locally.** The farm profile lives in `localStorage`; FarmPilot Connect keeps shared state in a JSON file on the server so multiple browsers can see the same listings.
- **Demo-friendly.** Connect ships with seed listings, and there is a date simulator so a season can be walked through in minutes.

## Deployment notes

- Set `MODEL_API_KEY` in your host's environment (Vercel, etc.).
- `connect-store.ts` writes to a local JSON file. Serverless hosts have ephemeral, read-only filesystems, so swap it for a hosted database (Postgres, Redis, ...) before deploying Connect for real.
- The WFP CSV is not committed; only the derived `seasonality.json` is.

## License

[MIT](LICENSE) © 2026 Abdulbasit Suleiman

## Attribution

- Food price data: World Food Programme via HDX, CC BY-IGO.
- Satellite and street imagery: Esri, Maxar, Earthstar Geographics.
- Models: Meta (Muse Spark, Muse Wonder, SAM 3.1, Muse Image, Muse Voice Transcribe).
