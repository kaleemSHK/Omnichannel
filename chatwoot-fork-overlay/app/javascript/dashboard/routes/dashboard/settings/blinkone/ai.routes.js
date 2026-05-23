import { frontendURL } from '../../../../helper/URLHelper';
import SettingsWrapper from '../SettingsWrapper.vue';
import KnowledgeBase from 'dashboard/blinkone_components/ai/knowledge-base/Index.vue';

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/blinkone/ai/knowledge-base'),
      component: SettingsWrapper,
      meta: { permissions: ['administrator'] },
      children: [{ path: '', name: 'blinkone_ai_knowledge_base', component: KnowledgeBase }],
    },
  ],
};
