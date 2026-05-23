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
const { escalation } = useBlinkoneApi();
const rulesets = ref([]);
const rules = ref([]);
const selected = ref(null);
const simulateResult = ref(null);

async function seedRuleset() {
  try {
    await escalation.createRuleset({ name: 'Default escalations', enabled: true });
    useAlert(t('BLINKONE.ESCALATION.RULESET_CREATED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function load() {
  rulesets.value = await escalation.listRulesets();
  if (selected.value) {
    rules.value = await escalation.listRules(selected.value.id);
  }
}

function select(rs) {
  selected.value = rs;
  load();
}

async function addBreachRule() {
  if (!selected.value) {
    useAlert(t('BLINKONE.ESCALATION.SELECT_RULESET'));
    return;
  }
  try {
    await escalation.createRule(selected.value.id, {
      name: 'SLA breach label',
      trigger: 'sla.breached',
      conditions: true,
      actions: [{ type: 'add_label', label: 'sla-breached' }],
    });
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function testSimulate() {
  simulateResult.value = await escalation.simulate({
    rule: {
      trigger: 'sla.breached',
      conditions: true,
      actions: [{ type: 'add_label', label: 'sla-breached' }],
    },
    event: { event_type: 'sla.breached', conversation: { id: 1 } },
  });
}

onMounted(load);
</script>

<template>
  <BlinkoneFeatureGate feature="escalation">
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.ESCALATION.TITLE')"
      :description="t('BLINKONE.ESCALATION.DESCRIPTION')"
    />
    <div class="grid lg:grid-cols-2 gap-4">
      <section>
        <h3 class="text-xs uppercase text-n-slate-11 mb-2">{{ t('BLINKONE.ESCALATION.RULESETS') }}</h3>
        <button
          v-for="rs in rulesets"
          :key="rs.id"
          type="button"
          class="w-full text-left rounded border p-3 mb-2"
          :class="selected?.id === rs.id ? 'border-n-brand' : 'border-n-weak'"
          @click="select(rs)"
        >
          {{ rs.name }}
        </button>
      </section>
      <section>
        <div class="flex gap-2 mb-2 flex-wrap">
          <Button size="sm" variant="ghost" :label="t('BLINKONE.ESCALATION.ADD_RULESET')" @click="seedRuleset" />
          <Button size="sm" :label="t('BLINKONE.ESCALATION.ADD_RULE')" @click="addBreachRule" />
          <Button size="sm" variant="ghost" :label="t('BLINKONE.ESCALATION.TEST')" @click="testSimulate" />
        </div>
        <div v-for="r in rules" :key="r.id" class="rounded border border-n-weak p-3 mb-2 text-sm">
          <div class="font-medium">{{ r.name }}</div>
          <div class="text-xs text-n-slate-11">{{ r.trigger }}</div>
        </div>
        <pre v-if="simulateResult" class="text-xs mt-4 p-3 bg-n-alpha-1 rounded overflow-auto">{{ JSON.stringify(simulateResult, null, 2) }}</pre>
      </section>
    </div>
  </SettingsLayout>
  </BlinkoneFeatureGate>
</template>
