<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, default: 'ended' },
  transport: { type: String, default: '' },
});

const classes = computed(() => {
  const s = props.status;
  if (s === 'ringing') return 'bg-ruby-50 text-ruby-11 border-ruby-200';
  if (s === 'connected') return 'bg-teal-50 text-teal-11 border-teal-200';
  if (s === 'missed') return 'bg-amber-50 text-amber-11 border-amber-200';
  return 'bg-n-solid-2 text-n-slate-11 border-n-weak';
});

const icon = computed(() => {
  const s = props.status;
  if (s === 'ringing') return 'i-lucide-phone-incoming';
  if (s === 'connected') return 'i-lucide-circle';
  if (s === 'missed') return 'i-lucide-phone-missed';
  return 'i-lucide-phone-off';
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border capitalize"
    :class="classes"
  >
    <span class="size-2.5" :class="icon" />
    {{ status }}
    <span v-if="transport" class="opacity-70">· {{ transport }}</span>
  </span>
</template>
