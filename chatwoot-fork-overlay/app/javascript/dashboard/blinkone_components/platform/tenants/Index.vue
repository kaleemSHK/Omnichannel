<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { platform } = useBlinkoneApi();
const tenants = ref([]);
const loading = ref(false);
const showWizard = ref(false);
const form = ref({
  name: '',
  slug: '',
  ownerEmail: '',
  plan: 'trial',
  features: { telephony: true, rag: true, voice_bot: true },
});

async function load() {
  loading.value = true;
  try {
    tenants.value = await platform.listTenants();
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = false;
  }
}

async function createTenant() {
  try {
    const r = await platform.createTenant({ ...form.value });
    useAlert(t('BLINKONE.PLATFORM.TENANT_CREATED'));
    showWizard.value = false;
    await load();
    if (r.tenant?.id) {
      router.push({
        name: 'blinkone_platform_tenant_detail',
        params: { accountId: route.params.accountId, tenantId: r.tenant.id },
      });
    }
  } catch (e) {
    useAlert(e.message);
  }
}

function statusClass(s) {
  if (s === 'suspended' || s === 'terminated') return 'text-n-ruby-11';
  if (s === 'trial') return 'text-n-amber-11';
  return 'text-n-teal-11';
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.PLATFORM.TENANTS.TITLE')"
      :description="t('BLINKONE.PLATFORM.TENANTS.DESCRIPTION')"
    />
    <div class="flex gap-2 mb-4">
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
      <Button :label="t('BLINKONE.PLATFORM.TENANTS.NEW')" @click="showWizard = !showWizard" />
    </div>

    <div v-if="showWizard" class="rounded-lg border border-n-weak p-4 mb-6 space-y-3">
      <input v-model="form.name" class="w-full rounded border border-n-weak px-3 py-2 text-sm" :placeholder="t('BLINKONE.PLATFORM.TENANTS.NAME')" />
      <input v-model="form.slug" class="w-full rounded border border-n-weak px-3 py-2 text-sm" placeholder="slug" />
      <input v-model="form.ownerEmail" class="w-full rounded border border-n-weak px-3 py-2 text-sm" type="email" placeholder="owner@client.om" />
      <Button :label="t('BLINKONE.PLATFORM.TENANTS.PROVISION')" @click="createTenant" />
    </div>

    <div
      v-for="tenant in tenants"
      :key="tenant.id"
      class="rounded-lg border border-n-weak p-4 mb-3 cursor-pointer hover:bg-n-alpha-1"
      @click="router.push({ name: 'blinkone_platform_tenant_detail', params: { accountId: route.params.accountId, tenantId: tenant.id } })"
    >
      <div class="flex justify-between">
        <span class="font-medium">{{ tenant.name }}</span>
        <span class="text-xs" :class="statusClass(tenant.status)">{{ tenant.status }}</span>
      </div>
      <div class="text-xs text-n-slate-11 mt-1">{{ tenant.slug }} · account {{ tenant.chatwootAccountId }}</div>
    </div>
    <p v-if="!tenants.length && !loading" class="text-sm text-n-slate-11">{{ t('BLINKONE.PLATFORM.TENANTS.EMPTY') }}</p>
  </SettingsLayout>
</template>
