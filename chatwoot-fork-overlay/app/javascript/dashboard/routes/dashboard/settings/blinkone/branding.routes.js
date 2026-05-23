import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import BrandingAdmin from 'dashboard/blinkone_components/branding/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/branding'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_branding_admin', component: BrandingAdmin }],
    },
  ],
};
