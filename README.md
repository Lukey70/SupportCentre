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

## v3.1 fix

This build includes a bug fix for the Agent Inbox login dropdown. The default Luke McGuiness demo agent is now seeded more defensively and also appears as a fallback option in the HTML before JavaScript loads.

Demo login:

- Agent: Luke McGuiness · Luke2003@outlook.com.au
- Password: 1234

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
