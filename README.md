# ScopeLog

A workspace for security assessments, research, evidence, findings, progress tracking, and reports. Built with Next.js, Clerk, and Neon Postgres.

**Live app:** [scope-log.vercel.app](https://scope-log.vercel.app)

**GitHub Pages:** [lawsonisthebest.github.io/scope-log](https://lawsonisthebest.github.io/scope-log/) (opens the live app)

**Source:** [lawsonisthebest/scope-log](https://github.com/lawsonisthebest/scope-log)

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
cp .env.example .env.local
# Fill in your Neon database URL and Clerk keys in .env.local.
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Create an account or sign in to access your workspace. Credentials stay in the local environment or hosting provider settings; never commit `.env.local`.

## Hosting

The complete app runs on Vercel. GitHub stores the source code and GitHub Pages provides a redirect to the hosted app. Pages cannot run the authentication middleware, database queries, API routes, or Server Actions required by ScopeLog.

To deploy another copy:

1. Import this GitHub repository into Vercel as a Next.js project with Node.js 24.
2. Add the environment variables from `.env.example` in Vercel's Production environment. The database and both Clerk keys are required. AI credentials are optional. Use Clerk production keys and configure the matching domain for a production launch; development keys have Clerk's development limitations.
3. Run `npm run db:migrate` against that database before deploying. Migrations are intentionally not run during every build or preview.
4. Deploy the `main` branch. Vercel can automatically deploy future pushes once its GitHub integration is connected.
5. Set the GitHub repository variable `LIVE_SITE_URL` to the verified Vercel production URL. Enable GitHub Pages with **GitHub Actions** as the source, then run **Publish GitHub Pages link**. The generated page redirects to the app and includes a fallback link.

The current hosted app uses the existing development Clerk instance and database so existing accounts keep access. A separate production Clerk instance has separate user identities; plan data migration before changing it. Environment variables are configured for Production only. Configure an isolated database and Clerk instance before enabling authenticated preview deployments.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

Integration tests require a migrated database and use isolated synthetic identities. The live AI test is opt-in with `SCOPELOG_LIVE_AI_TEST=1`. GitHub Actions runs lint, type checks, and unit tests without database or provider secrets.

## Automatic assessment reports

Creating a report gathers every finding, evidence record (context, source URL, attachment metadata and hash), and research note in the selected project. Reports are snapshots with a summary, scope, severity overview, recommendations, detailed findings, evidence register and research notes. Source records are retained even when AI generates the narrative. Linked pages and attachment bytes are not analyzed. Review a draft before marking it final.

The structure follows [OWASP reporting guidance](https://wstg.owasp.org/v4.1/5-Reporting/). The editor opens in a paper-style preview with Markdown export and Print / PDF (choose Save as PDF in the browser print dialog).

### Free OpenRouter AI

ScopeLog uses `openrouter/free` by default. This router selects an available free model that supports structured output. No paid fallback is configured, paid model IDs are rejected, and provider token prices are capped at zero. Free inference is **not unlimited**: OpenRouter currently documents 50 requests/day, or 1,000/day after purchasing $10 in credits, with 20 requests/minute. These allowances are shared across the account, including other apps using its keys. Provider capacity and availability can impose further limits.

1. Create an API key at <https://openrouter.ai/settings/keys>.
2. Add the following to `.env.local` (or your hosting provider's server environment). Never prefix the key with `NEXT_PUBLIC_` or commit it.

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
OPENROUTER_DAILY_LIMIT=50
AI_USER_DAILY_LIMIT=20
```

3. Run `npm run db:migrate` to install migration `0010_ai_assistance.sql`, then restart the app with `npm run dev` (or redeploy).
4. Click **Generate insight** on Overview, Progress, or a project. Generate a new report to include an AI narrative. Existing reports remain snapshots.

If your OpenRouter account qualifies for the higher free allowance, set `OPENROUTER_DAILY_LIMIT=1000`. This setting only changes ScopeLog's local ceiling; it does not upgrade your provider account. `AI_USER_DAILY_LIMIT` limits new generation attempts per signed-in user per UTC day and can be increased up to the shared limit. The server also permits at most 18 reservations per minute, leaving some headroom below OpenRouter's limit. Provider failures and conservative partial reservations count toward local allowances. Local counters cannot measure usage from other apps.

Overview insights use aggregate counts and up to ten recent project summaries. Progress insights use the selected month and browser time zone, comparing saved activity with the previous month; live/paused timers are excluded. Project guidance and reports use project text, findings, evidence context, and notes. Requests are on demand, require sign-in, and load only the current user's records on the server. AI does not modify project status, statistics, findings, or source records.

Unchanged successful generations are cached in Postgres for 24 hours per user, input, model, and feature. Identical concurrent requests share a database lease. Changed records produce a new snapshot. Failures are cached for one minute to avoid retry storms. API keys and source prompts are not stored in the cache; generated text is. Expired cache and quota rows are pruned during generation. Project caches are deleted with their project. Aggregate cached snapshots expire within 24 hours and are not reused after their input changes.

OpenRouter and the selected upstream provider receive the submitted text; attachment bytes and linked pages are never sent or fetched. Review provider data policies before submitting confidential assessment text. The UI explains what is shared. Keep provider credentials on the server. AI output is untrusted, validated, rendered as text, and labeled as suggestions.

If the key is absent, the quota is exhausted, storage/provider is unavailable, the response is invalid, the input exceeds 40,000 characters, or generation takes more than 45 seconds, insights show a helpful status and reports still include all original records. OpenRouter takes precedence when its key is set; existing Ollama report support remains available when it is not.

References: [Free router](https://openrouter.ai/docs/guides/routing/routers/free-router), [rate limits](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know), [structured output](https://openrouter.ai/docs/guides/features/structured-outputs).

### Optional local report AI (no provider usage quota)

Install [Ollama](https://ollama.com/) on the machine running the app, then download a local model, for example:

```sh
ollama pull qwen3:8b
```

Add to `.env.local` and restart Next.js:

```dotenv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
```

Ollama must be running and the model must fit the machine's available memory. Local inference has no provider request quota or API charge, but uses your hardware and electricity. Use a local model, not an Ollama cloud model. In a deployed app, localhost means the app server, not the visitor's computer; configure a privately reachable Ollama server there. Do not expose Ollama publicly without access controls.

AI is optional. If unconfigured, unavailable, invalid, slower than 45 seconds, or the source JSON exceeds the 40,000-character input budget, the app generates the complete structured report without AI and explains that in the report. No source records are truncated. AI output is validated and supplements the original records; it never replaces them. Hosted free tiers are not represented as unlimited.

### Automatic progress

The **Progress** page uses room/project completions, saved project time, and running or paused timers automatically. No skill setup or separate progress logging is required. The monthly calendar, room time breakdown, daily charts, and activity history update from those records. Live time updates each second; server data refreshes every 30 seconds and on window focus.

An active day has a room completion or positive tracked time. The current streak counts consecutive active days through today, or yesterday if today has no activity yet, regardless of the month being viewed. Dates follow the viewer's browser time zone. New timer intervals are split across local midnight, including daylight-saving transitions; pause gaps are excluded. Timers retain the existing 24-hour session limit.

Completion timestamps are recorded through both completion controls and project status edits. Repeat completion clicks and later edits do not move the date. Reopening a room removes its completion from the totals; completing it again records its new completion date. A room counts once while it is complete. Migration `0008_automatic_progress.sql` recovers older completion dates from explicit completion activities. Completed rooms without a recoverable date remain in overall totals but are excluded from calendar/streak calculations. Older time totals without interval history remain on their recorded date rather than guessing when the work took place.

Run `npm run db:migrate` before serving this feature in another environment. Existing manual progress logs and skills are retained in account exports but do not contribute to the automatic dashboard.

Progress records can be corrected from **Change completion date** or the pencil next to an activity. Completion corrections use a date-only value, so the selected day stays fixed across time zones. Removing a completion resets the room to incomplete (0%) while retaining the room and its research. Saved time entries support date, duration, and description corrections and deletion; stop a live timer before editing it. Changing a saved session's date or duration assigns the whole session to that date, while description-only edits retain its original intervals. Migration `0009_progress_corrections.sql` adds the optional date overrides.
