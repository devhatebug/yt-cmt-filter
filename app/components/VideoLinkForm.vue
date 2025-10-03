<script lang="ts" setup>
const props = defineProps<{
  modelValue: string;
  loading?: boolean;
  progress?: {
    current: number;
    total: number;
  };
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  submit: [];
}>();

const progressPercent = computed(() => {
  if (!props.progress || props.progress.total === 0) return 0;
  return Math.round((props.progress.current / props.progress.total) * 100);
});

const progressText = computed(() => {
  if (!props.progress || !props.loading) return "";
  if (props.progress.total > 0) {
    return `Đang tải ${props.progress.current} / ${props.progress.total} comments...`;
  }
  return `Đang tải ${props.progress.current} comments...`;
});

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

    <!-- Progress Bar -->
    <div v-if="loading && progress" class="mt-4">
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm text-gray-600">{{ progressText }}</span>
        <span class="text-sm font-semibold text-primary-600">
          {{ progressPercent }}%
        </span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2.5">
        <div
          class="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
          :style="{ width: `${progressPercent}%` }"></div>
      </div>
    </div>
  </TobiCard>
</template>
