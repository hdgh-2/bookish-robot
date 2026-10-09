// Validation and confirmation for the order form.
// Sending to the Google Sheet is handled by js/sheet-orders.js (see
// docs/google-sheet-setup.md); without a sheet URL the order is only confirmed
// on screen.

const form = document.getElementById("order-form");
const confirmation = document.getElementById("confirmation");
let pendingOrder = null;

function setInvalid(input, invalid) {
  const error = document.getElementById(`${input.id}-error`);
  input.setAttribute("aria-invalid", String(invalid));
  error.hidden = !invalid;
}

function validate() {
  const name = form.elements.name;
  const contact = form.elements.contact;
  const quantity = form.elements.quantity;
  const qty = Number(quantity.value);

  const checks = [
    [name, name.value.trim() !== ""],
    [contact, contact.value.trim() !== ""],
    [quantity, Number.isInteger(qty) && qty >= 1 && qty <= 12],
  ];

  let firstInvalid = null;
  for (const [input, ok] of checks) {
    setInvalid(input, !ok);
    if (!ok && !firstInvalid) firstInvalid = input;
  }
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

function makeReference() {
  return "WH-" + Date.now().toString(36).toUpperCase().slice(-6);
}

function showConfirmation(order) {
  document.getElementById("confirm-name").textContent = order.name;
  document.getElementById("confirm-contact").textContent = order.contact;
  document.getElementById("confirm-quantity").textContent = order.quantity;
  document.getElementById("confirm-note").textContent = order.note || "None";
  document.getElementById("confirm-ref").textContent = order.reference;

  form.hidden = true;
  confirmation.hidden = false;
  confirmation.focus();
}

// Capture phase, so this runs before the sheet script's submit handler and can
// stop an invalid order from being sent.
form.addEventListener("submit", (event) => {
  if (!validate()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  form.elements.reference.value = makeReference();
  pendingOrder = {
    name: form.elements.name.value.trim(),
    contact: form.elements.contact.value.trim(),
    quantity: Number(form.elements.quantity.value),
    note: form.elements.note.value.trim(),
    reference: form.elements.reference.value,
  };

  if (!window.ORDER_SHEET_URL) {
    event.preventDefault();
    showConfirmation(pendingOrder);
  }
}, { capture: true });

form.addEventListener("order:sent", () => showConfirmation(pendingOrder));

form.addEventListener("input", (event) => {
  if (event.target.getAttribute("aria-invalid") === "true") setInvalid(event.target, false);
});

document.getElementById("new-order").addEventListener("click", () => {
  form.reset();
  const status = form.querySelector("[data-sheet-status]");
  status.textContent = "";
  status.removeAttribute("data-state");
  confirmation.hidden = true;
  form.hidden = false;
  form.elements.name.focus();
});
