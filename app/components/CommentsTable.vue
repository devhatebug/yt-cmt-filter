<script lang="ts" setup>
import { h } from "vue";
import { getPaginationRowModel } from "@tanstack/vue-table";
import type { TableColumn } from "@nuxt/ui";
import type { YouTubeComment } from "../types/comment";
import {
  formatDate,
  formatYouTubeComment,
  truncateHtml,
  stripHtmlTags,
} from "../utils/format";

const props = defineProps<{
  comments: YouTubeComment[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  export: [];
}>();

const table = useTemplateRef("table");
const searchQuery = ref("");
const pageSize = 50;

// Pagination state cho TanStack Table
const pagination = ref({
  pageIndex: 0,
  pageSize: pageSize,
});

// State để track comments đã expand
const expandedComments = ref<Set<string>>(new Set());
const MAX_COMMENT_LENGTH = 200; // Số ký tự tối đa trước khi cần "Xem thêm"

// Toggle expand/collapse comment
const toggleComment = (commentId: string) => {
  if (expandedComments.value.has(commentId)) {
    expandedComments.value.delete(commentId);
  } else {
    expandedComments.value.add(commentId);
  }
};

// Utility: Flatten comments + replies thành danh sách phẳng
interface FlatComment extends YouTubeComment {
  level: number; // 0 = comment cha, 1 = reply
  parentAuthor?: string; // Tên tác giả comment cha (nếu là reply)
}

const flattenComments = (comments: YouTubeComment[]): FlatComment[] => {
  const flattened: FlatComment[] = [];

  comments.forEach((comment) => {
    // Thêm comment cha
    flattened.push({
      ...comment,
      level: 0,
    });

    // Thêm các replies
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.forEach((reply) => {
        flattened.push({
          ...reply,
          level: 1,
          parentAuthor: comment.author,
        });
      });
    }
  });

  return flattened;
};

// Flatten tất cả comments
const allComments = computed(() => flattenComments(props.comments));

// Search và filter
const searchedComments = computed(() => {
  if (!searchQuery.value) return allComments.value;

  const query = searchQuery.value.toLowerCase();
  return allComments.value.filter(
    (comment) =>
      comment.author.toLowerCase().includes(query) ||
      comment.content.toLowerCase().includes(query) ||
      comment.parentAuthor?.toLowerCase().includes(query)
  );
});

// Computed cho pagination display
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

// Columns definition theo TanStack Table API
const columns: TableColumn<FlatComment>[] = [
  {
    accessorKey: "date",
    header: "Ngày cmt",
    cell: ({ row }) => formatDate(row.getValue("date")),
  },
  {
    accessorKey: "author",
    header: "Người cmt",
    cell: ({ row }) => {
      const comment = row.original;
      if (comment.level === 1 && comment.parentAuthor) {
        return h("div", { class: "flex flex-col" }, [
          h("span", { class: "font-medium" }, row.getValue("author")),
          h(
            "span",
            { class: "text-xs text-gray-500" },
            `↳ Trả lời ${comment.parentAuthor}`
          ),
        ]);
      }
      return row.getValue("author");
    },
  },
  {
    accessorKey: "content",
    header: "Nội dung cmt",
    cell: ({ row }) => {
      const comment = row.original;
      const paddingClass = comment.level === 1 ? "pl-6" : "";

      const content = row.getValue("content") as string;
      const formattedContent = formatYouTubeComment(content);
      const plainText = stripHtmlTags(formattedContent);
      const isExpanded = expandedComments.value.has(comment.id);
      const needsTruncate = plainText.length > MAX_COMMENT_LENGTH;

      // Nội dung hiển thị
      let displayContent = formattedContent;
      if (needsTruncate && !isExpanded) {
        displayContent =
          truncateHtml(formattedContent, MAX_COMMENT_LENGTH) + "...";
      }

      // Thêm icon reply cho level 1
      if (comment.level === 1) {
        displayContent = `<span class="text-blue-500 mr-1 font-bold">↳</span> ${displayContent}`;
      }

      // Tạo container với content và button "Xem thêm"
      const children = [
        h("div", {
          class: "comment-text",
          innerHTML: displayContent,
        }),
      ];

      // Thêm button "Xem thêm" / "Thu gọn" nếu cần
      if (needsTruncate) {
        children.push(
          h(
            "button",
            {
              class:
                "text-blue-500 hover:text-blue-700 text-sm font-medium mt-1 focus:outline-none",
              onClick: (e: Event) => {
                e.stopPropagation();
                toggleComment(comment.id);
              },
            },
            isExpanded ? "Thu gọn" : "Xem thêm"
          )
        );
      }

      return h(
        "div",
        {
          class: `max-w-xl break-words whitespace-normal ${paddingClass} py-1 rounded comment-content`,
        },
        children
      );
    },
  },
  {
    accessorKey: "likeCount",
    header: () => h("div", { class: "text-right" }, "Số lượng thích"),
    cell: ({ row }) => {
      return h(
        "div",
        { class: "text-right font-medium" },
        row.getValue("likeCount")
      );
    },
  },
];

// Reset page khi search thay đổi
watch(searchQuery, () => {
  table.value?.tableApi?.setPageIndex(0);
});
</script>

<template>
  <div>
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
      <h2 class="text-xl font-bold">Danh sách bình luận</h2>

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
          icon="i-heroicons-arrow-down-tray"
          label="Xuất Excel"
          block
          class="w-full sm:w-auto"
          @click="emit('export')" />
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

<style scoped>
:deep(.comment-content) {
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

:deep(.comment-content a) {
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.2s;
}

:deep(.comment-content a:hover) {
  color: #2563eb;
  text-decoration: underline;
}

:deep(.comment-content br) {
  display: block;
  content: "";
  margin-bottom: 0.25rem;
}

/* Preserve whitespace và line breaks */
:deep(.comment-content) {
  white-space: pre-wrap;
}

/* Button Xem thêm/Thu gọn */
:deep(.comment-content button) {
  display: inline-block;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0.125rem 0;
}

:deep(.comment-content button:hover) {
  transform: translateX(2px);
}

/* Comment text container */
:deep(.comment-text) {
  margin-bottom: 0.25rem;
}
</style>
