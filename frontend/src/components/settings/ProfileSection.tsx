'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { getProfile, updateProfile } from '@/lib/api/settings';
import { DEMO_PROFILE, settingsDemoDelay } from '@/lib/demo/settingsFixture';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ROLE_META } from '@/lib/rbac';
import type { UserRole } from '@/lib/rbac';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  display_name: z.string().optional(),
  phone_number: z.string().optional(),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    password_confirmation: z.string(),
  })
  .refine(d => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export function ProfileSection() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const roleMeta = ROLE_META[(user?.role ?? 'agent') as UserRole];

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', display_name: '', phone_number: '' },
  });

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      if (isDemoDataEnabled()) return DEMO_PROFILE;
      try {
        return await getProfile();
      } catch {
        return DEMO_PROFILE;
      }
    },
  });

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: async (data: ProfileForm) => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay(500);
        return { ...DEMO_PROFILE, ...data };
      }
      return updateProfile(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: savePassword, isPending: savingPassword } = useMutation({
    mutationFn: async (data: PasswordForm) => {
      if (isDemoDataEnabled()) {
        await settingsDemoDelay(500);
        return;
      }
      await updateProfile(data);
    },
    onSuccess: () => {
      toast.success('Password updated');
      passwordForm.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!profile) return;
    profileForm.reset({
      name: profile.name,
      email: profile.email,
      display_name: profile.display_name ?? '',
      phone_number: profile.phone_number ?? '',
    });
  }, [profile, profileForm]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }

  const initials = (profile?.name ?? user?.name ?? '??').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal account details visible to teammates.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-semibold shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium">{profile?.name ?? user?.name}</p>
          <p className="text-xs text-muted-foreground">{profile?.email ?? user?.email}</p>
          {roleMeta && (
            <Badge className={`mt-1 text-[10px] ${roleMeta.color}`}>{roleMeta.label}</Badge>
          )}
        </div>
      </div>

      <form
        onSubmit={profileForm.handleSubmit(d => saveProfile(d))}
        className="space-y-4 max-w-md"
      >
        <div className="border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold">Personal details</h2>

          {(
            [
              { id: 'name' as const, label: 'Full name', placeholder: 'Ahmed Al-Rashidi', type: 'text' },
              { id: 'display_name' as const, label: 'Display name', placeholder: 'Ahmed', type: 'text' },
              { id: 'email' as const, label: 'Email', placeholder: 'ahmed@company.com', type: 'email' },
              { id: 'phone_number' as const, label: 'Phone number', placeholder: '+96891234567', type: 'tel' },
            ]
          ).map(({ id, label, placeholder, type }) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id} className="text-xs">
                {label}
              </Label>
              <Input
                id={id}
                type={type}
                placeholder={placeholder}
                {...profileForm.register(id)}
              />
              {profileForm.formState.errors[id] && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors[id]?.message}
                </p>
              )}
            </div>
          ))}

          <Button
            type="submit"
            disabled={savingProfile || !profileForm.formState.isDirty}
            className="bg-brand-primary hover:bg-brand-primary/90 w-full sm:w-auto"
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>

      <form
        onSubmit={passwordForm.handleSubmit(d => savePassword(d))}
        className="space-y-4 max-w-md"
      >
        <div className="border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold">Change password</h2>

          {(
            [
              { id: 'current_password', label: 'Current password' },
              { id: 'password', label: 'New password' },
              { id: 'password_confirmation', label: 'Confirm new password' },
            ] as const
          ).map(({ id, label }) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id} className="text-xs">
                {label}
              </Label>
              <Input id={id} type="password" {...passwordForm.register(id)} />
              {passwordForm.formState.errors[id] && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors[id]?.message}
                </p>
              )}
            </div>
          ))}

          <Button
            type="submit"
            disabled={savingPassword}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {savingPassword ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </div>
  );
}
