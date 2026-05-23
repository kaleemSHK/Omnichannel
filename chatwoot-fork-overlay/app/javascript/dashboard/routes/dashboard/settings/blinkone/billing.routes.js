import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import TenantBilling from 'dashboard/blinkone_components/admin/billing/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/admin/billing'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_admin_billing', component: TenantBilling }],
    },
  ],
};
