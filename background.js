// 存储用户配置的分类信息
let userCategories = [];
console.log("Background script loaded!");

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message.type);

  if (message.type === "ANALYZE_ARTICLE") {
    console.log("Article data received:", {
      title: message.article.title,
      hasContent: !!message.article.content,
      hasDescription: !!message.article.description,
    });

    // 立即发送处理中的响应
    sendResponse({ status: "processing" });

    // 异步处理分析请求
    handleAnalysis(message.article, sender.tab.id);
  }
  return true;
});

// 从存储中加载分类配置
chrome.storage.local.get(["categories", "apiKey"], (result) => {
  console.log("Loaded storage:", {
    hasCategories: !!result.categories,
    hasApiKey: !!result.apiKey,
    categories: result.categories,
  });

  if (result.categories) {
    userCategories = result.categories;
  }
});

// 处理分析请求的函数
async function handleAnalysis(article, tabId) {
  try {
    const config = await chrome.storage.local.get(["apiKey", "apiEndpoint", "model", "enableMaxLength", "maxLength", "enableTags"]);
    console.log("Starting analysis with config:", {
      hasApiKey: !!config.apiKey,
      apiEndpoint: config.apiEndpoint || "https://api.openai.com/v1/chat/completions",
      model: config.model || "gpt-3.5-turbo",
      categoriesCount: userCategories.length,
      enableMaxLength: config.enableMaxLength,
      maxLength: config.maxLength,
      enableTags: config.enableTags,
    });

    if (!config.apiKey) {
      console.error("API Key not found");
      chrome.tabs.sendMessage(tabId, {
        type: "CLASSIFICATION_ERROR",
        error: "请先配置 API Key",
      });
      return;
    }

    if (!config.model) {
      console.error("Model not found");
      chrome.tabs.sendMessage(tabId, {
        type: "CLASSIFICATION_ERROR",
        error: "请先配置模型名称",
      });
      return;
    }

    if (!userCategories.length) {
      console.error("No categories found");
      chrome.tabs.sendMessage(tabId, {
        type: "CLASSIFICATION_ERROR",
        error: "请先配置分类数据",
      });
      return;
    }

    // 准备 API 请求
    const prompt = await buildPrompt(article, userCategories);

    console.log("Preparing API request...");

    const apiEndpoint = config.apiEndpoint || "https://api.openai.com/v1/chat/completions";
    console.log("Using API endpoint:", apiEndpoint);
    console.log("Using model:", config.model);

    const requestBody = {
      model: config.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    };

    console.log("API request body:", {
      model: requestBody.model,
      messageLength: requestBody.messages[0].content.length,
      temperature: requestBody.temperature,
    });

    console.log("Sending API request...");

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log("API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log("API response received:", aiResponse);

    if (!aiResponse.choices || !aiResponse.choices[0]) {
      throw new Error("Invalid API response format");
    }

    const { suggestions, tags } = parseAISuggestions(aiResponse.choices[0].message.content);
    console.log("Parsed results:", { suggestions, tags });

    if (suggestions.length === 0) {
      throw new Error("No valid categories found in AI response");
    }

    // 发送建议回 content script
    chrome.tabs.sendMessage(tabId, {
      type: "CLASSIFICATION_SUGGESTIONS",
      suggestions,
      tags: config.enableTags ? tags : [],
    });
  } catch (error) {
    console.error("Analysis failed:", error);
    chrome.tabs.sendMessage(tabId, {
      type: "CLASSIFICATION_ERROR",
      error: error.message,
    });
  }
}

function parseAISuggestions(aiResponse) {
  console.log("Parsing AI response:", aiResponse);

  // 移除可能的空白字符
  const cleanResponse = aiResponse.trim();

  // 如果响应包含标签部分，则按标签分割
  const parts = cleanResponse.includes("标签：") ? cleanResponse.split(/标签：/) : [cleanResponse];
  const categoryPart = parts[0].trim();
  const tagsPart = parts[1] ? parts[1].trim() : "";

  // 解析分类ID，过滤掉空行和非ID内容
  const groupIds = categoryPart
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("：") && !line.includes(":")); // 过滤掉包含冒号的行（可能是标题行）

  console.log("Extracted group IDs:", groupIds);

  // 查找对应的分类信息
  const suggestions = groupIds
    .map((groupId) => {
      const category = userCategories.find((cat) => cat.groupId === groupId);
      if (!category) {
        console.log(`Category not found for ID: ${groupId}`);
      }
      return category;
    })
    .filter(Boolean);

  // 解析标签
  let tags = [];
  if (tagsPart) {
    tags = tagsPart
      .split("\n")
      .map((tag) => tag.trim())
      .filter((tag) => tag)
      .slice(0, 5);
  }

  console.log("Final suggestions:", { categories: suggestions, tags });

  if (suggestions.length === 0) {
    console.error("No valid categories found in response. Raw response:", cleanResponse);
    console.error("Extracted group IDs:", groupIds);
    console.error("Available categories:", userCategories);
  }

  return { suggestions, tags };
}

// 构建 AI 提示
async function buildPrompt(article, categories) {
  // 合并标题、描述和内容
  let combinedContent = [article.title, article.description, article.content].filter(Boolean).join("\n\n");

  const originalLength = combinedContent.length;

  // 检查是否需要限制内容长度
  const result = await chrome.storage.local.get(["enableMaxLength", "maxLength", "enableTags"]);
  if (result.enableMaxLength && result.maxLength) {
    const maxLength = parseInt(result.maxLength);
    if (combinedContent.length > maxLength) {
      combinedContent = combinedContent.substring(0, maxLength) + "...（已截断）";
      console.log(`Content length reduced from ${originalLength} to ${maxLength} characters`);
    }
  }

  let prompt = `请根据以下文章内容，从给定的分类列表中选择最合适的3个分类。`;

  if (result.enableTags) {
    prompt += `同时，请为文章生成5个准确且相关的标签。`;
  }

  prompt += `

文章内容：${combinedContent}

可选分类：
${categories.map((cat) => `${cat.groupId}: ${cat.groupName}${cat.description ? ` (${cat.description})` : ""}`).join("\n")}

${
  result.enableTags
    ? `请按以下格式返回：
分类ID：（每行一个ID）

标签：（每行一个标签，不要带序号或符号）`
    : `请直接返回三个最匹配的分类ID，每行一个，不要其他任何文字`
}`;

  console.log("Generated prompt:", {
    titleLength: article.title.length,
    contentLength: combinedContent.length,
    categoriesCount: categories.length,
    totalPromptLength: prompt.length,
    wasContentTruncated: originalLength !== combinedContent.length,
    truncatedAmount: originalLength - combinedContent.length,
    enableTags: result.enableTags,
  });

  return prompt;
}
