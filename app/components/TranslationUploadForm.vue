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

const startTranslation = () => {
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
          <h3 class="text-lg font-semibold">Dịch Comments sang Tiếng Trung</h3>
          <p class="text-sm text-gray-600 mt-1">
            Tải lên file Excel đã xuất để dịch sang tiếng Trung giản thể
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
              Chọn file Excel
            </TobiButton>
            <p class="text-sm text-gray-500 mt-2">hoặc kéo thả file vào đây</p>
          </div>
          <p class="text-xs text-gray-400">Hỗ trợ: .xlsx, .xls</p>
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
            <TobiButton color="primary" size="md" @click="startTranslation">
              <template #leading>
                <TobiIcon name="i-heroicons-language" />
              </template>
              Bắt đầu dịch
            </TobiButton>
            <TobiButton variant="outline" size="md" @click="removeFile">
              <template #leading>
                <TobiIcon name="i-heroicons-x-mark" />
              </template>
              Xoá
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
          <div class="text-sm space-y-1">
            <p class="font-medium">Lưu ý:</p>
            <ul class="list-disc list-inside space-y-1">
              <li>File Excel phải được xuất từ hệ thống này</li>
              <li>Hỗ trợ dịch từ viết tắt tiếng Việt (đc, ko, cx, v.v...)</li>
              <li>Giữ nguyên emoji và links</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </TobiCard>
</template>
