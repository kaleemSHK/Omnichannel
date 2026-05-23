<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const { integration } = useBlinkoneApi();
const endpoints = ref([]);
const deliveries = ref([]);
const form = ref({ name: '', url: '', eventsSubscribed: ['*'] });
const lastSecret = ref('');

async function load() {
  try {
    endpoints.value = await integration.listWebhooks();
    deliveries.value = await integration.listDeliveries();
  } catch (e) {
    useAlert(e.message);
  }
}

async function create() {
  try {
    const r = await integration.createWebhook(form.value);
    lastSecret.value = r.secret || '';
    useAlert(t('BLINKONE.WEBHOOKS.CREATED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function test(id) {
  try {
    await integration.testWebhook(id);
    useAlert(t('BLINKONE.WEBHOOKS.TEST_SENT'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader :title="t('BLINKONE.WEBHOOKS.TITLE')" :description="t('BLINKONE.WEBHOOKS.DESCRIPTION')" />
    <div class="rounded-lg border border-n-weak p-4 mb-4 space-y-2">
      <input v-model="form.name" class="w-full rounded border border-n-weak px-3 py-2 text-sm" placeholder="Name" />
      <input v-model="form.url" class="w-full rounded border border-n-weak px-3 py-2 text-sm" placeholder="https://..." />
      <Button :label="t('BLINKONE.WEBHOOKS.ADD')" @click="create" />
      <p v-if="lastSecret" class="text-xs text-n-ruby-11">Secret (copy now): {{ lastSecret }}</p>
    </div>
    <ul class="space-y-2 text-sm mb-6">
      <li v-for="ep in endpoints" :key="ep.id" class="flex justify-between border border-n-weak rounded px-3 py-2">
        <span>{{ ep.name }} → {{ ep.url }}</span>
        <Button size="sm" :label="t('BLINKONE.WEBHOOKS.TEST')" @click="test(ep.id)" />
      </li>
    </ul>
    <h3 class="text-sm font-medium mb-2">{{ t('BLINKONE.WEBHOOKS.DELIVERIES') }}</h3>
    <ul class="text-xs space-y-1 max-h-48 overflow-y-auto">
      <li v-for="d in deliveries" :key="d.id">{{ d.eventType }} — {{ d.status }} ({{ d.attempt }})</li>
    </ul>
  </SettingsLayout>
</template>
