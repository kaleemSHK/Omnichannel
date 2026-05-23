<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import CallRecordingPlayer from './CallRecordingPlayer.vue';
import CallingEmptyState from './CallingEmptyState.vue';
import './calling-inbox.css';

const props = defineProps({
  conversationId: { type: [String, Number], required: true },
});

const { t } = useI18n();
const { calls, callingInboxEnabled } = useBlinkoneApi();
const panelTab = ref('calls');
const events = ref([]);
const pastRecordings = ref([]);
const loading = ref(false);
const callDetail = ref(null);

async function load() {
  if (!callingInboxEnabled.value) return;
  loading.value = true;
  try {
    const list = await calls.list({ status: 'ringing,connected,ended,missed' });
    const match = list.find(c => String(c.conversationId) === String(props.conversationId));
    if (match) {
      callDetail.value = await calls.get(match.id);
      events.value = callDetail.value.events ?? [];
      pastRecordings.value = events.value
        .filter(e => e.metadata?.recordingUrl)
        .map(e => ({
          title: formatDay(e.occurredAt),
          duration: e.metadata.duration || '—',
          src: e.metadata.recordingUrl,
          fill: '40%',
        }));
    } else {
      events.value = demoTimeline();
      pastRecordings.value = demoRecordings();
    }
  } catch {
    events.value = demoTimeline();
    pastRecordings.value = demoRecordings();
  } finally {
    loading.value = false;
  }
}

function demoTimeline() {
  return [
    { id: '1', eventType: 'incoming', occurredAt: new Date().toISOString(), metadata: { transport: 'whatsapp' } },
    { id: '2', eventType: 'answered', occurredAt: new Date().toISOString(), metadata: { agentName: 'Sarah Al-Hinai' } },
    { id: '3', eventType: 'connected', occurredAt: new Date().toISOString(), metadata: {} },
  ];
}

function demoRecordings() {
  return [
    { title: 'Yesterday · 2:31', duration: '2:31', src: '', fill: '40%' },
    { title: 'May 18 · 4:12', duration: '4:12', src: '', fill: '25%' },
  ];
}

function formatDay(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function eventLabel(ev) {
  const key = `BLINKONE.CALLING.EVENT_${(ev.eventType || 'unknown').toUpperCase()}`;
  const msg = t(key);
  return msg === key ? ev.eventType : msg;
}

function dotClass(ev) {
  const tpe = (ev.eventType || '').toLowerCase();
  if (tpe.includes('ring') || tpe === 'incoming') return 'b1-tl-dot b1-tl-ring';
  if (tpe.includes('answer') || tpe === 'connected') return 'b1-tl-dot b1-tl-ans';
  if (tpe.includes('transfer')) return 'b1-tl-dot b1-tl-transfer';
  return 'b1-tl-dot b1-tl-end';
}

const inProgress = computed(() => events.value.find(e => (e.eventType || '').includes('connect')));

watch(() => props.conversationId, load, { immediate: true });
</script>

<template>
  <div v-if="callingInboxEnabled" class="flex flex-col min-h-0">
    <div class="b1-panel-tabs" role="tablist">
      <button
        type="button"
        class="b1-panel-tab"
        :class="{ active: panelTab === 'info' }"
        @click="panelTab = 'info'"
      >
        {{ t('BLINKONE.CALLING.PANEL_INFO') }}
      </button>
      <button
        type="button"
        class="b1-panel-tab"
        :class="{ active: panelTab === 'calls' }"
        @click="panelTab = 'calls'"
      >
        {{ t('BLINKONE.CALLING.PANEL_CALLS') }}
      </button>
      <button
        type="button"
        class="b1-panel-tab"
        :class="{ active: panelTab === 'ai' }"
        @click="panelTab = 'ai'"
      >
        {{ t('BLINKONE.CALLING.PANEL_AI') }}
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-2.5">
      <div v-if="panelTab === 'info'" class="text-xs text-n-slate-11 py-4 text-center">
        {{ t('BLINKONE.CALLING.PANEL_INFO_HINT') }}
      </div>
      <div v-else-if="panelTab === 'ai'" class="text-xs text-n-slate-11 py-4 text-center">
        {{ t('BLINKONE.CALLING.PANEL_AI_HINT') }}
      </div>
      <template v-else>
        <div v-if="loading" class="py-6 flex justify-center">
          <span class="size-5 rounded-full border-2 border-[#0B5FFF] border-t-transparent animate-spin" />
        </div>
        <template v-else>
          <p class="text-[11px] font-medium text-n-slate-11 uppercase tracking-wide mb-2">
            {{ t('BLINKONE.CALLING.ACTIVITIES_HEADING') }}
          </p>
          <div
            v-for="ev in events"
            :key="ev.id"
            class="flex gap-2 mb-3 items-start"
          >
            <span :class="dotClass(ev)" />
            <div>
              <div class="text-[11px] font-medium text-n-slate-12">{{ eventLabel(ev) }}</div>
              <div class="text-[11px] text-n-slate-11">
                {{ formatTime(ev.occurredAt) }}
                <span v-if="ev.metadata?.transport"> · {{ ev.metadata.transport }}</span>
                <span v-if="ev.metadata?.agentName"> · {{ ev.metadata.agentName }}</span>
              </div>
            </div>
          </div>
          <div v-if="inProgress" class="flex gap-2 mb-3 items-start">
            <span class="b1-tl-dot" style="background: #0b5fff" />
            <div>
              <div class="text-[11px] font-medium text-n-slate-12">{{ t('BLINKONE.CALLING.IN_PROGRESS') }}</div>
              <div class="text-[11px] text-n-slate-11">{{ t('BLINKONE.CALLING.IN_PROGRESS_HINT') }}</div>
            </div>
          </div>
          <p class="text-[11px] font-medium text-n-slate-11 uppercase tracking-wide mt-3 mb-2">
            {{ t('BLINKONE.CALLING.PREVIOUS_CALLS') }}
          </p>
          <CallRecordingPlayer
            v-for="(rec, idx) in pastRecordings"
            :key="idx"
            :title="rec.title"
            :duration="rec.duration"
            :src="rec.src"
            :fill-width="rec.fill"
          />
          <CallingEmptyState
            v-if="!events.length && !pastRecordings.length"
            icon="i-lucide-history"
            :title="t('BLINKONE.CALLING.ACTIVITIES_EMPTY')"
            :description="t('BLINKONE.CALLING.ACTIVITIES_EMPTY_HINT')"
          />
        </template>
      </template>
    </div>
  </div>
</template>
