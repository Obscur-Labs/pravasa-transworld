# Pravasa Transworld Platform: Deep Technical Context

## Overview

Pravasa Transworld is a full-stack, multi-tenant Visa CRM (Customer Relationship Management) platform designed for immigration service agencies. It manages the complete lifecycle of a visa application, from initial submission through embassy review to final delivery, with separate surfaces for applicants and administrators.

---

## Monorepo Structure

```
VisaServicePlatform/
├── package.json              # npm workspaces root
├── backend-api/              # Express + TypeScript REST API  (port 5000)
├── user-portal/              # Next.js 15, public site + applicant dashboard (port 3000)
├── admin-portal/             # Next.js 15, admin console (port 3001)
└── shared/                   # Shared TypeScript types (consumed by both portals)
```

Workspaces are managed via `npm workspaces`. The root `package.json` exposes convenience scripts:

| Script | Action |
|---|---|
| `npm run dev:backend` | Start API on :5000 with nodemon |
| `npm run dev:user` | Start user portal on :3000 |
| `npm run dev:admin` | Start admin portal on :3001 |
| `npm run seed` | Seed DB: 1 admin + 8 countries + 3 visa types |

---

## Backend API (`backend-api/`)

### Tech Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** MongoDB via Mongoose
- **Auth:** JWT (jsonwebtoken), bcryptjs for admin passwords
- **Email:** Nodemailer (SMTP / Gmail or Brevo)
- **File Storage:** Cloudinary (documents, vault, profile photos, visa PDFs)
- **File Upload:** Multer (in-memory buffer → Cloudinary)
- **Real-time:** Socket.io

### Entry Points

`src/app.ts` bootstraps Express with:
- CORS restricted to `FRONTEND_URL` (`:3000`) and `ADMIN_URL` (`:3001`), plus Vercel preview URLs
- Helmet security headers (CSP disabled for JSON API)
- NoSQL injection protection (mongoSanitize)
- XSS sanitisation on req.body / req.query
- JSON body parser with 10 MB limit
- Health check at `GET /health` → `{ status: 'ok', service: 'Pravasa Transworld API' }`
- Status check at `GET /` → `{ status: 'active' }`
- Route mounts: `/api/auth`, `/api/admin`, `/api/user`, `/api/public`

### Route Map

#### Auth Routes (`/api/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/send-otp` | Create/update user, generate 6-digit OTP, send email (new registrations) |
| POST | `/send-login-otp` | Send OTP to an existing user's email (returning login) |
| POST | `/verify-otp` | Validate OTP, return JWT + user object |
| POST | `/admin/login` | Email + password login for admins, return JWT |

#### User Routes (`/api/user`): requires `protect` middleware
| Method | Path | Description |
|---|---|---|
| GET | `/profile` | Get authenticated user's profile |
| PUT | `/profile` | Update name, phone, GST number |
| POST | `/profile/photo` | Upload / replace profile photo (Multer → Cloudinary `users/{id}/profile`) |
| GET | `/dashboard` | User-specific stats |
| GET/POST | `/applications` | List / create application |
| GET | `/applications/:id` | Application detail with documents and visa file |
| POST | `/applications/:id/documents` | Upload document file (Multer → Cloudinary `users/{id}/documents`) |
| POST | `/applications/:id/documents/from-vault` | Attach an existing vault document to an application |
| PUT | `/applications/:id/payment` | Submit payment for application |
| GET/POST | `/vault` | Document vault: list / upload (Cloudinary `users/{id}/vault`) |
| GET | `/vault/:id/url` | Get 1-hour signed Cloudinary URL for a vault document |
| DELETE | `/vault/:id` | Delete vault document (removes from Cloudinary) |
| GET | `/payments` | Payment history |
| GET | `/payments/:id/receipt` | Download PDF payment receipt (applicant name + application number) |
| GET | `/notifications` | Notification list (last 50) + unread count |
| PUT | `/notifications/:id/read` | Mark single notification read |
| PUT | `/notifications/read-all` | Mark all notifications read |
| DELETE | `/notifications/:id` | Delete single notification |
| DELETE | `/notifications/all` | Delete all notifications |

#### Admin Routes (`/api/admin`): requires `adminProtect` middleware
| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Aggregate stats: active, pending, approved, rejected, total |
| GET/POST | `/countries` | List all / create country |
| PUT/DELETE | `/countries/:id` | Update / delete country |
| PATCH | `/countries/:id/toggle` | Toggle isActive status |
| PATCH | `/countries/:id/toggle-website` | Toggle showOnWebsite (public visibility) |
| PUT | `/countries/:id/web-content` | Update webContent fields (heroTagline, overview, highlights, requirements, processingInfo, tips, faqs) |
| POST | `/countries/:id/images` | Upload a photo to Cloudinary, append URL to images[] |
| DELETE | `/countries/:id/images` | Remove a photo URL from images[] (body: { imageUrl }) |
| GET/POST | `/visa-types` | List all / create visa type |
| GET/PUT/DELETE | `/visa-types/:id` | Detail / update / delete visa type |
| PATCH | `/visa-types/:id/toggle` | Toggle active status |
| GET | `/applications` | Paginated list with filters |
| GET | `/applications/:id` | Full application detail |
| PUT | `/applications/:id/status` | Update application status |
| PUT | `/applications/:id/document-review` | Approve/reject individual document |
| PUT | `/applications/:id/approve-documents` | Bulk approve all documents |
| POST | `/applications/:id/visa-file` | Upload visa PDF (Multer → Cloudinary) |
| PUT | `/applications/:id/manual-payment` | Override payment manually |
| GET | `/applications/:id/documents/zip` | Download all application documents as ZIP |
| GET | `/applications/:id/receipt` | Download the breakdown receipt PDF for the application's completed payment |
| GET | `/payments` | Payment list across all applications |
| GET | `/users` | All registered applicants |
| POST | `/users` | Create a customer profile (individual or corporate; GST number required for corporate; duplicate email → 409) |
| PUT | `/users/:userId` | Update a customer profile (switching to individual clears GST; switching to corporate requires it) |
| DELETE | `/users/:userId` | Move a customer to trash (restorable; applications/vault keep the original id and re-link on restore) |
| GET | `/users/:userId/applications` | Applications for a specific user |
| GET | `/users/:userId/vault` | A user's vault documents |
| GET | `/users/:userId/vault/zip` | Download a user's vault as ZIP |
| PATCH | `/users/:userId/promo-applicable` | Toggle `promoApplicable` flag for a user |
| GET/POST | `/promo-codes` | List all / create promo code |
| PUT/DELETE | `/promo-codes/:id` | Update / soft-delete promo code |
| PATCH | `/promo-codes/:id/toggle` | Toggle `isActive` |
| PATCH | `/promo-codes/:id/toggle-website` | Toggle `showOnWebsite` |
| GET | `/promo-codes/:id/history` | Usage history for a promo code |
| GET | `/leads` | Contact form leads |
| PATCH | `/leads/:id/read` | Mark lead as read |
| DELETE | `/leads/:id` | Delete a lead |
| GET | `/notifications` | Admin notification list |
| PUT | `/notifications/read-all` | Mark all admin notifications read |
| PUT | `/notifications/:id/read` | Mark single admin notification read |
| DELETE | `/notifications/all` | Delete all admin notifications |
| DELETE | `/notifications/:id` | Delete single admin notification |

#### User Routes (`/api/user`): requires `protect` middleware (JWT)
| Method | Path | Description |
|---|---|---|
| GET | `/countries` | All `isActive: true` countries, **no** `showOnWebsite` filter. Used by Apply for Visa form so staff can process all active countries regardless of public visibility. |
| GET | `/dashboard` | User dashboard stats |
| GET/POST | `/applications` | List / create applications |
| GET | `/applications/:id` | Application detail |
| POST | `/applications/:id/documents` | Upload document (Multer → Cloudinary) |
| POST | `/applications/:id/documents/from-vault` | Attach vault document to application |
| POST | `/applications/:id/payment/order` | Create Razorpay order (accepts optional `promoCode` body param) |
| POST | `/applications/:id/payment/verify` | Verify payment signature |
| GET/POST | `/vault` | List / upload vault documents |
| GET | `/vault/:id/url` | Signed view URL for a vault document |
| DELETE | `/vault/:id` | Delete vault document |
| GET | `/payments` | Payment history |
| GET | `/payments/:id/receipt` | Download PDF receipt |
| GET | `/notifications` | Notification list + unread count |
| PUT | `/notifications/:id/read` | Mark single notification read |
| PUT | `/notifications/read-all` | Mark all read |
| DELETE | `/notifications/:id` | Delete notification |
| DELETE | `/notifications/all` | Delete all notifications |
| GET/PUT | `/profile` | Get / update profile |
| POST | `/profile/photo` | Upload profile photo |
| POST | `/ocr/passport` | OCR scan a passport image |
| POST | `/promo/validate` | Validate a promo code, checks promoApplicable, active/expiry/limit, returns discount preview |

#### Public Routes (`/api/public`)
Unauthenticated routes for the landing page, country pages, and contact form.

| Method | Path | Description |
|---|---|---|
| GET | `/countries` | `isActive: true` **AND** `showOnWebsite: true`: for the public website only |
| GET | `/countries/:slug` | Country detail + active visa types (by slug) |
| GET | `/visa-types` | Active visa types (optional `?country=id` filter) |
| POST | `/contact` | Submit contact form lead |
| GET | `/promos` | Active + `showOnWebsite: true` promo codes (for homepage popup) |

> **Key distinction, `showOnWebsite` vs `isActive`:**
> - `isActive` controls whether a country is usable **anywhere** (apply form, admin, public).
> - `showOnWebsite` is an extra gate for the **public marketing website only** (`/countries` page, landing slider).
> - A country can be `Active + Hidden`: fully operational for logged-in applications, just not advertised publicly.

---

## Data Models

### User
```typescript
{
  name: string                // required
  email: string               // unique, lowercase
  phone: string
  accountType: 'individual' | 'corporate'  // default: 'individual'
  gstNumber?: string          // corporate accounts only
  profilePhoto: string        // Cloudinary URL, default ''
  profilePhotoPublicId: string // Cloudinary public ID for deletion, default ''
  isActive: boolean           // default true
  promoApplicable: boolean    // default true, admin can disable to block promo access per-user
  createdAt: Date
  updatedAt: Date
}
```

> **Admin-managed customer profiles:** besides self-registration, admins can create, edit, and delete customers of both account types from the admin portal (`POST/PUT/DELETE /admin/users`). Corporate profiles require a `gstNumber`; switching a customer back to individual clears it. Deletion is soft, the customer document is snapshotted into the Trash collection (`entityType: 'user'`) and can be restored with the same `_id`, so their applications and vault documents re-link automatically.

### Admin
```typescript
{
  name: string
  email: string               // unique
  phone: string
  password: string            // bcrypt hashed, select: false
  isActive: boolean
}
// Instance method: comparePassword(candidate): Promise<boolean>
```

### OTP
```typescript
{
  email: string               // lowercase
  otp: string                 // 6-digit string
  expiresAt: Date             // 10 minutes from creation
  verified: boolean           // default false
}
```

### Country
```typescript
{
  name: string                // unique
  flag: string                // country code for flagcdn.com (e.g. 'in', 'us')
  code: string                // optional ISO alpha-3 code (e.g. 'IND', 'USA'), used in application reference IDs
  description: string
  isActive: boolean
  showOnWebsite: boolean      // whether this country appears on the public website
  slug: string                // auto-generated from name on save (e.g. 'united-states')
  images: string[]            // Cloudinary URLs for country photos (slider if multiple)
  webContent: {
    heroTagline: string       // shown below country name on detail page
    overview: string          // main description paragraph
    highlights: string[]      // badge chips (e.g. 'eVisa available')
    requirements: string      // visa requirements overview
    processingInfo: string    // processing timeline
    tips: string              // tips for applicants
    faqs: { question: string; answer: string }[]  // FAQ accordion items
  }
}
```

### VisaType
```typescript
{
  country: ObjectId           // ref: Country
  name: string
  description: string
  // Per-traveler pricing components. Total charged = (visa + VFS + service) × pax + 18% GST.
  // Visa and VFS fees are pass-through charges, identical for individual and corporate.
  // Only the service fee (our margin) has a corporate override.
  adultPrice: number          // adult visa fee (mandatory)
  childPrice: number          // child visa fee
  adultVfsFee: number         // adult VFS fee / pax (mandatory component, default 0)
  childVfsFee: number         // child VFS fee / pax
  adultServiceFee: number     // adult service fee / pax (optional; individual rate)
  childServiceFee: number     // child service fee / pax (individual rate)
  corporateAdultServiceFee?: number   // corporate service-fee override, used only when set;
  corporateChildServiceFee?: number   // 0 explicitly waives it, unset = same as individual
  price: number               // legacy mirror of adultPrice (listing "from" price)
  processingTime: string
  validity: string
  entry: string[]             // entry types (admin-configurable via VisaConfigOption)
  visaSubType / visaCategory / jurisdiction: string
  process: 'normal' | 'express'
  stayDuration: string
  formFields: FormField[]
  documentRequirements: DocumentRequirement[]
  terms: VisaTerm[]           // consent checkboxes shown on Review & Pay (see below)
  additionalNotes: string     // shown at the BOTTOM of the user-side visa overview modal and visa summary PDF
  isActive: boolean
}
```

> **Pricing & GST rule:** GST is a fixed **18%** applied on top of every fee component (`utils/pricing.ts` → `GST_RATE`, `computeSubtotal`, `computeGst`, `computePaymentAmount`). Visa and VFS fees are mandatory components; the service fee is optional. **Visa and VFS fees are the same for individual and corporate accounts (pass-through government/VFS charges); only the service fee varies by account type**, so it is the sole corporate override, a corporate service fee of 0 waives it, unset charges the standard (individual) service fee. All user-facing displayed totals are GST-inclusive; the full component breakdown appears only in the receipt PDF and in the checkout's hover (i) tooltip. Frontend checkout math mirrors the backend exactly (order-level subtotal, GST rounded once).

**VisaTerm** (embedded sub-document):
```typescript
{
  text: string                // the wording the applicant sees next to the checkbox
  required: boolean           // mandatory terms block submission until ticked
  defaultChecked: boolean     // pre-ticks the box (still un-tickable unless mandatory)
  order: number
}
```

> **Terms & Conditions:** admins build a per-visa list of consent checkboxes (Terms tab in the add/edit dialog). On the user-side Review & Pay step they render at the bottom, above the Pay button; mandatory terms gate submission both client-side (disabled button) and server-side (`createApplication` rejects a submission missing any required term). The exact wording ticked is snapshotted onto the application (`acceptedTerms`), so the record of what was agreed survives later edits to the visa type's terms.

**FormField** (embedded sub-document):
```typescript
{
  label: string
  fieldName: string
  type: 'text' | 'number' | 'email' | 'date' | 'select' | 'radio' | 'textarea' | 'file'
  required: boolean
  options: string[]           // for select / radio types
  placeholder: string
  order: number
  applicantType: 'adult' | 'child' | 'both'   // default 'adult'; controls which traveller sees this field
}
```

**DocumentRequirement** (embedded sub-document):
```typescript
{
  name: string
  description: string
  required: boolean
  applicantType: 'adult' | 'child' | 'both'   // default 'adult'; controls which traveller sees this doc
  docType: 'custom' | 'passport' | 'passport_front' | 'passport_back' | 'photo' | 'aadhaar' | 'pan'
}
```

> **`applicantType` rule:** Every form field and document requirement has exactly one upload slot per traveller. `'adult'` = shown only in adult traveller cards; `'child'` = only children; `'both'` = all travellers. Admin sets this per field with a 3-button segmented control (blue/violet/emerald). Replaces the old boolean `childOnly` flag.

### Application
```typescript
{
  user: ObjectId              // ref: User
  visaType: ObjectId          // ref: VisaType
  country: ObjectId           // ref: Country
  status: ApplicationStatus
  formResponses: Map<string, string>   // fieldName → value (encrypted at rest)
  rejectionReason: string
  adminNotes: string
  adults: number
  children: number
  paymentAmount: number       // locked at creation: subtotal (visa+VFS+service × pax) + 18% GST
  // Pricing snapshot at submission (base = visa fee, vfs = VFS fee, fee = service fee):
  adultBase / adultVfs / adultFee: number
  childBase / childVfs / childFee: number
  gstAmount: number           // 18% GST included in paymentAmount; 0 = legacy pre-GST application
  acceptedTerms: { text: string; required: boolean }[]  // snapshot of the visa terms ticked at submission
  referenceId: string         // format: PRS-{3-letter country code}-{4-digit number}, e.g. PRS-IND-4827
  createdAt: Date
  updatedAt: Date
}
```

**referenceId generation**: done in `createApplication` controller:
1. Fetch the Country document linked to the visa type
2. Use `country.code` if set, otherwise derive 3 letters from `country.name`
3. Pick a random 4-digit number (1000–9999) and check uniqueness; retry up to 10 times
4. Result: `PRS-IND-4827`, `PRS-USA-2391`, etc.

### Document
```typescript
{
  application: ObjectId       // ref: Application
  requirementName: string
  url: string                 // Cloudinary URL
  publicId: string            // Cloudinary public ID
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason: string
  reviewedAt: Date | null
}
```

### DocumentVault
```typescript
{
  user: ObjectId
  type: 'passport' | 'aadhar' | 'pan' | 'photograph' | 'bank_statement' | 'degree' | 'other'
  label: string               // user-supplied label
  url: string                 // Cloudinary URL
  publicId: string
  extractedData: Record<string, string>  // encrypted OCR results
  createdAt: Date
}
```

### Payment
```typescript
{
  application: ObjectId       // ref: Application
  user: ObjectId              // ref: User
  amount: number
  currency: string            // default 'USD'
  method: 'online' | 'cash' | 'manual_override'
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  transactionId: string       // TXN-{timestamp}-{random}
  markedByAdmin: boolean
  adminNote: string
  receiptUrl: string
  paidAt: Date | null
  createdAt: Date
}
```

### Notification
```typescript
{
  user: ObjectId
  title: string
  message: string
  type: 'otp' | 'document_approved' | 'document_rejected' | 'payment_request' |
        'status_update' | 'visa_approved' | 'visa_delivered' | 'general'
  application: ObjectId | null
  read: boolean
}
```

### VisaFile
```typescript
{
  application: ObjectId       // ref: Application
  url: string                 // Cloudinary URL of delivered visa PDF
  publicId: string
}
```

### ContactLead
```typescript
{
  name: string
  email: string
  phone?: string
  message: string
  read: boolean               // default false
  createdAt: Date
}
```

### PromoCode
```typescript
{
  code: string                // uppercase alphanumeric, unique (e.g. 'SAVE20', 'VISA2024')
  description: string         // user-visible description shown in popup and checkout
  discountType: 'percentage' | 'fixed'
  discountValue: number       // % for percentage, flat amount for fixed
  isActive: boolean           // default true, only active codes can be applied
  showOnWebsite: boolean      // default false, triggers homepage popup after 5s when true
  expiresAt?: Date            // optional expiry; expired codes are rejected at validation
  usageLimit?: number         // optional max uses; undefined = unlimited
  usageCount: number          // auto-incremented on successful payment
  usedBy: [{                  // history of each use
    user: ObjectId            // ref User
    userName: string
    userEmail: string
    applicationId?: ObjectId  // ref Application
    applicationRef?: string   // PRS-IND-4827 style
    usedAt: Date
    discountApplied: number   // actual cash discount received
  }]
  isDeleted: boolean          // soft delete
  deletedAt?: Date
}
```

**Promo eligibility:** `User.promoApplicable` is the per-user gate. Admin can disable it for any user from the Customers page; if false, the promo field is hidden in apply step 4 and the validate endpoint returns 403.

**Discount calculation:**
- `percentage`: `discount = round(orderAmount * value / 100)`
- `fixed`: `discount = min(value, orderAmount)` (never exceeds the order total)
- `finalAmount = max(0, orderAmount - discount)`

**Promo lifecycle:**
1. `POST /user/promo/validate`: validates code, checks promoApplicable, active/expired/limit, returns discount preview
2. `POST /user/applications/:id/payment/order`: accepts optional `promoCode` in body, re-validates, creates Razorpay order with discounted amount, stores `promoCode` + `discountApplied` in pending Payment record
3. `POST /user/applications/:id/payment/verify`: on successful payment, calls `PromoCode.findByIdAndUpdate` to increment `usageCount` and push to `usedBy[]`

---

## Application Status Flow

Linear pipeline with one branching terminal state:

```
submitted
  → documents_under_review
    → documents_approved
      → payment_pending
        → payment_completed
          → visa_processing
            → embassy_review
              → visa_approved
                → visa_delivered
              → visa_rejected   (terminal)
```

All 10 statuses are represented by the `ApplicationStatus` union type, shared across the monorepo via `shared/src/types/index.ts`.

**Business rules:**
- Payment UI is only unlocked after status reaches `documents_approved`
- `paymentAmount` is locked at application creation, corporate users get the corporate service fee if set
- Visa file upload by admin moves status to `visa_delivered`
- `visa_rejected` is a terminal dead-end; no recovery path in V1

---

## Authentication Architecture

### User Auth (Passwordless OTP)
Two separate OTP flows:
1. **Register / re-auth**: `POST /api/auth/send-otp`: upserts the User document (creates on first visit, updates name/phone on repeat)
2. **Returning login**: `POST /api/auth/send-login-otp`: only accepts an existing user's email, does not create or modify the user record

Both flows:
- Generate a 6-digit OTP, store hashed in OTP collection, expire in 10 min
- Email OTP via Nodemailer
- `POST /api/auth/verify-otp` validates OTP and issues JWT (`role: 'user'`, 7-day expiry)

### Admin Auth (Password)
1. Admin submits email + password → `POST /api/auth/admin/login`
2. Admin document fetched with `+password` projection
3. bcryptjs `comparePassword` validates
4. JWT issued (`role: 'admin'`, 7-day expiry)

### Middleware
- `protect`: validates JWT, fetches full User document from DB, attaches as `req.user`; rejects non-user roles
- `adminProtect`: validates JWT, attaches `req.admin`; rejects non-admin roles

---

## Corporate Pricing

Visa and VFS fees are pass-through charges billed identically to every account type; **only the service fee differs for corporate accounts.** When a user with `accountType: 'corporate'` submits an application:
- `createApplication` checks `req.user.accountType`
- `computeVisaPricing` takes visa and VFS fees straight from the standard fields and applies the corporate service-fee override (`corporateAdultServiceFee` / `corporateChildServiceFee`) only where the admin has set it; an unset corporate service fee falls back to the individual service fee, and 0 explicitly waives it.
- The stored `paymentAmount` (subtotal + 18% GST) and fee snapshot are the source of truth for payment and receipt generation
- Corporate receipts render as a **TAX INVOICE** with the client's GSTIN

On the apply page (user portal):
- Corporate users see their dedicated GST-inclusive rates (differing only by service fee) on visa cards and the overview modal
- The Review & Pay step shows a "Corporate" pill next to the total when a corporate service fee applies

---

## File Storage (Cloudinary)

Configured via `src/config/cloudinary.ts`. Upload service in `src/services/cloudinary.service.ts`.

All uploads are user-scoped with the following folder structure:

| Content | Cloudinary Folder |
|---|---|
| Application documents | `users/{userId}/documents` |
| Vault documents | `users/{userId}/vault` |
| Profile photos | `users/{userId}/profile` |
| Visa PDFs (admin upload) | configured separately |

Functions:
- `uploadToCloudinary(buffer, folder, resourceType)`: streams buffer via upload_stream
- `deleteFromCloudinary(publicId)`: removes file
- `getSignedUrl(storedUrl, publicId, expiresInSeconds)`: creates a time-limited signed delivery URL (used for vault document viewing)

When a user replaces their profile photo, the old Cloudinary asset is deleted before uploading the new one.

---

## Payment & Receipts

Payments run through **Razorpay**:
1. `POST /user/applications/:id/payment/order` creates a Razorpay order for `application.paymentAmount` (GST-inclusive; optional promo code discounts the total) and upserts a pending `Payment` record
2. `POST /user/applications/:id/payment/verify` validates the checkout signature, marks the payment `completed`, advances the application to `payment_completed`, increments promo usage
3. Admin and user notifications emitted via Socket.io; admin can still use the manual payment override

Receipt PDF (generated on demand via `GET /user/payments/:id/receipt` for customers, `GET /admin/applications/:id/receipt` for admins):
- Generated with PDFKit from the application's fee snapshot (`utils/receiptData.ts` + `services/pdf.service.ts`)
- **Full price breakdown lives here**: per-traveller rows with Visa Fees / VFS Fees / Serv. Chrgs columns, then Sub-Total → GST @ 18% → Discount (if promo) → Net Total (with amount in words)
- Legacy applications (`gstAmount: 0`) fall back to the old GST-included rendering so historical receipts don't misreport
- Corporate receipts are titled TAX INVOICE and include client GSTIN and place of supply; company details come from the admin-editable Receipt Config
- Returned as `application/pdf` blob

**Customer receipt download points:** the application detail page shows a "Download Receipt" button inside the Payment Confirmed card immediately after paying, and as a persistent "Payment Receipt" card in all later statuses; also from Payment History.

---

## Real-time Notifications (Socket.io)

- Server emits to per-user rooms: `user_{userId}` and `admin_room`
- `SocketProvider` on the client connects with Bearer token auth
- Events: `notification` (user), `admin_notification` (admin)
- Toast displayed on new real-time notification
- Unread count badge on the bell icon in the header

---

## Email Service (Nodemailer)

Four email templates, all styled with inline CSS (blue brand: `#1d4ed8`):

| Function | Trigger |
|---|---|
| `sendOTPEmail` | OTP request (register or login) |
| `sendDocumentStatusEmail` | Doc approve/reject by admin |
| `sendStatusUpdateEmail` | Any status change |
| `sendVisaDeliveredEmail` | Visa file uploaded by admin |

---

## Shared Types (`shared/`)

`shared/src/types/index.ts` exports all interfaces consumed by both portals:
- `ApplicationStatus` union + `STATUS_LABELS` map + `TIMELINE_STATUSES` array
- `FormField`, `DocumentRequirement`, `VisaTerm`, `Country`, `VisaType` (per-traveler fee components + `corporateAdultServiceFee?`/`corporateChildServiceFee?` + `terms[]`)
- `Application`, `Document`, `Notification`, `User`, `VisaFile`
- `ApiResponse<T>` generic wrapper: `{ success, message, data }`
- `DashboardStats`: `{ active, pending, approved, rejected, total }`

---

## Frontend Portals

### User Portal (`user-portal/`): Next.js 15 App Router, port 3000

**Route groups:**
- `(auth)`: `/login`, `/register`
- `(public)`: `/about`, `/contact`, `/privacy`, `/terms`, `/countries`, `/countries/[slug]`
- `(dashboard)`: all authenticated pages

**Public Country Pages (no login required):**
| Route | Description |
|---|---|
| `/countries` | Lists all `showOnWebsite: true` countries. Card shows `images[0]` as cover photo (flag fallback), name, description, first highlight chip. Search bar filters by name. |
| `/countries/[slug]` | Country detail page: photo slider (1 image = static, 2+ = arrows + pagination dots), visa info grid with colored dots (type, stay, entry, validity, processing), overview/requirements/processing/tips cards, FAQ accordion (numbered items, blue active state, smooth expand). Sticky right sidebar: visa type selector, GST-inclusive total per adult ("Inclusive of 18% GST" note; child price shown when set), "Start Application" CTA + "100% Secure" note. |

**FAQ Accordion (user portal):**
- Numbered circle per question (turns solid blue when open)
- Question text turns blue when open; answer indented below the number
- Smooth `max-height` CSS transition, no JS animation library
- Header shows count: "N questions answered"
- Renders all FAQs; no limit

**Landing page components:**
- `CountriesSlider`: `GET /public/countries` (showOnWebsite only). Cards link to `/countries/[slug]`. "Browse All Destinations" → `/countries`.
- `CountriesSection`: same API + fallback to hardcoded list if empty.
- `PromoPopup`: client component. Fetches `GET /public/promos` on mount; if any active `showOnWebsite` promos exist, shows a sliding bottom-right popup after 5 seconds with code + copy button. Dismissed for the session via `sessionStorage`. Multiple promos show dot navigation.

**Dashboard pages:**
| Route | Description |
|---|---|
| `/dashboard` | Stats + recent applications |
| `/apply` | 4-step visa application wizard. Step 1 fetches `GET /user/countries` (all active, no showOnWebsite filter). Step 2 shows visa cards with GST-inclusive rates and a visa overview modal (details, documents, Additional Notes at the bottom, copy-all + summary-PDF buttons). Step 3 renders one upload slot per document requirement per traveller. Field/doc visibility controlled by `applicantType` (adult/child/both); OCR runs server-side on upload for passport docTypes. Step 4 (Review & Pay) shows per-traveller pre-GST lines, an explicit GST (18%) line, and a GST-inclusive total; an **(i) icon reveals the full fee breakdown on hover** (Visa Fee, VFS Fee/pax, Service Fee/pax, GST). Promo code input for users with `promoApplicable: true`; validated discounts apply to the GST-inclusive total and are passed to the payment order. If the visa type defines **Terms**, a consent-checkbox card renders at the bottom (below the Razorpay notice), mandatory terms show a red asterisk and disable the Pay button until ticked, and the accepted wording is sent with the application. |
| `/applications` | Application list |
| `/applications/[id]` | Application detail with document upload, Razorpay payment, and **Download Receipt** (shown right after payment and in all later statuses) |
| `/my-visas` | Approved/delivered visas |
| `/document-vault` | Personal document storage with OCR auto-fill |
| `/payment-history` | Payment records and receipt download |
| `/notifications` | Full notifications page |
| `/profile` | Profile editing, photo upload, sign out |

**Responsive layout:**
- `lg+` (laptop/desktop): fixed left sidebar with collapse/expand toggle; sidebar shows avatar (→ `/profile`), nav items, Profile link, Sign Out
- `< lg` (mobile/tablet): top navbar with hamburger button; sidebar slides in as a full-height overlay drawer; route changes auto-close the drawer

**Notifications UX:**
- "Notifications" removed from sidebar nav
- Bell icon in top header opens a dropdown showing recent notifications
- Dropdown footer has a "View all notifications" link to the full `/notifications` page

**Profile page (`/profile`):**
- Profile photo with camera overlay button (uploads to Cloudinary, deletes old photo)
- Editable: name, phone, GST number (corporate only)
- Read-only: email, account type
- Sign Out button

**State management:** Zustand with localStorage persistence
- `useAuthStore` stores: `user` (including `profilePhoto`), `token`, `isAuthenticated`
- Actions: `login`, `logout`, `updateUser` (partial update without full re-login)

**KYC gate:** Dashboard blocked until Aadhaar (front + back) and PAN are uploaded to vault.

**Key components:**
- `DashboardSidebar`: collapsible desktop sidebar; `mobile` prop enables overlay drawer mode
- `NotificationDropdown`: bell with unread badge, sorted list, "View all" footer link
- `StatusTimeline`: visual 10-stage pipeline tracker
- `KYCModal`: document upload gate

**Env:** `NEXT_PUBLIC_API_URL=http://localhost:5000/api`

### Admin Portal (`admin-portal/`): Next.js 15 App Router, port 3001

**Auth redirect:** Login and register pages check `localStorage` for the token on mount. If found, `router.replace('/dashboard')` immediately (no flash of form). Admin portal checks `adminToken`; user portal checks `token`.

**Routes:**
- `/login`: email + password form
- `/dashboard`: live stats
- `/applications`: list with filters; `/applications/[id]`: full detail, document review, approval
- `/processing`: Kanban board
- `/countries`: country management: name, flag, ISO code, Active toggle (green), "Show on Website" toggle (violet), "Edit Content" button
- `/countries/[id]/content`: country web content editor. Two-column layout: left = form (photos, hero tagline, overview, highlights chips, requirements, processing info, tips, unlimited FAQs); right = sticky "What users see" page map (color-coded zones showing where each field renders on the public page) + live Content Status checklist (green/grey dots per field). Each form section has a colored location badge (violet = header, orange = slider, blue = overview, teal = requirements, amber = tips, rose = FAQs).
- `/visa-types`: visa type management. The add/edit dialog is a **5-step wizard**: **Information** (country, name, description, visa details) → **Pricing** → **Form** (presets + dynamic fields & document requirements) → **Additional Notes** → **Terms**. Footer Back/Continue walk the steps; validation errors jump to the tab that owns them (missing visa fee → Pricing, missing country/name/processing time → Information), and each tab shows a green tick when its required fields are satisfied. The **Pricing** tab is split by who the charge belongs to: one *Government & VFS charges* grid (Adult/Child Visa Fee + VFS Fee, entered once, same for everyone) and one *Service fee* grid with Individual and Corporate rows (Adult/Child each), where a blank corporate cell inherits the individual fee and 0 waives it; a live "Customer pays (incl. 18% GST)" grid previews both account types. The **Terms** tab (`components/shared/terms-editor.tsx`) builds the per-visa consent checkboxes (free-text wording, Mandatory toggle, Default-selected toggle). List toolbar has name/description search, country + category + status filters, a sort dropdown (name A–Z/Z–A, price low↔high, newest/oldest), and a clear-filters shortcut; the table's Corporate column highlights in amber only when a corporate service fee is set.
- `/users`: customer management with full CRUD for both Individual and Corporate profiles. Tabbed list (Individual / Corporate) with search and stat tiles; "Add Customer" button and per-row Edit/Delete actions. Create/edit share one dialog (`components/shared/customer-form-dialog.tsx`) with an Individual/Corporate segmented control, corporate selection reveals a required, auto-uppercased GST field, plus Active and Promo Eligible switches. Inline Promo Eligible/Blocked toggle per row (calls `PATCH /admin/users/:id/promo-applicable`). Delete confirms, then moves the customer to trash.
- `/users/[id]`: customer profile page: header with type badge, GST, contact info, and Edit/Delete buttons; stat tiles (applications, approved, rejected, total spend); document vault with ZIP download; application history table
- `/promo-codes`: full CRUD for promo codes (code, description, discount type/value, active toggle, show-on-website toggle, expiry date, usage limit, trash). Right-slide history drawer shows per-use breakdown (user, email, discount applied, date, application reference)
- `/leads`: contact form submissions
- `/notifications`: admin notifications

**Key capabilities:**
- No-code dynamic form builder, admin configures `formFields` per visa type
- Per-traveler fee components (visa/VFS shared, service fee with a corporate override) per visa type
- Per-visa Terms & Conditions builder, consent checkboxes shown to the applicant before payment
- Per-document review with approve/reject + reason
- Bulk document approval
- Manual payment override
- Visa file upload (PDF → Cloudinary)

**Env:** `NEXT_PUBLIC_API_URL=http://localhost:5000/api`

---

## Environment Variables

```env
# Backend (backend-api/.env)
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pravasatransworld
JWT_SECRET=<secret>
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<gmail>
EMAIL_PASS=<app-password>
EMAIL_FROM=Pravasa Transworld <noreply@pravasatransworld.com>

ADMIN_EMAIL=admin@pravasatransworld.com
ADMIN_PASSWORD=Admin@123
ADMIN_NAME=Super Admin
ADMIN_PHONE=9999999999

FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
```

---

## Default Seed Data

Running `npm run seed` creates:
- **1 Super Admin**: `admin@pravasatransworld.com` / `Admin@123`
- **8 Countries**: with flags and descriptions
- **3 Visa Types**: across different countries, with sample form fields and document requirements

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Passwordless OTP for users | Reduces friction for one-time / infrequent applicants |
| Separate register vs login OTP endpoint | Prevents accidentally creating duplicate accounts on returning login |
| Separate admin portal (port 3001) | Hard separation of concerns; admin never touches user portal code |
| Shared `types/` package | Single source of truth for API contracts across portals |
| Dynamic form builder | Agencies can configure visa-specific fields without code changes |
| Pricing snapshot at creation time | `paymentAmount` + per-traveler fee components + `gstAmount` are locked when the application is created, no price drift on receipts if the admin edits visa type fees later |
| GST added on top (fixed 18%) | Single `GST_RATE` constant mirrored in backend and frontend; totals displayed everywhere are GST-inclusive, component breakdown reserved for the receipt PDF and the checkout hover tooltip |
| Only the service fee varies by account type | Visa and VFS fees are pass-through government/VFS charges (same for everyone), so they're stored once; the service fee is our margin and is the sole corporate override. Cuts the corporate fields from six to two and lets the Pricing tab show both account types on one screen |
| Terms snapshotted onto the application | `acceptedTerms` stores the exact wording ticked at submission, so the record of what was agreed survives later edits to the visa type's terms, same reasoning as the pricing snapshot. Required terms are enforced server-side, not just via the disabled button |
| User-scoped Cloudinary folders | `users/{id}/documents`, `vault`, `profile`: isolates each user's assets, simplifies auditing and deletion |
| Application reference format `PRS-{CC}-{NNNN}` | Human-readable, country-identifiable, short enough for receipts and support tickets |
| Sidebar hidden on mobile | Small screens can't accommodate a persistent left sidebar; top navbar + drawer is standard mobile UX |
| Notifications removed from sidebar nav | Bell icon in header gives instant access; sidebar space reserved for primary workflow navigation |
| Payment gated on doc approval | Prevents payment before admin validates documents, reduces refund risk |
| 10-stage linear status flow | Mirrors real-world embassy processing pipeline; easy to audit |
