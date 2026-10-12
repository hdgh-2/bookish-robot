# Bookish Robot

An open pot tracker for the club's Bothy Bottling funds. The page shows how much members have paid in, how much has been spent, what is left in the pot, spending by category and each payment, without showing anyone's name or bank details.

The figures come from a Revolut Business statement pasted into a private Google Sheet, summarised by an Apps Script web app; see [docs/google-sheet-setup.md](docs/google-sheet-setup.md).

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Hosting on GitHub Pages

In the repository's **Settings → Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save. The site appears at `https://<user>.github.io/bookish-robot/`.
