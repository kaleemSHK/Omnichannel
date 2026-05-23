<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapGetter } from 'dashboard/composables/store';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import { useJsSipAgent } from 'dashboard/blinkone_components/Calling/useJsSipAgent';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const { routing, tenantId, callingPstnEnabled } = useBlinkoneApi();
const currentUser = useMapGetter('getCurrentUser');

const agentId = computed(() => String(currentUser.value?.id ?? 'agent'));
const status = ref('offline');
const realtime = ref(null);
const { registered: sipReady, error: sipError, connect: connectSip } = useJsSipAgent(agentId);

async function setStatus(next) {
  status.value = next;
  await routing.setAgentState(agentId.value, { status: next });
}

async function refresh() {
  realtime.value = await routing.realtime();
}

onMounted(async () => {
  try {
    await routing.registerAgent({
      agentId: agentId.value,
      displayName: currentUser.value?.name,
      skills: ['sales', 'support'],
      queueKeys: ['sales', 'support', 'default'],
      status: 'available',
    });
    status.value = 'available';
    await refresh();
    if (callingPstnEnabled.value) await connectSip();
  } catch {
    /* already registered */
  }
});
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.TELEPHONY.PHONE.TITLE')"
      :description="t('BLINKONE.TELEPHONY.PHONE.DESCRIPTION')"
    />
    <p class="text-sm text-n-slate-11 mb-4">
      {{ t('BLINKONE.TELEPHONY.PHONE.AGENT_ID') }}: {{ agentId }} | {{ t('BLINKONE.TELEPHONY.PHONE.TENANT') }}: {{ tenantId }}
    </p>
    <div class="flex flex-wrap gap-2 mb-6">
      <Button
        v-for="s in ['available', 'busy', 'away', 'offline']"
        :key="s"
        size="sm"
        :variant="status === s ? 'solid' : 'ghost'"
        :label="s"
        @click="setStatus(s)"
      />
    </div>
    <div v-if="realtime" class="rounded-lg border border-n-weak p-4 mb-4 text-sm">
      <div>{{ t('BLINKONE.TELEPHONY.ROUTING.WAITING') }}: {{ realtime.totalWaiting }}</div>
      <div>{{ t('BLINKONE.TELEPHONY.ROUTING.AVAILABLE') }}: {{ realtime.agents?.available }}</div>
    </div>
    <div class="rounded-lg border border-dashed border-n-weak p-6 text-center text-sm text-n-slate-11">
      <p>{{ t('BLINKONE.TELEPHONY.PHONE.SIP_PLACEHOLDER') }}</p>
      <p v-if="sipReady" class="mt-2 text-xs text-n-teal-11">{{ t('BLINKONE.TELEPHONY.PHONE.SIP_CONNECTED') }}</p>
      <p v-else class="mt-2 text-xs">{{ sipError || t('BLINKONE.TELEPHONY.PHONE.SIP_HINT') }}</p>
    </div>
  </SettingsLayout>
</template>
