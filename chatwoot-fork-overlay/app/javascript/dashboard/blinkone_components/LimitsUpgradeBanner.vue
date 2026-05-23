<script setup>
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';

const { limitsExceeded } = useBlinkoneApi();
</script>

<template>
  <div
    v-if="limitsExceeded"
    class="mx-4 mt-2 rounded-lg border border-n-ruby-6 bg-n-ruby-2 px-4 py-2 text-sm text-n-ruby-11"
    role="alert"
  >
    {{ $t('BLINKONE.GENERAL_SETTINGS.LIMITS_UPGRADE') }}
  </div>
</template>
