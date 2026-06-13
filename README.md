# Support Request Portal v4.5 Supabase

This is the Supabase-connected support request portal.

## Files to upload to GitHub

Upload/replace these files in the root of your GitHub Pages repository:

- `index.html`
- `config.js`
- `app-v4-5.js`
- `styles-v4-5.css`
- `backend-patch-v4-5.sql`
- `README.md`

## Version marker

After uploading, open the live site and confirm the header says:

`v4.5 Supabase`

Then hard refresh with `Ctrl + F5`.

## Database

No new database schema changes are required for v4.5. If you want to run the included SQL file, `backend-patch-v4-5.sql` is a no-op confirmation patch only.

## v4.5 changes

- The Reply to Customer email popup is now scrollable, including on smaller screens.
- The left case list now shows the current status badge next to the case number.
- The left case list now shows the case category.
- The open case status badge in the top-right is now the manual status dropdown/control.
- The separate status dropdown from the action row has been removed.
- Existing v4.4 fixes remain included:
  - Reply to Customer popup opens correctly.
  - Activity is newest first.
  - Activity does not show “No attachments” on messages with no files.
  - Awaiting Info button maps to backend status `Waiting on Customer`.
  - Start Work is disabled after a case is already started/assigned.
  - Agent display names use first name + last initial, for example `Luke M`.
