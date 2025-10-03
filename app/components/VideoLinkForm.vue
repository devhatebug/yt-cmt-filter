<script lang="ts" setup>
const props = defineProps<{
  modelValue: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
}>();

const videoUrl = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const isValidUrl = computed(() => {
  if (!videoUrl.value) return false;
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  return regex.test(videoUrl.value);
});

const handleSubmit = () => {
  if (isValidUrl.value && !props.loading) {
    emit("submit");
  }
};
</script>

<template>
  <TobiCard>
    <div class="flex flex-col md:flex-row gap-4">
      <div class="flex-1">
        <TobiFormField label="Link video YouTube" name="videoUrl">
          <TobiInput
            v-model="videoUrl"
            placeholder="https://www.youtube.com/watch?v=..."
            icon="i-heroicons-play-circle"
            size="lg"
            class="w-full"
            @keyup.enter="handleSubmit" />
        </TobiFormField>
      </div>
      <div class="flex items-end">
        <TobiButton
          :loading="props.loading"
          :disabled="!isValidUrl || loading"
          icon="i-heroicons-arrow-down-tray"
          color="primary"
          size="lg"
          block
          class="w-full md:w-auto"
          @click="handleSubmit">
          Lấy dữ liệu
        </TobiButton>
      </div>
    </div>
  </TobiCard>
</template>
