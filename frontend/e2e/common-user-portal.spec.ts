import { expect, test } from "@playwright/test";

import { expectOnPortal, login, mockApiSession } from "./helpers/auth";

test.describe("Common user portal flow", () => {
  test("common user faz login e acessa portal e pre-jogo", async ({ page }) => {
    await mockApiSession(page, "COMMON");
    await login(page, "jogador", "jogador123");
    await expectOnPortal(page);

    await expect(page.getByText("Presenca recente")).toBeVisible();
    await expect(page.getByText("Gestão de Elenco")).toHaveCount(0);

    await page.getByRole("link", { name: "Pré-Jogo" }).click();
    await expect(page).toHaveURL(/\/pre-match$/);
    await expect(page.getByText("Pré-Jogo")).toBeVisible();
  });
});
