# 部署说明

## GitHub Pages

1. 新建一个公开仓库，例如 `listing-guard`。
2. 上传本目录下所有文件到仓库根目录。
3. 打开仓库 `Settings -> Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub Pages 生成访问地址。

## Cloudflare Pages

1. 新建 Pages 项目。
2. 连接 Git 仓库，或直接上传本目录。
3. Framework preset 选择 `None`。
4. Build command 留空。
5. Output directory 填 `/` 或留空，按 Cloudflare 当前界面要求选择根目录。

## Vercel

1. 新建项目。
2. 导入 Git 仓库或上传本目录。
3. Framework preset 选择 `Other`。
4. Build command 留空。
5. Output directory 留空或设为根目录。

## 发布后检查

- 能打开首页。
- 点击“载入示例”后能生成体检结果。
- 能下载报告。
- 手机端不横向跑偏。
- 页面能看到隐私边界：本地解析、不上传、不登录平台、不自动上架。
