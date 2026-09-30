# Church Records Workspace Notes

- Use React, TypeScript, Vite, Tailwind CSS, and the existing Supabase client/service modules.
- Keep church data tenant-scoped. Enforce authorization in Supabase RLS; UI role checks are not a security boundary.
- Never expose Supabase service-role credentials or OCR provider secrets to browser code. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in client configuration.
- Keep member notes and uploaded files private. Do not add public storage URLs or unrestricted document policies.
- Preview mode must not seed or display fictitious records. Preserve the preview warning and do not represent preview edits as saved.
- Run `npm run build` and `npm run lint` after application changes.