<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const FEATURE_KEYS = [
  'sla', 'escalation', 'sso', 'audit', 'agent_assist', 'voice_bot', 'rag',
  'telephony', 'calling.pstn', 'calling.whatsapp', 'telephony.supervisor', 'telephony.reports', 'white_label',
];

const { t } = useI18n();
const { billing } = useBlinkoneApi();
const plans = ref([]);
const loading = ref(false);
const saving = ref(false);
const selectedId = ref(null);
const draft = ref(null);

const selectedPlan = computed(() => plans.value.find(p => p.id === selectedId.value));

function featureEnabled(plan, key) {
  const v = plan?.features?.[key];
  if (v === true) return true;
  if (v === false) return false;
  return v?.enabled !== false && v != null && v !== false;
}

function setFeature(key, on) {
  if (!draft.value) return;
  draft.value.features = { ...draft.value.features, [key]: on };
}

async function load() {
  loading.value = true;
  try {
    plans.value = await billing.listPlans();
    if (!selectedId.value && plans.value.length) selectedId.value = plans.value[0].id;
    selectPlan(selectedId.value);
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = false;
  }
}

function selectPlan(id) {
  selectedId.value = id;
  const p = plans.value.find(x => x.id === id);
  if (!p) return;
  draft.value = {
    name: p.name,
    basePriceOmr: p.basePriceOmr,
    includedAgents: p.includedAgents,
    includedMinutes: p.includedMinutes,
    includedMessages: p.includedMessages,
    includedAiCredits: p.includedAiCredits,
    features: { ...(p.features || {}) },
  };
}

async function save() {
  if (!selectedId.value || !draft.value) return;
  saving.value = true;
  try {
    const updated = await billing.patchPlan(selectedId.value, draft.value);
    const idx = plans.value.findIndex(p => p.id === selectedId.value);
    if (idx >= 0) plans.value[idx] = updated;
    useAlert(t('BLINKONE.BILLING.PLANS.SAVED'));
  } catch (e) {
    useAlert(e.message);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.BILLING.PLANS.TITLE')"
      :description="t('BLINKONE.BILLING.PLANS.DESCRIPTION')"
    />
    <div class="flex gap-2 mb-4">
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
    </div>
    <div class="grid md:grid-cols-3 gap-4">
      <div class="md:col-span-1 space-y-2">
        <button
          v-for="p in plans"
          :key="p.id"
          type="button"
          class="w-full text-left rounded-lg border p-3 text-sm"
          :class="selectedId === p.id ? 'border-n-brand bg-n-brand/5' : 'border-n-weak'"
          @click="selectPlan(p.id)"
        >
          <div class="font-medium">{{ p.name }}</div>
          <div class="text-xs text-n-slate-11">{{ p.basePriceOmr }} OMR · {{ p.tier }}</div>
        </button>
      </div>
      <div v-if="draft && selectedPlan" class="md:col-span-2 rounded-lg border border-n-weak p-4 space-y-4">
        <h3 class="font-medium">{{ selectedPlan.name }} ({{ selectedPlan.id }})</h3>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <label class="flex flex-col gap-1">
            <span class="text-n-slate-11">{{ t('BLINKONE.BILLING.PLANS.BASE_PRICE') }}</span>
            <input v-model.number="draft.basePriceOmr" type="number" step="0.001" class="border border-n-weak rounded px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-n-slate-11">{{ t('BLINKONE.BILLING.PLANS.INCLUDED_AGENTS') }}</span>
            <input v-model.number="draft.includedAgents" type="number" class="border border-n-weak rounded px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-n-slate-11">{{ t('BLINKONE.BILLING.PLANS.INCLUDED_MINUTES') }}</span>
            <input v-model.number="draft.includedMinutes" type="number" class="border border-n-weak rounded px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-n-slate-11">{{ t('BLINKONE.BILLING.PLANS.INCLUDED_MESSAGES') }}</span>
            <input v-model.number="draft.includedMessages" type="number" class="border border-n-weak rounded px-2 py-1" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-n-slate-11">{{ t('BLINKONE.BILLING.PLANS.INCLUDED_AI') }}</span>
            <input v-model.number="draft.includedAiCredits" type="number" class="border border-n-weak rounded px-2 py-1" />
          </label>
        </div>
        <div>
          <p class="text-sm font-medium mb-2">{{ t('BLINKONE.BILLING.PLANS.FEATURE_MATRIX') }}</p>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <label
              v-for="key in FEATURE_KEYS"
              :key="key"
              class="flex items-center gap-2"
            >
              <input
                type="checkbox"
                :checked="featureEnabled(draft, key)"
                @change="setFeature(key, $event.target.checked)"
              />
              <span>{{ key }}</span>
            </label>
          </div>
        </div>
        <Button
          :label="t('BLINKONE.BILLING.PLANS.SAVE')"
          :is-loading="saving"
          @click="save"
        />
      </div>
    </div>
    <p v-if="!plans.length && !loading" class="text-sm text-n-slate-11">{{ t('BLINKONE.BILLING.NO_DATA') }}</p>
  </SettingsLayout>
</template>
