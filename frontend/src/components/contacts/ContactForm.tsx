'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateContact, useUpdateContact } from '@/lib/hooks/useContacts';
import { contactSlaTier } from '@/lib/utils/contacts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { CWContact } from '@/types';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.union([z.string().email('Enter a valid email'), z.literal('')]),
  phone_number: z.union([z.string().min(7, 'Phone must be at least 7 digits'), z.literal('')]),
  company: z.string().optional(),
  sla_tier: z.enum(['gold', 'silver', 'bronze']),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  contact?: CWContact;
  onDone: () => void;
}

export function ContactForm({ contact, onDone }: Props) {
  const create = useCreateContact();
  const update = useUpdateContact();
  const isEdit = !!contact;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone_number: '',
      company: '',
      sla_tier: 'silver',
    },
  });

  useEffect(() => {
    if (contact) {
      reset({
        name: contact.name,
        email: contact.email ?? '',
        phone_number: contact.phone_number ?? '',
        company: contact.company?.name ?? '',
        sla_tier: contactSlaTier(contact),
      });
    } else {
      reset({
        name: '',
        email: '',
        phone_number: '',
        company: '',
        sla_tier: 'silver',
      });
    }
  }, [contact, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name: values.name,
      email: values.email || undefined,
      phone_number: values.phone_number || undefined,
      custom_attributes: {
        sla_tier: values.sla_tier,
        company: values.company || undefined,
      },
    } as Partial<CWContact>;
    try {
      if (isEdit && contact) {
        await update.mutateAsync({ id: contact.id, data: payload });
        toast.success('Contact updated');
      } else {
        await create.mutateAsync({
          name: values.name,
          email: values.email || undefined,
          phone_number: values.phone_number || undefined,
        });
        toast.success('Contact created');
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="contact-name">
          Name
        </label>
        <Input id="contact-name" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="contact-email">
          Email
        </label>
        <Input id="contact-email" type="email" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="contact-phone">
          Phone
        </label>
        <Input id="contact-phone" {...register('phone_number')} />
        {errors.phone_number && (
          <p className="text-xs text-destructive">{errors.phone_number.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="contact-company">
          Company
        </label>
        <Input id="contact-company" {...register('company')} />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="contact-sla">
          SLA tier
        </label>
        <Select id="contact-sla" {...register('sla_tier')}>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="bronze">Bronze</option>
        </Select>
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-brand-primary hover:bg-brand-primary/90"
      >
        {isSubmitting && <Loader2 size={16} className="animate-spin me-2" />}
        {isEdit ? 'Save changes' : 'Create contact'}
      </Button>
    </form>
  );
}
