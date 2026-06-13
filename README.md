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
- Optional attachments when raising the request
- Track My Requests area
- Search requests by requester email address
- Default requester status filter is `All statuses`
- Requesters can see:
  - request status
  - messages sent to them by agents
  - resolution notes
  - their own replies
  - customer-facing system updates
  - customer-facing attachments sent by agents
- Requesters can reply to open cases
- Requesters can add attachments after the case has already been raised
- Requesters can re-open resolved cases from the portal after entering a reason
- Closed cases cannot be re-opened and require a new support request

### Agent side

- Agent Inbox requires a demo agent login
- Default demo agent:
  - Name: Luke McGuiness
  - Email: Luke2003@outlook.com.au
  - Demo password: 1234
- Settings button next to Clear All
- Settings page with an Agents tab
- Add new agents with:
  - First Name
  - Last Name
  - Email
  - Password
- Default agent status filter is `Open`
- `Open` shows cases with these statuses:
  - New
  - In Progress
  - Waiting on Customer
- `Assigned to Me` filter shows cases assigned to the currently logged-in agent
- Category dropdown filter in Agent Inbox
- Search by request number, name, email, category, subject, details, status, or assigned agent
- Agents can add:
  - Reply to Customer
  - Internal note
  - attachments on updates
- Replies are attributed using the agent's first name and last initial, for example `Luke M`
- In the request detail view, Add Update appears before Activity
- Agents can resolve cases using a resolution notes popup
- Resolution notes are shown to the customer in the portal
- Agents can re-open resolved cases without a popup
- Agents can manually close resolved cases
- Agents can manually assign cases to agents
- Clicking Start Work automatically assigns the case to the logged-in agent and sets the status to In Progress
- Agents can manually change the case category if the customer selected the wrong category
- Assignment information is not shown to customers
- Closed cases cannot be re-opened

### Case lifecycle

- New requests start as `New`
- `Open` is a filter/view, not a saved case status
- Open includes:
  - New
  - In Progress
  - Waiting on Customer
- Resolved cases have a `Re-open case` option
- Requesters must enter a reason when re-opening a resolved case
- Resolved cases automatically change to `Closed` after 14 days
- Once a case is `Closed`, it cannot be re-opened

### Data tools

- Export saved request data and agents to JSON
- Import saved request data and agents from JSON
- Clear all saved requests from the browser
- Clear All keeps the agent settings so you can still log in

## Important limitations

This is a static GitHub Pages prototype. It stores requests, attachments, replies, notes, agents, and demo passwords in the browser using `localStorage`.

That means:

- requests are not shared across different computers/browsers
- resolution notifications are simulated inside the portal rather than sent as real emails
- attachments are browser-stored demo attachments, so smaller files are best
- demo passwords are not secure because static websites do not have a protected backend

To make this a real multi-agent helpdesk later, the next step would be adding a backend/database, real authentication, shared storage, and real email notifications.

## How to use on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md`.
3. Go to the repository settings.
4. Open **Pages**.
5. Publish from the main branch/root folder.
6. Open the GitHub Pages URL.
