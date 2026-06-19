# TripWall 旅行靈感牆

TripWall 是一個以「城市旅行靈感」為主題的分享平台。使用者可以發布旅行心得、收藏想去的地點、建立公開行程表，也能瀏覽其他旅人的城市筆記與路線安排。

專案最初由 ClassWall 改版而來，目前已轉型為完整的旅行靈感牆，並串接 Supabase 作為後端資料庫、Auth 與 Storage，部署在 Vercel。

## 線上展示

- Vercel Production: https://classwall-jacion-s-projects.vercel.app
- GitHub Repository: https://github.com/Jacion-1/classwall

## 主要功能

- 旅行心得牆：發布城市、地點、季節、類型、預算、標籤與心得內容。
- 多圖上傳：支援圖片壓縮與最多 3 張旅行圖片上傳。
- 圖片網址檢查：避免 Google Photos 等無法直接載入的分享連結造成圖片空白。
- 想去與收藏：使用者可以切換想去狀態，也能收藏想回看的心得。
- 我的心得 / 我的收藏：登入後可查看自己發布與收藏過的內容。
- 留言補充：每篇心得可新增旅行補充、交通提醒、餐廳建議等留言。
- 留言編輯與刪除：自己的留言可以修改或刪除。
- 行程表空間：可建立公開行程表，其他使用者也能瀏覽與複製。
- 時段式行程：每天分為上午、下午、晚上，每個時段可獨立設定交通方式。
- 行程表編輯與複製：可修改自己的行程，也能複製他人的公開行程作為範本。
- 個人資料頁：支援暱稱、頭像、簡介與個人內容統計。
- 公開作者資訊：可查看作者公開的近期心得與行程。
- 檢舉與管理員審核：心得、留言、行程皆可檢舉，管理員可隱藏、恢復或駁回。
- 熱門城市 Top 5：依公開心得統計熱門城市。
- 關鍵字搜尋：可搜尋城市、地點、標題、內容與標籤。
- 都市風首頁：使用城市背景輪播與深色/淺色主題切換。

## 技術架構

- Frontend: Next.js 16 App Router, React 19, TypeScript
- Styling: Tailwind CSS v4, shadcn/ui, lucide-react, Motion
- Backend: Supabase PostgreSQL, Row Level Security, RPC
- Auth: Supabase Email / Password Auth
- Storage: Supabase Storage
  - `trip-images`: 旅行心得圖片
  - `profile-images`: 個人頭像
- Deployment: Vercel
- Version Control: GitHub

## 資料庫重點

主要資料表與功能：

- `questions`: 旅行心得貼文
- `answers`: 心得留言與補充
- `itineraries`: 公開行程表
- `profiles`: 使用者個人資料
- `content_reports`: 檢舉與管理員審核紀錄
- `trip_saves`: 收藏紀錄
- `question_likes`: 想去紀錄

安全與權限：

- 使用 Supabase RLS 控制公開讀取、登入者擁有權與管理員審核權限。
- 被管理員隱藏的心得、留言與行程不會出現在公開列表。
- 使用者只能編輯或刪除自己的心得、留言與行程。
- 管理員角色由 `profiles.role = 'admin'` 控制。

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

建立 `.env.local`：

```bash
cp .env.example .env.local
```

填入 Supabase 專案資訊：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

注意：不要把 `service_role` key 放到前端或提交到 GitHub。

### 3. 啟動開發伺服器

```bash
npm run dev
```

開啟：

```text
http://localhost:3000
```

## Supabase 設定

這個專案的資料庫 schema 放在：

```text
supabase/migrations/
```

若要建立新的 Supabase 專案，請依序套用 migrations。最新版本包含：

- Email / Password 登入
- 個人資料
- 旅行圖片與頭像 Storage bucket
- 行程表
- 標籤與預算篩選
- 多圖貼文
- 檢舉與管理員審核

目前線上 Supabase 專案名稱為 `classwall`。

## Vercel 部署

Vercel 會從 GitHub `main` branch 自動部署。

必要環境變數：

```bash
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

每次推送到 `main` 後，Vercel 會自動建立 Production Deployment。

## 常用指令

```bash
npm run dev           # 啟動本地開發
npm run build         # 建立 production build
npm run start         # 啟動 production server
npm run lint          # ESLint 檢查
npm run format        # Prettier 格式化
npm run format:check  # 檢查格式
```

## 專案結構

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    question-form.tsx
    question-card.tsx
    answer-section.tsx
    itinerary-space.tsx
    profile-space.tsx
    admin-moderation-panel.tsx
    author-profile-button.tsx
    report-button.tsx
    ui/
  lib/
    supabase.ts
    use-auth.ts
    use-questions.ts
    use-answers.ts
    use-itineraries.ts
    image-upload.ts
    image-url.ts
    itinerary-days.ts
    trip-budget.ts
    trip-tags.ts
  types/
    database.ts

supabase/
  migrations/
```

## 目前狀態

TripWall 已具備期末專題展示所需的完整功能，也已接上 GitHub、Supabase 與 Vercel 的實際部署流程。

後續可再加強：

- 獨立作者頁網址
- 管理員後台的內容預覽
- 更完整的圖片裁切介面
- 行程表地圖視覺化
- 通知或追蹤作者功能
