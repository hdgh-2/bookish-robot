# Bookish Robot

A simple website where club members register interest in the next Bothy Bottling and can order extra bottles of earlier ones. Members enter their name, Slack username, how many Bothy Bottling #3 bottles and magnums they want, any extra Glen Elgin (Bothy Bottling #2) or Full Proof Weller bottles, and an optional note, then see an on-screen confirmation with an order reference. The extra bottle counts arrive in the sheet as new `magnum`, `glen_elgin` and `weller` columns automatically.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Receiving orders

Orders are saved to a Google Sheet through an Apps Script web app; see [docs/google-sheet-setup.md](docs/google-sheet-setup.md). Until `window.ORDER_SHEET_URL` is set in `js/sheet-config.js`, the page only shows the confirmation and orders are not sent anywhere.

## Hosting on GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save. The site appears at `https://<user>.github.io/bookish-robot/`.
