<script lang="ts" setup>
const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  export: [];
}>();
</script>

<template>
  <TobiButton
    :disabled="disabled"
    color="success"
    variant="outline"
    size="md"
    class="w-full sm:w-auto"
    @click="emit('export')">
    <template #leading>
      <Icon name="i-heroicons-arrow-down-tray" />
    </template>
    Xuất Excel
  </TobiButton>
</template>
