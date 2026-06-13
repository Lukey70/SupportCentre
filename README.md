# Support Request Portal

A GitHub Pages-ready support request website. Users can raise support requests with optional attachments, and agents can manage requests from a shared inbox-style interface.

## Features

- Raise a support request form
- Request number generation, for example `REQ-00001`
- Optional file attachments
- Agent inbox with search and status filter
- Request detail view
- Status workflow:
  - New
  - In Progress
  - Waiting on Customer
  - Resolved
  - Closed
- Agent replies and internal notes
- Export and import request data as JSON
- Browser-only storage using `localStorage`

## Important note about storage

This first version is a static website, so it can run on GitHub Pages without a server or database. Requests are saved in the browser on the computer that submitted or managed them.

That means:

- It is great for a prototype or demo.
- It does not yet sync between different computers or agents.
- Attachments are stored in the browser, so smaller files are best.
- Real email sending is not included yet.

For a real shared helpdesk, the next upgrade would be adding a backend database and authentication.

## How to use locally

Open `index.html` in your browser.

## How to publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload these files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Go to your repository settings.
4. Open **Pages**.
5. Set the source to your main branch and root folder.
6. Save.
7. GitHub will provide a public website link.

## Suggested future upgrades

- Agent login
- Customer email notifications
- Shared database
- Customer request tracking page
- Assignment to agents
- Categories managed from an admin screen
- SLA timers
- Attachments stored securely in cloud storage
