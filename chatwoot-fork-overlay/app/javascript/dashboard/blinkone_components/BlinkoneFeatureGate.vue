<script setup>
import { useFeature } from 'shared/blinkone/useFeature';

const props = defineProps({
  feature: { type: String, required: true },
});

const { enabled } = useFeature(props.feature);
</script>

<template>
  <slot v-if="enabled" />
  <p v-else class="text-sm text-n-slate-11 p-4 rounded-lg border border-n-weak">
    {{ $t('BLINKONE.FEATURES.UPGRADE_REQUIRED') }}
  </p>
</template>
