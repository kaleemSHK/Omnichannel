import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import IvrAdminIndex from 'dashboard/blinkone_components/telephony/ivr/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/ivr'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [
        {
          path: '',
          name: 'blinkone_ivr_admin',
          component: IvrAdminIndex,
          meta: { permissions: ['administrator'] },
        },
      ],
    },
  ],
};
