<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import BlinkoneFeatureGate from 'dashboard/blinkone_components/BlinkoneFeatureGate.vue';

const { t } = useI18n();
const { sla } = useBlinkoneApi();
const policies = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    policies.value = await sla.listPolicies();
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = false;
  }
}

async function seedGold() {
  try {
    await sla.createPolicy({
      name: 'Gold',
      isDefault: true,
      targets: [
        { targetType: 'first_response', thresholdMinutes: 15, appliesWhen: { priority: ['urgent', 'high'] } },
        { targetType: 'resolution', thresholdMinutes: 240, appliesWhen: {} },
      ],
    });
    useAlert(t('BLINKONE.SLA.POLICY_CREATED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <BlinkoneFeatureGate feature="sla">
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.SLA.POLICIES.TITLE')"
      :description="t('BLINKONE.SLA.POLICIES.DESCRIPTION')"
    />
    <div class="flex gap-2 mb-4">
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
      <Button :label="t('BLINKONE.SLA.POLICIES.ADD_GOLD')" @click="seedGold" />
    </div>
    <div v-for="p in policies" :key="p.id" class="rounded-lg border border-n-weak p-4 mb-3">
      <div class="font-medium">{{ p.name }} <span v-if="p.isDefault" class="text-xs text-n-amber-11">default</span></div>
      <div class="text-xs text-n-slate-11 mt-2">
        {{ (p.targets || []).map(tg => `${tg.targetType} ${tg.thresholdMinutes}m`).join(' | ') || '—' }}
      </div>
    </div>
    <p v-if="!policies.length && !loading" class="text-sm text-n-slate-11">{{ t('BLINKONE.SLA.POLICIES.EMPTY') }}</p>
  </SettingsLayout>
  </BlinkoneFeatureGate>
</template>
