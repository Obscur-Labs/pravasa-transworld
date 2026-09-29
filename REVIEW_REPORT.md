# Pravasa Transworld: Codebase Review

Date: 2026-09-29. Scope: full repo (backend-api, user-portal, admin-portal, root config). About 29.6k lines of TS/TSX across 273 tracked files. This was a static review: I read the code, ran `tsc --noEmit` on all three packages and ran `npm audit`. I didn't run the apps or use a browser.

**Verdict:** the product is feature-rich and the code is readable and well commented. The business logic is careful in places: price snapshots, idempotent payment verification, soft-delete trash and Brevo sender checks. The main risks are in **security and data protection**, not features. Uploaded identity documents are publicly reachable. Registration lets anyone overwrite another user's profile. Several secrets fall back to hardcoded defaults. There are no tests and no CI. Fix the 🔴 items before real customer traffic.

Legend: 🔴 critical/high · 🟠 medium · 🟡 low · ✅ good

> **Status (2026-09-29):**
> - **Fixed:** 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7 and 2.9.
> - **Fixed along the way:** 3.2 (vault delete no longer destroys files that applications use) and part of 3.13 (sockets re-check the account on connect).
> - **Still open:** 2.8 (compliance decisions; the KYC flow is kept as is, with only its modal UI polished) and all of sections 3 to 5.
> - **Deployment steps:** run `npm run migrate:private-assets -- --apply` once. Set `RAZORPAY_WEBHOOK_SECRET` and register the webhook in Razorpay.

---

## 1. What's good ✅

- **Clear monorepo layout.** npm workspaces with one API and two Next.js portals. Routes, controllers, models and services are cleanly separated.
- **Type safety holds.** `tsc --noEmit` passes with zero errors in all three packages, and the backend runs with `strict: true`.
- **Async error handling.** `utils/asyncRouter.ts` wraps every handler, so a rejected promise reaches the central error handler instead of crashing the process. The error handler maps ValidationError, CastError and 11000 duplicates to proper 4xx codes.
- **Pricing is snapshotted on the application** (`adultBase/adultVfs/adultFee/gstAmount`), so later price edits don't change old receipts. Pricing logic lives in one pure module (`utils/pricing.ts`).
- **Payment verification is careful.** The HMAC check uses `timingSafeEqual` (`razorpay.service.ts:62`). Verify is idempotent and scoped to the owning user, and late failure reports can't undo a completed payment (`payments.controller.ts:203`).
- **Ownership checks are consistent** on user endpoints. Every lookup is `{ _id, user: req.user._id }`, and I found no IDOR in the user API.
- **Corporate pricing is stripped** from public responses for anonymous and individual callers (`user/applications.controller.ts:292`).
- **Field-level AES-256-GCM encryption** is applied to `formResponses` and vault `extractedData`, with random IVs and an auth tag.
- **Soft delete and restore** go through a generic Trash collection, and trashed applications keep their raw encrypted snapshot.
- **Operational awareness is good.** The Brevo verified-sender check at boot (`config/email.ts`) is a strong touch. So are the fire-and-forget activity log and a TTL index on OTPs and activity logs.
- **Baseline hardening is in place.** Helmet, mongo-sanitize, a 10 MB upload cap, a MIME allowlist and `.env` files git-ignored (I confirmed no `.env` in git history).
- **Admin UX has a consistent design system**, plus SEO basics on the public site (`robots.ts`, `sitemap.ts`, OG image, JSON-LD, `noindex` on private routes).

---

## 2. Critical / High 🔴

### 2.1 Identity documents are publicly accessible on Cloudinary
`backend-api/src/services/cloudinary.service.ts:13-16` uploads everything with `type: 'upload'` and `access_mode: 'public'`. That covers passports, Aadhaar, PAN, bank statements and the final visa PDF. The "signed URL" endpoint (`getVaultDocumentUrl`) is therefore cosmetic, because the raw `url` is stored and sent to clients anyway (`document-vault/page.tsx:212,273,755`, admin `applications/[id]/page.tsx:518`). The visa PDF URL is even emailed (`email.service.ts sendVisaDeliveredEmail`). Anyone holding a link has permanent access.
**Fix:** upload with `type: 'authenticated'` (or `private`). Never return `url` to clients; always serve short-lived signed URLs or proxy through the API. Migrate existing assets.

### 2.2 Unauthenticated profile takeover via `/auth/send-otp`
`auth.controller.ts:31-39`: if the email already exists, the handler **overwrites** that user's `name`, `phone`, `accountType` and `gstNumber` *before* any OTP is verified. Anyone can rename a customer, change their phone number, or flip them to `corporate`, which changes their pricing and invoice type, knowing only their email.
**Fix:** store registration data on the OTP record (or a pending-registration doc) and only create or update the user in `verifyOtp`. For an existing email, reply "account exists, please log in".

### 2.3 Hardcoded secret fallbacks
- `JWT_SECRET || 'secret'` appears in `auth.controller.ts:12,193`, `auth.middleware.ts:21,44` and `adminAuth.middleware.ts:21`. The Vercel entry (`api/index.ts`) **skips** the `REQUIRED_ENV` check that `src/index.ts` performs. So a Vercel deploy with a missing var signs tokens with `'secret'`, and anyone can mint an admin token.
- `ENCRYPTION_KEY || 'default-insecure-dev-key'` (`utils/encryption.ts:8`), and `ENCRYPTION_KEY` isn't in `REQUIRED_ENV` at all.

**Fix:** delete every fallback. Read secrets through one `config/env.ts` that throws at startup, and call it from both `src/index.ts` and `api/index.ts`.

### 2.4 Wrong or rotated encryption key silently destroys data
`decryptData` returns `''` on failure (`encryption.ts:53`). The next `application.save()`, for example any admin status change, then re-encrypts `''` and persists it. That permanently wipes the applicant's form answers.
**Fix:** throw (or keep the ciphertext and flag the doc) on decrypt failure, and never write back a field that failed to decrypt. Add key versioning (`enc:v1:...`) so keys can rotate.

### 2.5 OTP brute-force and generation weaknesses
- The OTP comes from `Math.random()` (`auth.controller.ts:9`), which isn't a CSPRNG. `crypto` is already imported and unused, so use `crypto.randomInt(100000, 1000000)`.
- There is no per-OTP attempt counter. The only protection is an IP limiter, and it's in-memory, so it's ineffective across Vercel instances or rotating IPs.
- One limiter instance is shared across all five auth routes (`auth.routes.ts`), so the IP budget is 3 requests per minute in total. A real user who sends an OTP and mistypes it once is locked out, while an attacker just rotates IPs.
- OTPs are stored in plaintext, and `/auth/send-login-otp` and `/auth/admin/send-otp` return 404 for unknown emails, which enumerates both customers and admin accounts.

**Fix:** cap attempts per OTP record (for example 5, then delete it), hash OTPs, use separate limiters per route keyed by IP and email, use a shared store (Redis/Mongo) and return a generic "if the account exists, an OTP was sent".

### 2.6 Dev panel exposes OTPs and admin CRUD without auth
`app.ts:84-93` mounts `routes/dev.routes.ts` whenever `NODE_ENV !== 'production'`. It includes `GET /dev/otps` and `POST /dev/admins` with no authentication. The file is git-ignored, but any VPS or staging box started with plain `npm start` (NODE_ENV unset) that has the file present is fully open.
**Fix:** require an explicit `ENABLE_DEV_PANEL=true` *and* bind the panel to localhost only.

### 2.7 No payment webhook, so paid-but-unrecorded payments can happen
Completion depends entirely on the browser calling `/payment/verify`. If the tab closes, the network drops or the phone locks after Razorpay captures the money, the application stays `payment_pending` with the money taken.
**Fix:** add a Razorpay webhook (`payment.captured` / `order.paid`) with signature verification that runs the same completion logic idempotently.

### 2.8 Aadhaar / PII compliance (DPDP Act 2023, Aadhaar Act)
- The KYC modal (`DashboardShell.tsx:45-58`) pushes every user to upload Aadhaar front and back plus PAN, even though the product is a visa service. Storing Aadhaar copies has legal restrictions (masking, purpose limitation).
- Passport, Aadhaar and PAN images are sent to Groq (a third-party LLM) for OCR (`ocr.service.ts`). That needs to be disclosed in the privacy policy, with a data-processing basis.
- "Permanently delete" in Trash doesn't delete the Cloudinary files (`trash.controller.ts:14-21`), and permanently deleting a user doesn't remove their applications or vault documents. The right to erasure isn't actually honoured.

**Fix:** make Aadhaar optional or masked, update the privacy policy, and purge Cloudinary assets and dependent records on hard delete.

### 2.9 Known-vulnerable dependencies
`npm audit --omit=dev` reports **21 vulnerabilities (1 critical, 13 high)**, including socket.io-parser and ws (memory-exhaustion DoS on the socket server), qs via express, and sharp/libvips. Most are fixable with `npm audit fix`.

---

## 3. Medium 🟠

| # | Issue | Where | Fix |
|---|---|---|---|
| 3.1 | **Uploads fail for Word files.** The apply page accepts `.doc,.docx` but the backend only allows jpeg/png/pdf, so users get a server error. | `apply/page.tsx:36` vs `upload.middleware.ts:6` | Align both sides; move the list to a shared constant |
| 3.2 | **Deleting a vault doc breaks application docs.** `addDocumentFromVault` reuses the same `publicId`, so vault delete destroys the file the application still points to. | `documentVault.controller.ts:66`, `user/applications.controller.ts:396` | Copy the asset, or reference-count before deleting |
| 3.3 | **Applications allowed in a disabled country.** `createApplication` only checks `visaType.isActive`, which bypasses the "country off cascades" rule. | `user/applications.controller.ts:47` | Also check `Country.isActive` |
| 3.4 | **Double payment is possible.** After an admin cash override, a still-open Razorpay order can be verified, creating a second completed payment. | `admin/applications.controller.ts:397`, `payments.controller.ts:220` | Cancel pending orders on override; in verify, reject if the app is already `payment_completed` (and refund) |
| 3.5 | **Promo code weaknesses.** No per-user single-use check. The usage limit is check-then-increment, so it can be exceeded by concurrent orders. A 100% or large fixed discount gives `billAmount = 0`, which Razorpay rejects (minimum ₹1). Percentage discounts also apply to pass-through government and VFS fees. | `payments.controller.ts:74-92` | Atomic `findOneAndUpdate` with `usageCount < limit`; check `usedBy`; handle zero-amount orders; confirm the discount base with the business |
| 3.6 | **Tax-invoice accuracy.** The receipt number is computed at *download* time using the *current* year, so the same invoice gets a different number next year. GST is shown on the pre-discount service fee (discount subtracted after GST). The invoice uses the user's *current* accountType and GSTIN, not a snapshot. There is no CGST/SGST vs IGST split. | `payments.controller.ts:41-48`, `admin/applications.controller.ts:501-508`, `pdf.service.ts:222-253`, `receiptData.ts` | Persist `receiptNumber` (sequential per financial year) and buyer details on the Payment at completion; have a CA confirm the discount and GST treatment |
| 3.7 | **Status transitions are not validated.** Admins can jump `submitted → visa_delivered`, or set `payment_completed` with no Payment record. `rejectionReason` can't be cleared. | `admin/applications.controller.ts:233-247` | Define an allowed-transition map |
| 3.8 | **Passport OCR data is stored unencrypted** in `Document.extractedData`, even though the vault's equivalent field is encrypted. | `models/Document.ts` | Add `encryptionPlugin` |
| 3.9 | **Encryption is bypassed** by `findOneAndUpdate`, `updateOne` and `.lean()`, because the plugin only hooks `save` and `init`. It's safe today but fragile. | `plugins/encryptionPlugin.ts` | Add `pre('findOneAndUpdate')` hooks, or document and lint against these calls |
| 3.10 | **No database indexes** on hot query fields: `Application.user/status/createdAt`, `Document.application`, `Payment.application/user`, `Notification.user`, `DocumentVault.user`. | models | Add compound indexes |
| 3.11 | **Reference IDs will run out.** `PRS-XXX-NNNN` gives only 9,000 IDs per country from random retries. The fallback `Date.now().slice(-4)` can collide, and a collision throws a 409 on the unique index. | `user/applications.controller.ts:64-71`, `Application.ts:284` | Use an atomic counter per country, or widen the number |
| 3.12 | **Global XSS "sanitiser" corrupts data.** Every string in every request is HTML-escaped before storage, so `A&B Travels` is stored as `A&amp;B Travels` and shows up escaped in React, PDFs and emails. React already escapes on output. | `app.ts:52-71` | Remove the middleware; escape at output (emails already have `escapeHtml`) |
| 3.13 | **JWT stored in localStorage** in both portals and duplicated in the zustand persist store (two sources of truth). There's no server-side logout or revocation, admin tokens last 7 days, and sockets never re-check that the user or admin still exists. | `store/auth.store.ts`, `lib/api.ts`, `utils/socket.ts` | httpOnly cookie plus a short-lived access token with refresh; check existence on socket connect |
| 3.14 | **CORS trusts any `*.vercel.app`** with credentials, so anyone can deploy a site there. Socket.io uses a *different* origin list than Express. | `app.ts:26`, `socket.ts:14` | Restrict to your own project's preview pattern; share one origin list |
| 3.15 | **Socket.io is broken on Vercel.** The serverless entry `api/index.ts` never calls `initSocket`, so every `getIO()` throws (caught and logged) and real-time notifications silently don't work. The in-memory rate limiter is per-instance there too. | `api/index.ts` | Host the API on a long-running server (Render/Railway/VPS), or use a hosted pub/sub |
| 3.16 | **Apply draft is saved in localStorage** under a fixed key (`visa_app_draft`), so on a shared computer the next user sees the previous user's passport details. Logout doesn't clear it. | `apply/page.tsx:35,789` | Key it by user ID and clear it on logout |
| 3.17 | **Public contact form has no rate limit or captcha.** Each submission creates an admin notification, so it can be spammed. | `public.routes.ts:15` | Rate limit plus honeypot or Turnstile; validate email and length |
| 3.18 | **Audit log is erasable** by any admin (`DELETE /admin/activity-logs`), and there is no RBAC: every admin can do everything. | `admin.routes.ts:113` | Remove bulk delete (TTL already handles retention); add roles (owner/staff) |
| 3.19 | **Replaced documents leave orphaned files.** Re-uploading a document never deletes the old Cloudinary file. | `user/applications.controller.ts:204-212` | Delete the previous `publicId` after a successful replace |
| 3.20 | **Public country pages are client-rendered** (`'use client'` plus fetch in `useEffect`), so search engines see no country or visa content or per-country metadata. These are the main marketing pages. | `(public)/countries/[slug]/page.tsx` | Server component with `generateMetadata` and ISR |

---

## 4. Low 🟡

- **Dead or unused code:** `makePayment` "simulated payment" (`user/applications.controller.ts:261`) is unrouted but dangerous if ever wired up, so delete it. `crypto` is unused in `auth.controller.ts`. `ADMIN_PASSWORD` and `bcrypt` are no longer used (admin login is OTP).
- **Unused dependencies in the backend:** `next`, `tesseract.js`, `multer-storage-cloudinary`, `express-validator`. The 5 MB `eng.traineddata` file is committed to git. `@types/*` packages and `typescript` sit in `dependencies` instead of `devDependencies`. `@types/express-rate-limit` v6 is obsolete (v8 ships its own types).
- **Version mismatch:** `eslint-config-next@15.3.6` with `next@16`, no ESLint config file, and `next lint` is removed in Next 16, so linting effectively doesn't run.
- **`tsconfig.tsbuildinfo` is committed** in both portals; add it to `.gitignore`.
- **Duplication:**
  - The notification "create Notification, then emit socket, then try/catch" block is copy-pasted about 12 times; extract `notifyUser()` / `notifyAdmins()`.
  - Receipt-number logic is duplicated in two controllers.
  - `fetchBuffer` is duplicated in `users.controller.ts`, even though `utils/fetchBuffer.ts` exists.
  - `applicationReview.ts` and 11 UI primitives are duplicated across the two portals; consider a `packages/shared` workspace. README claims shared types exist, but they don't.
  - GST and pricing math is re-implemented on the client (`apply/page.tsx:37-743`), which will drift; have the API return a quote.
- **Needless dynamic imports:** `await import('../../models/...')` inside handlers (some in files that already statically import the same model).
- **Oversized components:** `apply/page.tsx` (1,766 lines), `countries/[id]/page.tsx` (1,194), `applications/[id]` (1,125 / 1,015), `document-vault` (988). Split them into step and section components.
- **Loose typing:** 149 `any` usages; `as any` casts on public routes (`public.routes.ts`).
- **No request validation layer.** Validation is ad hoc per handler, and `updateCountry` passes raw `req.body` to `findByIdAndUpdate` (mass assignment, admin-only). Adopt zod schemas, which are already a frontend dependency.
- **Pagination is missing** on admin users, leads, trash and notifications; `getAdminPayments` is hard-capped at 200.
- **Timezone bug in the dashboard trend:** it groups with UTC `$dateToString` while the window starts at server-local midnight, so IST early-morning applications land on the previous day.
- **Unescaped values in HTML and headers:**
  - `Hi ${name}` is interpolated unescaped into notification emails (currently masked by the global xss middleware; it breaks once 3.12 is fixed).
  - Filenames go unescaped into `Content-Disposition`.
  - `JsonLd` doesn't escape `</script>`.
- **Stale documentation:** README says "JWT + bcrypt for admins" and "Nodemailer/Gmail SMTP", but the code uses OTP and the Brevo API. `summary.md` says GST applies "on top of everything", but the code applies it to the service fee only. `context.md` is 42 KB of likely-stale notes.
- **Git hygiene:** commit messages like "OCR", "404 update" and "UI correction", and large multi-feature commits.

---

## 5. Missing foundations

1. **Tests: none.** There isn't a single test file. Start with pure units (`pricing.ts`, `encryption.ts`, `embassyMailTemplate.ts`), then API tests with supertest and mongodb-memory-server for auth, payment verify, promo and ownership.
2. **CI: none.** A GitHub Action running `tsc`, lint, tests and `npm audit` on every PR.
3. **Env validation:** a single zod-validated `config/env.ts`.
4. **Observability:** Sentry (or similar), structured logging (pino) instead of 38 `console.log`s that include emails, and alerts on email or payment failures.
5. **Backups and retention policy** for Mongo and Cloudinary.
6. **Admin management inside the app.** Admins can currently only be created through the local dev panel or the seed script.

---

## 6. Suggested order of work

1. **This week (security):**
   - Private Cloudinary delivery plus signed URLs (2.1).
   - Fix the send-otp overwrite (2.2).
   - Remove secret fallbacks and validate env in both entrypoints (2.3).
   - Fix the decrypt-failure data wipe (2.4).
   - OTP hardening (2.5).
   - Gate the dev panel (2.6).
   - `npm audit fix` (2.9).
2. **Next (money correctness):**
   - Razorpay webhook (2.7).
   - Double-payment guard (3.4).
   - Atomic promo codes (3.5).
   - Persisted invoice numbers and a GST review (3.6).
3. **Then (quick bug fixes):** 3.1, 3.2, 3.3, 3.11, 3.12, 3.16.
4. **Foundations:** tests for pricing, payments and auth; CI; indexes (3.10); decide the hosting model for Socket.io (3.15).
5. **Compliance:** Aadhaar handling, privacy policy for Groq OCR, real hard-delete (2.8).
6. **Cleanup:** dead code and deps, shared package, split the large pages, SSR for country pages (3.20).
