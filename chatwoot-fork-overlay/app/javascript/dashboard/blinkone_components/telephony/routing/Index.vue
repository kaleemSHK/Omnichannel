<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const { routing } = useBlinkoneApi();

const agents = ref([]);
const queues = ref([]);
const loading = ref(false);
const newQueue = ref({ key: '', name: '', skills: '' });
const newAgent = ref({ id: '1000', skills: 'sales,support', status: 'available' });

const totalWaiting = computed(() =>
  queues.value.reduce((n, q) => n + (q._waiting ?? 0), 0),
);

const availableCount = computed(() => agents.value.filter(a => a.status === 'available').length);
const busyCount = computed(() => agents.value.filter(a => a.status === 'busy').length);

async function load() {
  loading.value = true;
  try {
    const [agentList, queueList] = await Promise.all([
      routing.listAgents(),
      routing.listQueues(),
    ]);
    agents.value = agentList;
    let wait = 0;
    for (const q of queueList) {
      try {
        const st = await routing.queueStats(q.id);
        q._waiting = st.waiting ?? 0;
        wait += q._waiting;
      } catch {
        q._waiting = 0;
      }
    }
    queues.value = queueList;
  } catch (e) {
    useAlert(e.message);
  } finally {
    loading.value = false;
  }
}

async function createQueue() {
  try {
    const skills = newQueue.value.skills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(skill => ({ skill }));
    await routing.createQueue({
      queueKey: newQueue.value.key,
      name: newQueue.value.name || newQueue.value.key,
      skills,
    });
    newQueue.value = { key: '', name: '', skills: '' };
    useAlert(t('BLINKONE.TELEPHONY.ROUTING.QUEUE_CREATED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

async function registerAgent() {
  try {
    const skills = newAgent.value.skills.split(',').map(s => s.trim()).filter(Boolean);
    await routing.registerAgent({
      agentId: newAgent.value.id,
      skills,
      queueKeys: ['sales', 'support', 'default'],
      status: newAgent.value.status,
    });
    await routing.setAgentState(newAgent.value.id, {
      status: newAgent.value.status,
      skills,
    });
    useAlert(t('BLINKONE.TELEPHONY.ROUTING.AGENT_REGISTERED'));
    await load();
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <SettingsLayout>
    <BaseSettingsHeader
      :title="t('BLINKONE.TELEPHONY.ROUTING.TITLE')"
      :description="t('BLINKONE.TELEPHONY.ROUTING.DESCRIPTION')"
    />
    <div class="flex gap-2 mb-4">
      <Button :label="t('BLINKONE.TELEPHONY.REFRESH')" @click="load" />
    </div>

    <div class="grid grid-cols-3 gap-3 mb-6">
      <div class="rounded-lg border border-n-weak p-4 text-center">
        <div class="text-2xl font-semibold text-n-teal-11">{{ availableCount }}</div>
        <div class="text-sm text-n-slate-11">{{ t('BLINKONE.TELEPHONY.ROUTING.AVAILABLE') }}</div>
      </div>
      <div class="rounded-lg border border-n-weak p-4 text-center">
        <div class="text-2xl font-semibold text-n-brand">{{ busyCount }}</div>
        <div class="text-sm text-n-slate-11">{{ t('BLINKONE.TELEPHONY.ROUTING.BUSY') }}</div>
      </div>
      <div class="rounded-lg border border-n-weak p-4 text-center">
        <div class="text-2xl font-semibold text-n-amber-11">{{ totalWaiting }}</div>
        <div class="text-sm text-n-slate-11">{{ t('BLINKONE.TELEPHONY.ROUTING.WAITING') }}</div>
      </div>
    </div>

    <section class="mb-8">
      <h3 class="text-xs font-medium text-n-slate-11 uppercase mb-3">
        {{ t('BLINKONE.TELEPHONY.ROUTING.QUEUES') }}
      </h3>
      <div class="space-y-2 mb-3">
        <div
          v-for="q in queues"
          :key="q.id"
          class="rounded-lg border border-n-weak p-3 flex justify-between"
        >
          <div>
            <div class="font-medium">{{ q.name }}</div>
            <div class="text-xs text-n-slate-11">
              {{ q.queueKey }} · {{ q.selectionAlgorithm }}
            </div>
          </div>
          <span class="text-xs text-n-slate-11">{{ q._waiting ?? 0 }} waiting</span>
        </div>
      </div>
      <div class="rounded-lg border border-n-weak p-4 grid sm:grid-cols-3 gap-2">
        <input v-model="newQueue.key" :placeholder="t('BLINKONE.TELEPHONY.ROUTING.QUEUE_KEY')" class="rounded border border-n-weak bg-n-solid-1 px-3 py-2 text-sm" />
        <input v-model="newQueue.name" :placeholder="t('BLINKONE.TELEPHONY.ROUTING.QUEUE_NAME')" class="rounded border border-n-weak bg-n-solid-1 px-3 py-2 text-sm" />
        <input v-model="newQueue.skills" placeholder="sales, support" class="rounded border border-n-weak bg-n-solid-1 px-3 py-2 text-sm" />
        <Button class="sm:col-span-3" :label="t('BLINKONE.TELEPHONY.ROUTING.ADD_QUEUE')" @click="createQueue" />
      </div>
    </section>

    <section>
      <h3 class="text-xs font-medium text-n-slate-11 uppercase mb-3">
        {{ t('BLINKONE.TELEPHONY.ROUTING.AGENTS') }}
      </h3>
      <div class="rounded-lg border border-n-weak p-4 grid sm:grid-cols-4 gap-2 mb-4">
        <input v-model="newAgent.id" placeholder="agent id" class="rounded border border-n-weak bg-n-solid-1 px-3 py-2 text-sm" />
        <input v-model="newAgent.skills" placeholder="skills" class="rounded border border-n-weak bg-n-solid-1 px-3 py-2 text-sm" />
        <select v-model="newAgent.status" class="rounded border border-n-weak bg-n-solid-1 px-3 py-2 text-sm">
          <option value="available">available</option>
          <option value="busy">busy</option>
          <option value="away">away</option>
          <option value="offline">offline</option>
        </select>
        <Button :label="t('BLINKONE.TELEPHONY.ROUTING.REGISTER_AGENT')" @click="registerAgent" />
      </div>
      <div class="space-y-2">
        <div
          v-for="a in agents"
          :key="`${a.tenantId}:${a.agentId}`"
          class="rounded-lg border border-n-weak p-3 flex justify-between"
        >
          <div>
            <div class="font-medium">{{ a.agentId }}</div>
            <div class="text-xs text-n-slate-11">
              {{ (a.skills || []).join(', ') || '—' }}
            </div>
          </div>
          <span class="text-xs px-2 py-0.5 rounded bg-n-alpha-1">{{ a.status }}</span>
        </div>
        <p v-if="!agents.length && !loading" class="text-sm text-n-slate-11">
          {{ t('BLINKONE.TELEPHONY.ROUTING.NO_AGENTS') }}
        </p>
      </div>
    </section>
  </SettingsLayout>
</template>

