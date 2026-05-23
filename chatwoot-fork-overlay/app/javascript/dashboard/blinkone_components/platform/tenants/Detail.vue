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
const { platform, billing } = useBlinkoneApi();
const tenantId = computed(() => route.params.tenantId);
const tenant = ref(null);
const usage = ref(null);
const domains = ref([]);
const plans = ref([]);
const selectedPlan = ref('business');
const featureDraft = ref({});

const FEATURE_KEYS = [
  'sla', 'escalation', 'sso', 'audit', 'agent_assist', 'voice_bot', 'rag',
  'telephony', 'calling.pstn', 'calling.whatsapp', 'telephony.supervisor', 'telephony.reports',
];

async function load() {
  try {
    tenant.value = await platform.getTenant(tenantId.value);
    usage.value = await platform.getUsage(tenantId.value);
    domains.value = await platform.listDomains(tenantId.value);
    plans.value = await billing.listPlans();
    featureDraft.value = { ...(tenant.value?.features || {}) };
    for (const k of FEATURE_KEYS) {
      if (!(k in featureDraft.value)) featureDraft.value[k] = { enabled: false };
    }
  } catch (e) {
    useAlert(e.message);
  }
}

function isEnabled(key) {
  const v = featureDraft.value[key];
  if (v === true) return true;
  if (v === false) return false;
  return v?.enabled !== false;
}

function toggleFeature(key, on) {
  featureDraft.value[key] = on;
}

async function saveFeatures() {
  const features = {};
  for (const k of FEATURE_KEYS) {
    features[k] = isEnabled(k);
  }
  try {
    tenant.value = await platform.patchTenant(tenantId.value, { features });
    useAlert(t('BLINKONE.PLATFORM.TENANTS.FEATURES_SAVED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function assignPlan() {
  try {
    await billing.assignSubscription(tenantId.value, { planId: selectedPlan.value });
    useAlert(t('BLINKONE.PLATFORM.TENANTS.PLAN_ASSIGNED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function suspend() {
  try {
    tenant.value = await platform.suspendTenant(tenantId.value);
    useAlert(t('BLINKONE.PLATFORM.TENANTS.SUSPENDED'));
  } catch (e) {
    useAlert(e.message);
  }
}

async function impersonate() {
  try {
    const r = await platform.impersonate(tenantId.value);
    useAlert(`Impersonation ref: ${r.impersonationToken}`);
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="tenant?.name || t('BLINKONE.PLATFORM.TENANTS.DETAIL')"
      :description="t('BLINKONE.PLATFORM.TENANTS.DETAIL_DESC')"
    />
    <div v-if="tenant" class="space-y-4">
      <div class="rounded-lg border border-n-weak p-4">
        <div class="text-sm">Status: <strong>{{ tenant.status }}</strong></div>
        <div class="text-xs text-n-slate-11 mt-1">{{ tenant.ownerEmail }}</div>
        <div v-if="tenant.billingPlanId" class="text-xs text-n-slate-11 mt-1">Plan: {{ tenant.billingPlanId }}</div>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button :label="t('BLINKONE.PLATFORM.TENANTS.SUSPEND')" @click="suspend" />
        <Button :label="t('BLINKONE.PLATFORM.TENANTS.IMPERSONATE')" @click="impersonate" />
        <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
      </div>
      <div class="rounded-lg border border-n-weak p-4">
        <div class="font-medium text-sm mb-2">{{ t('BLINKONE.PLATFORM.TENANTS.ASSIGN_PLAN') }}</div>
        <div class="flex gap-2 items-center">
          <select v-model="selectedPlan" class="border border-n-weak rounded px-2 py-1 text-sm">
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <Button size="sm" :label="t('BLINKONE.PLATFORM.TENANTS.APPLY_PLAN')" @click="assignPlan" />
        </div>
      </div>
      <div class="rounded-lg border border-n-weak p-4">
        <div class="font-medium text-sm mb-2">{{ t('BLINKONE.PLATFORM.TENANTS.FEATURE_OVERRIDES') }}</div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <label v-for="key in FEATURE_KEYS" :key="key" class="flex items-center gap-2">
            <input type="checkbox" :checked="isEnabled(key)" @change="toggleFeature(key, $event.target.checked)" />
            {{ key }}
          </label>
        </div>
        <Button class="mt-3" size="sm" :label="t('BLINKONE.PLATFORM.TENANTS.SAVE_FEATURES')" @click="saveFeatures" />
      </div>
      <div class="rounded-lg border border-n-weak p-4">
        <div class="font-medium text-sm mb-2">{{ t('BLINKONE.PLATFORM.TENANTS.USAGE') }}</div>
        <pre class="text-xs text-n-slate-11 overflow-auto">{{ JSON.stringify(usage, null, 2) }}</pre>
      </div>
      <div class="rounded-lg border border-n-weak p-4">
        <div class="font-medium text-sm mb-2">{{ t('BLINKONE.PLATFORM.TENANTS.DOMAINS') }}</div>
        <div v-for="d in domains" :key="d.id" class="text-xs py-1">
          {{ d.domain }} — SSL {{ d.sslStatus }}
        </div>
      </div>
    </div>
  </SettingsLayout>
</template>
