<script setup>
import { computed } from 'vue';

const props = defineProps({
  call: { type: Object, required: true },
  size: { type: String, default: 'md' },
});

const label = computed(() => {
  const name = props.call.metadata?.callerName;
  if (name) {
    const parts = String(name).split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase();
  }
  const phone = props.call.customerPhone || '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 2) return digits.slice(-2);
  return '?';
});

const colorClass = computed(() => {
  const t = (props.call.transport || '').toLowerCase();
  if (t.includes('whatsapp') || t === 'wa') return 'b1-av-wa';
  if (t === 'pstn') return 'b1-av-pstn';
  return 'b1-av-phone';
});

const sizeClass = computed(() => (props.size === 'sm' ? 'size-8 text-[10px]' : 'size-9 text-xs'));
</script>

<template>
  <div
    class="shrink-0 rounded-full font-medium flex items-center justify-center"
    :class="[sizeClass, colorClass]"
  >
    {{ label }}
  </div>
</template>
