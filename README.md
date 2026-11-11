# LCPR E2E Playwright Tests

Playwright + TypeScript tests for the Liberty PR UAT2 site (`https://fluat2.libertypr.lla.digital`).
Page objects live in `src/pages/`, specs in `src/tests/`.

## Setup (first time only)

```bash
cd /Users/anshumanbiswal/Desktop/E2E-Playwright
npm install
npx playwright install chromium
```

## Test files

| File | Test ID | What it covers | Places a real order? |
| --- | --- | --- | --- |
| `src/tests/p0/postpaid-device-happy-flow.spec.ts` | TC-P0-PP-01 | Postpaid device purchase: device PLP → PDP → cart → personal info + OTP → billing address → payment → order confirmation | Yes |
| `src/tests/p0/prepaid-checkout-e2e.spec.ts` | TC-P0-01, TC-P0-02 | Prepaid purchase, eSIM and physical SIM: navigation → lead form → OTP → address (physical only) → payment → confirmation | Yes |
| `src/tests/p0/lcpr-prepaid-sanity.spec.ts` | TC-P0-01 (smoke) | Prepaid landing page smoke check | No |

> **Known issue:** `lcpr-prepaid-sanity.spec.ts` calls `prepaidPage.openPrepaidLanding()`, which does not exist in `src/pages/prepaid.page.ts`. It will not compile until that method is added or the spec is updated.

## How to run

Run one file (headed, so you can watch the browser):

```bash
npx playwright test src/tests/p0/postpaid-device-happy-flow.spec.ts --project=chromium --headed
```

Run one file without the browser window:

```bash
npx playwright test src/tests/p0/postpaid-device-happy-flow.spec.ts --project=chromium
```

Run every P0 test:

```bash
npx playwright test --grep @p0 --project=chromium
```

Run only the postpaid tests:

```bash
npx playwright test --grep @postpaid --project=chromium
```

Open the HTML report after a run:

```bash
npx playwright show-report
```

## Where failures are saved

- `test-results/` holds the trace, screenshot and video for failed tests.
- `playwright-report/` holds the HTML report.

## Before running

- The postpaid and prepaid tests place real test orders on UAT2. Only run them when that is intended.
- Test customer data (name, DOB, email, phone, SSN, test card) is hard-coded in each spec's `TEST_DATA` block.
- The postpaid spec selects **iPhone 16 Pro Max** from the PLP (`DEVICE_NAME`) and uses the **Liberty Mobile Mix Core** plan.
- Selectors marked `VERIFY` in the postpaid spec were not captured from the live DOM and may need adjusting if a step fails.
