/**
 * Shows the open pot ledger on the home page.
 *
 * Reads the anonymised summary of the "Pot" tab from the Apps Script web app at
 * POT_SHEET_URL. See docs/google-sheet-setup.md.
 */
(function () {
  var statusEl = document.getElementById('pot-status');
  var potEl = document.getElementById('pot');

  var money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
  var day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  function formatDate(value) {
    var d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00') : null;
    return d && !isNaN(d) ? day.format(d) : value;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderCategories(categories) {
    var list = document.getElementById('pot-categories');
    var max = categories.reduce(function (m, c) { return Math.max(m, c.amount); }, 0);
    list.replaceChildren();
    categories.forEach(function (c) {
      var item = el('li', 'bar-row');
      var label = el('div', 'bar-label');
      label.append(el('span', null, c.name), el('span', 'bar-value', money.format(c.amount)));
      var track = el('div', 'bar-track');
      var fill = el('div', 'bar-fill');
      fill.style.width = (max ? (c.amount / max) * 100 : 0) + '%';
      track.append(fill);
      item.append(label, track);
      list.append(item);
    });
    document.getElementById('pot-categories-section').hidden = categories.length === 0;
  }

  function fillPayers(id, people, showAmount) {
    var list = document.getElementById(id);
    list.replaceChildren();
    if (!people.length) {
      list.append(el('li', 'muted', 'Nobody yet.'));
      return;
    }
    people.forEach(function (p) {
      var item = el('li', 'payer');
      item.append(el('span', 'payer-name', p.name));
      if (showAmount) item.append(el('span', 'payer-amount', money.format(p.amount)));
      list.append(item);
    });
  }

  function renderPayers(payers) {
    var section = document.getElementById('payers-section');
    if (!payers) {
      section.hidden = true;
      return;
    }
    var from = money.format(payers.magnumFrom);
    document.getElementById('payers-magnum-rule').textContent = from + ' or more';
    document.getElementById('payers-bottle-rule').textContent = 'under ' + from;
    fillPayers('payers-magnum', payers.magnum, true);
    fillPayers('payers-bottle', payers.bottle, true);

    var unpaidGroup = document.getElementById('payers-unpaid-group');
    unpaidGroup.hidden = !payers.notPaid;
    if (payers.notPaid) fillPayers('payers-unpaid', payers.notPaid, false);

    var notes = [];
    if (payers.unlabelled) {
      notes.push(payers.unlabelled + (payers.unlabelled === 1 ? ' payment has' : ' payments have') +
        ' no Slack name yet, so ' + (payers.unlabelled === 1 ? 'it is' : 'they are') + ' not listed.');
    }
    if (payers.notPaid && payers.notPaid.length) {
      notes.push('Paid but still listed as not paid? Your payment reference may not match the Slack name on your order; let the organiser know.');
    }
    document.getElementById('payers-note').textContent = notes.join(' ');
    section.hidden = false;
  }

  function renderItems(items) {
    var body = document.getElementById('pot-items');
    body.replaceChildren();
    if (!items.length) {
      var empty = el('tr');
      var cell = el('td', 'muted', 'Nothing recorded yet.');
      cell.colSpan = 3;
      empty.append(cell);
      body.append(empty);
      return;
    }
    // Newest first; ISO dates sort as text.
    items.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; })
      .forEach(function (item) {
        var row = el('tr');
        var what = el('td');
        what.append(el('span', 'category', item.category));
        if (item.description) what.append(el('span', 'description', item.description));
        var sign = item.type === 'in' ? '+' : '−';
        row.append(
          el('td', 'date', formatDate(item.date)),
          what,
          el('td', 'num amount-' + item.type, sign + money.format(item.amount))
        );
        body.append(row);
      });
  }

  function render(data) {
    document.getElementById('pot-in').textContent = money.format(data.totals.in);
    var count = data.totals.memberPayments;
    document.getElementById('pot-in-count').textContent =
      count ? 'from ' + count + (count === 1 ? ' payment' : ' payments') : '';
    document.getElementById('pot-out').textContent = money.format(data.totals.out);
    document.getElementById('pot-balance').textContent = money.format(data.totals.balance);
    renderPayers(data.payers);
    renderCategories(data.categories || []);
    renderItems(data.items || []);
    statusEl.textContent = '';
    potEl.hidden = false;
  }

  function fail(message) {
    statusEl.textContent = message;
    statusEl.setAttribute('data-state', 'error');
  }

  var url = window.POT_SHEET_URL;
  if (!url) {
    fail('The pot is not connected to the sheet yet.');
    return;
  }

  fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data.ok || !data.totals) throw new Error(data.error || 'No pot data');
      render(data);
    })
    .catch(function (err) {
      console.error('Could not load the pot', err);
      fail('Sorry, the pot could not be loaded. Please try again later.');
    });
})();
