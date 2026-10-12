# Connecting the open pot to a Google Sheet

The website shows how the pooled funds in the Revolut Business account have
been used: money paid in, money spent, what is left, spending by category and
each payment. It reads a **Pot** tab in a Google Sheet that you keep private,
through a small Google Apps Script "web app" attached to the sheet. No server or
paid service is needed.

## Keeping the Pot tab current

1. In the Revolut Business app, download a statement for the pot account as
   **CSV**.
2. Paste it into the **Pot** tab, header row included, replacing what was
   there or adding the new rows underneath. Rows that appear twice (same
   Revolut `ID`) are only counted once, and pending or declined payments are
   ignored.

The page updates as soon as the sheet does; there is nothing to publish.

### Labelling spending (optional)

Add two columns to the right of the export with these exact headings:

| Category | Public note |
|----------|-------------|
| Cask     |             |
| Bottling | Bottles, corks and labels |

- **Category** groups the "Spent by category" chart (for example Cask, Bottling,
  Duty, Shipping, Fees). Without one, spending is grouped as Payments, Card
  payments or Fees.
- **Public note** replaces the payee shown for that line. Use it for anything
  paid to a person, such as a refund, which otherwise shows only as "Payment".

If the tab has no spare columns, right-click the last column heading and choose
**Insert 1 column right**.

## What is public

The Revolut export contains member names, payment references and account
numbers. None of it is sent to the page:

- **Money in** is added up per day, for example "Member payments, 25
  payments, £1,405". No names or references.
- **Money out** shows the date, amount, category and either your Public note or
  the payee, but only when the payee is clearly a business (a card merchant, or
  a name ending in Ltd, Limited, PLC, LLP and so on). Anything else reads
  "Payment" or "Refund".
- The script only ever reads the Pot tab. Other tabs, such as Orders, are never
  returned.

Don't use the sheet's **File > Share > Publish to web**; the web app is the
only thing the page needs.

## One-time setup

### 1. Add the script

1. In the spreadsheet, open **Extensions > Apps Script**.
2. Replace everything in `Code.gs` with the contents of
   [`apps-script/Code.gs`](../apps-script/Code.gs) from this repo.
3. Click **Save** (the disk icon).

### 2. Deploy it as a web app

If you already have a deployment from the order form, update it instead so the
URL stays the same: **Deploy > Manage deployments >** pencil icon **> Version:
New version > Deploy**.

Otherwise:

1. Click **Deploy > New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set **Execute as:** `Me` and **Who has access:** `Anyone`, then **Deploy**.
4. Authorise the script with your account. If you see "Google hasn't verified
   this app", click **Advanced > Go to (project name) (unsafe)**. It is your own
   script and only reads this spreadsheet.
5. Copy the **Web app URL** (`https://script.google.com/macros/s/AKfycb.../exec`)
   and paste it into [`js/sheet-config.js`](../js/sheet-config.js):

   ```js
   window.POT_SHEET_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```

To check it, open the web app URL in a browser. You should see the totals and
summary lines as JSON, with no names in them.
