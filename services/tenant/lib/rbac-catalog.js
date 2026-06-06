/**
 * Global RBAC permission + page catalog (seeded on migration).
 * Permission keys: `{module}.{action}` e.g. `calling.receive_call`
 */

export const RBAC_ACTIONS = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'publish', label: 'Publish' },
  { key: 'export', label: 'Export' },
  { key: 'use', label: 'Use' },
  { key: 'configure', label: 'Configure' },
  { key: 'make_call', label: 'Make Call' },
  { key: 'receive_call', label: 'Receive Call' },
  { key: 'transfer_call', label: 'Transfer Call' },
  { key: 'record_call', label: 'Record Call' },
  { key: 'monitor_call', label: 'Monitor Call' },
  { key: 'assign', label: 'Assign' },
  { key: 'close', label: 'Close' },
  { key: 'send', label: 'Send' },
  { key: 'receive', label: 'Receive' },
];

export const RBAC_MODULES = [
  { key: 'dashboard', label: 'Dashboard', sortOrder: 10, actions: ['view'] },
  { key: 'users', label: 'Users', sortOrder: 20, actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'roles', label: 'Roles', sortOrder: 30, actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'queues', label: 'Queues', sortOrder: 40, actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'ivr', label: 'IVR Builder', sortOrder: 50, actions: ['view', 'create', 'edit', 'delete', 'publish'] },
  {
    key: 'calling',
    label: 'Calling',
    sortOrder: 60,
    actions: ['view', 'make_call', 'receive_call', 'transfer_call', 'record_call', 'monitor_call'],
  },
  { key: 'crm', label: 'CRM', sortOrder: 70, actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'tickets', label: 'Tickets', sortOrder: 80, actions: ['view', 'create', 'assign', 'close', 'delete'] },
  { key: 'reports', label: 'Reports', sortOrder: 90, actions: ['view', 'export'] },
  { key: 'analytics', label: 'Analytics', sortOrder: 100, actions: ['view'] },
  { key: 'whatsapp', label: 'WhatsApp', sortOrder: 90, actions: ['view', 'send', 'receive', 'configure'] },
  { key: 'chat', label: 'Chat / Inbox', sortOrder: 120, actions: ['view', 'send', 'receive'] },
  { key: 'ai', label: 'AI Features', sortOrder: 130, actions: ['view', 'use', 'configure'] },
  { key: 'settings', label: 'Settings', sortOrder: 140, actions: ['view', 'edit'] },
  { key: 'integrations', label: 'Integrations', sortOrder: 150, actions: ['view', 'configure'] },
  { key: 'audit', label: 'Audit Logs', sortOrder: 160, actions: ['view'] },
  { key: 'billing', label: 'Billing', sortOrder: 170, actions: ['view', 'edit'] },
  { key: 'workflows', label: 'Workflows', sortOrder: 180, actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'departments', label: 'Departments', sortOrder: 190, actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'teams', label: 'Teams', sortOrder: 200, actions: ['view', 'create', 'edit', 'delete'] },
];

export const RBAC_PAGES = [
  { key: 'page.dashboard', label: 'Dashboard', route: '/conversations', sortOrder: 10 },
  { key: 'page.inbox', label: 'Inbox', route: '/conversations', sortOrder: 20 },
  { key: 'page.calls', label: 'Calls', route: '/calling', sortOrder: 30 },
  { key: 'page.call_history', label: 'Call History', route: '/calling/history', sortOrder: 35 },
  { key: 'page.wallboard', label: 'Wallboard', route: '/calling/wallboard', sortOrder: 36 },
  { key: 'page.ivr', label: 'IVR Builder', route: '/calling/ivr', sortOrder: 37 },
  { key: 'page.crm', label: 'CRM / Contacts', route: '/contacts', sortOrder: 40 },
  { key: 'page.ai', label: 'AI Assist', route: '/ai', sortOrder: 45 },
  { key: 'page.tickets', label: 'Tickets', route: '/tickets', sortOrder: 50 },
  { key: 'page.reports', label: 'Reports', route: '/reports', sortOrder: 60 },
  { key: 'page.analytics', label: 'Analytics', route: '/reports', sortOrder: 65 },
  { key: 'page.sla', label: 'SLA', route: '/sla', sortOrder: 70 },
  { key: 'page.escalation', label: 'Escalation', route: '/escalation', sortOrder: 75 },
  { key: 'page.billing', label: 'Billing', route: '/billing', sortOrder: 80 },
  { key: 'page.settings', label: 'Settings', route: '/settings', sortOrder: 90 },
  { key: 'page.platform', label: 'Platform Admin', route: '/platform', sortOrder: 100 },
];

/** Flat list of all valid permission keys */
export function allPermissionKeys() {
  const out = [];
  for (const m of RBAC_MODULES) {
    for (const a of m.actions) out.push(`${m.key}.${a}`);
  }
  return out;
}

const SUPERVISOR_PERMISSIONS = [
  'dashboard.view',
  'users.view',
  'queues.view',
  'calling.view',
  'calling.monitor_call',
  'calling.receive_call',
  'crm.view',
  'tickets.view',
  'tickets.assign',
  'reports.view',
  'analytics.view',
  'chat.view',
  'chat.send',
  'chat.receive',
  'whatsapp.view',
  'ai.view',
  'ai.use',
];

const SUPERVISOR_PAGES = [
  'page.dashboard',
  'page.inbox',
  'page.calls',
  'page.call_history',
  'page.wallboard',
  'page.crm',
  'page.tickets',
  'page.ai',
  'page.reports',
  'page.analytics',
  'page.sla',
  'page.escalation',
];

/** System role templates seeded per tenant */
export const SYSTEM_ROLE_TEMPLATES = {
  tenant_admin: {
    name: 'Tenant Admin',
    description: 'Full tenant configuration access',
    roleType: 'tenant_admin',
    permissions: allPermissionKeys(),
    // page.platform is platform-operator only (see gateway PLATFORM_ADMIN_EMAILS).
    pages: RBAC_PAGES.filter((p) => p.key !== 'page.platform').map((p) => p.key),
  },
  supervisor: {
    name: 'Supervisor',
    description: 'Monitor agents, queues, and team performance',
    roleType: 'supervisor',
    permissions: SUPERVISOR_PERMISSIONS,
    pages: SUPERVISOR_PAGES,
  },
  agent: {
    name: 'Agent',
    description: 'Handle customer interactions',
    roleType: 'agent',
    permissions: [
      'dashboard.view',
      'calling.view',
      'calling.make_call',
      'calling.receive_call',
      'calling.transfer_call',
      'crm.view',
      'tickets.view',
      'tickets.create',
      'chat.view',
      'chat.send',
      'chat.receive',
      'whatsapp.view',
      'whatsapp.send',
      'whatsapp.receive',
      'ai.view',
      'ai.use',
    ],
    pages: ['page.dashboard', 'page.inbox', 'page.calls', 'page.call_history', 'page.crm', 'page.tickets', 'page.ai'],
  },
  manager: {
    name: 'Manager',
    description: 'Operations manager with extended reporting',
    roleType: 'manager',
    permissions: [
      ...SUPERVISOR_PERMISSIONS,
      'queues.edit',
      'reports.export',
      'workflows.view',
      'teams.view',
      'crm.edit',
    ],
    pages: [...SUPERVISOR_PAGES, 'page.ivr', 'page.settings'],
  },
};

export async function seedRbacCatalog(pool) {
  for (const a of RBAC_ACTIONS) {
    await pool.query(
      `INSERT INTO rbac_actions (key, label) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label`,
      [a.key, a.label],
    );
  }
  for (const m of RBAC_MODULES) {
    await pool.query(
      `INSERT INTO rbac_modules (key, label, sort_order) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order`,
      [m.key, m.label, m.sortOrder],
    );
    for (const action of m.actions) {
      await pool.query(
        `INSERT INTO rbac_module_actions (module_key, action_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [m.key, action],
      );
    }
  }
  for (const p of RBAC_PAGES) {
    await pool.query(
      `INSERT INTO rbac_pages (key, label, route, sort_order) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, route = EXCLUDED.route, sort_order = EXCLUDED.sort_order`,
      [p.key, p.label, p.route, p.sortOrder],
    );
  }
}
