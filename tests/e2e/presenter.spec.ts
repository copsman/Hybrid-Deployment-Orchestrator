import { test, expect } from "@playwright/test";

test.describe("MERIDIAN // VANTAGE presenter mode", () => {
  test("presenter hotkeys drive the director and stay quiet while typing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?intro=0&speed=4");
    await expect(page.getByTestId("env-cards")).toBeVisible();

    // 2D map so the run does not depend on the runner's GPU; the switch keeps focus after the click,
    // so move focus to a neutral element before the first Space.
    await page.getByTestId("motion-toggle").click();
    await expect(page.getByTestId("scene-2d")).toBeVisible();
    await expect(page.getByTestId("presenter-rail")).toHaveAttribute("data-status", "idle");
    await page.getByTestId("presenter-rail").click();

    await page.keyboard.press("Space");
    await expect(page.getByTestId("caption")).toBeVisible();
    await expect(page.getByRole("button", { name: "PAUSE" })).toBeVisible();
    await expect(page.getByTestId("presenter-rail")).toHaveAttribute("data-status", "playing");
    await expect(page.getByTestId("scene-2d")).toBeVisible(); // Space never re-toggled the switch

    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "RESUME" })).toBeVisible();

    // Typing in a field (with spaces) must not resume the director.
    await page.getByTestId("job-title").click();
    await page.keyboard.press("End");
    await page.keyboard.type("hello world");
    await expect(page.getByRole("button", { name: "RESUME" })).toBeVisible();
    await expect(page.getByTestId("job-title")).toHaveValue(/hello world$/);

    await page.getByTestId("presenter-rail").click(); // moves focus off the input
    await page.keyboard.press("3");
    await expect(page.getByText("2D MAP · CLOUD")).toBeVisible();
    await page.keyboard.press("5");
    await expect(page.getByText("2D MAP · DATA DIODE")).toBeVisible();

    await page.keyboard.press("?");
    await expect(page.getByTestId("shortcut-legend")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("shortcut-legend")).toHaveCount(0);

    await page.keyboard.press("Space"); // resume
    await expect(page.getByRole("button", { name: "PAUSE" })).toBeVisible();

    await page.keyboard.press("r"); // plain R only warns
    await expect(page.getByText("Reset needs SHIFT+R")).toBeVisible();
    await expect(page.getByRole("button", { name: "PAUSE" })).toBeVisible();

    await page.keyboard.press("Shift+R");
    await expect(page.getByTestId("play-scenario")).toBeVisible();
    await expect(page.getByTestId("presenter-rail")).toHaveAttribute("data-status", "idle");
    await expect(page.locator("[data-testid^=job-row-]")).toHaveCount(0);

    expect(errors, errors.join("\n")).toEqual([]);
  });
});
