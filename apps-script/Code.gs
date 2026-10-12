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
 *
 * The "who has paid" list shows only the hand-added "Slack ref" column, added up
 * per person, and the Slack names on the Orders tab that have no payment yet.
 */

var POT_SHEET_NAME = 'Pot';
var ORDERS_SHEET_NAME = 'Orders';

// Paid this much or more counts as a magnum; less counts as a 70cl bottle.
var MAGNUM_FROM = 70;

// Slack names on Orders that are left off "not paid yet" while you check them
// by hand. Matching ignores capitals, spaces and punctuation.
var CHECKING_BY_HAND = [
  'BlacklistedBusta',
  'bondadam',
  'dimabag',
  'Maciej',
  'Marko',
  'FarcThat (Oli)'
];

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
  slackRef: 'Slack ref',
  category: 'Category',
  note: 'Public note'
};

// Orders tab headings. "Slack ref" is optional: fill it in where the Slack name
// someone typed on the order form doesn't match the Slack ref on their payment.
var ORDER_COLUMNS = {
  contact: 'contact',
  slackRef: 'Slack ref'
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
  var get = columnReader_(rows.shift() || [], COLUMNS);

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
      slackRef: get(row, 'slackRef'),
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
    items: items,
    payers: payers_(moves, readOrderContacts_())
  };
}

// Who has paid, grouped by what their total covers, and who has ordered but not
// paid. Only Slack names are returned: never real names or bank references.
function payers_(moves, orderContacts) {
  var paid = {};
  var paidList = [];
  var unlabelled = 0;
  moves.forEach(function (m) {
    if (m.amount <= 0) return;
    if (!m.slackRef) {
      unlabelled += 1;
      return;
    }
    var key = slackKey_(m.slackRef);
    if (!paid[key]) {
      paid[key] = { key: key, name: m.slackRef, amount: 0 };
      paidList.push(paid[key]);
    }
    paid[key].amount += m.amount;
  });

  var magnum = [];
  var bottle = [];
  paidList.forEach(function (p) {
    var entry = { name: p.name, amount: round2_(p.amount) };
    (p.amount >= MAGNUM_FROM ? magnum : bottle).push(entry);
  });
  var byName = function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; };

  var notPaid = null;
  if (orderContacts) {
    notPaid = [];
    var listed = {};
    CHECKING_BY_HAND.forEach(function (name) { listed[slackKey_(name)] = true; });
    orderContacts.forEach(function (name) {
      var key = slackKey_(name);
      if (!key || listed[key] || matchPayer_(key, paidList)) return;
      listed[key] = true;
      notPaid.push({ name: name });
    });
    notPaid.sort(byName);
  }

  return {
    magnumFrom: MAGNUM_FROM,
    magnum: magnum.sort(byName),
    bottle: bottle.sort(byName),
    notPaid: notPaid,
    unlabelled: unlabelled
  };
}

// The Slack names typed on the order form, or null when there is no Orders tab.
function readOrderContacts_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET_NAME);
  if (!sheet) return null;
  var rows = sheet.getDataRange().getValues();
  var get = columnReader_(rows.shift() || [], ORDER_COLUMNS);
  return rows
    .map(function (row) { return get(row, 'slackRef') || get(row, 'contact'); })
    .filter(function (name) { return name; });
}

// "@BeachBum (Si) " and "beachbum(si)" are the same person.
function slackKey_(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// An order matches a payment with the same Slack name. Failing that, it matches
// when one name starts with the other ("Tom" and "Tom M", "Rachel Marsh" and
// "Rachel M"), as long as the shorter one has 3 or more letters and only one
// payer fits.
function matchPayer_(key, paidList) {
  var exact = paidList.filter(function (p) { return p.key === key; });
  if (exact.length) return exact[0];
  var close = paidList.filter(function (p) {
    var shorter = p.key.length < key.length ? p.key : key;
    var longer = shorter === key ? p.key : key;
    return shorter.length >= 3 && longer.indexOf(shorter) === 0;
  });
  return close.length === 1 ? close[0] : null;
}

// Returns get(row, key[, raw]) for the given column headings; missing columns
// read as ''.
function columnReader_(headerRow, columns) {
  var headers = headerRow.map(function (h) { return String(h).trim().toLowerCase(); });
  var index = {};
  Object.keys(columns).forEach(function (key) {
    index[key] = headers.indexOf(columns[key].toLowerCase());
  });
  return function (row, key, raw) {
    var i = index[key];
    if (i === -1 || row[i] == null) return '';
    return raw ? row[i] : String(row[i]).trim();
  };
}

function defaultCategory_(m) {
  if (m.amount > 0) return 'Other money in';
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
