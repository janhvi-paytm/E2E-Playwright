import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CartPage extends BasePage {
  readonly checkoutBtn: Locator;
  readonly newNumberOption: Locator;

  constructor(page: Page) {
    super(page);
    this.newNumberOption = page.getByLabel(/new number|nuevo número/i);
    this.checkoutBtn = page.getByRole('button', { name: /continue|checkout|continuar/i });
  }

  /** Cart summary overview → checkout personal-information (postpaid device flow). */
  async proceedFromCartSummary() {
    await this.page.waitForURL(/cart-summary-overview/i, { timeout: 45000 });
    // Title is a styled div, not a semantic heading — getByRole('heading') never resolves.
    await this.page.getByText(/^Tu Carrito$/i).first().waitFor({ state: 'visible', timeout: 30000 });

    await this.dismissCookieBanner();
    await this.waitForAppLoaderHidden();

    // Cart totals may refresh after load; Continuar stays disabled until that finishes.
    const continueBtn = this.page
      .getByRole('button', { name: /^Continuar$/i, disabled: false })
      .last();
    await continueBtn.scrollIntoViewIfNeeded();
    await expect(continueBtn).toBeVisible({ timeout: 15000 });
    await expect(continueBtn).toBeEnabled({ timeout: 30000 });

    // No force: if an overlay covers the button, Playwright reports the blocking element.
    await continueBtn.click();
    await this.page.waitForURL(/checkout\/mobile\/personal-information/i, { timeout: 45000 });
  }

  async proceedToCheckout() {
    if (await this.newNumberOption.isVisible()) {
      await this.newNumberOption.check();
    }
    await this.dismissCookieBanner();
    await this.waitForAppLoaderHidden();
    const continueBtn = this.checkoutBtn.last();
    await continueBtn.scrollIntoViewIfNeeded();
    await expect(continueBtn).toBeEnabled({ timeout: 30000 });
    await continueBtn.click({ force: true });
  }
}