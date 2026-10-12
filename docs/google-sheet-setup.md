# Saving orders to a Google Sheet

Each order submitted on the website is added as a new row in a Google Sheet that
the organiser owns. From there you can sort, filter, share, or export the orders
(File > Download > CSV or Excel).

It works with a small Google Apps Script "web app" attached to the sheet. The
website sends each order to that web app, and the script writes the row. No
server or paid service is needed.

## One-time setup (about 10 minutes)

### 1. Create the sheet

1. Go to <https://sheets.google.com> and create a blank spreadsheet.
2. Name it something like **Club Whisky Orders**.

You don't need to add any columns. The script creates a tab called **Orders**
and fills in the header row from the form's fields on the first order.

### 2. Add the script

1. In the spreadsheet, open **Extensions > Apps Script**.
2. Delete the placeholder code in `Code.gs`.
3. Copy the whole contents of [`apps-script/Code.gs`](../apps-script/Code.gs)
   from this repo and paste it in.
4. Click **Save** (the disk icon).

Optional: to reject orders that are missing key details, list the field names in
`REQUIRED_FIELDS` near the top, for example `['name', 'email', 'quantity']`.

### 3. Deploy it as a web app

1. Click **Deploy > New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** `Orders`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**.
5. Google asks you to authorise the script. Choose your account. If you see
   "Google hasn't verified this app", click **Advanced > Go to (project name)
   (unsafe)**. This is expected: it is your own script, and it only needs
   access to this spreadsheet.
6. Copy the **Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

To check it is working, open that URL in a browser. You should see
`{"ok":true,"message":"Order endpoint is running."}`.

### 4. Connect the website

Open [`js/sheet-config.js`](../js/sheet-config.js) and paste the URL between
the quotes:

```js
window.ORDER_SHEET_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Commit and publish the site. Place a test order and check that a row appears in
the sheet.

## Wiring the order form

The order page needs three small things so its orders go to the sheet:

```html
<form data-sheet-orders>
  <!-- every field needs a name; the name becomes the column heading -->
  <input name="name" required>
  <input name="email" type="email" required>
  <input name="quantity" type="number" min="1" value="1" required>

  <!-- spam trap: hidden from people, bots fill it in and get ignored -->
  <input name="website" tabindex="-1" autocomplete="off"
         style="position:absolute;left:-9999px" aria-hidden="true">

  <button type="submit">Place order</button>
  <p data-sheet-status role="status"></p>
</form>

<script src="js/sheet-config.js"></script>
<script src="js/sheet-orders.js" defer></script>
```

- `data-sheet-orders` on the form turns on sending to the sheet.
- `data-sheet-status` (optional) shows "Sending…", success, and error messages.
  Its `data-state` attribute is set to `pending`, `success` or `error` for styling.
- On success the form is cleared and an `order:sent` event fires on it, in case
  the page wants to show a confirmation panel.
- If `ORDER_SHEET_URL` is empty, the form submits normally, so nothing breaks
  before setup is done.

## Changing the script later

After editing the script, publish the change without changing the URL:
**Deploy > Manage deployments >** pencil icon **> Version: New version > Deploy**.
Creating a *new* deployment instead gives a new URL, which you would then need
to paste into `js/sheet-config.js` again.

## Open pot tracker

[`pot.html`](../pot.html) shows members how the pooled funds have been used:
money paid in, money spent, what is left, spending by category and every line
in the ledger. It reads a hand-kept **Pot** tab in the same spreadsheet through
the same web app URL, so there is nothing new to configure on the website.

### Set up the Pot tab

1. Add a tab named exactly **Pot** to the orders spreadsheet.
2. Put these headings in row 1, columns A to E:

   | Date | Type | Category | Description | Amount |
   |------|------|----------|-------------|--------|
   | 06/10/2026 | In | Contributions | Bottle payments, week of 6 Oct | 1260 |
   | 08/10/2026 | Out | Cask | Bothy #3 cask share | 950 |
   | 10/10/2026 | Out | Bottling | Bottles, corks and labels | 145.50 |

   - **Type** is `In` or `Out`. Rows with anything else, or with no amount, are
     skipped, so you can leave notes or blank rows.
   - **Amount** is a positive number in pounds; Type decides the sign.
   - **Category** groups the spending chart. Keep a short, consistent list
     (for example Cask, Bottling, Duty, Shipping, Fees, Refunds).
3. If you already deployed the script, publish the updated version (see
   [Changing the script later](#changing-the-script-later)) so it can read the
   Pot tab. The URL stays the same.

To check it, open the web app URL with `?view=pot` on the end. You should see
the totals and your rows as JSON.

### Keeping it current

Add a line whenever money moves. A Revolut Business statement downloaded as
CSV is a handy monthly check that the ledger's "Left in the pot" matches the
account.

### What is public

Columns A to E of the Pot tab are shown to anyone who opens the page, so:

- record money coming in as weekly or batch totals ("Bottle payments, week of
  6 Oct"), not one line per member;
- never put names, Slack handles, account numbers, sort codes or payment
  references in Description;
- anything private can go in column F onwards. The script only ever reads
  columns A to E of the Pot tab, and never returns anything from the Orders tab.

## Good to know

- **Privacy:** the sheet is private to you unless you share it. The web app URL
  only lets people *add* order rows; the only thing it returns is columns A to E
  of the Pot tab (see [What is public](#what-is-public)).
- **Spam:** the hidden `website` field filters simple bots. If junk orders
  become a problem, set `REQUIRED_FIELDS` or add a club password field and check
  it in the script.
- **Limits:** Apps Script on a free Google account handles far more orders than
  a club will send.
- **Formulas:** values starting with `=`, `+`, `-` or `@` are stored as plain
  text so nobody can inject a formula into the sheet.
