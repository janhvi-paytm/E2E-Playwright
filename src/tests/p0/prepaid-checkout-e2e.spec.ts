import { test, expect } from '@playwright/test';
import { PrepaidPage } from '../../pages/prepaid.page';
import { CheckoutPage } from '../../pages/checkout.page';
import { ConfirmationPage } from '../../pages/confirmation.page';

test.describe('LCPR Prepaid E2E Checkout Flow', () => {
  test.setTimeout(120000);

  test('TC-P0-01: End-to-end happy path prepaid eSIM purchase with valid test payment @p0', async ({ page }) => {
    const prepaidPage = new PrepaidPage(page);
    const checkoutPage = new CheckoutPage(page);
    const confirmationPage = new ConfirmationPage(page);

    // 1. Navigation
    await prepaidPage.navigateToPrepaidPlans();
    await prepaidPage.startPrepaidCheckout();

    // 2. Customer Lead Capture Form (eSIM)
    await checkoutPage.fillCustomerDetails({
      firstName: 'JJ',
      lastName: 'DD',
      dob: '09/23/2004',
      email: 'janhvi1.dikhit@paytm.com',
      phone: '(787)878-7878',
      simType: 'esim',
    });

    // 3. Dynamic OTP
    const capturedOtp = await checkoutPage.submitFormAndEnterDynamicOtp();
    expect(capturedOtp).toHaveLength(5);

    // 4. Payment
    await checkoutPage.fillPaymentDetailsAndPay({
      cardholderName: 'JJ DD',
      cardNumber: '4111111111111111',
      expirationDate: '2/30',
      cvv: '100',
    });

    // 5. Order Confirmation
    await confirmationPage.verifyOrderPlaced();
    await expect(page).toHaveURL(/.*order-confirmation.*/i);
  });

  test('TC-P0-02: End-to-end happy path prepaid physical SIM purchase with valid test payment @p0', async ({ page }) => {
    const prepaidPage = new PrepaidPage(page);
    const checkoutPage = new CheckoutPage(page);
    const confirmationPage = new ConfirmationPage(page);

    // 1. Navigation
    await prepaidPage.navigateToPrepaidPlans();
    await prepaidPage.startPrepaidCheckout();

    // 2. Customer Lead Capture Form (Physical SIM)
    await checkoutPage.fillCustomerDetails({
      firstName: 'JJ',
      lastName: 'DD',
      dob: '09/23/2004',
      email: 'janhvi1.dikhit@paytm.com',
      phone: '(787)878-7878',
      simType: 'physical',
    });

    // 3. Dynamic OTP
    const capturedOtp = await checkoutPage.submitFormAndEnterDynamicOtp();
    expect(capturedOtp).toHaveLength(5);

    // 4. Billing & Shipping Address
    await checkoutPage.fillBillingAndShippingAddress('525 calle');

    // 5. Payment via Braintree
    await checkoutPage.fillPaymentDetailsAndPay({
      cardholderName: 'JJ',
      cardNumber: '4111111111111111',
      expirationDate: '12/28',
      cvv: '100',
    });

    // 6. Order Confirmation
    await confirmationPage.verifyOrderPlaced();
    await expect(page).toHaveURL(/.*order-confirmation.*/i);
  });
});