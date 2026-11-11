import { Page } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  async navigateTo(path: string = '/') {
    await this.page.goto(path);
  }

  async waitForPageLoaded() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async dismissCookieBanner() {
    const btn = this.page.locator('button').filter({ hasText: /aceptar todo|accept all/i }).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click({ force: true });
    }
  }

  /** Waits until Angular overlay loaders stop intercepting pointer events. */
  async waitForAppLoaderHidden(timeout = 30000) {
    const loader = this.page.locator('lla-loader-container, .llac-loaders__opacity-50');
    await loader.waitFor({ state: 'hidden', timeout }).catch(() => {});
  }
}
