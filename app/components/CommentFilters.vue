<script lang="ts" setup>
import type { FilterOptions } from "../types/comment";

const props = defineProps<{
  modelValue: FilterOptions;
  total: number;
  filtered: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: FilterOptions];
}>();

const filters = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const removedCount = computed(() => props.total - props.filtered);
</script>

<template>
  <TobiCard class="mb-6">
    <h3 class="text-lg font-semibold mb-4">Bộ lọc bình luận</h3>

    <div class="space-y-3">
      <TobiCheckbox
        v-model="filters.removeEmojiOnly"
        label="Chỉ có icon (emoji only)" />

      <TobiCheckbox
        v-model="filters.removeAdvertisements"
        label="Có mục đích quảng cáo hoặc có link quảng cáo" />

      <TobiCheckbox
        v-model="filters.removeGenericComments"
        label="Quá ngắn, quá đơn điệu" />
    </div>

    <TobiSeparator class="my-4" />

    <div class="text-sm space-y-1">
      <div class="flex justify-between">
        <span class="text-gray-600">Tổng comments:</span>
        <span class="font-semibold">{{ total }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">Sau khi lọc:</span>
        <span class="font-semibold text-green-600">{{ filtered }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600">Đã bị lọc:</span>
        <span class="font-semibold text-red-600">{{ removedCount }}</span>
      </div>
    </div>
  </TobiCard>
</template>
