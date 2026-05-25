# STEP 02 — Login Page
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 03 until all checks pass.

## What to build

`src/app/login/page.tsx` — the full login screen.

## Visual spec (implement exactly)

Two-column split layout, full viewport height:

**Left panel (45% width, bg-[#0B5FFF]):**
- BlinkOne logo (text "BlinkOne" in white, text-2xl font-bold) at top-left, p-8
- Centered vertically: large headline "Your contact center, unified." in white, text-3xl font-semibold
- Feature list below headline, each item has a `CheckCircle` icon (white, w-4 h-4) and white text:
  - Unified inbox (voice, WhatsApp, email)
  - PSTN + WhatsApp calling
  - AI-powered agent assist
  - SLA management & escalation
  - Visual IVR builder

**Right panel (55% width, white bg):**
- Language toggle top-right: two buttons "EN" | "AR" — clicking AR sets `bn_locale` cookie to `ar` and reloads
- Centered vertically: max-w-sm mx-auto
- Heading: "Sign in to BlinkOne", text-2xl font-semibold text-[#0A0F1C]
- Sub-heading: "Welcome back, LABBIK Telecom S.P.C"
- Form (react-hook-form + zod):
  - Email field: label "Email", type email, placeholder "agent@labbik.om"
  - Password field: label "Password", type password, show/hide toggle icon
  - zod schema: `z.object({ email: z.string().email(), password: z.string().min(8) })`
- "Sign in" button: full width, bg-brand-primary, text-white, loading spinner while submitting
- Divider: "Or"
- "Continue with SSO" outline button: full width
- Error: use `sonner` toast.error() on API error

## Implementation requirements

```tsx
// src/app/login/page.tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { loginWithPassword } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
```

On successful login:
1. Call `loginWithPassword({ email, password })`
2. Call `useAuthStore.getState().setAuth(user, tokens)`
3. `router.push('/conversations')`

The page route is `/login` (NOT under the dashboard layout — it has no auth guard or sidebar).

## Acceptance checklist — verify before STEP 03
- [ ] Login page renders at `http://localhost:3001/dashboard/login`
- [ ] Left blue panel shows feature list with check icons
- [ ] Form validates email format and password length before submit
- [ ] Submitting with wrong creds shows sonner error toast
- [ ] Submitting with correct creds redirects to `/conversations`
- [ ] EN/AR toggle changes `bn_locale` cookie
- [ ] No TypeScript errors
- [ ] Mobile: stacks vertically (left panel collapses to top banner)

✅ Only proceed to STEP 03 once all boxes are checked.
