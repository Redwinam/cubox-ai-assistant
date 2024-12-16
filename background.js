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
    const config = await chrome.storage.local.get(["apiKey", "apiEndpoint", "model"]);
    console.log("Starting analysis with config:", {
      hasApiKey: !!config.apiKey,
      apiEndpoint: config.apiEndpoint || "https://api.openai.com/v1/chat/completions",
      model: config.model || "gpt-3.5-turbo",
      categoriesCount: userCategories.length,
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
    const prompt = `分析以下文章内容，从给定的分类中选择最合适的三个。只需返回分类ID，每行一个ID：

文章标题：${article.title}
文章描述：${article.description}
文章内容：${article.content}

可选分类：
${userCategories.map((cat) => `${cat.groupId}: ${cat.groupName}`).join("\n")}

请直接返回三个最匹配的分类ID，每行一个，不要其他任何文字：`;

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

    const suggestions = parseAISuggestions(aiResponse.choices[0].message.content);
    console.log("Parsed suggestions:", suggestions);

    if (suggestions.length === 0) {
      throw new Error("No valid categories found in AI response");
    }

    // 发送建议回 content script
    chrome.tabs.sendMessage(tabId, {
      type: "CLASSIFICATION_SUGGESTIONS",
      suggestions,
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

  // 解析返回的分类ID
  const groupIds = aiResponse.trim().split("\n").slice(0, 3);
  console.log("Extracted group IDs:", groupIds);

  // 查找对应的分类信息
  const suggestions = groupIds
    .map((groupId) => {
      const trimmedId = groupId.trim();
      const category = userCategories.find((cat) => cat.groupId === trimmedId);
      if (!category) {
        console.log(`Category not found for ID: ${trimmedId}`);
      }
      return category;
    })
    .filter(Boolean);

  console.log("Final suggestions:", suggestions);
  return suggestions;
}
