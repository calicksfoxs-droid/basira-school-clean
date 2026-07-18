import { rm } from "node:fs/promises";

// Next dev can be terminated while writing generated validator files. Those
// files are disposable and an incomplete validator must not make a clean
// source typecheck fail. Production route validators remain in .next/types.
await rm(".next/dev/types", { recursive: true, force: true });
