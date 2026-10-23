# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Node.js + Vite + React + TypeScript (user's choice). Client-only; data persists in the browser (localStorage).

## Users

A person tracking their own monthly money: logging income and expenses as they happen, then checking where the month stands. Secondary audience: people browsing the author's portfolio, who will try the app for a minute.

## Product Purpose

A personal budget tracker. Log transactions, set monthly spending limits per category, and see at a glance how much is left this month. Success: a visitor can add a transaction in seconds and immediately understand their month.

## Positioning

Built around one question — "how much can I still spend this month?" — rather than accounting ledgers. Category budgets and remaining amounts lead; history supports.

## Capabilities and Constraints

- Add, edit, delete income and expense transactions (amount, category, date, note).
- Monthly budgets per expense category with progress.
- Month navigation, summary (income, spent, balance), category breakdown.
- Filter/search transaction history.
- No backend, no accounts. Data stays in localStorage; sample data loads on first visit so portfolio viewers see a populated app, with a reset option.
- Currency: EUR (author is Portuguese).

## Evidence on Hand

None. Sample transactions are clearly demo data, not claims.

## Product Principles

1. Remaining-to-spend is the headline number.
2. Adding a transaction is never more than one step away.
3. Works fully with keyboard and on a phone.
4. Nothing is lost silently: deletes can be undone.

## Accessibility & Inclusion

WCAG 2.2 AA: contrast, focus visibility, labelled controls, reduced-motion respected.
