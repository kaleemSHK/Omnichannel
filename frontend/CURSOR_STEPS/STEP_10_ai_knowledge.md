# STEP 10 — AI Knowledge Base
> Paste this entire prompt into Cursor Composer. Do NOT move to STEP 11 until all checks pass.

## What to build

```
src/app/(dashboard)/ai/page.tsx
src/components/ai/CollectionsSidebar.tsx
src/components/ai/DocumentList.tsx
src/components/ai/DocumentListItem.tsx
src/components/ai/QueryTester.tsx
src/components/ai/RAGResultCard.tsx
src/components/ai/UploadDocumentModal.tsx
```

## Layout

```
[IconSidebar] | [190px collections-sidebar] | [flex-1 documents-panel] | [280px query-tester]
```

## Collections sidebar

From `listCollections()` — `GET /api/ai/v1/collections`.

Each collection item:
- Folder icon (`FolderOpen` lucide)
- Collection name (font-medium)
- Doc count (muted, right-aligned)
- Selected: bg-blue-50 text-brand-primary
- Click → loads that collection's documents in the docs panel

"New collection" dashed button at bottom:
- Inline text input appears on click → on Enter: `createCollection({ name })` → `invalidateQueries(['collections'])`

## Documents panel

TopBar:
- Search input (client-side filter on document name)
- "Upload" blue button with `Upload` icon → opens `UploadDocumentModal`

Document list from `listDocuments(collectionId)`:

Each `DocumentListItem`:
- File type icon (PDF=red, XLSX=green, MD=blue, DOCX=indigo, default=gray) — use lucide `FileText`
- File name (font-medium, truncate)
- Meta: `{type} · {size} · {page count if PDF} · {upload date}`
- Index status chip (right side):
  - `Indexed` = green badge
  - `Indexing…` = amber badge + spinning loader icon
  - `Error` = red badge with hover tooltip showing error message
- Click → (future) opens doc preview drawer, for now just highlights selected

**Empty state:** "No documents in this collection. Upload your first document."

## UploadDocumentModal (shadcn Dialog)

- Drag-and-drop zone: dashed border, upload icon, "Drop files here or click to browse"
- Accepted types: PDF, DOCX, XLSX, TXT, MD
- Max size: 50MB per file
- On file select: show file name + size
- "Start upload" button:
  - `POST /api/ai/v1/collections/{collectionId}/documents` with `multipart/form-data`
  - Progress bar while uploading
  - On success: close modal + `invalidateQueries(['documents', collectionId])`
- Handles multiple files (queue them one by one)

## QueryTester panel

From the `suggestReply` / `queryRAG` endpoints.

**Form:**
- "Ask a question" `<Textarea>` (3 rows)
- Collection select (shows all collections as options)
- Top K results (number input, default 3, range 1-10)
- "Run query" blue button

On submit: `queryRAG({ collection_id, query, top_k })` from `src/lib/api/ai.ts`

**Results:**
For each result in response: render `RAGResultCard`

**RAGResultCard:**
- Score badge: blue, "XX% match" (e.g. 94% match)
- Chunk text (text-sm, max 4 lines, `line-clamp-4`)
- Source line: `{filename} · page {page}` in muted text-xs
- "Insert to reply" button (only visible when a conversation is selected in the store)

---

## Acceptance checklist — verify before STEP 11
- [ ] Collections sidebar loads and selecting one filters documents
- [ ] "New collection" inline input creates a collection on Enter
- [ ] Document list shows correct index status badges
- [ ] Upload modal accepts drag-and-drop + shows progress
- [ ] Query tester returns results with correct scores
- [ ] No TypeScript errors

✅ Only proceed to STEP 11 once all boxes are checked.
