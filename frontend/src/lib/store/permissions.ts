import { create } from 'zustand';

export interface EffectiveRbac {
  permissions: string[];
  pages: string[];
  roles: { id?: string; name: string; roleType: string }[];
  source?: string;
}

interface PermissionsState {
  effective: EffectiveRbac | null;
  setEffective: (effective: EffectiveRbac | null) => void;
  clear: () => void;
  hasPermission: (key: string) => boolean;
  hasPage: (pageKey: string) => boolean;
  canAccessPath: (pathname: string) => boolean;
}

const PAGE_ROUTES: Record<string, string> = {
  'page.dashboard': '/conversations',
  'page.inbox': '/conversations',
  'page.calls': '/calling',
  'page.call_history': '/calling/history',
  'page.wallboard': '/calling/wallboard',
  'page.ivr': '/calling/ivr',
  'page.crm': '/contacts',
  'page.ai': '/ai',
  'page.tickets': '/tickets',
  'page.reports': '/reports',
  'page.analytics': '/reports',
  'page.sla': '/sla',
  'page.escalation': '/escalation',
  'page.billing': '/billing',
  'page.settings': '/settings',
  'page.platform': '/platform',
};

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  effective: null,

  setEffective: effective => set({ effective }),

  clear: () => set({ effective: null }),

  hasPermission: key => {
    const perms = get().effective?.permissions;
    if (!perms?.length) return false;
    return perms.includes(key);
  },

  hasPage: pageKey => {
    const pages = get().effective?.pages;
    if (!pages?.length) return true;
    return pages.includes(pageKey);
  },

  canAccessPath: pathname => {
    const pages = get().effective?.pages;
    if (!pages?.length) return true;
    const allowedRoutes = pages
      .map(k => PAGE_ROUTES[k])
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!allowedRoutes.length) return true;
    const match = allowedRoutes.find(r => pathname.startsWith(r));
    if (!match) return true;
    const pageKey = Object.entries(PAGE_ROUTES).find(([, route]) => route === match)?.[0];
    return pageKey ? pages.includes(pageKey) : true;
  },
}));

export function hydratePermissionsFromJwt(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (Array.isArray(payload.permissions) || Array.isArray(payload.pages)) {
      usePermissionsStore.getState().setEffective({
        permissions: payload.permissions ?? [],
        pages: payload.pages ?? [],
        roles: [],
        source: 'jwt',
      });
    }
  } catch {
    /* ignore */
  }
}

export function hydratePermissionsFromLogin(body: {
  permissions?: string[];
  pages?: string[];
  rbacRoles?: { id?: string; name: string; roleType: string }[];
}) {
  if (!body.permissions?.length && !body.pages?.length) return;
  usePermissionsStore.getState().setEffective({
    permissions: body.permissions ?? [],
    pages: body.pages ?? [],
    roles: body.rbacRoles ?? [],
    source: 'login',
  });
}
