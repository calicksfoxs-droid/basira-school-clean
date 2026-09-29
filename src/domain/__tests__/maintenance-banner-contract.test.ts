import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

describe("platform maintenance banner", () => {
  it("passes the persisted maintenance message from the protected layout to AppShell", async () => {
    const layout = await read("src/app/app/layout.tsx");
    expect(layout).toContain("settings.maintenanceMessage");
    expect(layout).toContain("maintenanceMessage=");
  });

  it("renders the message globally as ordinary React text", async () => {
    const shell = await read("src/components/layout/app-shell.tsx");
    expect(shell).toContain('data-testid="maintenance-banner"');
    expect(shell).toContain("{maintenance}");
    expect(shell).toContain('role="status"');
    expect(shell).toContain('aria-live="polite"');
  });
});
