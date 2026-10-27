# rosemarylanedesigns

Rosemary Lane Design is an elegant, stationery-inspired needlepoint atelier website.

## Features
- Responsive single-page website
- Antique ivory, barely-blush and soft sage palette
- Fine pinstripe hero with oval monogram
- Private and group lesson descriptions
- Bespoke needlework and French knot signature section
- Hand-painted canvas inspiration gallery
- Contact email links and newsletter request via email

## Running locally
Open `index.html` in any modern browser. No install, build process, or dependencies are required (fonts and images are loaded from external services).

## Deploying on GitHub Pages
The `.github/workflows/deploy.yml` workflow deploys the site to GitHub Pages on pushes to `main`, manual runs, and scheduled calendar refreshes. In **Settings → Pages**, the source should be **GitHub Actions**.

## Before launch
Replace illustrative photographs with licensed photographs of actual Rosemary Lane needlework; confirm the contact email address; connect real lesson booking and newsletter signup services. The newsletter form currently prepares an email request rather than storing subscribers.

Designed as a reference-inspired original website; the user's sample invitation artwork is not copied.


## Google Calendar
The calendar beneath the Coastal Pop-Ups details is driven by the public Google Calendar feed configured in `scripts/sync-calendar.py`. Add or edit public events in that Google calendar; no website edits or API key are needed. Keep personal events on a separate calendar.

GitHub Actions refreshes at :17 and :47 each hour. Scheduled runs may be delayed by GitHub; run **Actions → Deploy Rosemary Lane to GitHub Pages → Run workflow** for an immediate refresh. GitHub can disable scheduled workflows after 60 days without repository activity; re-enable the workflow in Actions if needed.

The build expands repeating events (including exceptions), handles all-day events and Eastern daylight saving time, and publishes only display fields to `data/calendar.json`. It omits private/confidential and cancelled entries, attendees, organizer details, and raw calendar data. The display covers the previous month through the next twelve months. Visitors get a month grid and event details on desktop, and an agenda on phones.

If a sync fails transiently, a previous public snapshot no older than seven days may be used with a delayed-updates notice. If sharing is revoked, or no valid snapshot is available, the calendar falls back to Google's agenda embed. Check that sharing is **Make available to public → See all event details** if events do not appear.

For local calendar work: `python -m pip install -r scripts/calendar-requirements.txt`, then `python scripts/test-calendar.py`, `python scripts/sync-calendar.py`, and `python -m http.server 8000`. The rest of the site remains static.
