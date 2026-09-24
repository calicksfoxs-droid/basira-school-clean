# BASIRA Update Backlog

Only deferred P2/P3 or intentionally unsupported capabilities belong here. A known P0/P1 affecting the frozen Core 1.0 surface must stay in Release State instead.

| Item | Why deferred | Becomes blocker when | Target |
|---|---|---|---|
| Standalone Assignments | Independent subsystem not required for Core teaching loop | Release claims standalone assignment workflow | 1.1+ |
| Unified Gradebook | Depends on stable assessment/assignment grade sources | Release claims unified gradebook | after Assignments |
| Advanced quiz attempts | Core 1.0 freezes one normal attempt | Configurable/multiple attempts become supported | 1.1 |
| Highest-attempt aggregation | Not part of objective-only Core contract | Multiple attempts are supported | 1.1 |
| Review timing/modes | Immediate objective release is sufficient for Core | Delayed/selective review is promised | 1.1 |
| Essay/manual grading | Explicitly disabled for Core 1.0 | Essay/manual assessment is promoted | 1.1 |
| Lesson aid assets | Student read path is not Core 1.0 | Aid is promoted to Supported | 1.1 |
| Image handouts | Production handout bucket currently PDF-only | Images are promoted to Supported handouts | 1.1 |
| Analytics | Not required for 30-day teaching survival | Analytics becomes a product claim | later |
| Competitive benchmark | Valuable after durable core is stable | Before final broad UX/product pass | post-core |
| Full fresh-environment rebuild drill | Strong release-engineering evidence, not current manual-deploy blocker | DB deploy automation/DR relies on migration replay | 1.1 / before automation |
| Migration-history normalization | Current manual deployment can be controlled with explicit parity state | Routine automated `db push` is enabled | before automation |
| Legacy lane removal | Existing data compatibility may still need code/RLS | Legacy rows are migrated/retired intentionally | later |
| Broader UI/UX polish | Comfort layer can follow durable core | UX blocks or misleads a supported journey | 1.1 |
