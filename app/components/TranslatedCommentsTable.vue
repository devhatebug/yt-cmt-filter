<script lang="ts" setup>
import { h } from "vue";
import { getPaginationRowModel } from "@tanstack/vue-table";
import type { TableColumn } from "@nuxt/ui";
import * as XLSX from "xlsx/xlsx.mjs";

interface TranslatedComment {
  index: number;
  date: string;
  author: string;
  type: string;
  content: string;
  translatedContent: string;
}

const props = defineProps<{
  comments: TranslatedComment[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  exportTranslated: [];
}>();

const table = useTemplateRef("table");
const searchQuery = ref("");
const pageSize = 50;

const pagination = ref({
  pageIndex: 0,
  pageSize: pageSize,
});

// Search
const searchedComments = computed(() => {
  if (!searchQuery.value) return props.comments;

  const query = searchQuery.value.toLowerCase();
  return props.comments.filter(
    (comment) =>
      comment.author.toLowerCase().includes(query) ||
      comment.content.toLowerCase().includes(query) ||
      comment.translatedContent.toLowerCase().includes(query)
  );
});

// Pagination
const total = computed(() => {
  return table.value?.tableApi?.getFilteredRowModel().rows.length || 0;
});

const currentPage = computed(() => {
  return (table.value?.tableApi?.getState().pagination.pageIndex || 0) + 1;
});

const startIndex = computed(() => {
  const pageIndex = table.value?.tableApi?.getState().pagination.pageIndex || 0;
  return pageIndex * pageSize + 1;
});

const endIndex = computed(() => {
  const pageIndex = table.value?.tableApi?.getState().pagination.pageIndex || 0;
  return Math.min((pageIndex + 1) * pageSize, total.value);
});

// Columns
const columns: TableColumn<TranslatedComment>[] = [
  {
    accessorKey: "date",
    header: "Ngày",
    cell: ({ row }) => row.getValue("date"),
  },
  {
    accessorKey: "author",
    header: "Người cmt",
    cell: ({ row }) => row.getValue("author"),
  },
  {
    accessorKey: "content",
    header: "Tiếng Việt",
    cell: ({ row }) => {
      const content = row.getValue("content") as string;
      return h(
        "div",
        {
          class: "max-w-md break-words whitespace-normal text-sm",
        },
        content
      );
    },
  },
  {
    accessorKey: "translatedContent",
    header: "中文 (Tiếng Trung)",
    cell: ({ row }) => {
      const translated = row.getValue("translatedContent") as string;
      return h(
        "div",
        {
          class:
            "max-w-md break-words whitespace-normal text-sm font-medium text-blue-600",
        },
        translated
      );
    },
  },
];

// Export translated
const exportTranslated = () => {
  const data = props.comments.map((c) => ({
    Ngày: c.date,
    "Người cmt": c.author,
    Loại: c.type,
    "Tiếng Việt": c.content,
    "中文 (Tiếng Trung)": c.translatedContent,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Translated Comments");

  const timestamp = Date.now();
  XLSX.writeFile(wb, `translated_comments_${timestamp}.xlsx`);
};

watch(searchQuery, () => {
  table.value?.tableApi?.setPageIndex(0);
});
</script>

<template>
  <div>
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
      <h2 class="text-xl font-bold">Kết quả dịch</h2>

      <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
        <TobiInput
          v-model="searchQuery"
          placeholder="Tìm kiếm..."
          icon="i-heroicons-magnifying-glass"
          size="md"
          class="w-full sm:w-64" />

        <TobiButton
          :disabled="!comments.length"
          color="success"
          variant="outline"
          size="md"
          class="w-full sm:w-auto"
          @click="exportTranslated">
          <template #leading>
            <TobiIcon name="i-heroicons-arrow-down-tray" />
          </template>
          Xuất Excel
        </TobiButton>
      </div>
    </div>

    <div class="overflow-x-auto">
      <TobiTable
        ref="table"
        v-model:pagination="pagination"
        :data="searchedComments"
        :columns="columns"
        :loading="loading"
        :pagination-options="{
          getPaginationRowModel: getPaginationRowModel(),
        }"
        class="w-full" />
    </div>

    <div
      v-if="total > pageSize"
      class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
      <div class="text-sm text-gray-500">
        Hiển thị {{ startIndex }}-{{ endIndex }} của {{ total }} comments
      </div>
      <TobiPagination
        :default-page="currentPage"
        :items-per-page="pageSize"
        :total="total"
        @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)" />
    </div>
  </div>
</template>
