# CURSOR PROMPT — STEP 02: Login Page
> Paste this ENTIRE file into Cursor Composer. Verify every checkbox before moving to PROMPT_03.

---

Read `.cursorrules` before writing anything.

## Your task — create this file completely:
```
src/app/login/page.tsx
```

This page is NOT inside the `(dashboard)` group — it has no sidebar, no auth guard.

---

## `src/app/login/page.tsx`

Full implementation requirements:

```tsx
'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { loginWithPassword } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
```

### Zod schema:
```ts
const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type LoginForm = z.infer<typeof loginSchema>
```

### Layout — two-column split, full viewport height (`h-screen flex`):

**LEFT PANEL** (`w-[45%] bg-[#0B5FFF] flex flex-col`):
- Top: `<span className="text-white text-2xl font-bold p-8">BlinkOne</span>`
- Center (flex-1 flex items-center justify-center px-12):
  ```tsx
  <div className="space-y-8">
    <h1 className="text-white text-3xl font-semibold leading-tight">
      Your contact center, unified.
    </h1>
    <ul className="space-y-3">
      {[
        'Unified inbox (voice, WhatsApp, email)',
        'PSTN + WhatsApp calling',
        'AI-powered agent assist',
        'SLA management & escalation',
        'Visual IVR builder',
      ].map((feature) => (
        <li key={feature} className="flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-white shrink-0" />
          <span className="text-white text-sm">{feature}</span>
        </li>
      ))}
    </ul>
  </div>
  ```

**RIGHT PANEL** (`flex-1 bg-white flex flex-col`):
- Top-right language toggle (`flex justify-end p-6`):
  ```tsx
  <div className="flex gap-2">
    {['EN', 'AR'].map((lang) => (
      <button
        key={lang}
        onClick={() => {
          document.cookie = `bn_locale=${lang.toLowerCase()}; path=/`
          window.location.reload()
        }}
        className="px-3 py-1 text-sm border rounded-md hover:bg-muted transition-colors"
      >
        {lang}
      </button>
    ))}
  </div>
  ```
- Center form (`flex-1 flex items-center justify-center px-8`):
  ```tsx
  <div className="w-full max-w-sm space-y-6">
    <div>
      <h2 className="text-2xl font-semibold text-[#0A0F1C]">Sign in to BlinkOne</h2>
      <p className="mt-1 text-sm text-muted-foreground">Welcome back, LABBIK Telecom S.P.C</p>
    </div>

    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Email field */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="agent@labbik.om" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      {/* Password field with show/hide toggle */}
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className="pr-10"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      {/* Sign in button */}
      <Button type="submit" className="w-full bg-brand-primary hover:bg-brand-primary/90" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="w-4 h-4 me-2 animate-spin" /> Signing in…</> : 'Sign in'}
      </Button>
    </form>

    {/* Divider */}
    <div className="relative">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
      <div className="relative flex justify-center text-xs text-muted-foreground bg-white px-2">Or</div>
    </div>

    {/* SSO button */}
    <Button variant="outline" className="w-full">Continue with SSO</Button>
  </div>
  ```

### onSubmit handler:
```ts
async function onSubmit(data: LoginForm) {
  try {
    const result = await loginWithPassword({ email: data.email, password: data.password })
    useAuthStore.getState().setAuth(result.user, result.tokens)
    router.push('/conversations')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid credentials'
    toast.error(message)
  }
}
```

### Mobile responsive:
- Add `flex-col md:flex-row` on the outer wrapper
- Left panel: `w-full md:w-[45%]` with reduced padding on mobile
- Right panel: `w-full md:flex-1`

---

## CHECKLIST — verify every item before moving to PROMPT_03:
- [ ] Page renders at `/login` (not `/dashboard/login`)
- [ ] Left blue panel shows "BlinkOne" + headline + all 5 feature items with CheckCircle icons
- [ ] Email field validates format before submit (inline error message)
- [ ] Password field validates min 8 chars before submit (inline error message)
- [ ] Submit with wrong creds → `toast.error()` fires via sonner
- [ ] Submit with correct creds → redirects to `/conversations`
- [ ] "Sign in" button shows Loader2 spinner while submitting
- [ ] Eye icon toggles password visibility
- [ ] EN/AR language buttons set `bn_locale` cookie + reload
- [ ] Mobile: panels stack vertically
- [ ] `npm run type-check` → 0 errors

✅ All checked? Paste PROMPT_03 into Composer.
