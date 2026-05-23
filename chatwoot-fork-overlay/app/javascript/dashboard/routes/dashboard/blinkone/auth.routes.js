import SsoCallback from 'dashboard/blinkone_components/auth/SsoCallback.vue';

export default {
  routes: [
    {
      path: '/blinkone/auth/callback',
      name: 'blinkone_sso_callback',
      component: SsoCallback,
      meta: { public: true },
    },
  ],
};
