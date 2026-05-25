import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  canAction?: boolean;
}

export function SectionHeader({ title, description, actionLabel, onAction, canAction = true }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {actionLabel && onAction && canAction && (
        <Button className="bg-brand-primary hover:bg-brand-primary/90 shrink-0" size="sm" onClick={onAction}>
          <Plus size={14} className="me-1.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
