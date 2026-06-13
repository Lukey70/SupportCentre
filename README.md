# Support Request Portal v4 - Supabase Backend Version

This version connects the support request portal to your Supabase project instead of storing live case data only in the browser.

## Supabase project used

The included `config.js` contains:

```js
window.SUPPORT_PORTAL_CONFIG = {
  SUPABASE_URL: "https://iierbrcpbuiwdgruoday.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_YKdtucfLJ6ifQ6R2dfciuw_BigGSJiA"
};
```

Only the publishable key is included. Do not add a service role key to this project or to GitHub.

## Important setup step before using attachments

You already ran the main database setup scripts. Before using this version, run the included SQL file:

```text
backend-patch-v4.sql
```

In Supabase:

```text
SQL Editor > New Query > paste backend-patch-v4.sql > Run
```

This adds the attachment registration functions used by the website.

## Files

- `index.html` - website layout
- `styles.css` - website styling
- `app.js` - Supabase-connected app logic
- `config.js` - Supabase URL and publishable key
- `backend-patch-v4.sql` - extra backend functions for attachment records

## What works in this version

- Raise a support request into Supabase
- Track a request using case number + email address
- Agent login using Supabase backend function
- Agent inbox with Open default filter
- Assigned to Me filter only shows open cases assigned to the logged-in agent
- Category filter in Agent Inbox
- Manual category change within a case
- Agent assignment and Start Work auto-assignment
- Customer replies through the portal
- Customer attachments after the case is raised
- Agent Reply to Customer email-style popup
- Agent attachments on customer-facing replies
- Internal notes
- Resolution notes
- Customer reopen reason popup
- Agent reopen without popup
- Closed cases cannot be reopened
- Attachments upload to Supabase Storage and attachment records are saved in the database

## Still not included yet

Real outgoing email is not connected yet. The Reply to Customer popup saves the message and attachments to the case. To actually send emails and allow customers to reply by email, the project still needs an email provider and server-side function, such as a Supabase Edge Function.

## GitHub Pages note

This version can still be hosted on GitHub Pages because it is a static frontend. The database, login functions, and file storage live in Supabase.

## Security note

The current customer lookup is the simpler middle option: case number + matching email address. This is better than showing all cases by email alone, but it is not the same as full customer account login. For a production-grade portal, use Supabase Auth, private storage policies, and stricter Row Level Security policies.
