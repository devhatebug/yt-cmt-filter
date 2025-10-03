# 🎬 YouTube Comment Filter

Ứng dụng web để lọc và phân tích comments từ video YouTube, giúp người dùng thống kê và xuất dữ liệu theo các tiêu chí cụ thể.

[![Made with Nuxt](https://img.shields.io/badge/Made%20with-Nuxt%203-00DC82?style=flat&logo=nuxt.js)](https://nuxt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Setup API Key (see YOUTUBE_API_SETUP.md)
cp .env.example .env
# Edit .env and add your YouTube API Key

# Start dev server
pnpm dev
```

Truy cập: **http://localhost:3000**

👉 **[Hướng dẫn chi tiết 5 phút](QUICK_START.md)**

---

## ✨ Tính năng

- 🎯 **Fetch Comments** - Lấy comments từ video YouTube qua API
- 🔍 **Smart Filtering** - Lọc emoji-only, quảng cáo, comments đơn điệu
- 📊 **Data Table** - Search, sort, pagination (50 items/page)
- 📥 **Excel Export** - Xuất dữ liệu đã lọc ra file Excel
- 🎨 **Modern UI** - NuxtUI với prefix "Tobi", Light mode only
- 📱 **Responsive** - Hoạt động trên mọi thiết bị

---

## 📚 Documentation

### 📖 Essential

- **[INDEX.md](INDEX.md)** - 🗺️ Danh mục toàn bộ tài liệu
- **[QUICK_START.md](QUICK_START.md)** - ⚡ Bắt đầu trong 5 phút
- **[YOUTUBE_API_SETUP.md](YOUTUBE_API_SETUP.md)** - 🔑 Setup YouTube API Key

### 🔧 Technical

- **[PROJECT_README.md](PROJECT_README.md)** - 📘 Tài liệu đầy đủ
- **[FILTERING_LOGIC.md](FILTERING_LOGIC.md)** - 🧠 Chi tiết logic lọc
- **[BUILD_SUMMARY.md](BUILD_SUMMARY.md)** - 📊 Tổng quan build

### 🤝 Contributing

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - 💻 Hướng dẫn đóng góp
- **[CHANGELOG.md](CHANGELOG.md)** - 📝 Lịch sử phiên bản

---

## 🛠️ Tech Stack

- **[Nuxt 3](https://nuxt.com)** - Vue.js Framework
- **[NuxtUI](https://ui.nuxt.com)** - Component Library (prefix: "Tobi")
- **[TypeScript](https://www.typescriptlang.org/)** - Type Safety
- **[Tailwind CSS 4](https://tailwindcss.com)** - Styling
- **[XLSX](https://www.npmjs.com/package/xlsx)** - Excel Export
- **YouTube Data API v3** - Data Source

---

## 📦 Project Structure

```
crawl-cmt/
├── app/
│   ├── pages/
│   │   └── index.vue              # Main page
│   └── assets/css/
│       └── main.css
├── components/
│   ├── VideoLinkForm.vue          # Input form
│   ├── CommentFilters.vue         # Filter UI
│   ├── CommentsTable.vue          # Data table
│   ├── EmptyState.vue             # Placeholder
│   └── ExportButton.vue           # Export button
├── composables/
│   ├── useYouTubeData.ts          # API integration
│   ├── useCommentFilter.ts        # Filter logic
│   └── useExcelExport.ts          # Excel export
├── types/
│   └── comment.ts                 # TypeScript types
├── utils/
│   ├── youtube.ts                 # YouTube helpers
│   └── format.ts                  # Format functions
└── docs/                          # Documentation
```

---

Look at the [Full Documentation](INDEX.md) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
