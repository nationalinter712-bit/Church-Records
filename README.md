# Church Records

A responsive member-records workspace built with React, Vite, TypeScript, Tailwind CSS, Supabase Auth, Postgres, and private Supabase Storage. The preview workspace is sample data only; changes in preview mode are not saved. Adding Supabase environment values switches the app to invite-only authentication and disables sample records.

## Local setup

1. Install Node.js 20.19+ or 22.12+ and npm.
2. Run `npm install`.
3. Open the ignored local `.env.local` file and fill in `VITE_SUPABASE_URL` with the **Project URL root** (`https://<project-ref>.supabase.co`), not a Data API endpoint such as one ending in `/rest/v1/`. Set `VITE_SUPABASE_ANON_KEY` from the project's publishable (or legacy anon) key. These are browser-safe values; never put a service-role key in a `VITE_` variable.
4. Link the Supabase CLI to your project with `supabase link --project-ref YOUR_PROJECT_REF`, then apply migrations with `supabase db push`; alternatively, run the migration in the Supabase SQL editor.
5. In Supabase **Authentication → Users**, create the administrator user and set their password. In **Authentication → URL Configuration**, use `http://localhost:5173` as the Site URL while testing locally, and add `http://localhost:5173/**` to Redirect URLs. For production, add the actual deployed Vercel origin (not an unassigned/404 hostname) to Redirect URLs.
6. In the SQL editor, edit and run `supabase/setup-first-owner.sql` once, replacing `admin@yourchurch.org` and `Your Church Name`. It verifies that the Auth user exists before creating the church and owner membership.
7. Set `GOOGLE_CLOUD_VISION_API_KEY` in the Vercel serverless environment to enable OCR for scanned JPEG, PNG, and WebP images. PDFs upload privately but OCR is currently image-only.
8. Restart `npm run dev` after saving `.env.local`; verify with `npm run build` and `npm run lint`.

Without Supabase browser variables the app opens in an explicitly labeled preview. Do not enter real member information in preview mode.

## Supabase and access control

The migration creates tenant-owned church, membership, family, member, attendance, note, and document tables. Every tenant table has row-level security. Roles are `owner`, `admin`, `pastor`, `staff`, and `viewer`: viewers are read-only; staff can manage member, family, attendance, and document records; pastoral roles can read pastoral notes; administrators and owners can read and create administrator-only notes. Notes have no update or delete policy. Memberships are provisioned by a trusted administrator; users cannot grant themselves a role.

The `church-documents` bucket is private, limited to PDF/JPEG/PNG/WebP files up to 12 MB. Storage policies check church and member IDs encoded in the object path. The browser only receives the Supabase anon key; database and storage access rely on RLS. The OCR function validates the Supabase access token, checks the caller and document through RLS, downloads only the authorized private object, then uses the server-only Google Vision key. Do not configure a service-role key for the app or OCR function.

To provision the first workspace, use the Supabase dashboard to create/invite the administrator Auth user, then run the following in the trusted SQL editor, replacing the sample values:

```sql
insert into public.churches (name)
values ('Your Church')
returning id;

insert into public.church_memberships (church_id, user_id, role)
select 'YOUR_CHURCH_UUID', id, 'owner'
from auth.users
where email = 'admin@yourchurch.org';
```

Invite additional users through Supabase Auth, then insert their church membership with the least-privileged role required. The current app selects the first active church membership for an account.

## Deploy to Vercel

Import the repository into Vercel. `vercel.json` uses `npm run build`, serves `dist`, discovers `/api/ocr`, and sets baseline security headers. Configure these environment variables for each Vercel environment that needs access:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GOOGLE_CLOUD_VISION_API_KEY` (OCR only)

The Vite variables must match the server-side Supabase URL and anon key. Redeploy after changing environment variables. Restrict Supabase Auth redirect URLs to the exact local and deployed origins, disable public sign-up, require verified/invited accounts, and enable MFA for privileged administrators. Configure backups, retention, and a suitable data-processing agreement before entering real pastoral/member records.

## Current scope

Member search/filtering, family grouping, attendance history display, administrator notes, private document upload, sign-in, and session sign-out are implemented. Preview charts, document rows, and summary totals are illustrative. Production member records and notes come from Supabase. OCR requires Google Cloud Vision API enablement and a server-side key. Before production use, add a tested administrator provisioning workflow, operational audit logging, data export/deletion procedures, and automated RLS integration tests for the church's policies and retention obligations.

For password recovery, open Church Records on the origin you intend to use, select **Forgot password?**, and request a fresh link. Open the newest email promptly; recovery links are single-use and expire. Supabase redirects to the app origin that requested the link, where the new password can be set.
