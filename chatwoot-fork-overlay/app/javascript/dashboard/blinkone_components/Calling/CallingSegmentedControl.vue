<script setup>
defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true },
});
const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div class="flex border-b border-n-weak" role="tablist">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      role="tab"
      class="flex-1 py-2 text-xs font-medium text-center border-b-2 -mb-px transition-colors"
      :class="
        modelValue === opt.value
          ? 'text-n-brand border-n-brand'
          : 'text-n-slate-11 border-transparent hover:text-n-slate-12'
      "
      :aria-selected="modelValue === opt.value"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
      <span
        v-if="opt.badge"
        class="ml-1 inline-flex min-w-[1rem] h-4 px-1 rounded-full bg-ruby-500 text-white text-[10px] font-semibold align-middle"
      >
        {{ opt.badge }}
      </span>
    </button>
  </div>
</template>
