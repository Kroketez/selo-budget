# Selo — monthly budget tracker

A personal budget tracker built around one question: **how much can I still spend this month?**
Every category budget is drawn as a postage stamp whose face value is what's left. Go over, and the stamp gets a postmark.

Built with **React 19 + TypeScript + Vite**. No backend: data lives in `localStorage`, and sample data loads on first visit.

## Features

- Add, edit and delete income and expenses (amount, description, category, date)
- Delete with **Undo**
- Monthly budgets per category, editable in place
- "Left to spend" headline with a daily allowance for the rest of the month
- Month navigation with remaining amount per month
- Search, filter by type, or click a stamp to filter by category
- Form validation with clear error messages
- Keyboard shortcut: press **N** to add a transaction
- Responsive from phone to desktop, accessible labels and focus states, respects reduced motion

## Run it

```bash
npm install
npm run dev
```

Build for production (outputs to `dist/`, uses relative paths so it works on GitHub Pages):

```bash
npm run build
```

## Project structure

```
src/
  App.tsx                 main screen and state wiring
  store.ts                reducer + localStorage persistence
  data.ts                 categories, default budgets, sample data
  format.ts               money and date helpers
  useTicker.ts            animated number hook
  components/
    Rail.tsx              sidebar / mobile top bar, month navigation
    Stamp.tsx             category budget stamp + postmark
    Composer.tsx          add / edit transaction form
    TransactionList.tsx   searchable, filterable list
```
