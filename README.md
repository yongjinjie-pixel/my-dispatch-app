# Dispatch Pilot Enhanced

This release is based on the `my-dispatch-app-main.zip` version you provided. It keeps that project’s PWA path (`/my-dispatch-app/`) and dark theme direction, then adds the requested operating features.

## What is new

- Editable trucks: prefix, registration number, availability, daily/Near/Far/Stone limits, notes, add and delete controls.
- Editable dispatch board: change customer, material/source, zone, remark and trip sequence after auto-generation; add or remove a manual trip.
- Dispatch tally checker: shows each customer’s needed loads, planned loads and balance after every dispatch save.
- Source catalogue: add/edit sandpits and quarries.
- Material catalogue: add/edit each material under its exact source.
- Customer rules: select one or more allowed material-source combinations for every customer, then edit those rules later.
- Orders use only the saved material/source choices for the selected customer; the Orders page shows Near, Far, Stone and total-load summaries.
- Actual-trip entries save to phone storage immediately, visibly show `Saved ✓`, can be updated, and can be reset to Planned if entered wrongly.
- Google Sheets Apps Script creates sortable view tabs for trucks, sources, materials, customers, orders, dispatches, actual trip logs and recovery rules.
- Dark theme uses the company-logo colours: black/navy base, royal blue, cyan and construction yellow.

## Publish the update

In this GitHub-ready ZIP, the web app files are already at the ZIP root. Upload those root files to your existing `my-dispatch-app` GitHub Pages publishing folder. (In the editable project folder they are inside `app`.) Keep the files at that exact level:

```text
index.html
app.js
scheduler.js
styles.css
sw.js
manifest.json
icon-192.png
icon-512.png
```

Do not put these files inside a second `app` folder on GitHub unless your Pages URL is changed to match it. This package retains the manifest paths for:

```text
https://YOUR-ACCOUNT.github.io/my-dispatch-app/
```

After publishing, open the website once while online. The service-worker build is `20260711-3`, so it will replace the older cached app files. If Android keeps showing the old icon, remove the installed app and install it again from Chrome after the update is live.

## Google Sheet database setup

1. Create a blank Google Sheet, such as `Dispatch Pilot Database`.
2. Open **Extensions → Apps Script** in that Sheet.
3. Replace the default script with `google-apps-script/Code.gs` from this package, then save.
4. In **Project Settings → Script properties**, create a `DISPATCH_SECRET` value. Use a long private phrase.
5. Choose **Deploy → New deployment → Web app**. Run as yourself, and choose the access level appropriate for your company. Copy the deployed `/exec` Web App URL.
6. In the app, open **Setup**, enter the Web App URL and same secret, then select **Sync to Google Sheet**.

The following sortable Google Sheet tabs are automatically produced on every sync:

- `Truck_View`
- `Source_View`
- `Material_View`
- `Customer_View`
- `Order_View`
- `Dispatch_View`
- `Trip_Log_View`
- `Recovery_View`

Do not manually edit the `DP_*` JSON data tabs. Use the app for data entry, and use the `*_View` tabs for filtering, sorting and reporting.

## Important about saving

Before Google Sheets is connected, data is permanently stored in the same browser profile on your phone using phone browser storage. Actual trips remain saved when the app is closed and reopened. They will not appear automatically on a different phone until you connect Google Sheets and press **Sync to Google Sheet**.
