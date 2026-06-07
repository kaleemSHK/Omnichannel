/** Extract plain text from uploaded knowledge-base files (server-side). */

export function isPlaceholderContent(content) {
  return !content || String(content).trim().startsWith('[binary upload');
}

export async function extractDocumentText({ source_type, source_ref, content, file_base64 }) {
  const trimmed = String(content ?? '').trim();
  if (trimmed && !isPlaceholderContent(trimmed)) return trimmed;

  const ext = String(source_type || source_ref?.split('.').pop() || '')
    .toLowerCase()
    .replace(/^.*\./, '');

  if (!file_base64) {
    if (isPlaceholderContent(trimmed)) {
      throw new Error(
        `No text extracted from "${source_ref}". Upload .txt/.md/.docx with readable content.`,
      );
    }
    return trimmed;
  }

  const buf = Buffer.from(String(file_base64), 'base64');

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const text = String(value ?? '').trim();
    if (!text) throw new Error(`DOCX "${source_ref}" contains no extractable text.`);
    return text;
  }

  if (ext === 'txt' || ext === 'md' || ext === 'markdown' || ext === 'plain_text') {
    return buf.toString('utf8').trim();
  }

  throw new Error(`Unsupported document type "${ext}" for "${source_ref}". Use .txt, .md, or .docx.`);
}
