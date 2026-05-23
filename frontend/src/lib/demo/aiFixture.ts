import type { RagCollection, RagDocument, RagQueryResult } from '@/lib/utils/ai';

export const DEMO_AI_COLLECTIONS: RagCollection[] = [
  { id: 'col-faq', name: 'Product FAQ', docCount: 5 },
  { id: 'col-billing', name: 'Billing policies', docCount: 3 },
  { id: 'col-troubleshoot', name: 'Troubleshooting guides', docCount: 4 },
];

export const DEMO_AI_DOCUMENTS: RagDocument[] = [
  {
    id: 'doc-1',
    collectionId: 'col-faq',
    name: 'Home_Internet_Plans_2025.pdf',
    type: 'pdf',
    sizeBytes: 2_450_000,
    pageCount: 12,
    uploadedAt: '2025-04-02T09:00:00Z',
    status: 'indexed',
  },
  {
    id: 'doc-2',
    collectionId: 'col-faq',
    name: 'Fiber_Coverage_Map.pdf',
    type: 'pdf',
    sizeBytes: 8_100_000,
    pageCount: 4,
    uploadedAt: '2025-04-10T14:30:00Z',
    status: 'indexed',
  },
  {
    id: 'doc-3',
    collectionId: 'col-faq',
    name: 'WhatsApp_Support_Scripts.md',
    type: 'md',
    sizeBytes: 24_000,
    uploadedAt: '2025-05-01T11:00:00Z',
    status: 'indexing',
  },
  {
    id: 'doc-4',
    collectionId: 'col-billing',
    name: 'Invoice_Dispute_Process.docx',
    type: 'docx',
    sizeBytes: 156_000,
    uploadedAt: '2025-03-18T08:00:00Z',
    status: 'indexed',
  },
  {
    id: 'doc-5',
    collectionId: 'col-billing',
    name: 'OMR_Pricing_Matrix.xlsx',
    type: 'xlsx',
    sizeBytes: 89_000,
    uploadedAt: '2025-03-20T10:15:00Z',
    status: 'error',
    errorMessage: 'Parser failed: unsupported sheet format in row 42',
  },
  {
    id: 'doc-6',
    collectionId: 'col-troubleshoot',
    name: 'Router_Reset_Guide.pdf',
    type: 'pdf',
    sizeBytes: 512_000,
    pageCount: 2,
    uploadedAt: '2025-02-28T16:00:00Z',
    status: 'indexed',
  },
];

export const DEMO_RAG_RESULTS: RagQueryResult[] = [
  {
    id: 'chunk-1',
    excerpt:
      'Home Fiber 500 offers up to 500 Mbps download with unlimited data. Installation is free for new subscribers in Muscat governorate.',
    score: 0.94,
    filename: 'Home_Internet_Plans_2025.pdf',
    page: 3,
    collectionId: 'col-faq',
  },
  {
    id: 'chunk-2',
    excerpt:
      'To upgrade from Fiber 200 to Fiber 500, the customer must have an active contract with no outstanding balance. Upgrades are processed within 24 hours.',
    score: 0.87,
    filename: 'Home_Internet_Plans_2025.pdf',
    page: 7,
    collectionId: 'col-faq',
  },
  {
    id: 'chunk-3',
    excerpt:
      'Coverage for Al Khoud and Bausher is available on the 2025 fiber rollout map. Pre-orders open when the zone status is marked green.',
    score: 0.81,
    filename: 'Fiber_Coverage_Map.pdf',
    page: 1,
    collectionId: 'col-faq',
  },
];
