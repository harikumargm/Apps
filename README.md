# Sai Cotton Vastram Store

Readymade clothing for web and mobile. The shop is an editorial catalog. Two vision services sit behind it: a fabric reading, and a physics-based trial view.

This build runs on a CPU. It does not pretend to host a TensorRT classifier or an IDM-VTON / OOTDiffusion stack. Those engines are selected with `SUTRA_FABRIC_ENGINE=tensorrt` and `SUTRA_TRYON_ENGINE=diffusion`, and they fail closed until the weights are mounted.

## Layout

- `apps/web` — Next.js 15, TypeScript, Tailwind, Framer Motion, Zustand
- `apps/mobile` — Flutter (iOS and Android), Riverpod view models, GetIt for the API client and repository, a fragment shader plus a canvas garment painter
- `services/api` — FastAPI gateway, SQLite by default, PostgreSQL and Redis when configured
- `services/vision` — fabric heuristic and the three-stage trial pipeline
- `data/catalog.json` — the edit. `apps/web/data/catalog.json` is the same file for static pages

## Run the shop

```bash
python3 -m venv .venv
.venv/bin/pip install -r services/api/requirements-dev.txt
PYTHONPATH=services/vision .venv/bin/uvicorn app.main:app --app-dir services/api --port 8000

cd apps/web
npm install
npm run dev
```

Open http://127.0.0.1:3000. The web app proxies `/api` to the gateway.

Preview account: `mira@sutra.test` / `loom-and-line`. Phone demo, only while `SUTRA_DEMO=1`: `+919800000000`, code `240126`.

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:8000
```

Use `http://127.0.0.1:8000` on the iOS simulator. Android emulator traffic to the host is `10.0.2.2`.

## What the vision services actually do

Fabric (`heuristic-cv-v1`) measures thread direction, texture, and sheen. It returns a weave (plain, twill, satin), a weight category, a stretch index, care, and a fibre hypothesis with a confidence. Product pages keep the mill specification as the composition of record. The badge says so.

Trial view (`physics-drape-v1`):

1. Garment parser builds an alpha mask and drops the backdrop.
2. Pose estimator places joints from measurements, or from the body box in a photograph.
3. Renderer drapes the cloth. Hem sag and fold count follow weight. Ease follows stretch.

A preview has to finish in under two seconds. Body photos are deleted from the inference scratch when the response is sent. A sweeper removes anything older than 24 hours. Nothing is added to a training set, even if the training checkbox is ticked. That checkbox only stores a preference.

## Tests

```bash
cd services/api && PYTHONPATH=../vision ../.venv/bin/pytest
cd apps/mobile && flutter test
cd apps/web && npx tsc --noEmit
```

## Full stack

`docker-compose.yml` starts PostgreSQL, Redis, the vision service, and the gateway. Set `VISION_URL` if the gateway should call vision over HTTP. Leave it empty and the gateway imports the same Python modules in-process.

Google and Apple sign-in are wired, and refused, until `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` are set. Google tokens are checked with Google's tokeninfo endpoint. Apple tokens are checked against Apple's JWKS.
