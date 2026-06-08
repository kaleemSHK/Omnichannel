'use client';

import { useEffect, useState } from 'react';
import { Download, FileIcon } from 'lucide-react';
import { WhatsAppVoiceMessage } from '@/components/conversations/WhatsAppVoiceMessage';
import { formatFileSize } from '@/lib/utils/attachments';
import type { CWAttachment } from '@/types';

interface Props {
  attachments: CWAttachment[];
  isOutbound?: boolean;
}

export function MessageAttachments({ attachments, isOutbound = false }: Props) {
  return (
    <div className="mt-2 space-y-2">
      {attachments.map(att => (
        <AttachmentItem key={att.id} attachment={att} isOutbound={isOutbound} />
      ))}
    </div>
  );
}

function AttachmentItem({
  attachment,
  isOutbound = false,
}: {
  attachment: CWAttachment;
  isOutbound?: boolean;
}) {
  const type = attachment.file_type?.toLowerCase() ?? 'file';
  const url = attachment.data_url;

  if (type === 'audio' || type.startsWith('audio')) {
    return <WhatsAppVoiceMessage src={url} isOutbound={isOutbound} />;
  }

  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img
          src={attachment.thumb_url ?? url}
          alt="Attachment"
          className="rounded-md max-h-48 max-w-full object-contain border border-black/5"
        />
      </a>
    );
  }

  if (type === 'video' || type.startsWith('video')) {
    return (
      <video
        controls
        preload="metadata"
        src={url}
        className="rounded-xl max-h-56 max-w-full bg-black/5"
        playsInline
      >
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-brand-primary underline">
          Play video
        </a>
      </video>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 text-xs text-brand-primary hover:underline border rounded-md px-2 py-1.5 bg-white/60"
    >
      <FileIcon className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1">Download file</span>
      <Download className="w-3.5 h-3.5 shrink-0" />
    </a>
  );
}

export function PendingAttachmentChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const isAudio = file.type.startsWith('audio/');
  const isImage = file.type.startsWith('image/');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  return (
    <div className="flex items-center gap-2 text-xs bg-muted rounded-md px-2 py-1 border">
      {isImage && preview ? (
        <img src={preview} alt="" className="w-8 h-8 rounded object-cover" />
      ) : (
        <FileIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate max-w-[140px]" title={file.name}>
        {isAudio ? 'Voice message' : file.name}
      </span>
      <span className="text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground ms-1"
        aria-label="Remove attachment"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
