# 渠道商自动评分系统 - Vercel 公开部署版

这个版本不是 localhost 给别人用，而是部署到 Vercel 后生成一个公开网址。

## 文件结构

```text
api/score.js        后端接口，负责安全调用 Dify API
public/index.html   前端页面，别人打开这个页面填写表单
package.json
.env.example
```

## 部署到 Vercel

### 方式一：通过 GitHub

1. 新建一个 GitHub 仓库。
2. 把本项目所有文件上传到仓库。
3. 打开 Vercel，新建 Project，导入这个仓库。
4. 在 Vercel 的 Environment Variables 添加：

```text
DIFY_API_KEY = 你的 Dify API Key
```

5. 点击 Deploy。
6. 部署完成后，Vercel 会给你一个类似这样的公开链接：

```text
https://你的项目名.vercel.app
```

把这个链接发给别人即可。

## 本地测试

安装 Vercel CLI：

```bash
npm install -g vercel
```

在项目根目录执行：

```bash
cp .env.example .env
```

把 `.env` 里的 API Key 改成真实的。

然后运行：

```bash
vercel dev
```

浏览器打开：

```text
http://localhost:3000
```

## 注意

不要把 Dify API Key 写进 public/index.html。这个项目已经把 Key 放在服务端环境变量里。
