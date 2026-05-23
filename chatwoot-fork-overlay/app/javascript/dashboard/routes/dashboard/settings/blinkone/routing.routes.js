import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import RoutingAdminIndex from 'dashboard/blinkone_components/telephony/routing/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/routing'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [
        {
          path: '',
          name: 'blinkone_routing_admin',
          component: RoutingAdminIndex,
          meta: { permissions: ['administrator'] },
        },
      ],
    },
  ],
};
