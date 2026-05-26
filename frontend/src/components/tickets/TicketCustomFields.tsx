'use client';

import { useQuery } from '@tanstack/react-query';
import { listTicketFields, type TicketField } from '@/lib/api/ticketFields';
import { isDemoDataEnabled } from '@/lib/demo/config';

export type CustomFieldValues = Record<string, string | number | boolean>;

interface Props {
  values: CustomFieldValues;
  onChange: (values: CustomFieldValues) => void;
}

export function TicketCustomFields({ values, onChange }: Props) {
  const { data: fields = [] } = useQuery({
    queryKey: ['ticket-fields'],
    queryFn: listTicketFields,
    enabled: !isDemoDataEnabled(),
  });

  if (!fields.length) return null;

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-600">Custom fields</p>
      {fields.map(field => (
        <CustomFieldInput
          key={field.field_key}
          field={field}
          value={values[field.field_key]}
          onChange={next =>
            onChange({ ...values, [field.field_key]: next })
          }
        />
      ))}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: TicketField;
  value: string | number | boolean | undefined;
  onChange: (v: string | number | boolean) => void;
}) {
  const label = (
    <span className="text-xs font-medium text-gray-600">
      {field.label}
      {field.required && ' *'}
    </span>
  );

  if (field.field_type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        {label}
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(e.target.checked)}
          className="ms-auto"
        />
      </label>
    );
  }

  if (field.field_type === 'select') {
    return (
      <label className="block">
        {label}
        <select
          value={value != null ? String(value) : ''}
          onChange={e => onChange(e.target.value)}
          className="mt-1 w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">Select…</option>
          {(field.options ?? []).map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const inputType =
    field.field_type === 'number'
      ? 'number'
      : field.field_type === 'date'
        ? 'date'
        : 'text';

  return (
    <label className="block">
      {label}
      <input
        type={inputType}
        value={value != null ? String(value) : ''}
        onChange={e =>
          onChange(
            field.field_type === 'number' ? Number(e.target.value) : e.target.value,
          )
        }
        className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-[#0B5FFF]"
      />
    </label>
  );
}
