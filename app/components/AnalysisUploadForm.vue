<script lang="ts" setup>
const emit = defineEmits<{
  upload: [file: File];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const isDragging = ref(false);

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && isValidExcelFile(file)) {
    selectedFile.value = file;
  }
};

const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file && isValidExcelFile(file)) {
    selectedFile.value = file;
  }
};

const isValidExcelFile = (file: File): boolean => {
  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
  return validTypes.includes(file.type) || file.name.endsWith(".xlsx");
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const startAnalysis = () => {
  if (selectedFile.value) {
    emit("upload", selectedFile.value);
  }
};

const removeFile = () => {
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = "";
  }
};
</script>

<template>
  <TobiCard>
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold">评论综合分析</h3>
          <p class="text-sm text-gray-600 mt-1">
            上传 Excel 文件，AI 将自动进行词频、情感和主题三重分析
          </p>
        </div>
      </div>

      <!-- Drop Zone -->
      <div
        :class="[
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors border-[var(--ui-border-muted)]',
        ]"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop">
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="handleFileSelect" />

        <div v-if="!selectedFile" class="space-y-3">
          <TobiIcon
            name="i-heroicons-cloud-arrow-up"
            class="mx-auto h-12 w-12 text-gray-400" />
          <div>
            <TobiButton variant="outline" size="sm" @click="triggerFileInput">
              选择 Excel 文件
            </TobiButton>
            <p class="text-sm text-gray-500 mt-2">或拖拽文件到这里</p>
          </div>
          <p class="text-xs text-gray-400">支持: .xlsx, .xls</p>
        </div>

        <div v-else class="space-y-3">
          <TobiIcon
            name="i-heroicons-document-check"
            class="mx-auto h-12 w-12 text-green-500" />
          <div>
            <p class="font-medium">{{ selectedFile.name }}</p>
            <p class="text-sm text-[var(--ui-text-muted)]">
              {{ (selectedFile.size / 1024).toFixed(2) }} KB
            </p>
          </div>
          <div class="flex gap-2 justify-center">
            <TobiButton color="primary" size="md" @click="startAnalysis">
              <template #leading>
                <TobiIcon name="i-heroicons-chart-bar" />
              </template>
              Bắt đầu phân tích
            </TobiButton>
            <TobiButton variant="outline" size="md" @click="removeFile">
              <template #leading>
                <TobiIcon name="i-heroicons-x-mark" />
              </template>
              Xóa file
            </TobiButton>
          </div>
        </div>
      </div>

      <!-- Info -->
      <div class="border border-[var(--ui-border-muted)] rounded-lg p-4">
        <div class="flex gap-3">
          <TobiIcon
            name="i-heroicons-information-circle"
            class="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div class="text-sm space-y-2">
            <p class="font-medium">Nội dung phân tích:</p>
            <ul class="list-disc list-inside space-y-1">
              <li>
                📊 <strong>Phân tích tần suất từ</strong>: Trích xuất Top 20 từ
                khóa phổ biến
              </li>
              <li>
                💭 <strong>Phân tích cảm xúc</strong>: Nhận diện tích cực/trung
                lập/tiêu cực
              </li>
              <li>
                🏷️ <strong>Phân loại chủ đề</strong>: AI tự động tổng hợp chủ đề
                bình luận (diễn viên, kịch bản, hiệu ứng, v.v.)
              </li>
            </ul>

            <div class="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
              <p
                class="font-medium text-blue-900 text-xs flex items-center gap-1">
                <TobiIcon name="i-heroicons-sparkles" class="h-3 w-3" />
                Phân tích toàn diện, có thể mất vài phút
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </TobiCard>
</template>
