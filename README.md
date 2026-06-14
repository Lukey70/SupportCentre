# Support Customer Portal v1 (Supabase)

This is the customer-facing portal only.

## What this site includes

- Raise a Support Request
- First name and last name fields
- Categories: ICT, Finance Service, Human Resources
- Attachments when raising a case
- My Support Requests lookup using case number + email address
- Customer replies and customer attachments after the case is raised
- Customer re-open reason for resolved cases
- Portal-only case messages. Real outgoing email is not enabled in this version.

## Files to upload to the customer GitHub repository

Upload these files to the root of your customer portal repository:

- `index.html`
- `config.js`
- `app-customer-v1.js`
- `styles-customer-v1.css`
- `backend-patch-split-v1.sql`
- `README.md`

## Supabase patch

Run `backend-patch-split-v1.sql` once in Supabase SQL Editor. It is safe to run again if needed.

The customer and agent portals use the same Supabase project, so you only need to run the patch once.

## Notes

This version deliberately does not include real email sending or desktop notifications.
