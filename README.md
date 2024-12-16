# Cubox AI 小助手

一个智能的 Chrome 扩展，为 Cubox 用户提供 AI 驱动的文章分类和标签推荐功能。通过分析文章内容，自动推荐最合适的分类目录，让您的 Cubox 收藏更加有条理。

![旧版界面](https://github.com/user-attachments/assets/baf50309-79c1-4565-99cc-80b44f643b86)

## ✨ 主要功能

- 🤖 **AI 智能分类**：自动分析文章内容，推荐最合适的分类目录
- 🏷️ **标签生成**：智能生成相关标签，帮助更好地组织内容
- ⌨️ **快捷键支持**：支持自定义快捷键，快速操作常用功能
- 🎨 **Cubox 风格**：完美融入 Cubox 的界面设计
- 🔄 **双版本支持**：同时支持 Cubox 新旧两个版本

![新版界面（Beta）](https://github.com/user-attachments/assets/f26b9e49-c628-408c-a2a7-83aad18080bc)

## 🛠️ 技术特性

- 支持自定义 API 接口和模型
- 可配置内容长度限制
- 支持批量更新分类数据
- 可自定义分类描述，提升分类准确度
- 完整的错误处理和状态提示

## 📦 安装方法

1. 在 [Releases](https://github.com/user-attachments/cubox-ai-assistant/releases) 页面下载最新版本后解压
2. 打开 Arc / Chrome 浏览器，进入扩展程序页面（chrome://extensions/）
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹即可完成安装

## ⚙️ 使用配置

1. 点击浏览器工具栏中的扩展图标，打开设置面板
2. 在"基本设置"标签页：
   - 填写 API Key
   - 配置 API 接口（可选）
   - 设置模型名称
   - 配置内容长度限制（可选）
   - 开启/关闭标签生成功能

![API 配置示意](https://github.com/user-attachments/assets/a4a07e80-3867-4137-829c-f56ebb288109)

3. 在"分类管理"标签页：

   - 点击"从 Cubox 更新分类"同步最新分类数据
   - 为分类添加描述，提供给 AI 参考，提高分类准确度

![分类管理示意](https://github.com/user-attachments/assets/28d4879a-57f6-4f84-8bcc-780d87d4529a)

4. 在"快捷键"标签页：
   - 开启快捷键功能
   - 自定义各项功能的快捷键

## 🎯 使用方法

1. 在 Cubox 中打开任意文章
2. 点击右上角的"AI 分类"按钮
3. 等待 AI 分析完成
4. 从推荐的分类中选择合适的选项
5. 如果开启了标签功能，还可以选择推荐的标签

## ⌨️ 快捷键

- AI 分类：默认 `F`
- 切换星标：默认 `S`
- 归档内容：默认 `A`
- 删除内容：默认 `D`

![快捷键示意](https://github.com/user-attachments/assets/2bba8112-1d4f-48a3-9348-dc701b5c4258)

## 🔑 API 支持

- 支持 OpenAI 等 API，推荐国产 DeepSeek 等大模型，主要是便宜还快
- 支持自定义 API 端点
- 支持多种 AI 模型：
  - GPT-3.5-turbo
  - ChatGLM
  - 其他兼容的模型

## 📝 注意事项

- 请确保在使用前已登录 Cubox
- API Key 请妥善保管，不要泄露
- 建议将内容长度限制设置在 1000-3000 字之间
- 可以通过添加分类描述来提高分类准确度

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！插件开发纯属个人仓鼠症 + 强迫症 + 懒病作祟，观察了官方的 AI 服务快 1 年，AI 分类和标签的功能还是八字没一撇。
如果这个插件对您有帮助，可以通过 Cubox 推荐码 `kdrg8e` 领取 7 天会员来向我报以诚挚的感谢。

## 📄 许可证

Made by 千啾略 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)
Thanks to Cursor for helping me 瞬间写完了这个 README.md and make this extension.
