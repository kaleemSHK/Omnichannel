'use client';

import type { IVRNode } from '@/types';
import { Button } from '@/components/ui/button';

interface Props {
  selected: IVRNode | null;
  label: string;
  onLabelChange: (v: string) => void;
  onSave: () => void;
}

export function IVRPropertiesPanel({ selected, label, onLabelChange, onSave }: Props) {
  return (
    <aside className="w-[200px] shrink-0 bg-white border-s border-gray-200 p-3 h-full overflow-y-auto">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Properties</p>
      {!selected ? (
        <p className="text-xs text-muted-foreground">Select a node on the canvas</p>
      ) : (
        <>
          <p className="text-[10px] text-muted-foreground uppercase">{selected.type}</p>
          <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">Label</label>
          <input
            value={label}
            onChange={e => onLabelChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md"
          />
          {selected.type === 'play' && (
            <>
              <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">TTS text</label>
              <textarea
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md h-20 resize-none"
                defaultValue={String(selected.config?.text ?? '')}
              />
            </>
          )}
          {selected.type === 'dtmf' && (
            <>
              <label className="block text-xs font-medium text-gray-700 mt-3 mb-1">Prompt</label>
              <textarea
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md h-16 resize-none"
                defaultValue={String(selected.config?.prompt ?? '')}
              />
            </>
          )}
          <Button type="button" variant="outline" className="w-full mt-4 h-8 text-xs" onClick={onSave}>
            Save changes
          </Button>
        </>
      )}
    </aside>
  );
}
