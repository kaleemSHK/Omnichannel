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
const { integration } = useBlinkoneApi();
const events = ref([]);
const total = ref(0);
const filters = ref({ action: '', actor_id: '', from: '', to: '' });

async function load() {
  try {
    const q = { ...filters.value };
    Object.keys(q).forEach(k => {
      if (!q[k]) delete q[k];
    });
    const r = await integration.listAudit(q);
    events.value = r.events ?? [];
    total.value = r.total ?? 0;
  } catch (e) {
    useAlert(e.message);
  }
}

async function exportCsv() {
  try {
    await integration.exportAuditCsv(filters.value);
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <BlinkoneFeatureGate feature="audit">
    <SettingsLayout>
      <BaseSettingsHeader :title="t('BLINKONE.AUDIT.TITLE')" :description="t('BLINKONE.AUDIT.DESCRIPTION')" />
      <div class="flex flex-wrap gap-2 mb-4">
        <input v-model="filters.action" class="rounded border border-n-weak px-2 py-1 text-sm" placeholder="action" />
        <input v-model="filters.actor_id" class="rounded border border-n-weak px-2 py-1 text-sm" placeholder="actor" />
        <input v-model="filters.from" type="datetime-local" class="rounded border border-n-weak px-2 py-1 text-sm" />
        <input v-model="filters.to" type="datetime-local" class="rounded border border-n-weak px-2 py-1 text-sm" />
        <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
        <Button :label="t('BLINKONE.AUDIT.EXPORT')" @click="exportCsv" />
      </div>
      <p class="text-xs text-n-slate-11 mb-2">{{ total }} {{ t('BLINKONE.AUDIT.EVENTS') }}</p>
      <ul class="space-y-2 text-sm max-h-96 overflow-y-auto">
        <li v-for="e in events" :key="e.id" class="border-b border-n-weak py-2">
          <span class="font-medium">{{ e.action }}</span>
          <span class="text-n-slate-11"> · {{ e.actor_id }} · {{ e.target_type }}/{{ e.target_id }}</span>
          <span class="block text-xs text-n-slate-11">{{ e.occurred_at }}</span>
        </li>
      </ul>
    </SettingsLayout>
  </BlinkoneFeatureGate>
</template>
