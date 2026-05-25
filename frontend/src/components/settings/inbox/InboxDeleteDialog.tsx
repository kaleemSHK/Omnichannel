'use client';

import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/button';
import { useDeleteInbox } from '@/hooks/useInboxAdmin';
import type { CWInbox } from '@/types';

interface Props {
  inbox: CWInbox | null;
  onClose: () => void;
}

export function InboxDeleteDialog({ inbox, onClose }: Props) {
  const { mutate: deleteInbox, isPending } = useDeleteInbox();

  if (!inbox) return null;

  function handleConfirm() {
    deleteInbox(inbox!.id, { onSuccess: onClose });
  }

  return (
    <Dialog open={!!inbox} onClose={onClose} title={`Delete "${inbox.name}"?`}>
      <p className="text-sm text-muted-foreground mb-6">
        This will permanently remove the inbox and all its configuration. Conversations inside this
        inbox will not be deleted but will lose their inbox association. This action cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isPending}
          className="bg-destructive hover:bg-destructive/90 text-white"
        >
          {isPending ? 'Deleting…' : 'Delete inbox'}
        </Button>
      </div>
    </Dialog>
  );
}
