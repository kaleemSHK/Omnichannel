<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBlinkoneApi } from 'shared/blinkone/useBlinkoneApi';

const route = useRoute();
const router = useRouter();
const { integration } = useBlinkoneApi();
const error = ref('');
const status = ref('Completing sign-in…');

onMounted(async () => {
  const code = route.query.code;
  const state = route.query.state;
  if (!code) {
    error.value = 'Missing authorization code';
    return;
  }
  try {
    const result = await integration.ssoCallback({ code, state });
    if (result.gatewayToken) {
      sessionStorage.setItem('blinkoneGatewayToken', result.gatewayToken);
    }
    status.value = 'Signed in. Redirecting…';
    const target = result.redirectTo || '/';
    await router.replace(target);
  } catch (e) {
    error.value = e.message || 'SSO callback failed';
  }
});
</script>

<template>
  <div class="flex min-h-[40vh] items-center justify-center p-8">
    <div class="text-center max-w-md">
      <p v-if="error" class="text-sm text-ruby-11">{{ error }}</p>
      <p v-else class="text-sm text-n-slate-11">{{ status }}</p>
    </div>
  </div>
</template>
