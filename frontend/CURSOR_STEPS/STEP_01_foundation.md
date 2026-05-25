# STEP 01 — Foundation & Shell Layout
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 02 until all checks pass.

## What to build

Set up the application shell that every screen will use. This is the one-time foundation step.

### 1. Global layout shell — `src/app/(dashboard)/layout.tsx`

Create the protected dashboard layout. Requirements:
- Import `useAuthStore` from `src/lib/store/auth.ts`
- On mount, if `useAuthStore.getState().tokens === null` → redirect to `/login`
- Render the 52px icon sidebar + the main content slot
- The icon sidebar contains navigation icons (lucide-react):
  - `MessageSquare` → `/conversations` (label: Conversations)
  - `Phone` → `/calling` (label: Calling)
  - `Users` → `/contacts` (label: Contacts)
  - `Clock` → `/sla` (label: SLA)
  - `TrendingUp` → `/escalation` (label: Escalation)
  - `Bot` → `/ai` (label: AI Assist)
  - `Receipt` → `/billing` (label: Billing)
  - `Building2` → `/platform` (label: Platform — only show if user.role === 'platform_admin')
  - `Settings` → `/settings` (label: Settings)
- Active route: `bg-blue-50 text-[#0B5FFF]`, inactive: `text-muted-foreground hover:bg-muted`
- Use `usePathname()` to detect active route
- The layout renders a `PhonePanel` floating component at bottom-right (stub it as `<div id="phone-panel" />` for now)
- Use `'use client'`

### 2. Icon sidebar component — `src/components/layout/IconSidebar.tsx`

Extract the icon sidebar into its own component. Width: 52px, full height, white bg, border-right.
Each icon button: `w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer tooltip on hover`.
Use shadcn/ui `Tooltip` for labels.

### 3. Query provider — `src/components/layout/Providers.tsx`

```tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { NextIntlClientProvider } from 'next-intl'
// wrap children with QueryClientProvider + NextIntlClientProvider
// QueryClient config: staleTime: 30_000, retry: 1
```

Wrap `src/app/layout.tsx` root layout with `<Providers>`.

### 4. Global CSS — `src/styles/globals.css`

Add CSS variables:
```css
:root {
  --brand-primary: #0B5FFF;
  --brand-ink: #0A0F1C;
}
```
Add Tailwind `brand` color extensions in `tailwind.config.ts`:
```ts
theme: { extend: { colors: { brand: { primary: '#0B5FFF', ink: '#0A0F1C' } } } }
```

### 5. i18n middleware — `src/middleware.ts`

Use `next-intl` middleware. Detect locale from `bn_locale` cookie (default: `en`). Set `<html dir="rtl">` when locale is `ar`.

### 6. Root `src/app/layout.tsx`

- `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}`
- Load `Inter` font (LTR) and `Noto_Sans_Arabic` font (RTL) via `next/font/google`
- Import `globals.css`
- Wrap body with `<Providers>`

---

## Acceptance checklist — verify before STEP 02
- [ ] `npm run dev` starts without errors
- [ ] Visiting `http://localhost:3001/dashboard/conversations` redirects to `/login` when not authenticated
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Icon sidebar renders with all icons and tooltips
- [ ] Tailwind `text-brand-primary` resolves to `#0B5FFF`
- [ ] `<html dir="rtl">` when locale cookie is `ar`

✅ Only proceed to STEP 02 once all boxes are checked.
