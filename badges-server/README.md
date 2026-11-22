# Kittycord Badges server

Cloudflare Worker + D1 database behind the Fake/Custom Badges plugin. Open source on purpose: the security
doesn't depend on anything being secret except the Discord client secret (a Worker secret, never in git).

## Security model
- **Login = Discord OAuth2** (`identify` scope only). The user logs in on discord.com in their own browser.
  Kittycord and this server never see a Discord password or token; the server exchanges the one-time code,
  reads the user ID + public flags, and immediately revokes Discord's token. Nothing from Discord's token is stored.
- **Our session token**: 256-bit random, only its SHA-256 is stored, 30 day expiry, max 5 per user, revocable.
- **Login can't be hijacked**: the client picks a secret `verifier` (only its hash is sent to the server) and must
  present it to claim the session, and the user must type the code shown *in Kittycord* on the confirmation page
  (stops someone tricking you into finishing *their* login). Wrong codes lock the attempt after 5 tries.
- **Who you are always comes from the session**, never from the request body, so you can only edit your own badges.
- **Strict inputs**: fixed badge catalog, regex-validated IDs, 1 KB body limit, JSON only, parameterised SQL.
- **Real badges are verified** from Discord's `public_flags` / `premium_type` at login. Anything Discord doesn't
  expose (boosting, quests, legacy username) or that you don't own is shown to others as "(custom)".
- **Rate limits** per IP / per user on every endpoint; no CORS (the app talks to it from the main process).
- **Privacy**: stores only Discord user ID, public flags, and chosen badges. `DELETE /me` wipes everything.

## API
| Route | Auth | |
|---|---|---|
| `POST /auth/start` `{challenge}` | - | begin login, returns Discord URL + code |
| `GET /auth/callback` | - | Discord redirects here |
| `POST /auth/confirm` | - | form posted by the confirmation page |
| `POST /auth/claim` `{id, verifier}` | - | client collects the session token (once) |
| `POST /auth/logout` | Bearer | |
| `GET /me` / `DELETE /me` | Bearer | your badges / delete everything |
| `POST /badges` `{action: add\|remove, badge}` | Bearer | |
| `GET /badges?users=id,id` (max 50) | - | public badge lookup |
| `GET /catalog` | - | |

## Deploy
```
npm i
npx wrangler d1 create kittycord-badges      # put the id in wrangler.jsonc
npx wrangler d1 execute kittycord-badges --remote --file=schema.sql
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler deploy
```
Tests (needs `.dev.vars` with `DISCORD_CLIENT_SECRET=test` and `DISCORD_API=http://127.0.0.1:9100`):
`npx wrangler d1 execute kittycord-badges --local --file=schema.sql && npx wrangler dev --local --port 8799`, then
`BASE=http://127.0.0.1:8799 npm test`.
