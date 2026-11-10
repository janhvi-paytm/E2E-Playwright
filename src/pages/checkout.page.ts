import { Page, Locator, FrameLocator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class CheckoutPage extends BasePage {
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly dobInput: Locator;
  readonly emailInput: Locator;
  readonly phoneInput: Locator;
  readonly esimRadio: Locator;
  readonly physicalSimOption: Locator;
  readonly continueBtn: Locator;
  readonly cookieAcceptBtn: Locator;

  // Billing / Shipping Address Locators
  readonly streetAddressInput: Locator;
  readonly addressSuggestion: Locator;

  // Dialog & Verification
  readonly firstDigitInput: Locator;
  readonly validateOtpBtn: Locator;

  // Braintree Payment Iframes & Elements
  readonly cardholderNameFrame: FrameLocator;
  readonly cardNumberFrame: FrameLocator;
  readonly expDateFrame: FrameLocator;
  readonly cvvFrame: FrameLocator;
  readonly payButton: Locator;

  constructor(page: Page) {
    super(page);

    this.firstNameInput = page.locator('input[formcontrolname*="first" i], input[formcontrolname*="name" i]')
      .or(page.getByRole('textbox', { name: /nombre|first name/i })).first();

    this.lastNameInput = page.locator('input[formcontrolname*="last" i], input[formcontrolname*="apellido" i]')
      .or(page.getByRole('textbox', { name: /apellido|last name/i })).first();

    this.dobInput = page.locator('input[placeholder*="mm/dd" i], input[formcontrolname*="dob" i], input[formcontrolname*="birth" i]')
      .or(page.getByRole('textbox', { name: /mm\/dd/i }))
      .or(page.locator('form input[type="text"]').nth(2)).first();

    this.emailInput = page.locator('input[type="email"], input[formcontrolname*="email" i], input[placeholder*="@"]')
      .or(page.getByRole('textbox', { name: /email|correo|example\.com/i })).first();

    this.phoneInput = page.locator('input[type="tel"], input[formcontrolname*="phone" i], input[placeholder*="787"]')
      .or(page.getByRole('textbox', { name: /787|phone|tel/i })).first();

    this.esimRadio = page.getByRole('radio', { name: /esim/i })
      .or(page.getByText('eSIM', { exact: true }));

    // Target the visible label directly to bypass pointer interception
    this.physicalSimOption = page.locator('span.radioLabel, span.radio-checkmark, label')
      .filter({ hasText: /sim física/i })
      .or(page.getByText('SIM Física', { exact: false }))
      .or(page.getByRole('radio', { name: /sim física/i })).first();

    this.continueBtn = page.getByRole('button', { name: /continuar|continue/i });
    this.cookieAcceptBtn = page.locator('button').filter({ hasText: /aceptar todo|accept all/i });

    // Address elements
    this.streetAddressInput = page.getByPlaceholder(/nombre de la calle y número|street name/i)
      .or(page.locator('input[formcontrolname*="address" i], input[formcontrolname*="street" i]')).first();
    this.addressSuggestion = page.locator('.mat-mdc-autocomplete-panel, .mat-mdc-option, mat-option, [role="option"]').first();

    // OTP Modal elements
    this.firstDigitInput = page.locator('#input-code-0-input-0, input[id*="input-code-0"]').first();
    this.validateOtpBtn = page.getByRole('button', { name: /validar|validate/i });

    // Braintree Hosted Field Iframes
    this.cardholderNameFrame = page.frameLocator('iframe[name="braintree-hosted-field-cardholderName"]');
    this.cardNumberFrame = page.frameLocator('iframe[name="braintree-hosted-field-number"]');
    this.expDateFrame = page.frameLocator('iframe[name="braintree-hosted-field-expirationDate"]');
    this.cvvFrame = page.frameLocator('iframe[name="braintree-hosted-field-cvv"]');
    this.payButton = page.getByRole('button', { name: /Pagar \$/i });
  }

  async fillCustomerDetails(details: {
    firstName: string;
    lastName: string;
    dob?: string;
    email: string;
    phone: string;
    simType?: 'esim' | 'physical';
  }) {
    // Clear cookie prompt if present
    try {
      if (await this.cookieAcceptBtn.isVisible({ timeout: 2000 })) {
        await this.cookieAcceptBtn.click({ force: true });
      }
    } catch {}

    // Wait for first form field to mount
    await this.firstNameInput.waitFor({ state: 'visible', timeout: 30000 });
    await this.firstNameInput.click();
    await this.firstNameInput.fill(details.firstName);

    await this.lastNameInput.click();
    await this.lastNameInput.fill(details.lastName);

    if (details.dob) {
      if (await this.dobInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.dobInput.click();
        await this.dobInput.pressSequentially(details.dob.replace(/\//g, ''), { delay: 50 });
      }
    }

    await this.emailInput.click();
    await this.emailInput.fill(details.email);

    await this.phoneInput.click();
    await this.phoneInput.fill(details.phone);

    await this.page.waitForTimeout(500);

    if (details.simType === 'physical') {
      await this.physicalSimOption.waitFor({ state: 'visible', timeout: 10000 });
      await this.physicalSimOption.scrollIntoViewIfNeeded();
      await this.physicalSimOption.click({ force: true });
    } else {
      if (await this.esimRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.esimRadio.click({ force: true });
      }
    }
  }

  async submitFormAndEnterDynamicOtp(): Promise<string> {
    let capturedOtp = '';

    const responseHandler = async (response: any) => {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const body = await response.json();
          if (body && body.otp) {
            capturedOtp = String(body.otp);
            console.log(`[Captured Dynamic OTP]: ${capturedOtp}`);
          }
        }
      } catch {}
    };

    this.page.on('response', responseHandler);

    await this.continueBtn.scrollIntoViewIfNeeded();
    await this.continueBtn.click({ force: true });

    try {
      if (await this.cookieAcceptBtn.isVisible({ timeout: 2000 })) {
        await this.cookieAcceptBtn.click();
      }
    } catch {}

    await this.firstDigitInput.waitFor({ state: 'visible', timeout: 25000 });

    const startTime = Date.now();
    while (!capturedOtp && Date.now() - startTime < 15000) {
      await this.page.waitForTimeout(200);
    }
    this.page.off('response', responseHandler);

    if (!capturedOtp) {
      throw new Error('Failed to intercept OTP from network response payload.');
    }

    const digits = capturedOtp.split('');
    for (let i = 0; i < digits.length; i++) {
      const input = this.page.locator(`#input-code-0-input-${i}`);
      if (await input.isVisible()) {
        await input.click();
        await input.pressSequentially(digits[i], { delay: 100 });
      }
    }

    await this.validateOtpBtn.waitFor({ state: 'visible' });
    await expect(this.validateOtpBtn).toBeEnabled({ timeout: 10000 });
    await this.validateOtpBtn.click();

    return capturedOtp;
  }

  async fillBillingAndShippingAddress(addressQuery: string = '525 calle') {
    // 1. Wait for billing address route
    await this.page.waitForURL(/.*billing-address.*/i, { timeout: 35000 });
    await this.page.waitForTimeout(1000);

    // 2. Type street address
    const addressInput = this.page.getByPlaceholder('Nombre de la calle y número')
      .or(this.streetAddressInput).first();
    await addressInput.waitFor({ state: 'visible', timeout: 15000 });
    await addressInput.click();
    await addressInput.fill(addressQuery);

    // 3. Target active autocomplete option (resolves strict mode)
    const predictionOption = this.page.getByRole('option', { name: /525 Calle 1/i })
      .or(this.page.locator('mat-option:not([aria-disabled="true"])').filter({ hasText: /525/i }))
      .first();

    await predictionOption.waitFor({ state: 'visible', timeout: 15000 });
    await predictionOption.click();
    await this.page.waitForTimeout(1000);

    // 4. Click first Continuar (triggers standardization)
    const continueBtn = this.page.getByRole('button', { name: 'Continuar' });
    await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(continueBtn).toBeEnabled({ timeout: 10000 });
    await continueBtn.click();

    // 5. Wait for standardization loader to disappear
    const loader = this.page.locator('lla-loader-container, .llac-loaders__opacity-50');
    try {
      await loader.waitFor({ state: 'hidden', timeout: 10000 });
    } catch {}

    // 6. Select recommended address option if modal appears
    const suggestedAddressRadio = this.page.locator('mat-radio-button, input[type="radio"], [role="radio"]')
      .filter({ hasText: /sugerida|estandarizada|recomendada/i })
      .or(this.page.locator('.mat-mdc-radio-button, mat-radio-button').first());

    if (await suggestedAddressRadio.isVisible({ timeout: 4000 }).catch(() => false)) {
      await suggestedAddressRadio.click({ force: true });
      await this.page.waitForTimeout(500);
    }

    // 7. Click second Continuar once enabled
    await expect(continueBtn).toBeEnabled({ timeout: 15000 });
    await continueBtn.click();

    // 8. Route to payment page
    await this.page.waitForURL(/.*payment-tnc.*/i, { timeout: 35000 });
  }

  async fillPaymentDetailsAndPay(payment: {
    cardholderName: string;
    cardNumber: string;
    expirationDate: string;
    cvv: string;
  }) {
    await this.page.waitForURL(/.*payment-tnc.*/i, { timeout: 35000 });

    const nameInput = this.cardholderNameFrame.getByRole('textbox', { name: 'Cardholder Name' });
    await nameInput.waitFor({ state: 'visible', timeout: 20000 });
    await nameInput.click();
    await nameInput.fill(payment.cardholderName);

    const numberInput = this.cardNumberFrame.getByRole('textbox', { name: 'Credit Card Number' });
    await numberInput.click();
    await numberInput.fill(payment.cardNumber);

    const expInput = this.expDateFrame.getByRole('textbox', { name: 'Expiration Date' });
    await expInput.click();
    await expInput.fill(payment.expirationDate);

    const cvvInput = this.cvvFrame.getByRole('textbox', { name: 'CVV' });
    await cvvInput.click();
    await cvvInput.fill(payment.cvv);

    await this.payButton.scrollIntoViewIfNeeded();
    await expect(this.payButton).toBeEnabled({ timeout: 10000 });
    await this.payButton.click();
  }
}