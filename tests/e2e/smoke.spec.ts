import { test, expect } from "@playwright/test";

test.describe("MERIDIAN // VANTAGE control room", () => {
  test("loads, plays the full scenario, routes three jobs and refuses three", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?intro=0&speed=4");
    await expect(page.getByTestId("env-cards")).toBeVisible();
    await expect(page.getByTestId("env-card-cloud")).toContainText("1.3.0");

    // Switch to the 2D map so the run does not depend on the CI runner's GPU.
    await page.getByTestId("motion-toggle").click();
    await expect(page.getByTestId("scene-2d")).toBeVisible();

    await page.getByTestId("play-scenario").click();
    await expect(page.getByTestId("caption")).toBeVisible();
    await expect(page.getByTestId("caption")).toContainText("SCENARIO COMPLETE", { timeout: 110_000 });

    const rows = page.locator("[data-testid^=job-row-]");
    await expect(rows).toHaveCount(6);
    await expect(page.getByTestId("job-row-JOB-A")).toHaveAttribute("data-env", "cloud");
    await expect(page.getByTestId("job-row-JOB-B")).toHaveAttribute("data-env", "onprem");
    await expect(page.getByTestId("job-row-JOB-C")).toHaveAttribute("data-status", "REFUSED");
    await expect(page.getByTestId("job-row-JOB-C2")).toHaveAttribute("data-env", "airgapped");
    await expect(page.getByTestId("job-row-JOB-D")).toHaveAttribute("data-status", "REFUSED");
    await expect(page.getByTestId("job-row-JOB-E")).toHaveAttribute("data-status", "REFUSED");

    await page.getByTestId("tab-ledger").click();
    await expect(page.getByTestId("ledger-status")).toHaveText("CHAIN INTACT");
    await page.getByTestId("ledger-tamper").click();
    await expect(page.getByTestId("ledger-status")).toHaveText("CHAIN BROKEN");
    await page.getByTestId("ledger-restore").click();
    await expect(page.getByTestId("ledger-status")).toHaveText("CHAIN INTACT");

    await page.getByTestId("tab-deployments").click();
    await expect(page.getByTestId("artefact-row-1.4.0")).toContainText("CONSISTENT");

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("rejects malformed input without crashing and survives a reset", async ({ page }) => {
    await page.goto("/?intro=0&speed=4");
    await page.getByTestId("motion-toggle").click();
    await page.getByRole("button", { name: "RAW JSON" }).click();
    await page.getByTestId("raw-json").fill('{"title": 42, "classification": "TOP SECRET", "pii": "yes", "bogus": true}');
    await page.getByTestId("submit-raw").click();
    await expect(page.getByText("Submission rejected")).toBeVisible();
    await page.getByTestId("raw-json").fill("this is not json {");
    await page.getByTestId("submit-raw").click();
    await expect(page.getByText("Not valid JSON")).toBeVisible();
    await expect(page.locator("[data-testid^=job-row-]")).toHaveCount(0);

    await page.getByTestId("raw-json").fill('{"title": "Ad hoc", "classification": "SECRET", "egress": true}');
    await page.getByTestId("submit-raw").click();
    await expect(page.locator("[data-testid^=job-row-]")).toHaveCount(1);
    await expect(page.getByTestId("refusal-alert")).toBeVisible();

    await page.getByTestId("reset").click();
    await expect(page.locator("[data-testid^=job-row-]")).toHaveCount(0);
    await expect(page.getByTestId("env-card-cloud")).toContainText("1.3.0");
  });
});
