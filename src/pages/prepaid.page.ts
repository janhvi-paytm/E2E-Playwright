import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class PrepaidPage extends BasePage {
  readonly movilMenuLink: Locator;
  readonly planesMovilesLink: Locator;
  readonly prepagoLink: Locator;
  readonly llamanosButton: Locator;
  readonly cookieAcceptBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.cookieAcceptBtn = page.locator('button').filter({ hasText: /aceptar todo|accept all/i });

    // Exact selectors as captured in the DOM recording
    // Must not match "Cash Pago Fácil Móvil" (href: pagos.libertypr.com/movil), which is blocked
    this.movilMenuLink = page.locator('a').filter({ hasText: /^MóvilChevron Down$/ }).first();
    this.planesMovilesLink = page.locator('a').filter({ hasText: /^CellularPlanes Móviles/ }).first();
    this.prepagoLink = page.getByRole('link', { name: 'Planes de Prepago' }).first();
    this.llamanosButton = page.getByRole('button', { name: 'Llámanos' }).first();
  }

  async dismissCookiesIfPresent() {
    try {
      if (await this.cookieAcceptBtn.isVisible({ timeout: 2500 })) {
        await this.cookieAcceptBtn.click({ force: true });
        await this.page.waitForTimeout(500);
      }
    } catch {}
  }

  async navigateToPrepaidPlans() {
    await this.page.goto('https://fluat2.libertypr.lla.digital/es/', { waitUntil: 'domcontentloaded' });
    await this.dismissCookiesIfPresent();

    // 1. Click Móvil
    await this.movilMenuLink.waitFor({ state: 'visible', timeout: 20000 });
    await this.movilMenuLink.click();
    await this.page.waitForTimeout(600);

    // 2. Click CellularPlanes Móviles
    await this.planesMovilesLink.waitFor({ state: 'visible', timeout: 15000 });
    await this.planesMovilesLink.click();
    await this.page.waitForTimeout(600);

    // 3. Click Planes de Prepago
    await this.prepagoLink.waitFor({ state: 'visible', timeout: 15000 });
    await this.prepagoLink.click();

    // Wait for the plan card view to load
    await this.llamanosButton.waitFor({ state: 'visible', timeout: 25000 });
    await this.dismissCookiesIfPresent();
  }

  async startPrepaidCheckout() {
    await this.dismissCookiesIfPresent();

    // Click Llámanos
    await this.llamanosButton.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.llamanosButton.click({ force: true });

    // Wait for the registration form input to render
    const formElement = this.page.locator('input[formcontrolname*="name" i]:visible, [role="dialog"]:visible, form:visible').first();
    await formElement.waitFor({ state: 'visible', timeout: 20000 });
  }
}