<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const route = useRoute();
const { integration } = useBlinkoneApi();
const connectors = ref([]);
const types = ref([]);
const form = ref({ connectorType: 'generic_rest', name: '', config: { baseUrl: '' } });

async function load() {
  try {
    connectors.value = await integration.listConnectors();
    types.value = await integration.listConnectorTypes();
  } catch (e) {
    useAlert(e.message);
  }
}

async function save() {
  try {
    await integration.upsertConnector(form.value.connectorType, form.value);
    useAlert(t('BLINKONE.INTEGRATIONS.SAVED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function test(type) {
  try {
    const r = await integration.testConnector(type);
    useAlert(r.ok ? t('BLINKONE.INTEGRATIONS.TEST_OK') : (r.detail || 'Failed'));
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.INTEGRATIONS.TITLE')"
      :description="t('BLINKONE.INTEGRATIONS.DESCRIPTION')"
    />
    <div class="rounded-lg border border-n-weak p-4 mb-4 space-y-2">
      <select v-model="form.connectorType" class="w-full rounded border border-n-weak px-3 py-2 text-sm">
        <option v-for="ty in types" :key="ty" :value="ty">{{ ty }}</option>
      </select>
      <input v-model="form.config.baseUrl" class="w-full rounded border border-n-weak px-3 py-2 text-sm" placeholder="https://erp.example.om/api" />
      <Button :label="t('BLINKONE.INTEGRATIONS.SAVE')" @click="save" />
    </div>
    <ul class="space-y-2 text-sm">
      <li v-for="c in connectors" :key="c.id" class="flex justify-between border border-n-weak rounded px-3 py-2">
        <span>{{ c.connectorType }} — {{ c.status }}</span>
        <Button size="sm" :label="t('BLINKONE.INTEGRATIONS.TEST')" @click="test(c.connectorType)" />
      </li>
    </ul>
  </SettingsLayout>
</template>
