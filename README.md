# Bookish Robot

A simple website where club members can order a club whisky bottle. Members enter their name, email or member number, how many bottles they want, and an optional note, then see an on-screen confirmation with an order reference.

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Receiving orders

Orders are saved to a Google Sheet through an Apps Script web app; see [docs/google-sheet-setup.md](docs/google-sheet-setup.md). Until `window.ORDER_SHEET_URL` is set in `js/sheet-config.js`, the page only shows the confirmation and orders are not sent anywhere.

## Hosting on GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save. The site appears at `https://<user>.github.io/bookish-robot/`.
