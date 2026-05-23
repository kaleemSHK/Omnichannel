<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const { ai } = useBlinkoneApi();
const collections = ref([]);
const newName = ref('');
const indexContent = ref('');
const selectedCollection = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    collections.value = await ai.listCollections();
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = false;
  }
}

async function createCollection() {
  if (!newName.value.trim()) return;
  try {
    await ai.createCollection({ name: newName.value.trim(), language: 'ar' });
    newName.value = '';
    useAlert(t('BLINKONE.AI.KB.CREATED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function indexDoc() {
  if (!selectedCollection.value || !indexContent.value.trim()) return;
  try {
    await ai.indexDocument({
      collection_id: selectedCollection.value,
      source_type: 'plain_text',
      source_ref: `manual-${Date.now()}`,
      content: indexContent.value,
    });
    indexContent.value = '';
    useAlert(t('BLINKONE.AI.KB.INDEXED'));
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.AI.KB.TITLE')"
      :description="t('BLINKONE.AI.KB.DESCRIPTION')"
    />
    <div class="flex gap-2 mb-4">
      <input
        v-model="newName"
        class="flex-1 rounded border border-n-weak px-3 py-2 text-sm"
        :placeholder="t('BLINKONE.AI.KB.COLLECTION_NAME')"
      />
      <Button :label="t('BLINKONE.AI.KB.ADD')" @click="createCollection" />
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
    </div>
    <div v-for="c in collections" :key="c.id || c.collection_id" class="rounded-lg border border-n-weak p-3 mb-2">
      <span class="font-medium">{{ c.name }}</span>
      <span class="text-xs text-n-slate-11 ml-2">{{ c.language }}</span>
    </div>
    <div class="mt-6 space-y-2">
      <select v-model="selectedCollection" class="w-full rounded border border-n-weak px-3 py-2 text-sm">
        <option value="">{{ t('BLINKONE.AI.KB.SELECT_COLLECTION') }}</option>
        <option v-for="c in collections" :key="c.id || c.collection_id" :value="c.id || c.collection_id">
          {{ c.name }}
        </option>
      </select>
      <textarea
        v-model="indexContent"
        rows="6"
        class="w-full rounded border border-n-weak px-3 py-2 text-sm"
        :placeholder="t('BLINKONE.AI.KB.PASTE')"
      />
      <Button :label="t('BLINKONE.AI.KB.INDEX')" @click="indexDoc" />
    </div>
  </SettingsLayout>
</template>
