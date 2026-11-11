import { test, expect, Page } from '@playwright/test';
import { CartPage } from '../../pages/cart.page';
import { CheckoutPage } from '../../pages/checkout.page';
import { ConfirmationPage } from '../../pages/confirmation.page';

/**
 * TC-P0-PP-01: Postpaid device purchase happy path (device PLP -> order confirmation)
 *
 * Flow captured from a manual run in the UAT2 browser (network log):
 *   /device-plp
 *     -> /device-pdp/device-code/<device>        (line type, SIM, payment option, plan, Añadir al carrito)
 *     -> cart (createcart / addcart)
 *     -> /checkout/mobile/personal-information   (name, DOB, email, phone; SSN search; OTP)
 *     -> /checkout/mobile/billing-address        (street address, Melissa verify, delivery + billing)
 *     -> /checkout/mobile/payment-summary        (order summary, stock reservation)
 *     -> /checkout/mobile/payment-tnc            (Braintree hosted fields, Pagar)
 *     -> /checkout/mobile/order-confirmation
 *
 * Selectors marked VERIFY were not captured from the DOM and must be confirmed.
 */

const PLP_URL = '/device-plp';
// Device to buy from the PLP. Matched by name, not by card position.
const DEVICE_NAME = /iPhone 16 Pro Max/i;

const TEST_DATA = {
  // Test-only values. Replace with the test customer you use on UAT2.
  firstName: 'John',
  lastName: 'Hammer',
  dob: '09/23/2004',
  email: 'anshuman.biswal@p.com',
  phone: '(787)878-7878',
  // Port-in number (only used when keeping the current number). VERIFY test value.
  portInNumber: '7878787878',
  street: '525 calle',
  streetSuggestion: /525 Calle 1/i,
  card: {
    cardholderName: 'JJ DD',
    cardNumber: '4111111111111111',
    expirationDate: '12/28',
    cvv: '100',
  },
  // SSN used by the credit check (mule/userinfo/ssn-search). Hard-coded test value.
  ssn: '666730235',
};

class PostpaidPlpPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(PLP_URL, { waitUntil: 'domcontentloaded' });
    await this.dismissCookies();
  }

  async dismissCookies() {
    const btn = this.page.locator('button').filter({ hasText: /aceptar todo|accept all/i }).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click({ force: true });
    }
  }

  /** Clicks "Lo quiero" on the card for the device matching DEVICE_NAME. */
  async selectDevice(name: RegExp = DEVICE_NAME) {
    // The innermost div containing both the device name and its "Lo quiero" button is the card.
    const card = this.page
      .locator('div')
      .filter({ hasText: name })
      .filter({ has: this.page.getByText('Lo quiero', { exact: true }) })
      .last();
    const buy = card.getByText('Lo quiero', { exact: true });
    await buy.waitFor({ state: 'visible', timeout: 30000 });
    await this.dismissCookies();
    await buy.click();
    await this.page.waitForURL(/device-pdp/, { timeout: 30000 });
  }
}

class PostpaidDevicePdpPage {
  constructor(private page: Page) {}

  async configureLine(opts: { lineType: 'new' | 'port'; sim: 'physical' | 'esim' }) {
    if (opts.lineType === 'new') {
      // "No, necesito un número nuevo": a new number, no porting needed.
      await this.page.getByText('No, necesito un número nuevo', { exact: true }).click({ force: true });
    } else {
      // "Sí, conservar mi número": port in an existing number (needs a phone number and Verificar).
      const phoneInput = this.page.locator('input#mat-input-0, input[type="text"][placeholder*="787" i]').first();
      await phoneInput.click();
      await phoneInput.pressSequentially(TEST_DATA.portInNumber, { delay: 60 });
      await this.page.getByRole('button', { name: 'Verificar' }).click({ force: true });
      await this.page.waitForResponse(/portability\/portabilityCheck/, { timeout: 30000 }).catch(() => {});
    }

    // SIM option. VERIFY label text for eSIM.
    const simLabel = opts.sim === 'physical' ? /Tarjeta SIM|PhysicalSIM/i : /eSIM/i;
    await this.page.getByText(simLabel).first().click({ force: true });

    // Payment option: full payment ("Pago completo" / "Precio Total").
    await this.page.getByText(/Precio Total|Pago completo/i).first().click({ force: true });

    // Plan: Liberty Mobile Mix Core.
    await this.page.getByText('Liberty Mobile Mix Core').first().click({ force: true });
  }

  async addToCart() {
    const addBtn = this.page.getByRole('button', { name: 'Añadir al carrito' });
    await expect(addBtn).toBeEnabled({ timeout: 15000 });
    await Promise.all([
      this.page.waitForResponse(/api\/cart\/addcart/, { timeout: 30000 }),
      addBtn.click(),
    ]);
    await this.page.waitForURL(/cart-summary-overview/i, { timeout: 45000 });
  }
}

/**
 * Postpaid personal-information page: personal info, SSN and address are collapsible sections.
 * Each section with a "Guardar" button is saved before moving on.
 */
async function clickSaveIfPresent(page: Page) {
  const save = page.getByRole('button', { name: 'Guardar', exact: true });
  if (await save.isVisible({ timeout: 2000 }).catch(() => false)) {
    await save.click();
    await save.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }
}

async function fillPostpaidPersonalInfo(page: Page) {
  // Section 1: Información personal
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(TEST_DATA.firstName);
  await page.getByRole('textbox', { name: 'Apellido', exact: true }).fill(TEST_DATA.lastName);
  await page.locator('input[type="email"], input[formcontrolname*="email" i]').first().fill(TEST_DATA.email);
  await page.getByRole('textbox', { name: /787\)000-0000/ }).fill(TEST_DATA.phone);
  await clickSaveIfPresent(page);

  // Section 2: Verificación con SSN (open the accordion only if its fields are hidden)
  const dob = page.getByRole('textbox', { name: 'mm/dd/aaaa' });
  if (!(await dob.isVisible({ timeout: 2000 }).catch(() => false))) {
    await page.getByText('Verificación con Número de Seguro Social (SSN)').click();
  }
  await dob.click();
  await dob.pressSequentially(TEST_DATA.dob.replace(/\//g, ''), { delay: 50 });
  await page.getByRole('textbox', { name: /dígitos de su SSN/i }).fill(TEST_DATA.ssn);
  await clickSaveIfPresent(page);
}

const TOTAL_STEPS = 9;

test.describe('LCPR Postpaid Device Purchase - Happy Flow', () => {
  test.setTimeout(240000);

  test('TC-P0-PP-01: Postpaid device purchase from PLP to order confirmation @p0 @postpaid', async ({ page }) => {
    const plp = new PostpaidPlpPage(page);
    const pdp = new PostpaidDevicePdpPage(page);
    const cart = new CartPage(page);
    const checkout = new CheckoutPage(page);
    const confirmation = new ConfirmationPage(page);

    // Progress log: prints "[n/9] label ..." when a step starts and its duration when it ends.
    const runStart = Date.now();
    let current = 0;
    const step = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      current++;
      const stepStart = Date.now();
      const tag = `[${current}/${TOTAL_STEPS}]`;
      console.log(`${tag} ${label} ...`);
      try {
        const result = await test.step(label, fn);
        const took = ((Date.now() - stepStart) / 1000).toFixed(1);
        const total = ((Date.now() - runStart) / 1000).toFixed(0);
        console.log(`${tag} ${label} done in ${took}s (elapsed ${total}s)`);
        return result;
      } catch (err) {
        console.log(`${tag} ${label} FAILED after ${((Date.now() - stepStart) / 1000).toFixed(1)}s`);
        throw err;
      }
    };

    await step('Open device PLP and select device', async () => {
      await plp.open();
      await plp.selectDevice();
    });

    await step('Configure line (new number, physical SIM) and add to cart', async () => {
      await pdp.configureLine({ lineType: 'new', sim: 'physical' });
      await pdp.addToCart();
    });

    await step('Continue from cart summary', async () => {
      await cart.proceedFromCartSummary();
    });

    await step('Fill personal information and SSN', async () => {
      await page.waitForURL(/checkout\/mobile\/personal-information/, { timeout: 45000 });
      await fillPostpaidPersonalInfo(page);
    });

    await step('Submit form and enter OTP from generate-otp response', async () => {
      await checkout.submitFormAndEnterDynamicOtp();
    });

    await step('Fill billing and delivery address', async () => {
      await checkout.fillBillingAndShippingAddress(TEST_DATA.street);
    });

    await step('Check order summary (plan and total)', async () => {
      // Address step ends on payment-tnc; the summary is checked here.
      // VERIFY: summary-only assertions against the payment-summary DOM.
      await expect(page.getByText(/Mobile Plan Mix Core|Liberty Mobile Mix Core/i).first()).toBeVisible();
      await expect(page.getByText(/Total/i).first()).toBeVisible();
    });

    await step('Pay with Braintree test card', async () => {
      await checkout.fillPaymentDetailsAndPay(TEST_DATA.card);
    });

    await step('Verify order confirmation', async () => {
      await confirmation.verifyOrderPlaced();
      await expect(page.getByText('Your order was completed successfully')).toBeVisible();
      await expect(page.getByText(/Order ID/i)).toBeVisible();
    });
  });
});
