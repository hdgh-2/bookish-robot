/**
 * Google Apps Script web app that appends club whisky orders to a Google Sheet.
 *
 * Paste this into Extensions > Apps Script on the orders spreadsheet and deploy
 * it as a web app. See docs/google-sheet-setup.md for the full steps.
 *
 * Every field the order form posts becomes a column. The header row is created
 * on the first order, and a new column is added if the form gains a field.
 */

var SHEET_NAME = 'Orders';

// Field names (form `name` attributes) that must be present for an order to be saved.
// Leave empty to accept any submission.
var REQUIRED_FIELDS = [];

// Hidden "honeypot" field: real people leave it empty, spam bots fill it in.
var HONEYPOT_FIELD = 'website';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var params = (e && e.parameter) || {};

    if (params[HONEYPOT_FIELD]) {
      return json_({ ok: true });
    }

    var missing = REQUIRED_FIELDS.filter(function (name) {
      return !String(params[name] || '').trim();
    });
    if (missing.length) {
      return json_({ ok: false, error: 'Missing fields: ' + missing.join(', ') });
    }

    var sheet = getSheet_();
    var headers = getHeaders_(sheet);

    Object.keys(params).forEach(function (key) {
      if (key !== HONEYPOT_FIELD && headers.indexOf(key) === -1) {
        headers.push(key);
      }
    });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    var row = headers.map(function (key) {
      if (key === 'Timestamp') return new Date();
      return sanitize_(params[key]);
    });
    sheet.appendRow(row);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app URL in a browser checks it is deployed.
// Adding ?view=pot returns the public open pot ledger (see readPot_).
function doGet(e) {
  var view = e && e.parameter && e.parameter.view;
  if (view === 'pot') {
    try {
      return json_(readPot_());
    } catch (err) {
      return json_({ ok: false, error: String(err) });
    }
  }
  return json_({ ok: true, message: 'Order endpoint is running.' });
}

// Tab holding the open pot ledger, kept by hand. Columns, in this order:
//   Date | Type (In or Out) | Category | Description | Amount
// Everything in these five columns is shown publicly on the pot page, so keep
// names, account details and references out of them. Any extra columns to the
// right are private and never leave the sheet.
var POT_SHEET_NAME = 'Pot';
var POT_DESCRIPTION_MAX = 140;

// Returns only the public ledger columns and totals; never reads the Orders tab.
function readPot_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(POT_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return { ok: true, currency: 'GBP', totals: { in: 0, out: 0, balance: 0 }, categories: [], items: [] };
  }

  var tz = Session.getScriptTimeZone();
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  var items = [];
  rows.forEach(function (r) {
    var type = String(r[1]).trim().toLowerCase();
    var amount = Math.abs(Number(r[4]));
    if ((type !== 'in' && type !== 'out') || !isFinite(amount) || amount === 0) return;
    items.push({
      date: r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0]).trim(),
      type: type,
      category: String(r[2]).trim() || 'Other',
      description: String(r[3]).trim().slice(0, POT_DESCRIPTION_MAX),
      amount: round2_(amount)
    });
  });

  var totalIn = 0;
  var totalOut = 0;
  var byCategory = {};
  items.forEach(function (item) {
    if (item.type === 'in') {
      totalIn += item.amount;
    } else {
      totalOut += item.amount;
      byCategory[item.category] = (byCategory[item.category] || 0) + item.amount;
    }
  });

  var categories = Object.keys(byCategory)
    .map(function (name) { return { name: name, amount: round2_(byCategory[name]) }; })
    .sort(function (a, b) { return b.amount - a.amount; });

  return {
    ok: true,
    currency: 'GBP',
    totals: { in: round2_(totalIn), out: round2_(totalOut), balance: round2_(totalIn - totalOut) },
    categories: categories,
    items: items
  };
}

function round2_(n) {
  return Math.round(n * 100) / 100;
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getHeaders_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .filter(function (h) { return h !== ''; })
    .map(String);
}

// Stop values like "=HYPERLINK(...)" being run as spreadsheet formulas.
function sanitize_(value) {
  var s = value == null ? '' : String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
