import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import IntegrationsAdmin from 'dashboard/blinkone_components/admin/integrations/Index.vue';
import SsoAdmin from 'dashboard/blinkone_components/admin/sso/Index.vue';
import AuditAdmin from 'dashboard/blinkone_components/admin/audit/Index.vue';
import WebhooksAdmin from 'dashboard/blinkone_components/admin/webhooks/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/admin/integrations'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_admin_integrations', component: IntegrationsAdmin }],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/admin/sso'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_admin_sso', component: SsoAdmin }],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/admin/audit'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_admin_audit', component: AuditAdmin }],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/admin/webhooks'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_admin_webhooks', component: WebhooksAdmin }],
    },
  ],
};
