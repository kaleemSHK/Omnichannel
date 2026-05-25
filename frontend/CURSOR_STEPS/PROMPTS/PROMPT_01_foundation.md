# CURSOR PROMPT — STEP 01: Foundation & Shell Layout
> Paste this ENTIRE file into Cursor Composer. Run `npm run type-check` and verify every checkbox before moving to PROMPT_02.

---

You are building the BlinkOne contact center UI (Next.js 14, TypeScript strict, Tailwind CSS, shadcn/ui).
All rules are in `.cursorrules`. Read it now before writing a single line.

## Your task — create these files completely:

```
src/app/(dashboard)/layout.tsx
src/components/layout/IconSidebar.tsx
src/components/layout/Providers.tsx
src/app/layout.tsx              ← update the root layout
src/styles/globals.css          ← add CSS variables
tailwind.config.ts              ← add brand color extension
src/middleware.ts               ← next-intl locale detection
```

---

## 1. `src/app/(dashboard)/layout.tsx`

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth'
import { IconSidebar } from '@/components/layout/IconSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (useAuthStore.getState().tokens === null) {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <IconSidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
      {/* PhonePanel stub — will be replaced in Step 04 */}
      <div id="phone-panel" />
    </div>
  )
}
```

---

## 2. `src/components/layout/IconSidebar.tsx`

Requirements:
- 'use client'
- Width: w-[52px], h-screen, white bg, border-r, flex-col, items-center, py-3, gap-1
- Import usePathname from next/navigation
- Import useAuthStore from @/lib/store/auth
- Import Tooltip, TooltipContent, TooltipProvider, TooltipTrigger from @/components/ui/tooltip
- Import Link from next/link
- Nav items (lucide-react icons only):
  ```ts
  const navItems = [
    { icon: MessageSquare, label: 'Conversations', href: '/conversations' },
    { icon: Phone,         label: 'Calling',       href: '/calling' },
    { icon: Users,         label: 'Contacts',       href: '/contacts' },
    { icon: Clock,         label: 'SLA',            href: '/sla' },
    { icon: TrendingUp,    label: 'Escalation',     href: '/escalation' },
    { icon: Bot,           label: 'AI Assist',      href: '/ai' },
    { icon: Receipt,       label: 'Billing',        href: '/billing' },
    { icon: Ticket,        label: 'Tickets',        href: '/tickets' },
    { icon: Settings,      label: 'Settings',       href: '/settings' },
  ]
  ```
- Platform item (Building2 icon → /platform) only rendered if user.role === 'platform_admin'
- Each item: Link wrapped in TooltipTrigger
  - Active (pathname starts with href): `bg-blue-50 text-brand-primary`
  - Inactive: `text-muted-foreground hover:bg-muted`
  - Button size: `w-9 h-9 rounded-lg flex items-center justify-center transition-colors`
- Tooltip side="right" with label text

---

## 3. `src/components/layout/Providers.tsx`

```tsx
'use client'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { NextIntlClientProvider } from 'next-intl'

export function Providers({ children, locale, messages }: {
  children: React.ReactNode
  locale: string
  messages: Record<string, string>
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
```

---

## 4. `src/app/layout.tsx` (root layout — replace existing)

```tsx
import type { Metadata } from 'next'
import { Inter, Noto_Sans_Arabic } from 'next/font/google'
import { cookies } from 'next/headers'
import { getMessages } from 'next-intl/server'
import { Providers } from '@/components/layout/Providers'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const notoSansArabic = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabic' })

export const metadata: Metadata = {
  title: 'BlinkOne — LABBIK Telecom',
  description: 'BlinkOne Contact Center',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const locale = cookieStore.get('bn_locale')?.value ?? 'en'
  const messages = await getMessages({ locale })

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`${inter.variable} ${notoSansArabic.variable}`}>
      <body className="font-sans antialiased">
        <Providers locale={locale} messages={messages as Record<string, string>}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

---

## 5. `src/styles/globals.css` — add at the TOP of the file (keep existing Tailwind directives)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --brand-primary: #0B5FFF;
  --brand-ink: #0A0F1C;
}

html[dir="rtl"] body {
  font-family: var(--font-arabic), sans-serif;
}

html[dir="ltr"] body {
  font-family: var(--font-inter), sans-serif;
}
```

---

## 6. `tailwind.config.ts` — add brand colors to theme.extend

```ts
// Add inside theme: { extend: { colors: { ... } } }
brand: {
  primary: '#0B5FFF',
  ink: '#0A0F1C',
},
```

---

## 7. `src/middleware.ts`

```ts
import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localeDetection: false,
  localePrefix: 'never',
})

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

---

## After writing all files, run:
```bash
npm run dev
npm run type-check
```

## CHECKLIST — verify every item before moving to PROMPT_02:
- [ ] `npm run dev` starts with no errors
- [ ] Visiting `/conversations` without login redirects to `/login`
- [ ] `npm run type-check` → 0 TypeScript errors
- [ ] IconSidebar renders all icons vertically with tooltips on hover
- [ ] Active nav item gets blue-50 background + blue text
- [ ] `text-brand-primary` class resolves to #0B5FFF in browser DevTools
- [ ] Setting cookie `bn_locale=ar` makes `<html dir="rtl">`

✅ All boxes checked? Paste PROMPT_02 into Composer.
