import { test, expect } from "@playwright/test";

test.describe("MERIDIAN // VANTAGE jury view", () => {
  test("jury view hides manual controls and plays from the keyboard", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?intro=0&speed=4&jury=1");
    await expect(page.getByTestId("env-cards")).toBeVisible();
    await expect(page.getByTestId("presenter-rail")).toBeVisible();
    await expect(page.locator("[data-jury='1']")).toHaveCount(1);

    // Manual controls are gone: submit form, raw JSON, reset, next/stop/speed, the WHAT-IF tab.
    await expect(page.getByTestId("submit-form")).toHaveCount(0);
    await expect(page.getByTestId("raw-json")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "RAW JSON" })).toHaveCount(0);
    await expect(page.getByTestId("reset")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next step (N)" })).toHaveCount(0);
    await expect(page.getByTestId("tab-whatif")).toHaveCount(0);
    await expect(page.locator("[data-testid^=tab-]")).toHaveCount(6);
    await expect(page.getByText("No jobs yet. Press SPACE or PLAY SCENARIO.")).toBeVisible();

    await page.getByTestId("tab-ledger").click();
    await expect(page.getByTestId("ledger-status")).toHaveText("CHAIN INTACT");
    await expect(page.getByTestId("ledger-tamper")).toHaveCount(0);
    await expect(page.getByTestId("ledger-verify")).toHaveCount(0);

    await page.getByTestId("tab-pipeline").click();
    await expect(page.getByTestId("pipeline")).toBeVisible();
    await expect(page.getByTestId("build-next")).toHaveCount(0);
    await expect(page.getByTestId("pipeline-manual")).toHaveCount(0);

    // Presenter keys still work: M swaps to the GPU-free 2D map, ? opens the legend.
    await page.keyboard.press("m");
    await expect(page.getByTestId("scene-2d")).toBeVisible();
    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcut-legend")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("shortcut-legend")).toHaveCount(0);

    await page.getByTestId("play-scenario").click();
    await expect(page.getByTestId("caption")).toBeVisible();
    // Story auto-follow: the first jobs land on the DECISION tab without any click.
    await expect(page.getByTestId("tab-decision")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("caption")).toContainText("SCENARIO COMPLETE", { timeout: 110_000 });
    // ...and the run ends on the LEDGER tab.
    await expect(page.getByTestId("tab-ledger")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("ledger-status")).toHaveText("CHAIN INTACT");

    // Radix unmounts inactive panels, so select JOBS before counting the rows.
    await page.getByTestId("tab-jobs").click();
    await expect(page.locator("[data-testid^=job-row-]")).toHaveCount(6);
    await expect(page.getByTestId("job-row-JOB-C2")).toHaveAttribute("data-env", "airgapped");
    await page.getByTestId("tab-ledger").click();
    await expect(page.getByTestId("ledger-status")).toHaveText("CHAIN INTACT");

    // J restores the operator page: the submit form and its single RAW JSON button are back.
    await page.getByTestId("presenter-rail").click();
    await page.keyboard.press("j");
    await expect(page.locator("[data-jury='0']")).toHaveCount(1);
    await page.getByTestId("tab-jobs").click();
    await expect(page.getByTestId("submit-form")).toBeVisible();
    await expect(page.getByRole("button", { name: "RAW JSON" })).toHaveCount(1);
    await expect(page.getByTestId("reset")).toBeVisible();

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
