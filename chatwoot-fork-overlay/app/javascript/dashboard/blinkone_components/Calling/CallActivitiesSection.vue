<script setup>
import CallTimelinePanel from './CallTimelinePanel.vue';

defineProps({
  conversationId: { type: [String, Number], required: true },
});
</script>

<template>
  <div class="border-t border-n-weak mt-1">
    <CallTimelinePanel :conversation-id="conversationId" />
  </div>
</template>
