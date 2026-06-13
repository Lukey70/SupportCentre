# Support Request Portal v4.4 Supabase

This version connects to Supabase for cases, messages, agents, assignments, and attachments.

## What changed in v4.4

- Fixed the **Reply to Customer** button so it opens the email-style popup.
- Added the missing Reply to Customer modal to `index.html`.
- Updated the page to load `app-v4-4.js` and `styles-v4-4.css` with cache-busting.
- Added an **Awaiting Info** button. It maps to the existing backend status `Waiting on Customer`.
- The status filter and status dropdown show **Awaiting Info** in the UI.
- Disabled **Start Work** once a case has already been started/assigned/in progress/waiting/resolved/closed.
- Removed **No attachments** from message/activity items that do not have attachments.
- Activity messages now show newest first.
- Agent Inbox case cards now show:
  1. Case number
  2. Case subject and customer name
  3. Status and assigned agent
- Reply email signatures use the privacy format: first name + first letter of last name, for example `Luke M`.
- Fixed the **Assigned to Me** status filter value so it matches the Supabase backend function.

## Files to upload to GitHub

Upload/replace these files in your GitHub repository root:

- `index.html`
- `config.js`
- `app-v4-4.js`
- `styles-v4-4.css`
- `backend-patch-v4-4.sql`
- `backend-patch-v4.sql` if you do not already have it
- `README.md`

## Supabase SQL

No new database tables are required for v4.4. The file `backend-patch-v4-4.sql` is included as an idempotent safety patch for the backend functions introduced in v4.3. Running it again is safe.

## After uploading

Open your GitHub Pages site and check the header shows:

```text
v4.4 Supabase
```

Then do a hard refresh:

```text
Ctrl + F5
```

## Notes

The email-style **Reply to Customer** popup saves the reply and attachments to the case in Supabase. Real outgoing email sending is not connected yet. That will require a Supabase Edge Function and an email provider.
