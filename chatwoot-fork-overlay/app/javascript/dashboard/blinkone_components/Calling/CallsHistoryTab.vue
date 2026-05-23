<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import IncomingCallCard from './IncomingCallCard.vue';
import CallChannelAvatar from './CallChannelAvatar.vue';
import CallStatusBadge from './CallStatusBadge.vue';
import CallingEmptyState from './CallingEmptyState.vue';

const props = defineProps({
  incoming: { type: Array, default: () => [] },
});

const { t } = useI18n();
const { calls, callingPstnEnabled } = useBlinkoneApi();
const history = ref([]);
const loading = ref(false);

onMounted(async () => {
  if (!callingPstnEnabled.value) return;
  loading.value = true;
  try {
    history.value = await calls.list({ status: 'ended,connected' });
  } catch {
    history.value = [];
  } finally {
    loading.value = false;
  }
});

const pastCalls = computed(() =>
  history.value.filter(c => c.status !== 'ringing' && c.status !== 'connected'),
);

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="py-10 flex justify-center">
      <span class="size-6 rounded-full border-2 border-n-brand border-t-transparent animate-spin" />
    </div>
    <template v-else>
      <div v-if="incoming.length" class="divide-y divide-n-weak">
        <IncomingCallCard
          v-for="c in incoming"
          :key="'in-' + c.id"
          :call="c"
        />
      </div>
      <div v-if="pastCalls.length" class="py-2">
        <p
          v-if="incoming.length"
          class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-n-slate-11"
        >
          {{ t('BLINKONE.CALLING.HISTORY_SECTION') }}
        </p>
        <div
          v-for="c in pastCalls"
          :key="c.id"
          class="flex gap-3 px-3 py-2.5 border-l-[3px] border-l-transparent hover:bg-n-solid-2 cursor-pointer"
        >
          <CallChannelAvatar :call="c" size="sm" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-n-slate-12 truncate">
              {{ c.customerPhone || c.roomId }}
            </p>
            <div class="flex flex-wrap gap-1 mt-1">
              <CallStatusBadge :status="c.status" :transport="c.transport" />
            </div>
            <p class="text-[10px] text-n-slate-11 mt-0.5">{{ formatWhen(c.startedAt) }}</p>
          </div>
        </div>
      </div>
      <CallingEmptyState
        v-if="!incoming.length && !pastCalls.length"
        icon="i-lucide-phone"
        :title="t('BLINKONE.CALLING.HISTORY_EMPTY')"
        :description="t('BLINKONE.CALLING.HISTORY_EMPTY_HINT')"
      />
    </template>
  </div>
</template>
