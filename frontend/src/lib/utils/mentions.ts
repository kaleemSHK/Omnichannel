/** Chatwoot private-note mention token (see Messages::MentionService). */
export function formatAgentMention(agent: { id: number; name: string }): string {
  return `[@${agent.name}](mention://user/${agent.id}/${agent.name})`;
}

export interface MentionSegment {
  type: 'text' | 'mention';
  value: string;
}

const MENTION_RE = /\[@([^\]]+)\]\(mention:\/\/user\/(\d+)\/[^)]+\)/g;

export function parseMentionSegments(content: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'mention', value: match[1] ?? '' });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: 'text', value: content }];
}

/** True when the cursor is in an active @-mention token on the last line. */
export function activeMentionQuery(lastLine: string): string | null {
  const atIdx = lastLine.lastIndexOf('@');
  if (atIdx === -1) return null;
  const afterAt = lastLine.slice(atIdx + 1);
  if (afterAt.includes(' ') || afterAt.includes('](')) return null;
  const slashAfterAt = afterAt.indexOf('/');
  if (slashAfterAt === 0) return null;
  return afterAt;
}
