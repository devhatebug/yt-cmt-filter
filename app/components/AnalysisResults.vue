<script lang="ts" setup>
import { h } from "vue";
import { getPaginationRowModel } from "@tanstack/vue-table";
import type { TableColumn } from "@nuxt/ui";
import * as XLSX from "xlsx/xlsx.mjs";

interface AnalysisComment {
  index: number;
  date: string;
  author: string;
  zhContent: string;
  viContent?: string;
  categoryName: string;
  sentiment: "positive" | "neutral" | "negative";
  topKeywords: string[];
}

interface AnalysisData {
  comments: AnalysisComment[];
  wordFrequency: Array<{ word: string; count: number }>;
  sentimentSummary: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topicDistribution: Record<string, number>;
}

const props = defineProps<{
  data: AnalysisData;
  loading?: boolean;
}>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = useTemplateRef<any>("table");
const searchQuery = ref("");
const pageSize = 20;

const pagination = ref({
  pageIndex: 0,
  pageSize: pageSize,
});

// Sentiment colors
const getSentimentColor = (sentiment: string) => {
  switch (sentiment) {
    case "positive":
      return "bg-green-100 text-green-800";
    case "negative":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getSentimentLabel = (sentiment: string) => {
  switch (sentiment) {
    case "positive":
      return "积极";
    case "negative":
      return "消极";
    default:
      return "中性";
  }
};

// Search
const searchedComments = computed(() => {
  if (!searchQuery.value) return props.data.comments;

  const query = searchQuery.value.toLowerCase();
  return props.data.comments.filter(
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
const columns: TableColumn<AnalysisComment>[] = [
  {
    accessorKey: "date",
    header: "日期",
    cell: ({ row }) => {
      const date = row.getValue("date") as string;
      return h(
        "div",
        {
          class: "text-xs whitespace-nowrap",
        },
        date
      );
    },
  },
  {
    accessorKey: "author",
    header: "账号名",
    cell: ({ row }) => row.getValue("author"),
  },
  {
    accessorKey: "zhContent",
    header: "评论内容",
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
    header: "主题",
    cell: ({ row }) => {
      const categoryName = row.getValue("categoryName") as string;
      return h(
        "div",
        {
          class:
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800",
        },
        categoryName
      );
    },
  },
  {
    accessorKey: "sentiment",
    header: "情绪",
    cell: ({ row }) => {
      const sentiment = row.getValue("sentiment") as string;
      const color = getSentimentColor(sentiment);
      const label = getSentimentLabel(sentiment);
      return h(
        "div",
        {
          class: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`,
        },
        label
      );
    },
  },
  {
    accessorKey: "topKeywords",
    header: "关键词",
    cell: ({ row }) => {
      const keywords = row.getValue("topKeywords") as string[];
      return h(
        "div",
        {
          class: "flex gap-1 flex-wrap",
        },
        keywords.map((kw) =>
          h(
            "span",
            {
              class:
                "px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs",
            },
            kw
          )
        )
      );
    },
  },
];

// Export với multiple sheets
const exportData = () => {
  console.log("🚀 Starting Excel export...");
  console.log(
    `📊 Data received - Comments: ${props.data.comments.length}, WordFreq: ${props.data.wordFrequency.length}`
  );
  console.log(
    `📝 Sample comment viContent:`,
    props.data.comments.slice(0, 2).map((c) => c.viContent?.substring(0, 30))
  );

  const wb = XLSX.utils.book_new();

  // Sheet 1: 评论详细数据 (Comments Detail)
  const commentsData = props.data.comments.map((c) => ({
    序号: c.index + 1,
    日期: c.date,
    账号名: c.author,
    越南语评论: c.viContent || "",
    中文评论: c.zhContent,
    主题分类: c.categoryName,
    情绪: getSentimentLabel(c.sentiment),
    关键词: c.topKeywords.join(", "),
  }));
  console.log(`📄 Sheet 1 - Comments: ${commentsData.length} rows`);
  const wsComments = XLSX.utils.json_to_sheet(commentsData);
  XLSX.utils.book_append_sheet(wb, wsComments, "评论详细数据");

  // Sheet 2: 词频统计 (Word Frequency)
  const wordFreqData = props.data.wordFrequency.map((wf, idx) => ({
    排名: idx + 1,
    关键词: wf.word,
    出现次数: wf.count,
  }));
  console.log(`📄 Sheet 2 - Word Frequency: ${wordFreqData.length} rows`);
  const wsWordFreq = XLSX.utils.json_to_sheet(wordFreqData);
  XLSX.utils.book_append_sheet(wb, wsWordFreq, "词频统计");

  // Sheet 3: 情绪分布 (Sentiment Distribution)
  const total = props.data.comments.length;
  const sentimentData = [
    {
      情绪类型: "积极",
      数量: props.data.sentimentSummary.positive,
      百分比: `${((props.data.sentimentSummary.positive / total) * 100).toFixed(
        1
      )}%`,
    },
    {
      情绪类型: "中性",
      数量: props.data.sentimentSummary.neutral,
      百分比: `${((props.data.sentimentSummary.neutral / total) * 100).toFixed(
        1
      )}%`,
    },
    {
      情绪类型: "消极",
      数量: props.data.sentimentSummary.negative,
      百分比: `${((props.data.sentimentSummary.negative / total) * 100).toFixed(
        1
      )}%`,
    },
  ];
  console.log(
    `📄 Sheet 3 - Sentiment: ${sentimentData.length} rows`,
    sentimentData
  );
  const wsSentiment = XLSX.utils.json_to_sheet(sentimentData);
  XLSX.utils.book_append_sheet(wb, wsSentiment, "情绪分布");

  // Sheet 4: 主题分布 (Topic Distribution)
  const topicData = Object.entries(props.data.topicDistribution)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count], idx) => ({
      排名: idx + 1,
      主题: topic,
      数量: count,
      百分比: `${((count / total) * 100).toFixed(1)}%`,
    }));
  const wsTopic = XLSX.utils.json_to_sheet(topicData);
  XLSX.utils.book_append_sheet(wb, wsTopic, "主题分布");
  console.log(`📄 Sheet 4 - Topics: ${topicData.length} rows`);

  console.log(`📚 Total sheets in workbook: ${wb.SheetNames.length}`);
  console.log(`📚 Sheet names: ${wb.SheetNames.join(", ")}`);

  const timestamp = Date.now();
  const filename = `评论分析_${timestamp}.xlsx`;
  XLSX.writeFile(wb, filename);
  console.log(`✅ Excel exported: ${filename}`);
};

watch(searchQuery, () => {
  table.value?.tableApi?.setPageIndex(0);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Word Frequency Card -->
      <TobiCard>
        <div class="space-y-3">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <TobiIcon name="i-heroicons-hashtag" />
            Từ khóa phổ biến Top 10
          </h3>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="(item, idx) in data.wordFrequency.slice(0, 10)"
              :key="idx"
              class="flex justify-between items-center text-sm">
              <span class="font-medium">{{ idx + 1 }}. {{ item.word }}</span>
              <span class="text-gray-600">{{ item.count }} lần</span>
            </div>
          </div>
        </div>
      </TobiCard>

      <!-- Sentiment Summary -->
      <TobiCard>
        <div class="space-y-3">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <TobiIcon name="i-heroicons-face-smile" />
            Phân bố cảm xúc
          </h3>
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-green-500" />
                积极
              </span>
              <span class="font-semibold text-green-600">
                {{ data.sentimentSummary.positive }}
                ({{
                  (
                    (data.sentimentSummary.positive / data.comments.length) *
                    100
                  ).toFixed(1)
                }}%)
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-gray-500" />
                中性
              </span>
              <span class="font-semibold text-gray-600">
                {{ data.sentimentSummary.neutral }}
                ({{
                  (
                    (data.sentimentSummary.neutral / data.comments.length) *
                    100
                  ).toFixed(1)
                }}%)
              </span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-red-500" />
                消极
              </span>
              <span class="font-semibold text-red-600">
                {{ data.sentimentSummary.negative }}
                ({{
                  (
                    (data.sentimentSummary.negative / data.comments.length) *
                    100
                  ).toFixed(1)
                }}%)
              </span>
            </div>
          </div>
        </div>
      </TobiCard>

      <!-- Topic Distribution -->
      <TobiCard>
        <div class="space-y-3">
          <h3 class="text-lg font-semibold flex items-center gap-2">
            <TobiIcon name="i-heroicons-tag" />
            Phân bố chủ đề
          </h3>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="(count, topic) in data.topicDistribution"
              :key="topic"
              class="flex justify-between items-center text-sm">
              <span class="font-medium">{{ topic }}</span>
              <span class="text-gray-600">{{ count }}条</span>
            </div>
          </div>
        </div>
      </TobiCard>
    </div>

    <!-- Comments Table -->
    <TobiCard>
      <div
        class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h2 class="text-xl font-bold">详细评论分析</h2>

        <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <TobiInput
            v-model="searchQuery"
            placeholder="搜索评论..."
            icon="i-heroicons-magnifying-glass"
            size="md"
            class="w-full sm:w-64" />

          <TobiButton
            :disabled="!data.comments.length"
            color="success"
            variant="outline"
            size="md"
            class="w-full sm:w-auto"
            @click="exportData">
            <template #leading>
              <TobiIcon name="i-heroicons-arrow-down-tray" />
            </template>
            导出 Excel
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
          显示 {{ startIndex }}-{{ endIndex }} / 共 {{ total }} 条评论
        </div>
        <TobiPagination
          :default-page="currentPage"
          :items-per-page="pageSize"
          :total="total"
          @update:page="(p: number) => table?.tableApi?.setPageIndex(p - 1)" />
      </div>
    </TobiCard>
  </div>
</template>
