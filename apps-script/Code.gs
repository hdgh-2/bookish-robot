/**
 * Google Apps Script web app that serves the open pot ledger to the website.
 *
 * Paste this into Extensions > Apps Script on the spreadsheet and deploy it as
 * a web app. See docs/google-sheet-setup.md for the full steps.
 *
 * The "Pot" tab holds a Revolut Business statement export, pasted in as is.
 * That export contains member names, references and account numbers, so this
 * script never returns rows as they are: money in is added up per day with no
 * names, and money out shows only a business payee (or your own public note).
 */

var POT_SHEET_NAME = 'Pot';

// Revolut export headings this script reads. Matching ignores case.
var COLUMNS = {
  id: 'ID',
  date: 'Date completed (UTC)',
  dateStarted: 'Date started (UTC)',
  type: 'Type',
  state: 'State',
  description: 'Description',
  totalAmount: 'Total amount',
  amount: 'Amount',
  beneficiary: 'Beneficiary name',
  // Optional columns you can add yourself, anywhere in the header row.
  category: 'Category',
  note: 'Public note'
};

var MEMBER_PAYMENTS = 'Member payments';
var NOTE_MAX = 140;

function doGet() {
  try {
    return json_(readPot_());
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function readPot_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(POT_SHEET_NAME);
  var rows = sheet ? sheet.getDataRange().getValues() : [];
  var tz = Session.getScriptTimeZone();
  var get = columnReader_(rows.shift() || []);

  var seen = {};
  var moves = [];
  rows.forEach(function (row) {
    var id = get(row, 'id');
    if (id && seen[id]) return; // the same export pasted twice
    if (id) seen[id] = true;

    var state = get(row, 'state').toUpperCase();
    if (state && state !== 'COMPLETED') return;

    var amount = Number(get(row, 'totalAmount') || get(row, 'amount'));
    if (!isFinite(amount) || amount === 0) return;

    moves.push({
      date: formatDate_(get(row, 'date', true) || get(row, 'dateStarted', true), tz),
      amount: amount,
      type: get(row, 'type').toUpperCase(),
      description: get(row, 'description'),
      beneficiary: get(row, 'beneficiary'),
      category: get(row, 'category'),
      note: get(row, 'note').slice(0, NOTE_MAX)
    });
  });

  var items = [];
  var paymentsByDate = {};
  var memberPayments = 0;
  moves.forEach(function (m) {
    if (m.amount > 0 && !m.note) {
      var day = paymentsByDate[m.date];
      if (!day) {
        day = paymentsByDate[m.date] = { date: m.date, type: 'in', category: m.category || MEMBER_PAYMENTS, count: 0, amount: 0 };
        items.push(day);
      }
      day.count += 1;
      day.amount += m.amount;
      memberPayments += 1;
      return;
    }
    items.push({
      date: m.date,
      type: m.amount > 0 ? 'in' : 'out',
      category: m.category || defaultCategory_(m),
      description: m.note || (m.amount < 0 ? payee_(m) : ''),
      amount: Math.abs(m.amount)
    });
  });

  var totalIn = 0;
  var totalOut = 0;
  var byCategory = {};
  items.forEach(function (item) {
    item.amount = round2_(item.amount);
    if (item.count) {
      item.description = item.count + (item.count === 1 ? ' payment' : ' payments');
      delete item.count;
    }
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
    totals: {
      in: round2_(totalIn),
      out: round2_(totalOut),
      balance: round2_(totalIn - totalOut),
      memberPayments: memberPayments
    },
    categories: categories,
    items: items
  };
}

// Returns get(row, key[, raw]) for the COLUMNS above; missing columns read as ''.
function columnReader_(headerRow) {
  var headers = headerRow.map(function (h) { return String(h).trim().toLowerCase(); });
  var index = {};
  Object.keys(COLUMNS).forEach(function (key) {
    index[key] = headers.indexOf(COLUMNS[key].toLowerCase());
  });
  return function (row, key, raw) {
    var i = index[key];
    if (i === -1 || row[i] == null) return '';
    return raw ? row[i] : String(row[i]).trim();
  };
}

// Payees that get their own category, matched on the start of the payee name.
var PAYEE_CATEGORIES = [
  { match: /^cask exit partners\b/i, category: 'Cask purchase' }
];

function defaultCategory_(m) {
  if (m.amount > 0) return 'Other money in';
  var name = m.beneficiary || m.description.replace(/^to\s+/i, '');
  for (var i = 0; i < PAYEE_CATEGORIES.length; i++) {
    if (PAYEE_CATEGORIES[i].match.test(name)) return PAYEE_CATEGORIES[i].category;
  }
  if (m.type === 'FEE') return 'Fees';
  if (m.type === 'CARD_PAYMENT') return 'Card payments';
  return 'Payments';
}

// Who was paid. Only names that are clearly businesses (card merchants, or a
// company name) are shown; a payment to a person reads "Payment" or "Refund"
// unless you give it a Public note.
var BUSINESS_NAME = /\b(ltd|limited|plc|llp|inc|llc|gmbh|co)\b\.?/i;

function payee_(m) {
  var name = m.beneficiary || m.description.replace(/^to\s+/i, '');
  if (m.type === 'REFUND') return 'Refund';
  if (name && (m.type === 'CARD_PAYMENT' || BUSINESS_NAME.test(name))) return titleCase_(name);
  return 'Payment';
}

// Revolut gives names in capitals; "CASK EXIT PARTNERS LIMITED" reads better as
// "Cask Exit Partners Limited". Mixed-case names are left alone.
function titleCase_(name) {
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
}

function formatDate_(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  return String(value).trim().slice(0, 10);
}

function round2_(n) {
  return Math.round(n * 100) / 100;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
