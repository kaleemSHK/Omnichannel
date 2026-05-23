<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  conversationId: { type: [Number, String], required: true },
  transcript: { type: String, default: '' },
  collectionId: { type: String, default: '' },
});

const { t } = useI18n();
const { ai } = useBlinkoneApi();
const loading = ref('');
const summary = ref('');
const suggestions = ref([]);
const sentiment = ref(null);
const classification = ref(null);

async function run(action, fn) {
  loading.value = action;
  try {
    await fn();
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = '';
  }
}

async function suggestReply() {
  await run('suggest', async () => {
    const r = await ai.suggestReply({
      conversation_id: props.conversationId,
      text: props.transcript,
      collection_id: props.collectionId || undefined,
    });
    suggestions.value = r.suggestions ?? [];
  });
}

async function summarize() {
  await run('summarize', async () => {
    const r = await ai.summarizeConversation({
      conversation_id: props.conversationId,
      text: props.transcript,
    });
    summary.value = r.summary ?? '';
  });
}

async function detectIntent() {
  await run('classify', async () => {
    classification.value = await ai.classifyTicket({
      message_sample: props.transcript.slice(0, 2000),
    });
  });
}

async function analyzeSentiment() {
  await run('sentiment', async () => {
    sentiment.value = await ai.sentiment({ text: props.transcript.slice(-1500) });
  });
}
</script>

<template>
  <div class="rounded-lg border border-n-weak p-3 space-y-3 bg-n-solid-2">
    <div class="text-sm font-medium">{{ t('BLINKONE.AI.ASSIST.TITLE') }}</div>
    <div class="flex flex-wrap gap-2">
      <Button
        size="sm"
        :label="t('BLINKONE.AI.ASSIST.SUGGEST')"
        :is-loading="loading === 'suggest'"
        @click="suggestReply"
      />
      <Button
        size="sm"
        :label="t('BLINKONE.AI.ASSIST.SUMMARIZE')"
        :is-loading="loading === 'summarize'"
        @click="summarize"
      />
      <Button
        size="sm"
        :label="t('BLINKONE.AI.ASSIST.INTENT')"
        :is-loading="loading === 'classify'"
        @click="detectIntent"
      />
      <Button
        size="sm"
        :label="t('BLINKONE.AI.ASSIST.SENTIMENT')"
        :is-loading="loading === 'sentiment'"
        @click="analyzeSentiment"
      />
    </div>
    <p v-if="summary" class="text-xs text-n-slate-11 whitespace-pre-wrap">{{ summary }}</p>
    <ul v-if="suggestions.length" class="text-xs space-y-2">
      <li v-for="(s, i) in suggestions" :key="i" class="p-2 rounded bg-n-alpha-1">
        {{ s.text }}
        <span class="text-n-slate-11">({{ s.tone }})</span>
      </li>
    </ul>
    <p v-if="classification" class="text-xs text-n-slate-11">
      {{ classification.category }} · {{ classification.priority }} · {{ classification.language }}
    </p>
    <p v-if="sentiment" class="text-xs text-n-slate-11">
      {{ sentiment.label }} ({{ sentiment.score }})
    </p>
  </div>
</template>
