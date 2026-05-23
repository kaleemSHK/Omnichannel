<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const { billing } = useBlinkoneApi();
const overview = ref(null);
const plans = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    [overview.value, plans.value] = await Promise.all([
      billing.platformOverview(),
      billing.listPlans(),
    ]);
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = false;
  }
}

function featureSummary(plan) {
  const f = plan.features || {};
  return Object.entries(f)
    .filter(([, v]) => v === true || (v && typeof v === 'object' && v.enabled !== false))
    .map(([k]) => k)
    .join(', ');
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.BILLING.PLATFORM.TITLE')"
      :description="t('BLINKONE.BILLING.PLATFORM.DESCRIPTION')"
    />
    <div class="flex gap-2 mb-4">
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
    </div>
    <div v-if="overview" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="rounded-lg border border-n-weak p-4">
        <p class="text-xs text-n-slate-11">{{ t('BLINKONE.BILLING.MRR') }}</p>
        <p class="text-xl font-semibold">{{ overview.mrrOmr }} {{ overview.currency }}</p>
      </div>
      <div class="rounded-lg border border-n-weak p-4">
        <p class="text-xs text-n-slate-11">{{ t('BLINKONE.BILLING.ARR') }}</p>
        <p class="text-xl font-semibold">{{ overview.arrOmr }} {{ overview.currency }}</p>
      </div>
      <div class="rounded-lg border border-n-weak p-4">
        <p class="text-xs text-n-slate-11">{{ t('BLINKONE.BILLING.OVERDUE') }}</p>
        <p class="text-xl font-semibold text-n-ruby-11">{{ overview.overdueCount }}</p>
      </div>
    </div>
    <div class="rounded-lg border border-n-weak p-4">
      <h3 class="font-medium text-sm mb-3">{{ t('BLINKONE.BILLING.PLANS.TITLE') }}</h3>
      <div v-for="plan in plans" :key="plan.id" class="border-b border-n-weak py-3 last:border-0">
        <div class="flex justify-between items-start gap-4">
          <div>
            <p class="font-medium">{{ plan.name }} <span class="text-xs text-n-slate-11">({{ plan.id }})</span></p>
            <p class="text-xs text-n-slate-11 mt-1">
              {{ plan.basePriceOmr }} {{ overview?.currency || 'OMR' }}/{{ plan.billingPeriod }}
              · {{ plan.includedAgents }} agents · {{ plan.includedMinutes }} min
            </p>
            <p class="text-xs text-n-brand mt-1">{{ featureSummary(plan) || '—' }}</p>
          </div>
        </div>
      </div>
      <p v-if="!plans.length && !loading" class="text-sm text-n-slate-11">{{ t('BLINKONE.BILLING.NO_DATA') }}</p>
    </div>
  </SettingsLayout>
</template>
