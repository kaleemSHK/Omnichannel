import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import TelephonyRealtime from 'dashboard/blinkone_components/telephony/realtime/Index.vue';
import TelephonyReports from 'dashboard/blinkone_components/telephony/reports/Index.vue';
import PhonePanel from 'dashboard/blinkone_components/PhonePanel/PhonePanel.vue';
import TelephonyCallsMonitor from 'dashboard/blinkone_components/telephony/calls/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/telephony/realtime'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [
        {
          path: '',
          name: 'blinkone_telephony_realtime',
          component: TelephonyRealtime,
          meta: { permissions: ['administrator'] },
        },
      ],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/telephony/reports'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [
        {
          path: '',
          name: 'blinkone_telephony_reports',
          component: TelephonyReports,
          meta: { permissions: ['administrator'] },
        },
      ],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/telephony/calls'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [
        {
          path: '',
          name: 'blinkone_telephony_calls',
          component: TelephonyCallsMonitor,
          meta: { permissions: ['administrator'] },
        },
      ],
    },
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/phone'),
      component: SettingsWrapper,
      children: [
        {
          path: '',
          name: 'blinkone_phone_panel',
          component: PhonePanel,
          meta: { permissions: ['administrator', 'agent'] },
        },
      ],
    },
  ],
};
