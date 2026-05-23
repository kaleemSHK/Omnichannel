#!/usr/bin/env node
/**
 * Patches upstream Chatwoot CE (in Docker build) for BlinkOne telephony admin routes.
 * Run after overlay COPY, before assets:precompile.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = process.env.CHATWOOT_ROOT || '/app';
const MARK = 'BLINKONE_TELEPHONY';

function patchSettingsRoutes() {
  const path = `${ROOT}/app/javascript/dashboard/routes/dashboard/settings/settings.routes.js`;
  let src = readFileSync(path, 'utf8');
  if (src.includes(MARK)) {
    console.log('settings.routes.js already patched');
    return;
  }
  src = src.replace(
    "import captain from './captain/captain.routes';",
    `import captain from './captain/captain.routes';\nimport blinkone from './blinkone/blinkone.routes'; // ${MARK}`,
  );
  src = src.replace(
    '...captain.routes,',
    `...captain.routes,\n    ...blinkone.routes, // ${MARK}`,
  );
  writeFileSync(path, src);
  console.log('patched settings.routes.js');
}

function patchSidebar() {
  const path = `${ROOT}/app/javascript/dashboard/components-next/sidebar/Sidebar.vue`;
  if (!existsSync(path)) {
    console.warn('Sidebar.vue not found — skip sidebar patch');
    return;
  }
  let src = readFileSync(path, 'utf8');
  if (src.includes(MARK)) {
    console.log('Sidebar.vue already patched');
    return;
  }
  const needle = `{
          name: 'Settings Security',
          label: t('SIDEBAR.SECURITY'),
          icon: 'i-lucide-shield',
          to: accountScopedRoute('security_settings_index'),
        },`;
  const insert = `{
          name: 'Settings BlinkOne IVR',
          label: t('SIDEBAR.BLINKONE_IVR'),
          icon: 'i-lucide-phone',
          to: accountScopedRoute('blinkone_ivr_admin'),
        },
        {
          name: 'Settings BlinkOne Routing',
          label: t('SIDEBAR.BLINKONE_ROUTING'),
          icon: 'i-lucide-git-branch',
          to: accountScopedRoute('blinkone_routing_admin'),
        },
        {
          name: 'Settings BlinkOne Realtime',
          label: t('SIDEBAR.BLINKONE_REALTIME'),
          icon: 'i-lucide-activity',
          to: accountScopedRoute('blinkone_telephony_realtime'),
        },
        {
          name: 'Settings BlinkOne Reports',
          label: t('SIDEBAR.BLINKONE_REPORTS'),
          icon: 'i-lucide-bar-chart-2',
          to: accountScopedRoute('blinkone_telephony_reports'),
        },
        {
          name: 'Settings BlinkOne Live Calls',
          label: 'Live calls',
          icon: 'i-lucide-phone-call',
          to: accountScopedRoute('blinkone_telephony_calls'),
        },
        {
          name: 'Settings BlinkOne Phone',
          label: t('SIDEBAR.BLINKONE_PHONE'),
          icon: 'i-lucide-headphones',
          to: accountScopedRoute('blinkone_phone_panel'),
        },
        {
          name: 'Settings BlinkOne SLA Policies',
          label: t('SIDEBAR.BLINKONE_SLA_POLICIES'),
          icon: 'i-lucide-timer',
          to: accountScopedRoute('blinkone_sla_policies'),
        },
        {
          name: 'Settings BlinkOne SLA Dashboard',
          label: t('SIDEBAR.BLINKONE_SLA_DASHBOARD'),
          icon: 'i-lucide-alert-triangle',
          to: accountScopedRoute('blinkone_sla_dashboard'),
        },
        {
          name: 'Settings BlinkOne Escalations',
          label: t('SIDEBAR.BLINKONE_ESCALATIONS'),
          icon: 'i-lucide-zap',
          to: accountScopedRoute('blinkone_escalations'),
        },
        {
          name: 'Settings BlinkOne SSO',
          label: t('SIDEBAR.BLINKONE_SSO'),
          icon: 'i-lucide-key-round',
          to: accountScopedRoute('blinkone_admin_sso'),
        },
        {
          name: 'Settings BlinkOne Audit',
          label: t('SIDEBAR.BLINKONE_AUDIT'),
          icon: 'i-lucide-scroll-text',
          to: accountScopedRoute('blinkone_admin_audit'),
        },
        ${needle}`;
  if (!src.includes(needle)) {
    console.warn('Sidebar.vue needle not found — skip sidebar patch');
    return;
  }
  src = src.replace(needle, insert);
  writeFileSync(path, src);
  console.log('patched Sidebar.vue');
}

function patchRailsRoutes() {
  const path = `${ROOT}/config/routes.rb`;
  let src = readFileSync(path, 'utf8');
  if (src.includes('draw :blinkone')) {
    console.log('routes.rb already draws blinkone');
    return;
  }
  const needle = "resources :widget_tests, only: [:index] unless Rails.env.production?";
  if (src.includes(needle)) {
    src = src.replace(
      needle,
      `${needle}\n\n  draw :blinkone # ${MARK}`,
    );
  } else {
    src = src.replace(/\nend\s*$/, `\n  draw :blinkone # ${MARK}\nend\n`);
  }
  writeFileSync(path, src);
  console.log('patched config/routes.rb');
}

function patchDashboardRoutes() {
  const path = `${ROOT}/app/javascript/dashboard/routes/dashboard/dashboard.routes.js`;
  if (!existsSync(path)) {
    console.warn('dashboard.routes.js not found — skip auth routes patch');
    return;
  }
  let src = readFileSync(path, 'utf8');
  if (src.includes('blinkone/auth.routes')) {
    console.log('dashboard.routes.js already patched for auth');
    return;
  }
  const importNeedle = "import settings from './settings/settings.routes';";
  if (src.includes(importNeedle)) {
    src = src.replace(
      importNeedle,
      `${importNeedle}\nimport blinkoneAuth from './blinkone/auth.routes'; // ${MARK}`,
    );
  } else {
    src = `import blinkoneAuth from './blinkone/auth.routes'; // ${MARK}\n${src}`;
  }
  const routesNeedle = '...settings.routes,';
  if (src.includes(routesNeedle)) {
    src = src.replace(routesNeedle, `${routesNeedle}\n    ...blinkoneAuth.routes, // ${MARK}`);
  } else {
    src = src.replace(/routes:\s*\[/, `routes: [\n    ...blinkoneAuth.routes, // ${MARK}`);
  }
  writeFileSync(path, src);
  console.log('patched dashboard.routes.js');
}

patchSettingsRoutes();
patchDashboardRoutes();
patchSidebar();
patchRailsRoutes();
console.log('BlinkOne telephony patch complete');
