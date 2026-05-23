<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const { ivr } = useBlinkoneApi();

const SAMPLE_GRAPH = {
  entry: 'welcome',
  nodes: [
    { id: 'welcome', type: 'play', media: 'sound:hello-world', next: 'menu' },
    { id: 'menu', type: 'play', media: 'sound:please-try-again', collectDigits: true, timeoutSec: 5, next: 'hangup' },
    { id: 'sales', type: 'enqueue', queue: 'sales', digit: '1' },
    { id: 'support', type: 'enqueue', queue: 'support', digit: '2' },
    { id: 'hangup', type: 'hangup' },
  ],
};

const flows = ref([]);
const versions = ref([]);
const selected = ref(null);
const editName = ref('');
const editDefault = ref(false);
const graphJson = ref('');
const versionComment = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    flows.value = await ivr.listFlows();
    if (selected.value?.id) {
      const fresh = flows.value.find(f => f.id === selected.value.id);
      if (fresh) selectFlow(fresh);
    }
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = false;
  }
}

function selectFlow(f) {
  selected.value = f;
  editName.value = f.name;
  editDefault.value = !!f.isDefault;
  graphJson.value = JSON.stringify(f.graph || SAMPLE_GRAPH, null, 2);
  loadVersions();
}

async function loadVersions() {
  if (!selected.value?.id) return;
  try {
    versions.value = await ivr.listVersions(selected.value.id);
  } catch {
    versions.value = [];
  }
}

function newFlow() {
  selected.value = { id: null };
  editName.value = 'New flow';
  editDefault.value = false;
  graphJson.value = JSON.stringify(SAMPLE_GRAPH, null, 2);
  versions.value = [];
}

async function saveMeta() {
  try {
    if (!selected.value?.id) {
      const created = await ivr.createFlow({
        name: editName.value,
        graph: JSON.parse(graphJson.value),
      });
      useAlert(t('BLINKONE.TELEPHONY.IVR.CREATED'));
      await load();
      selectFlow(flows.value.find(f => f.id === created.id) || created);
      return;
    }
    await ivr.patchFlow(selected.value.id, {
      name: editName.value,
      isDefault: editDefault.value,
    });
    useAlert(t('BLINKONE.TELEPHONY.IVR.SAVED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function publish() {
  let graph;
  try {
    graph = JSON.parse(graphJson.value);
  } catch {
    useAlert(t('BLINKONE.TELEPHONY.INVALID_JSON'));
    return;
  }
  if (!selected.value?.id) {
    useAlert(t('BLINKONE.TELEPHONY.IVR.SAVE_FIRST'));
    return;
  }
  try {
    await ivr.publishVersion(selected.value.id, {
      graph,
      comment: versionComment.value || undefined,
      setActive: true,
    });
    versionComment.value = '';
    useAlert(t('BLINKONE.TELEPHONY.IVR.PUBLISHED'));
    await load();
    selectFlow(flows.value.find(f => f.id === selected.value.id));
  } catch (e) {
    useAlert(e.message);
  }
}

async function activate(v) {
  try {
    await ivr.patchFlow(selected.value.id, { activeVersionId: v.id });
    useAlert(t('BLINKONE.TELEPHONY.IVR.ACTIVATED', { n: v.version }));
    await load();
    selectFlow(flows.value.find(f => f.id === selected.value.id));
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.TELEPHONY.IVR.TITLE')"
      :description="t('BLINKONE.TELEPHONY.IVR.DESCRIPTION')"
    />
    <div class="flex flex-wrap gap-2 mb-4">
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
      <Button :label="t('BLINKONE.TELEPHONY.IVR.NEW_FLOW')" @click="newFlow" />
    </div>

    <div class="grid lg:grid-cols-3 gap-4">
      <section class="lg:col-span-1 space-y-2">
        <h3 class="text-xs font-medium text-n-slate-11 uppercase">
          {{ t('BLINKONE.TELEPHONY.IVR.FLOWS') }}
        </h3>
        <button
          v-for="f in flows"
          :key="f.id"
          type="button"
          class="w-full text-left rounded-lg border p-3 transition"
          :class="selected?.id === f.id ? 'border-n-brand bg-n-alpha-1' : 'border-n-weak'"
          @click="selectFlow(f)"
        >
          <div class="font-medium text-sm">{{ f.name }}</div>
          <div class="text-xs text-n-slate-11 mt-1">
            v{{ f.activeVersion ?? '?' }}
            <span v-if="f.isDefault" class="text-n-amber-11 ml-1">default</span>
          </div>
        </button>
        <p v-if="!flows.length && !loading" class="text-sm text-n-slate-11">
          {{ t('BLINKONE.TELEPHONY.IVR.EMPTY') }}
        </p>
      </section>

      <section v-if="selected" class="lg:col-span-2 space-y-4">
        <div class="rounded-lg border border-n-weak p-4">
          <label class="text-xs text-n-slate-11 block mb-1">{{ t('BLINKONE.TELEPHONY.IVR.FLOW_NAME') }}</label>
          <input v-model="editName" class="w-full mb-3 rounded border border-n-weak bg-n-solid-1 px-3 py-2 text-sm" />
          <label class="flex items-center gap-2 text-sm mb-3">
            <input v-model="editDefault" type="checkbox" />
            {{ t('BLINKONE.TELEPHONY.IVR.DEFAULT_FLOW') }}
          </label>
          <Button :label="t('BLINKONE.TELEPHONY.IVR.SAVE_META')" @click="saveMeta" />
        </div>

        <div>
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-xs font-medium text-n-slate-11 uppercase">
              {{ t('BLINKONE.TELEPHONY.IVR.GRAPH') }}
            </h3>
            <Button :label="t('BLINKONE.TELEPHONY.IVR.PUBLISH')" @click="publish" />
          </div>
          <textarea
            v-model="graphJson"
            rows="14"
            class="w-full font-mono text-xs rounded border border-n-weak bg-n-solid-1 p-3"
          />
          <input
            v-model="versionComment"
            class="w-full mt-2 rounded border border-n-weak bg-n-solid-1 px-3 py-2 text-sm"
            :placeholder="t('BLINKONE.TELEPHONY.IVR.VERSION_COMMENT')"
          />
        </div>

        <div>
          <h3 class="text-xs font-medium text-n-slate-11 uppercase mb-2">
            {{ t('BLINKONE.TELEPHONY.IVR.VERSIONS') }}
          </h3>
          <div class="space-y-2 max-h-40 overflow-y-auto">
            <div
              v-for="v in versions"
              :key="v.id || v.version"
              class="flex justify-between items-center rounded border border-n-weak p-2 text-sm"
            >
              <span>
                <span class="font-mono">v{{ v.version }}</span>
                <span v-if="v.comment" class="text-n-slate-11 ml-2">{{ v.comment }}</span>
              </span>
              <Button
                v-if="selected.activeVersionId !== v.id && selected.activeVersion !== v.version"
                size="sm"
                variant="ghost"
                :label="t('BLINKONE.TELEPHONY.IVR.ACTIVATE')"
                @click="activate(v)"
              />
              <span v-else class="text-xs text-n-teal-11">{{ t('BLINKONE.TELEPHONY.IVR.ACTIVE') }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </SettingsLayout>
</template>
