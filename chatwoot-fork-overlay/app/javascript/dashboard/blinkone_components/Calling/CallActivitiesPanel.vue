<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import CallEventCard from './CallEventCard.vue';
import CallingEmptyState from './CallingEmptyState.vue';

const props = defineProps({
  conversationId: { type: [String, Number], required: true },
});
const { t } = useI18n();
const { calls, callingPstnEnabled } = useBlinkoneApi();
const events = ref([]);
const loading = ref(false);
const loaded = ref(false);

async function load() {
  if (!callingPstnEnabled.value) {
    loaded.value = true;
    return;
  }
  loading.value = true;
  try {
    const list = await calls.list({ status: 'ringing,connected,ended' });
    const match = list.find(c => String(c.conversationId) === String(props.conversationId));
    if (match) {
      const detail = await calls.get(match.id);
      events.value = detail.events ?? [];
    } else {
      events.value = [];
    }
  } catch {
    events.value = [];
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

const grouped = ref({});
watch(events, list => {
  const g = {};
  for (const ev of list) {
    const day = (ev.occurredAt || '').slice(0, 10) || 'unknown';
    if (!g[day]) g[day] = [];
    g[day].push(ev);
  }
  grouped.value = g;
});

watch(() => props.conversationId, load, { immediate: true });
</script>

<template>
  <div class="px-2 pb-2">
    <p class="text-[10px] font-semibold uppercase tracking-wide text-n-slate-11 px-1 mb-2">
      {{ t('BLINKONE.CALLING.ACTIVITIES_HEADING') }}
    </p>
    <div v-if="loading" class="py-6 flex justify-center">
      <span class="size-5 rounded-full border-2 border-n-brand border-t-transparent animate-spin" />
    </div>
    <template v-else-if="events.length">
      <div v-for="(dayEvents, day) in grouped" :key="day" class="mb-3">
        <p class="text-[10px] text-n-slate-11 px-1 mb-1">{{ day }}</p>
        <CallEventCard v-for="ev in dayEvents" :key="ev.id" :event="ev" />
      </div>
    </template>
    <CallingEmptyState
      v-else-if="loaded"
      icon="i-lucide-history"
      :title="t('BLINKONE.CALLING.ACTIVITIES_EMPTY')"
      :description="t('BLINKONE.CALLING.ACTIVITIES_EMPTY_HINT')"
    />
  </div>
</template>
