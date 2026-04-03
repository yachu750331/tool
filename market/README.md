# 美股戰情儀表板

這是一個使用 React + Vite 建立的 GitHub Pages 可部署版本。

## 本機執行

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
```

## 部署到 GitHub Pages

1. 把整個專案推到 GitHub repository。
2. 到 GitHub repository 的 **Settings → Pages**。
3. 在 **Build and deployment** 中，將 **Source** 設成 **GitHub Actions**。
4. 之後每次 push 到 `main`，GitHub 都會自動部署。

## 專案結構

- `src/market_dashboard.jsx`：主儀表板元件
- `src/App.jsx`：入口元件
- `src/main.jsx`：React 掛載點
- `.github/workflows/deploy.yml`：GitHub Pages 自動部署流程
