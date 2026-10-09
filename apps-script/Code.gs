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

// Lets you open the web app URL in a browser to check it is deployed.
function doGet() {
  return json_({ ok: true, message: 'Order endpoint is running.' });
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
