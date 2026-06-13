# Support Request Portal

A GitHub Pages-ready support request portal prototype. Users can raise support requests, track their cases in the portal, and agents can manage cases through an inbox-style workspace.

## Files

- `index.html` – page structure and templates
- `styles.css` – visual styling
- `app.js` – browser-only app logic

## Current version features

### Requester / customer side

- Raise a Support Request form
- Categories:
  - ICT
  - Finance Service
  - Human Resources
- Optional attachments
- Track My Requests area
- Search requests by requester email address
- Default requester view is `Open`
- Requesters can see:
  - request status
  - messages sent to them by agents
  - resolution notes
  - their own replies
  - customer-facing system updates
- Requesters can reply to open cases
- Requesters can re-open resolved cases from the portal after entering a reason
- Closed cases cannot be re-opened and require a new support request

### Agent side

- Agent inbox
- Default agent status filter is `Open`
- `Open` shows cases with these statuses:
  - New
  - In Progress
  - Waiting on Customer
- Search by request number, name, email, category, subject, details, or status
- Agents can add:
  - replies to requester
  - internal notes
- In the request detail view, Add Update appears before Activity
- Agents can resolve cases using a resolution notes popup
- Resolution notes are shown to the requester in the portal
- Agents can re-open resolved cases without a popup
- Agents can manually close resolved cases
- Closed cases cannot be re-opened

### Case lifecycle

- New requests start as `New`
- `Open` is a filter/view, not a saved case status
- Open includes:
  - New
  - In Progress
  - Waiting on Customer
- Resolved cases have a `Re-open case` option
- Resolved cases automatically change to `Closed` after 14 days
- Once a case is `Closed`, it cannot be re-opened

### Data tools

- Export saved request data to JSON
- Import saved request data from JSON
- Clear all browser-saved data

## Important limitation

This is a static GitHub Pages prototype. It stores requests, attachments, replies, and notes in the browser using `localStorage`.

That means:

- requests are not shared across different computers/browsers
- resolution notifications are simulated inside the portal rather than sent as real emails
- attachments are browser-stored demo attachments, so smaller files are best

To make this a real multi-agent helpdesk later, the next step would be adding a backend/database and real email notifications.

## How to use on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md`.
3. Go to the repository settings.
4. Open **Pages**.
5. Publish from the main branch/root folder.
6. Open the GitHub Pages URL.


## v4.2 fix

This version fixes the category mismatch by using exact category values in the website and by cache-busting the JavaScript/CSS filenames. It also corrects **My Support Requests** so customers must enter both case number and email address.

Before testing v4.2, run `backend-patch-v4-2.sql` in Supabase SQL Editor, then upload all v4.2 files to GitHub and hard-refresh the website.

## v4.2 category submit fix

This version fixes the customer request form so it reads the category dropdown directly and validates that it is exactly one of:

- ICT
- Finance Service
- Human Resources

The page header should show `v4.2 Supabase`. If it does not, GitHub Pages is still serving an older version.
