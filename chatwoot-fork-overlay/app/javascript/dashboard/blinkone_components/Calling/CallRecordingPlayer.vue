<script setup>
defineProps({
  title: { type: String, default: '' },
  duration: { type: String, default: '' },
  src: { type: String, default: '' },
  fillWidth: { type: String, default: '40%' },
});
</script>

<template>
  <div class="b1-rec-card !mt-0 flex-1 min-w-0 border-0 p-0">
    <span class="b1-rec-play">
      <span class="i-lucide-play size-3.5" />
    </span>
    <div class="flex-1 min-w-0">
      <p class="text-[11px] font-medium text-n-slate-12 truncate">{{ title }}</p>
      <div class="b1-rec-bar mt-1">
        <div class="b1-rec-fill" :style="{ width: fillWidth }" />
      </div>
      <audio v-if="src" class="sr-only" controls :src="src" />
    </div>
    <span v-if="duration" class="text-[10px] text-n-slate-11 tabular-nums shrink-0">{{ duration }}</span>
  </div>
</template>
