# Architecture

## Core flow

```text
Access code → role-scoped home → teacher-owned group → subject → lesson
→ direct content OR ordered one-level parts → video/PDF/quiz
→ objective auto-grade + manual essay grading → released private result
```

## Backends

The same `BasiraStore` contract is implemented by:

- `DemoStore`: signed cookie, JSON database, local private file route. Used by default for immediate local evaluation.
- `SupabaseStore`: Supabase Auth, Postgres, private Storage, RLS, trusted server operations. Enabled with `BASIRA_BACKEND=supabase`.

UI and Server Actions consume the contract rather than backend-specific tables.

## Ownership

Every active group has exactly one teacher owner. Subjects inherit the group. Lessons, parts, assets, quizzes, submissions and grades resolve permissions through that chain.

## Lesson structure

A lesson is either:

- `direct`: one optional video, one optional PDF and one optional quiz.
- `parts`: ordered, one-level parts; every part may contain one of each.

Mixing modes is blocked. Publishing requires real ready content.

## Assessment

- Objective answers are graded on trusted code/database functions.
- Correct answers live in separate protected tables.
- Essays remain pending until teacher grading.
- A mixed quiz does not expose partial scores/correct answers before release.
- Submission creation is duplicate-safe.

## Files

Production files use private buckets:

- `lesson-videos`
- `lesson-handouts`
- `submission-files`

Large videos upload directly to Supabase Storage with TUS, not through the Next.js/Render request body. Replacement uploads to a new immutable path and swaps references only after verification.
