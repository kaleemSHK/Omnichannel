<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import { useFeature } from 'shared/blinkone/useFeature';

const props = defineProps({
  conversationId: { type: [Number, String], default: null },
});

const POLL_MS = 30_000;

const { sla } = useBlinkoneApi();
const { enabled } = useFeature('sla');
const instances = ref([]);
let timer = null;

function msUntil(iso) {
  if (!iso) return null;
  return new Date(iso).getTime() - Date.now();
}

function formatCountdown(ms) {
  if (ms == null) return '';
  if (ms <= 0) return 'overdue';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

const primary = computed(() => {
  const active = instances.value.filter(i =>
    ['active', 'warning_sent', 'paused'].includes(i.status),
  );
  if (!active.length) return instances.value[0] ?? null;
  return active.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))[0];
});

const badgeClass = computed(() => {
  const s = primary.value?.status;
  if (s === 'breached') return 'bg-n-ruby-3 text-n-ruby-11';
  if (s === 'warning_sent') return 'bg-n-amber-3 text-n-amber-11';
  if (s === 'paused') return 'bg-n-slate-3 text-n-slate-11';
  if (s === 'met') return 'bg-n-teal-3 text-n-teal-11';
  return 'bg-n-brand-3 text-n-brand-11';
});

const label = computed(() => {
  const i = primary.value;
  if (!i) return '';
  const left = formatCountdown(msUntil(i.dueAt));
  const type = (i.targetType || 'sla').replace('_', ' ');
  if (i.status === 'breached') return `SLA breached · ${type}`;
  if (i.status === 'met') return `SLA met · ${type}`;
  if (i.status === 'paused') return `SLA paused · ${type}`;
  if (i.status === 'warning_sent') return `SLA at risk · ${left}`;
  return `SLA · ${type} · ${left}`;
});

async function load() {
  if (!enabled.value || !props.conversationId) {
    instances.value = [];
    return;
  }
  try {
    instances.value = await sla.conversationSla(props.conversationId);
  } catch {
    instances.value = [];
  }
}

function startPoll() {
  stopPoll();
  timer = setInterval(load, POLL_MS);
}

function stopPoll() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(() => props.conversationId, () => {
  load();
  startPoll();
});

watch(enabled, v => {
  if (v) {
    load();
    startPoll();
  } else {
    instances.value = [];
    stopPoll();
  }
});

onMounted(() => {
  load();
  startPoll();
});

onUnmounted(stopPoll);
</script>

<template>
  <span
    v-if="enabled && primary"
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    :class="badgeClass"
    :title="instances.map(i => `${i.targetType}: ${i.status} (due ${i.dueAt})`).join('\n')"
  >
    {{ label }}
  </span>
</template>
