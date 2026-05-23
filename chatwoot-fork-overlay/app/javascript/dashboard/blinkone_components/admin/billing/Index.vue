<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const { billing, tenantId } = useBlinkoneApi();
const usage = ref(null);
const invoices = ref([]);
const subscription = ref(null);
const loading = ref(false);

const gauges = computed(() => {
  if (!usage.value?.comparison) return [];
  return Object.entries(usage.value.comparison).map(([dim, c]) => ({
    dim,
    used: c.used,
    allowed: c.allowed,
    pct: c.allowed ? Math.min(100, Math.round((c.used / c.allowed) * 100)) : 0,
  }));
});

async function load() {
  loading.value = true;
  try {
    usage.value = await billing.getUsage(tenantId.value);
    subscription.value = usage.value?.subscription;
    invoices.value = await billing.listInvoices(tenantId.value);
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = false;
  }
}

async function generateInvoice() {
  try {
    await billing.generateInvoice(tenantId.value);
    useAlert(t('BLINKONE.BILLING.INVOICE_GENERATED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.BILLING.ADMIN.TITLE')"
      :description="t('BLINKONE.BILLING.ADMIN.DESCRIPTION')"
    />
    <div class="flex gap-2 mb-4">
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
      <Button :label="t('BLINKONE.BILLING.GENERATE_INVOICE')" @click="generateInvoice" />
    </div>

    <div v-if="subscription" class="rounded-lg border border-n-weak p-4 mb-6">
      <p class="text-sm font-medium">{{ subscription.planName }}</p>
      <p class="text-xs text-n-slate-11">
        {{ subscription.status }} · {{ subscription.currency }} · ends {{ subscription.currentPeriodEnd }}
      </p>
    </div>

    <div v-if="gauges.length" class="grid gap-3 mb-6">
      <div v-for="g in gauges" :key="g.dim" class="rounded-lg border border-n-weak p-3">
        <div class="flex justify-between text-sm mb-1">
          <span>{{ g.dim }}</span>
          <span>{{ g.used }} / {{ g.allowed }}</span>
        </div>
        <div class="h-2 rounded-full bg-n-alpha-3 overflow-hidden">
          <div class="h-full bg-[var(--bn-accent)]" :style="{ width: `${g.pct}%` }" />
        </div>
      </div>
    </div>

    <h3 class="text-sm font-medium mb-2">{{ t('BLINKONE.BILLING.INVOICES') }}</h3>
    <ul class="space-y-2 text-sm">
      <li
        v-for="inv in invoices"
        :key="inv.id"
        class="rounded border border-n-weak px-3 py-2 flex justify-between"
      >
        <span>{{ inv.periodStart?.slice(0, 10) }} — {{ inv.totalOmr }} OMR</span>
        <span class="uppercase text-xs">{{ inv.status }}</span>
      </li>
    </ul>
    <p v-if="!invoices.length && !loading" class="text-sm text-n-slate-11">{{ t('BLINKONE.BILLING.NO_INVOICES') }}</p>
  </SettingsLayout>
</template>
