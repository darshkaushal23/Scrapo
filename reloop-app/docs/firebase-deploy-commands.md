# Firebase production ops (scrapo-613a1)

## Deployed

- Firestore rules: deployed to `scrapo-613a1`
- Storage: **not enabled** on the project; `storage.rules` is deny-all and ready when Storage is created

## Auth model (production)

1. Client signs in with Firebase Email/Password (display name → `*@accounts.scrapo.app`).
2. APIs accept only `Authorization: Bearer <Firebase ID token>`.
3. Server verifies tokens via Admin SDK **or** Google JWKS (`jose`) — no service account required for API auth.
4. Trust & Safety persistence: Admin Firestore → Firestore REST with the caller's ID token (under rules) → local `.data/` **blocked** when `SCRAPO_PRODUCTION=1` / `NODE_ENV=production` unless `SCRAPO_ALLOW_FILE_STORE=1`.
5. Prototype phone OTP API returns `503` in production unless `SCRAPO_ALLOW_PHONE_OTP_FALLBACK=1`.

## Optional Admin SDK (privileged writes / claims)

```bash
# Create a service account in Firebase Console → Project settings → Service accounts
# Then set one of:
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
# or
GOOGLE_APPLICATION_CREDENTIALS=C:\\path\\to\\serviceAccount.json
```

## Redeploy rules

```bash
cd reloop-app
npx -y firebase-tools@latest deploy --only firestore:rules --project scrapo-613a1
```

Storage (only after enabling Storage in Console):

```bash
npx -y firebase-tools@latest deploy --only storage --project scrapo-613a1
```

## Seed demo users

```bash
node scripts/seed-firebase-users.mjs
```

Admin promotion is **not** done by the seed script for role=`admin` (rules block self-admin). Use Firebase Console / Admin SDK / MCP to set `profiles/{uid}.role = "admin"` and custom claims `admin=true`, `role=admin`.

## Do not

- Overwrite live data with stale `schema.sql`
- Commit service account JSON or `.env.local`
- Enable Storage uploads until a threat model is done
