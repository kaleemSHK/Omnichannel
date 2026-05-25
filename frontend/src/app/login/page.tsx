'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { loginWithPassword } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

const FEATURES = [
  'Unified inbox (voice, WhatsApp, email)',
  'PSTN + WhatsApp calling',
  'AI-powered agent assist',
  'SLA management & escalation',
  'Visual IVR builder',
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const hydrated = useAuthStore(s => s.hydrated);
  const user = useAuthStore(s => s.user);
  const hydrateFromSession = useAuthStore(s => s.hydrateFromSession);

  useLayoutEffect(() => {
    hydrateFromSession();
  }, [hydrateFromSession]);

  useEffect(() => {
    if (!hydrated || !user) return;
    router.replace(user.role === 'platform_admin' ? '/platform' : '/conversations');
  }, [hydrated, user, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginForm) {
    try {
      const result = await loginWithPassword({ email: data.email, password: data.password });
      useAuthStore.getState().setAuth(result.user, result.tokens);
      const role = result.user.role;
      if (role === 'platform_admin') {
        router.push('/platform');
      } else {
        router.push('/conversations');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid credentials';
      toast.error(message);
    }
  }

  return (
    <div className="h-screen flex flex-col md:flex-row">
      <div className="w-full md:w-[45%] bg-[#0B5FFF] flex flex-col min-h-[40vh] md:min-h-0 md:h-screen">
        <span className="text-white text-2xl font-bold p-8">BlinkOne</span>
        <div className="flex-1 flex items-center justify-center px-8 md:px-12 pb-8 md:pb-0">
          <div className="space-y-8 w-full max-w-lg">
            <h1 className="text-white text-2xl md:text-3xl font-semibold leading-tight">
              Your contact center, unified.
            </h1>
            <ul className="space-y-3">
              {FEATURES.map(feature => (
                <li key={feature} className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-white shrink-0" />
                  <span className="text-white text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="w-full md:flex-1 bg-white flex flex-col min-h-0 flex-1 md:h-screen">
        <div className="flex justify-end p-6">
          <div className="flex gap-2">
            {(['EN', 'AR'] as const).map(lang => (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  document.cookie = `bn_locale=${lang.toLowerCase()}; path=/`;
                  window.location.reload();
                }}
                className="px-3 py-1 text-sm border rounded-md hover:bg-muted transition-colors"
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 pb-8">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-[#0A0F1C]">Sign in to BlinkOne</h2>
              <p className="mt-1 text-sm text-muted-foreground">Welcome back, LABBIK Telecom S.P.C</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="agent@labbik.om"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Role is auto-detected from your account. Agents → Inbox, Supervisors → Inbox +
                  Reports, Admins → Full access.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="pr-10"
                    autoComplete="current-password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs text-muted-foreground bg-white px-2">
                Or
              </div>
            </div>

            <Button variant="outline" type="button" className="w-full">
              Continue with SSO
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
