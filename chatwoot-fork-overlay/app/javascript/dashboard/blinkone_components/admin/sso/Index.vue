<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';
import BaseSettingsHeader from 'dashboard/routes/dashboard/settings/components/BaseSettingsHeader.vue';
import SettingsLayout from 'dashboard/routes/dashboard/settings/SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import BlinkoneFeatureGate from 'dashboard/blinkone_components/BlinkoneFeatureGate.vue';

const { t } = useI18n();
const { integration, tenantId } = useBlinkoneApi();
const cfg = ref({ slug: '', providerType: 'oidc', clientId: '', discoveryUrl: '', enabled: false });
const loginUrl = ref('');

async function load() {
  try {
    const c = await integration.getSsoConfig();
    if (c?.configured !== false) cfg.value = { ...cfg.value, ...c };
  } catch (e) {
    useAlert(e.message);
  }
}

async function save() {
  try {
    cfg.value = await integration.saveSsoConfig({ ...cfg.value, provision: true });
    useAlert(t('BLINKONE.SSO.SAVED'));
  } catch (e) {
    useAlert(e.message);
  }
}

async function previewLogin() {
  try {
    const r = await integration.ssoLoginUrl(cfg.value.slug || tenantId.value, tenantId.value);
    loginUrl.value = r.loginUrl;
  } catch (e) {
    useAlert(e.message);
  }
}

onMounted(load);
</script>

<template>
  <BlinkoneFeatureGate feature="sso">
    <SettingsLayout>
      <BaseSettingsHeader :title="t('BLINKONE.SSO.TITLE')" :description="t('BLINKONE.SSO.DESCRIPTION')" />
      <div class="space-y-3 max-w-lg">
        <input v-model="cfg.slug" class="w-full rounded border border-n-weak px-3 py-2 text-sm" placeholder="tenant-slug" />
        <select v-model="cfg.providerType" class="w-full rounded border border-n-weak px-3 py-2 text-sm">
          <option value="oidc">OIDC (Azure AD / Google / Okta)</option>
          <option value="saml">SAML (AD FS)</option>
          <option value="ldap">LDAP / AD</option>
        </select>
        <input v-model="cfg.clientId" class="w-full rounded border border-n-weak px-3 py-2 text-sm" placeholder="Client ID" />
        <input v-model="cfg.discoveryUrl" class="w-full rounded border border-n-weak px-3 py-2 text-sm" placeholder="OIDC discovery URL" />
        <label class="flex items-center gap-2 text-sm">
          <input v-model="cfg.enabled" type="checkbox" />
          {{ t('BLINKONE.SSO.ENABLED') }}
        </label>
        <div class="flex gap-2">
          <Button :label="t('BLINKONE.SSO.SAVE')" @click="save" />
          <Button :label="t('BLINKONE.SSO.PREVIEW_LOGIN')" @click="previewLogin" />
        </div>
        <p v-if="loginUrl" class="text-xs break-all text-n-slate-11">{{ loginUrl }}</p>
      </div>
    </SettingsLayout>
  </BlinkoneFeatureGate>
</template>
