<script lang="ts" setup>
import { h } from "vue";
import { getPaginationRowModel } from "@tanstack/vue-table";
import type { TableColumn } from "@nuxt/ui";
import * as XLSX from "xlsx/xlsx.mjs";

interface ClassifiedComment {
  index: number;
  date: string;
  author: string;
  type: string;
  viContent: string;
  zhContent: string;
  categoryName: string;
}

const props = defineProps<{
  comments: ClassifiedComment[];
  loading?: boolean;
}>();

// Color mapping cho các category phổ biến
const colorMap: Record<string, string> = {
  演员演技: "bg-purple-100 text-purple-800",
  特效制作: "bg-blue-100 text-blue-800",
  剧情改编: "bg-green-100 text-green-800",
  配音音乐: "bg-yellow-100 text-yellow-800",
  怀旧回忆: "bg-pink-100 text-pink-800",
  版本对比: "bg-indigo-100 text-indigo-800",
  赞美推荐: "bg-emerald-100 text-emerald-800",
  批评差评: "bg-red-100 text-red-800",
  提问疑问: "bg-orange-100 text-orange-800",
  经典作品: "bg-cyan-100 text-cyan-800",
  童年回忆: "bg-rose-100 text-rose-800",
  文化传承: "bg-lime-100 text-lime-800",
};

// Hàm lấy màu cho category - dùng hash để tạo màu nhất quán
const getCategoryColor = (categoryName: string): string => {
  if (colorMap[categoryName]) {
    return colorMap[categoryName];
  }

  // Tạo màu dựa trên hash của category name
  const colors = [
    "bg-purple-100 text-purple-800",
    "bg-blue-100 text-blue-800",
    "bg-green-100 text-green-800",
    "bg-yellow-100 text-yellow-800",
    "bg-pink-100 text-pink-800",
    "bg-indigo-100 text-indigo-800",
    "bg-emerald-100 text-emerald-800",
    "bg-orange-100 text-orange-800",
    "bg-cyan-100 text-cyan-800",
    "bg-rose-100 text-rose-800",
  ];

  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length] || "bg-gray-100 text-gray-800";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = useTemplateRef<any>("table");
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
      comment.zhContent.toLowerCase().includes(query) ||
      comment.categoryName.toLowerCase().includes(query)
  );
});

// Pagination
const total = computed((): number => {
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
const columns: TableColumn<ClassifiedComment>[] = [
  {
    accessorKey: "date",
    header: "日期",
    cell: ({ row }) => row.getValue("date"),
  },
  {
    accessorKey: "author",
    header: "账号名",
    cell: ({ row }) => row.getValue("author"),
  },
  {
    accessorKey: "type",
    header: "类型",
    cell: ({ row }) => row.getValue("type"),
  },
  {
    accessorKey: "zhContent",
    header: "中文评论内容",
    cell: ({ row }) => {
      const content = row.getValue("zhContent") as string;
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
    accessorKey: "categoryName",
    header: "分类",
    cell: ({ row }) => {
      const categoryName = row.getValue("categoryName") as string;
      const color = getCategoryColor(categoryName);
      return h(
        "div",
        {
          class: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`,
        },
        categoryName
      );
    },
  },
];

// Export classified
const exportClassified = () => {
  const data = props.comments.map((c) => ({
    序号: c.index + 1,
    日期: c.date,
    账号名: c.author,
    类型: c.type,
    越南语评论内容: c.viContent,
    中文评论内容: c.zhContent,
    分类: c.categoryName,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Classified Comments");

  const timestamp = Date.now();
  XLSX.writeFile(wb, `classified_comments_${timestamp}.xlsx`);
};

watch(searchQuery, () => {
  table.value?.tableApi?.setPageIndex(0);
});
</script>

<template>
  <div>
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
      <h2 class="text-xl font-bold">Kết quả phân loại</h2>

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
          @click="exportClassified">
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
