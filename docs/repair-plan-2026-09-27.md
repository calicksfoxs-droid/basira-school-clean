# BASIRA Repair Execution — 2026-09-27

This branch is the bounded repair line for Core 1.0. It starts from production-aligned SHA `fb438ec73511cd1ad87970311405403159947329`.

## Repair invariants

1. Learning Core is canonical: Teacher -> Grade -> Subject -> Group -> Membership, and Subject -> Unit -> Lesson -> Asset/Quiz.
2. Student reads are scoped by authenticated/RLS paths; service-role filtering is not the primary privacy boundary.
3. Student privacy is absolute: no student roster, peer names, peer counts, peer IDs, or peer-derived metadata in student-facing contracts.
4. Account identity and enrollment are separate lifecycle concepts.
5. Display-order allocation is concurrency-safe at the database layer.
6. Core 1.0 assessment accepts only MCQ and True/False across runtime and database-enforced write paths.
7. Cross-system storage operations become idempotent and reconcilable before Cloudflare becomes primary production.
8. Production fails closed if configured without the Supabase backend.

## Initial batch

- Add database-level repair diagnostics and canonical Learning Core invariants.
- Add atomic display-order allocators.
- Lock Core 1.0 quiz question types at the database write boundary.
- Add an RLS-native `list_my_learning_subjects_v1` projection for students.
- Replace student Learning Core subject enumeration that currently uses the service role.
- Add release-contract tests for the new invariants.

Production data migration is intentionally separate from the contract migration so ambiguous legacy groups are never auto-linked to a subject without evidence.
