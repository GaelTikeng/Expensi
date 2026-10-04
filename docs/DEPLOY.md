# Deploying (F7.3 / F7.4)

Two deployables come out of this one repo: the **API routes** (EAS Hosting) and
the **native app** (EAS Build). Both read the same `app.json`.

## 0. One-time setup

```bash
npm i -g eas-cli
eas login
eas init                      # links the project; writes extra.eas.projectId into app.json
```

## 1. API routes → EAS Hosting

Server env lives in EAS Hosting, never in the bundle:

```bash
eas env:create --scope project --environment production --name DATABASE_URL --value '...'
# repeat for DIRECT_URL, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET, TENSORX_API_KEY,
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION, MAINTENANCE_SECRET
```

Then export and deploy:

```bash
npx expo export --platform web
eas deploy --prod
```

The deployment URL becomes `EXPO_PUBLIC_API_URL` for production app builds and
the base of the Clerk webhook endpoint (`<url>/api/webhooks/clerk`).

**Region.** Put Neon and the hosting region as close as possible to each other
and to users. For Central Africa: Neon `eu-central-1` (Frankfurt). An API in a
US region talking to a Frankfurt database adds a transatlantic hop to every
query; it is the most common self-inflicted latency bug here.

**Runtime caveat.** `pdf-parse` (text PDFs in E3) is a Node library. If the
hosting runtime rejects it, move `src/server/services/imports/` behind a small
Node service (CLAUDE.md D1 escape hatch); the repository layer makes that a
file move.

## 2. App → EAS Build

```bash
eas build --profile development --platform all   # dev client for local work
eas build --profile preview --platform all       # internal testers (APK + ad-hoc)
eas build --profile production --platform all    # store builds, auto-incremented
eas submit --platform ios && eas submit --platform android
```

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` as EAS
environment variables for the `preview` and `production` environments. The
`development` profile leaves the API URL empty so Metro serves routes locally.

## 3. Maintenance cron

`POST /api/maintenance/sweep` with header `x-maintenance-secret: $MAINTENANCE_SECRET`
removes attachment rows that were presigned but never confirmed (> 24 h) and
their objects. Call it daily from any scheduler (GitHub Actions cron is enough):

```yaml
- run: curl -fsS -X POST "$API_URL/api/maintenance/sweep" -H "x-maintenance-secret: $MAINTENANCE_SECRET"
```

## 4. Store checklist

- Privacy policy URL: host `docs/PRIVACY_POLICY.md` (or the in-app `/privacy`
  text) on a public page and paste the URL in both consoles.
- App Store "App Privacy" / Play "Data safety": declare photos/files uploaded
  by the user (stored in S3, processed by TensorX for imports), email (Clerk),
  no tracking.
- Permission strings are in `app.json` (`infoPlist`, `android.permissions`,
  plugin props).
- Account deletion is in-app (Settings → Delete account) and via Clerk.
