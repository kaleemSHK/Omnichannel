import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import EscalationRules from 'dashboard/blinkone_components/escalation/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/escalations'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_escalations', component: EscalationRules }],
    },
  ],
};
