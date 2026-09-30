# Deploy SDG Flight Operations on Render

This project is prepared for a single Render Node web service. The production
server serves both the built React app and `/api` from one URL. Do not deploy it
as a static site: the API and SQLite database must run with the app.

## Before deploying

1. Put this project in a private Git repository. The `work/` directory and
   `*.sqlite*` files are ignored so local operational records are not pushed.
2. Decide whether the hosted app should start fresh or receive a copy of the
   local database. A fresh database creates the three aircraft, Corey's pilot
   profile and administrator account, but no schedules or flight history.
   Existing local records are **not** transferred automatically.
3. Choose a unique administrator password of at least 12 characters. The
   initial email is `corey@sdgops.com`. Do not reuse the local development
   password or send the password in a message or commit it to Git.

## Render setup

1. In Render, choose **New → Blueprint** and connect the Git repository.
   Render reads [`render.yaml`](render.yaml) from the repository root.
2. Enter `SDG_INITIAL_ADMIN_PASSWORD` when Render requests the secret during
   Blueprint creation. It is used only when the database is first created;
   changing the environment variable later does not reset an existing account.
3. Review the paid web service and 1 GB persistent disk before creating it.
   The disk is mounted at `/var/data`; `SDG_DB_PATH` points inside it.
4. Wait for the `/health` check to pass, then open the HTTPS address Render
   assigns. Sign in with `corey@sdgops.com` and your chosen password.
5. In Admin, create individual accounts and link pilot accounts to the correct
   pilot profiles. Never share the administrator login.

Render's free web service does not support the persistent disk needed for this
SQLite setup. Without it, records disappear on redeploy or restart. The disk
also limits the service to one instance and can cause brief downtime during a
deploy. Arrange separate database backups; disk snapshots alone are not a
replacement for a tested backup and restore procedure.

## Existing local data

The local database is `work/sdg-operations.sqlite`. The hosted database lives
at `/var/data/sdg-operations.sqlite`. Do **not** upload the local database by
putting it in Git or copying only the main `.sqlite` file while the local app is
running; SQLite may have uncheckpointed data in `-wal` files. If you want the
current records moved, make a consistent SQLite backup and transfer it to the
Render disk before the first live use. Change the existing administrator
password before exposing an imported database, because the local starter
account may still use the known development password. Test sign-in and record
counts after migration.

## Local production check

With Node 24 and pnpm installed:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm test:api
pnpm test:web
```

`pnpm start` serves the production build on `PORT` (default 3000). In
production, `NODE_ENV=production`, `SDG_DB_PATH`, and the initial administrator
password are required for a fresh database. Local `pnpm dev` remains unchanged.
