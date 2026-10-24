# Selo — monthly budget tracker

[![Test and deploy](https://github.com/Kroketez/selo-budget/actions/workflows/deploy.yml/badge.svg)](https://github.com/Kroketez/selo-budget/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**[Live demo →](https://kroketez.github.io/selo-budget/)**

A personal budget tracker built around one question: **how much can I still spend this month?**
Every category budget is drawn as a postage stamp whose face value is what's left. Go over, and the stamp gets a postmark.

Built with **React 19 + TypeScript + Vite**, a dependency-free **Node.js + SQLite** API, **Docker**, and tested with **Playwright**.

- **With the server** (Docker or `npm run server`): data is saved in a SQLite database.
- **Without it** (like the GitHub Pages demo): the app falls back to `localStorage`.

The sidebar always says where your data is being saved. Sample data loads on first visit.

<p>
  <img src="docs/desktop.png" alt="Selo on desktop: red sidebar with months, €688.78 left to spend in October, a sheet of eight colored category stamps with one cancelled by a postmark, and the transaction list" width="74%">
  &nbsp;
  <img src="docs/mobile.png" alt="Selo on a phone: month switcher in a red top bar, the left-to-spend figure, a summary and the first category stamps" width="22%">
</p>

## Features

- **Monthly items:** set salary, rent or subscriptions once and they're added to every month automatically. Edit one to change every month, or stop it from a given month (earlier months keep it).
- **Quick adding:** separate Income and Expense buttons, tap a category, the note is optional, and the date defaults to today. Tick "Repeat every month" to make it a monthly item.
- **Clear month view:** what's left to spend, a daily allowance for the rest of the month, and income vs expenses for the month
- Six spending categories with monthly budgets drawn as postage stamps; going over cancels the stamp with a postmark
- Edit or delete any entry, with **Undo**
- Search, filter by type, or click a stamp to filter by category
- Upcoming entries later in the month are marked as such
- Keyboard shortcuts: **N** for a new expense, **I** for a new income
- Responsive from phone to desktop, accessible labels and focus states, respects reduced motion

## Run with Docker (saves to a database)

```bash
docker compose up -d --build
```

Open http://localhost:8080. The database lives in the `selo-data` Docker volume, so your data survives restarts and rebuilds. Stop with `docker compose down` (add `-v` only if you want to delete the data).

### API

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/state` | All transactions and budgets |
| `PUT` | `/api/state` | Replace everything (used for seeding and reset) |
| `POST` | `/api/transactions` | Add a transaction |
| `PUT` | `/api/transactions/:id` | Update a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `POST` | `/api/recurring` | Add a monthly item |
| `PUT` | `/api/recurring/:id` | Update or stop a monthly item |
| `DELETE` | `/api/recurring/:id` | Delete a monthly item |
| `PUT` | `/api/budgets/:categoryId` | Set a category budget |
| `GET` | `/api/health` | Health check |

## Run it for development

```bash
npm install
npm run dev
```

That uses browser storage. To develop against the database, run the API in one terminal and Vite in another:

```bash
npm run server
```

```bash
API_URL=http://localhost:3001 npm run dev
```

On Windows PowerShell, set the variable first: `$env:API_URL="http://localhost:3001"; npm run dev`.

API tests: `npm run test:api`.

Build for production (outputs to `dist/`, uses relative paths so it works on GitHub Pages):

```bash
npm run build
```

## Tests

End-to-end tests in [`tests/`](tests/budget.spec.ts) cover adding, validating, editing, deleting with undo, filtering, budget editing, month navigation, saving and resetting — on both a desktop and a phone viewport. The clock is frozen, so results don't depend on today's date.

```bash
npx playwright install chromium   # first time only
npm test
```

GitHub Actions runs the linter and the tests on every push and pull request. The site only deploys when they pass.

To refresh the README screenshots: `npm run screenshots`.

## Ship a change

Build, commit everything and push to GitHub in one command. The site at
https://kroketez.github.io/selo-budget/ redeploys automatically.

```bash
npm run ship "what you changed"
```

If the build fails, nothing is committed or pushed.

## Project structure

```
server/
  server.mjs              API + static server (Node http + built-in SQLite)
  server.test.mjs         API tests
src/
  App.tsx                 main screen and state wiring
  store.ts                state, API sync and localStorage fallback
  data.ts                 categories, default budgets, sample data
  format.ts               money and date helpers
  useTicker.ts            animated number hook
  components/
    Rail.tsx              sidebar / mobile top bar, month navigation
    Stamp.tsx             category budget stamp + postmark
    Composer.tsx          add / edit transaction form
    TransactionList.tsx   searchable, filterable list
    MonthlyList.tsx       the "Every month" section
```
