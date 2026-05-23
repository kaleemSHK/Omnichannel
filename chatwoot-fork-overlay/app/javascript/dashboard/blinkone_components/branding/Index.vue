<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const route = useRoute();
const { platform, tenantId } = useBlinkoneApi();
const brand = ref({ product_name: '', primary_color: '#0B5FFF', custom_css: '' });
const subdomain = ref('');
const newDomain = ref('');
const domains = ref([]);
const previewStyle = computed(() => ({
  '--blinkone-primary': brand.value.primary_color || '#0B5FFF',
}));

async function load() {
  try {
    const b = await platform.getBranding(tenantId.value);
    brand.value = { ...brand.value, ...(b.brand || {}) };
    subdomain.value = b.subdomain || '';
    domains.value = await platform.listDomains(tenantId.value);
  } catch (e) {
    useAlert(e.message);
  }
}

async function save() {
  const css = (brand.value.custom_css || '').replace(/<\/style/gi, '');
  try {
    await platform.patchBranding(tenantId.value, {
      brand: { ...brand.value, custom_css: css },
      subdomain: subdomain.value,
    });
    useAlert(t('BLINKONE.BRANDING.SAVED'));
  } catch (e) {
    useAlert(e.message);
  }
}

async function addDomain() {
  if (!newDomain.value.trim()) return;
  try {
    await platform.addDomain(tenantId.value, { domain: newDomain.value.trim(), isPrimary: false });
    newDomain.value = '';
    await load();
    useAlert(t('BLINKONE.BRANDING.DOMAIN_ADDED'));
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.BRANDING.TITLE')"
      :description="t('BLINKONE.BRANDING.DESCRIPTION')"
    />
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="space-y-3">
        <input v-model="brand.product_name" class="w-full rounded border border-n-weak px-3 py-2 text-sm" :placeholder="t('BLINKONE.BRANDING.PRODUCT_NAME')" />
        <label class="text-xs text-n-slate-11">{{ t('BLINKONE.BRANDING.PRIMARY_COLOR') }}</label>
        <input v-model="brand.primary_color" type="color" class="w-full h-10 rounded border border-n-weak" />
        <input v-model="subdomain" class="w-full rounded border border-n-weak px-3 py-2 text-sm" placeholder="client.blinkone.local" />
        <textarea
          v-model="brand.custom_css"
          rows="4"
          class="w-full rounded border border-n-weak px-3 py-2 text-sm font-mono"
          :placeholder="t('BLINKONE.BRANDING.CUSTOM_CSS')"
        />
        <Button :label="t('BLINKONE.BRANDING.SAVE')" @click="save" />
        <div class="pt-4 border-t border-n-weak">
          <input v-model="newDomain" class="w-full rounded border border-n-weak px-3 py-2 text-sm mb-2" placeholder="support.client.com" />
          <Button :label="t('BLINKONE.BRANDING.ADD_DOMAIN')" @click="addDomain" />
          <div v-for="d in domains" :key="d.id" class="text-xs mt-2 text-n-slate-11">
            {{ d.domain }} — {{ d.sslStatus }}
          </div>
        </div>
      </div>
      <div class="rounded-lg border border-n-weak p-4" :style="previewStyle">
        <div class="text-sm font-medium mb-2">{{ t('BLINKONE.BRANDING.PREVIEW') }}</div>
        <div
          class="rounded p-4 text-white"
          :style="{ background: brand.primary_color || '#0B5FFF' }"
        >
          {{ brand.product_name || 'BlinkOne' }}
        </div>
        <p class="text-xs text-n-slate-11 mt-3">{{ t('BLINKONE.BRANDING.PREVIEW_HINT') }}</p>
      </div>
    </div>
  </SettingsLayout>
</template>
