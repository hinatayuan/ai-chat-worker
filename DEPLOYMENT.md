# 🚀 部署指南

本指南将帮助你在 Cloudflare 上部署 AI Chat Worker。

## 📋 前置要求

1. **Cloudflare 账户** - [注册地址](https://dash.cloudflare.com/sign-up)
2. **OpenAI API Key** - [获取地址](https://platform.openai.com/api-keys)
3. **Node.js 18+** 和 **npm**
4. **Git** 和 **GitHub 账户**

## 🔧 方式一：GitHub 自动部署（推荐）

### 1. Fork 这个仓库

点击右上角的 "Fork" 按钮，将项目复制到你的 GitHub 账户。

### 2. 在 Cloudflare 中连接 GitHub

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单选择 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Pages** 选项卡
5. 点击 **Connect to Git**
6. 授权 Cloudflare 访问你的 GitHub
7. 选择刚才 Fork 的 `ai-chat-worker` 仓库

### 3. 配置构建设置

在部署配置页面：

- **Project name**: `ai-chat-worker` (或你喜欢的名字)
- **Production branch**: `main`
- **Build command**: `npm run build`
- **Build output directory**: `dist`

### 4. 设置环境变量

在 **Environment variables** 部分添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `OPENAI_API_KEY` | `sk-xxx...` | 你的 OpenAI API 密钥 |
| `CORS_ORIGIN` | `https://your-frontend-domain.com` | 前端域名（可选） |
| `ENVIRONMENT` | `production` | 环境标识 |

### 5. 部署

点击 **Save and Deploy**，Cloudflare 会自动：
1. 从 GitHub 拉取代码
2. 安装依赖
3. 构建项目
4. 部署到 Workers

## ⚙️ 方式二：命令行部署

### 1. 克隆项目

```bash
git clone https://github.com/hinatayuan/ai-chat-worker.git
cd ai-chat-worker
```

### 2. 安装依赖

```bash
npm install
```

### 3. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 4. 登录 Cloudflare

```bash
wrangler auth login
```

### 5. 设置 Secrets

```bash
# 设置 OpenAI API Key
wrangler secret put OPENAI_API_KEY
# 输入你的 OpenAI API Key
```

### 6. 修改配置

编辑 `wrangler.toml` 文件，更新以下内容：

```toml
name = "your-worker-name"  # 改为你的 Worker 名称

[env.production.vars]
CORS_ORIGIN = "https://your-frontend-domain.com"  # 改为你的前端域名
```

### 7. 部署

```bash
npm run deploy
```

## 🔗 获取 API 端点

部署成功后，你会得到一个 Worker URL，例如：
```
https://your-worker-name.your-subdomain.workers.dev
```

GraphQL 端点为：
```
https://your-worker-name.your-subdomain.workers.dev/graphql
```

## 🧪 测试部署

### 1. 健康检查

```bash
curl https://your-worker-name.your-subdomain.workers.dev/health
```

应该返回：
```json
{
  "status": "OK",
  "timestamp": "2025-08-09T10:00:00.000Z",
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. GraphQL 测试

访问 GraphQL 端点并执行查询：

```graphql
query {
  hello
}
```

### 3. 聊天测试

```graphql
mutation {
  chat(input: {
    message: "你好，请介绍一下自己"
    model: "gpt-3.5-turbo"
  }) {
    success
    message
    error
    usage {
      totalTokens
    }
  }
}
```

## 🔧 配置前端

更新前端项目中的 API 端点：

```typescript
// src/services/graphqlClient.ts
const API_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 
  'https://your-worker-name.your-subdomain.workers.dev/graphql';
```

在前端项目的 `.env` 文件中设置：

```env
REACT_APP_GRAPHQL_ENDPOINT=https://your-worker-name.your-subdomain.workers.dev/graphql
```

## 📊 监控和日志

### 查看实时日志

```bash
wrangler tail your-worker-name
```

### 查看部署状态

```bash
wrangler deployments list your-worker-name
```

### 查看指标

在 Cloudflare Dashboard 中：
1. 进入 **Workers & Pages**
2. 选择你的 Worker
3. 查看 **Analytics** 选项卡

## 🔒 安全配置

### 1. 设置 CORS

在 `wrangler.toml` 中配置允许的域名：

```toml
[env.production.vars]
CORS_ORIGIN = "https://yourdomain.com,https://www.yourdomain.com"
```

### 2. 限制请求频率

可以使用 Cloudflare 的 Rate Limiting：

1. 在 Cloudflare Dashboard 中进入 **Security** > **Rate Limiting**
2. 创建规则限制每分钟请求数

### 3. 监控 API 使用

定期检查 OpenAI API 使用情况：
- 登录 [OpenAI Platform](https://platform.openai.com/usage)
- 查看 API 使用量和费用

## 🔄 自动部署

当你推送代码到 GitHub 的 `main` 分支时，Cloudflare 会自动重新部署。

## 🛠️ 故障排除

### 常见问题

1. **部署失败**
   ```bash
   # 检查构建日志
   wrangler deployments list
   ```

2. **API Key 错误**
   ```bash
   # 重新设置 Secret
   wrangler secret put OPENAI_API_KEY
   ```

3. **CORS 错误**
   - 检查 `CORS_ORIGIN` 环境变量
   - 确保包含正确的前端域名

4. **GraphQL 错误**
   - 检查请求格式是否正确
   - 查看 Worker 日志：`wrangler tail`

### 调试技巧

1. **查看详细错误**
   ```bash
   wrangler tail --format=pretty
   ```

2. **本地测试**
   ```bash
   npm run dev
   # 在 http://localhost:8787 测试
   ```

3. **检查环境变量**
   ```bash
   wrangler secret list
   ```

## 📈 性能优化

### 1. 启用缓存

可以使用 Cloudflare KV 缓存常见问题：

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

### 2. 优化响应时间

- 使用较快的 GPT 模型（如 `gpt-3.5-turbo`）
- 限制 `max_tokens` 参数
- 压缩响应内容

### 3. 监控成本

- 设置 OpenAI API 使用限制
- 监控 Cloudflare Workers 请求数量
- 定期查看费用账单

## 🔗 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
- [GraphQL Yoga 文档](https://the-guild.dev/graphql/yoga-server)

---

🎉 **恭喜！你的 AI Chat Worker 已经成功部署！**