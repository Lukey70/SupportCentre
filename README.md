# Support Request Portal v4.6 Supabase

This version is based on v4.5 and adds separate customer first name / last name capture.

## What changed in v4.6

- The **Raise a Support Request** form now asks for:
  - First name
  - Last name
  - Email address
- The case still displays the customer's full name where appropriate.
- The **Reply to Customer** email popup now auto-populates the greeting using only the customer's first name:

```text
Hello Alex,


Kind regards,
Luke M
```

- A new backend patch adds `customer_first_name` and `customer_last_name` columns to `support_requests`.
- Existing cases are backfilled using the existing `customer_name` value.
- The website calls a new Supabase function: `create_support_request_v2`.

## Files to upload to GitHub

Upload/replace all files from this folder:

- `index.html`
- `config.js`
- `app-v4-6.js`
- `styles-v4-6.css`
- `backend-patch-v4-6.sql`
- `README.md`

## Supabase step

Before testing the website, run this file in Supabase SQL Editor:

```text
backend-patch-v4-6.sql
```

You should see **Success. No rows returned**.

## After uploading

Open your GitHub Pages site, confirm the header says:

```text
v4.6 Supabase
```

Then press **Ctrl + F5** to hard refresh.

## Notes

This version still saves the email-style reply to the case in Supabase. Real outgoing email sending still requires a later Supabase Edge Function/email provider setup.
