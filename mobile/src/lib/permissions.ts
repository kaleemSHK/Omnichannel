import { create } from 'zustand';

const PAGE_ROUTES: Record<string, string> = {
  'page.dashboard': 'Home',
  'page.inbox': 'Conversations',
  'page.calls': 'Calls',
  'page.crm': 'Contacts',
  'page.tickets': 'Tickets',
  'page.reports': 'Reports',
  'page.settings': 'Settings',
};

interface PermissionsState {
  permissions: string[];
  pages: string[];
  setEffective: (permissions: string[], pages: string[]) => void;
  clear: () => void;
  hasPermission: (key: string) => boolean;
  hasPageKey: (key: string) => boolean;
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  permissions: [],
  pages: [],

  setEffective: (permissions, pages) => set({ permissions, pages }),

  clear: () => set({ permissions: [], pages: [] }),

  hasPermission: key => {
    const perms = get().permissions;
    if (!perms.length) return false;
    return perms.includes(key);
  },

  hasPageKey: key => {
    const pages = get().pages;
    if (!pages.length) return true;
    return pages.includes(key);
  },
}));

export function hydratePermissionsFromJwt(token: string) {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { permissions?: string[]; pages?: string[] };
    if (Array.isArray(payload.permissions) || Array.isArray(payload.pages)) {
      usePermissionsStore.getState().setEffective(payload.permissions ?? [], payload.pages ?? []);
    }
  } catch {
    /* ignore */
  }
}

export function hydratePermissionsFromLogin(body: {
  permissions?: string[];
  pages?: string[];
}) {
  if (body.permissions?.length || body.pages?.length) {
    usePermissionsStore.getState().setEffective(body.permissions ?? [], body.pages ?? []);
  }
}

export { PAGE_ROUTES };
