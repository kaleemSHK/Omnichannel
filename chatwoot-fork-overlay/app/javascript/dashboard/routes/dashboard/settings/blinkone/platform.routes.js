import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import PlatformTenants from 'dashboard/blinkone_components/platform/tenants/Index.vue';
import PlatformTenantDetail from 'dashboard/blinkone_components/platform/tenants/Detail.vue';
import PlatformBilling from 'dashboard/blinkone_components/platform/billing/Index.vue';
import PlatformPlans from 'dashboard/blinkone_components/platform/plans/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/platform/billing'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_platform_billing', component: PlatformBilling }],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/platform/plans'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_platform_plans', component: PlatformPlans }],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/platform/tenants'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [
        { path: '', name: 'blinkone_platform_tenants', component: PlatformTenants },
        {
          path: ':tenantId',
          name: 'blinkone_platform_tenant_detail',
          component: PlatformTenantDetail,
        },
      ],
    },
  ],
};
