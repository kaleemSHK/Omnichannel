<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  icon: { type: String, default: 'i-lucide-phone-off' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
});
</script>

<template>
  <div class="flex flex-col items-center justify-center px-4 py-8 text-center">
    <span
      class="flex items-center justify-center size-10 rounded-full bg-n-solid-2 text-n-slate-11 mb-3"
      :class="icon"
    />
    <p class="text-sm font-medium text-n-slate-12">{{ title }}</p>
    <p v-if="description" class="text-xs text-n-slate-11 mt-1 max-w-[220px] leading-relaxed">
      {{ description }}
    </p>
  </div>
</template>
