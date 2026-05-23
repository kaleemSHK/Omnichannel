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
const { sla } = useBlinkoneApi();
const calendars = ref([]);

const DEFAULT_HOURS = {
  monday: [{ start: '08:00', end: '17:00' }],
  tuesday: [{ start: '08:00', end: '17:00' }],
  wednesday: [{ start: '08:00', end: '17:00' }],
  thursday: [{ start: '08:00', end: '17:00' }],
  friday: [{ start: '08:00', end: '12:00' }],
};

async function load() {
  try {
    calendars.value = await sla.listCalendars();
  } catch (e) {
    useAlert(e.message);
  }
}

async function createDefault() {
  try {
    await sla.createCalendar({
      name: 'Default business hours',
      timezone: 'Asia/Muscat',
      weekdayHours: DEFAULT_HOURS,
      holidays: [],
    });
    useAlert(t('BLINKONE.SLA.CALENDAR_CREATED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <BlinkoneFeatureGate feature="sla">
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.SLA.CALENDARS.TITLE')"
      :description="t('BLINKONE.SLA.CALENDARS.DESCRIPTION')"
    />
    <div class="flex gap-2 mb-4">
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
      <Button :label="t('BLINKONE.SLA.CALENDARS.ADD_DEFAULT')" @click="createDefault" />
    </div>
    <div v-for="c in calendars" :key="c.id" class="rounded-lg border border-n-weak p-4 mb-3">
      <div class="font-medium">{{ c.name }}</div>
      <div class="text-xs text-n-slate-11">{{ c.timezone }}</div>
    </div>
    <p v-if="!calendars.length" class="text-sm text-n-slate-11">{{ t('BLINKONE.SLA.CALENDARS.EMPTY') }}</p>
  </SettingsLayout>
  </BlinkoneFeatureGate>
</template>
