'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/lib/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
});
type ProfileForm = z.infer<typeof schema>;

export function ProfileSection() {
  const user = useAuthStore(s => s.user);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: '' },
  });

  async function onSubmit(_data: ProfileForm) {
    await new Promise(r => setTimeout(r, 500));
    toast.success('Profile updated');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your personal account details visible to teammates.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-semibold">
          {user?.name?.slice(0, 2).toUpperCase() ?? '??'}
        </div>
        <div>
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" type="tel" placeholder="+968 9XXX XXXX" {...register('phone')} />
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={!isDirty || isSubmitting}
            className="bg-brand-primary hover:bg-brand-primary/90"
          >
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>

      <div className="border-t pt-6 space-y-4 max-w-md">
        <h2 className="text-sm font-semibold">Change password</h2>
        <div className="space-y-1.5">
          <Label>Current password</Label>
          <Input type="password" placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label>New password</Label>
          <Input type="password" placeholder="min. 8 characters" />
        </div>
        <Button variant="outline" type="button" onClick={() => toast.success('Password updated')}>
          Update password
        </Button>
      </div>
    </div>
  );
}
