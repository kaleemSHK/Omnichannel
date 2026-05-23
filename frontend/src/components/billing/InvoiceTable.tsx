'use client';

import { formatOmr } from '@/lib/utils/billing';
import type { InvoiceView } from '@/lib/utils/billing';
import { cn } from '@/lib/utils/cn';

const STATUS_STYLES: Record<InvoiceView['status'], { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200' },
};

export function InvoiceTable({ invoices }: { invoices: InvoiceView[] }) {
  if (!invoices.length) {
    return <p className="text-sm text-gray-500 py-8 text-center">No invoices yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pe-4 font-medium">Period</th>
            <th className="py-2 pe-4 font-medium">Amount</th>
            <th className="py-2 pe-4 font-medium">Overage</th>
            <th className="py-2 pe-4 font-medium">Status</th>
            <th className="py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => {
            const st = STATUS_STYLES[inv.status];
            return (
              <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                <td className="py-3 pe-4 text-gray-900">{inv.period}</td>
                <td className="py-3 pe-4 font-medium">{formatOmr(inv.amount)}</td>
                <td className="py-3 pe-4">
                  {inv.overage > 0 ? (
                    <span className="text-red-600">+{formatOmr(inv.overage)}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-3 pe-4">
                  <span
                    className={cn(
                      'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border',
                      st.className,
                    )}
                  >
                    {st.label}
                  </span>
                </td>
                <td className="py-3">
                  {inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0B5FFF] hover:underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
