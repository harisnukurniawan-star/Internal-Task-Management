# Internal Task Management

Weekly performance-management application for Supervisor and Employee workflows.

## Core workflow

Supervisor assigns weekly tasks → employee submits realization and evidence → supervisor reviews and scores → weekly leaderboard recalculates.

## Stack

- Next.js App Router
- Supabase Auth + Postgres + Storage + RLS
- Vercel

## Initial employees

- Endang Mirah Ayu
- Citra Aries
- Heri Syamsudin

## Environment

Copy `.env.example` to `.env.local` and set the Supabase publishable key.

## Database

The source-of-truth schema is in `supabase/migrations/0001_foundation.sql`.

## Build status

Foundation build validated successfully in GitHub Actions on September 21, 2026.
