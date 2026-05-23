import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import SlaPolicies from 'dashboard/blinkone_components/sla/policies/Index.vue';
import SlaCalendars from 'dashboard/blinkone_components/sla/calendars/Index.vue';
import SlaDashboard from 'dashboard/blinkone_components/sla/dashboard/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/sla/policies'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_sla_policies', component: SlaPolicies }],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/sla/calendars'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_sla_calendars', component: SlaCalendars }],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/sla/dashboard'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_sla_dashboard', component: SlaDashboard }],
    },
  ],
};
