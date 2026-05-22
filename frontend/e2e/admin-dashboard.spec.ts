import { expect, test } from "@playwright/test";

import { expectOnDashboard, login, mockApiSession } from "./helpers/auth";

test.describe("Admin dashboard flow", () => {
  test("admin faz login e registra um lancamento", async ({ page }) => {
    await mockApiSession(page, "ADMIN");
    await login(page, "admin", "admin123");
    await expectOnDashboard(page);

    await page.getByRole("button", { name: "Lançar movimento" }).click();
    await expect(page.getByRole("heading", { name: "Novo lançamento" })).toBeVisible();

    await page.getByLabel("Descrição").fill("Taxa extra E2E");
    await page.getByLabel("Valor").fill("35");
    await page.getByRole("button", { name: "Salvar lançamento" }).click();

    await expect(page.getByText("Taxa extra E2E")).toBeVisible();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
