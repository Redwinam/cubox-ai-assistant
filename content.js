// 监听页面 URL 变化
console.log("Content script loaded!");

let lastUrl = location.href;
console.log("Current URL:", lastUrl);

// 获取 Cubox token 的函数
function getCuboxToken() {
  const localToken = localStorage.getItem("token");
  if (localToken) {
    return localToken;
  }
  return null;
}

// 添加 AI 分类按钮
function addClassifyButton() {
  // 判断是否是新版页面
  const isNewVersion = location.href.includes("/cards/");
  const readerSelector = isNewVersion ? "#reader" : "#cubox-reader";

  // 等待 reader div 加载完成
  const waitForReader = setInterval(() => {
    const readerDiv = document.querySelector(readerSelector);
    if (readerDiv) {
      clearInterval(waitForReader);

      // 移除可能已存在的按钮
      const existingButton = document.querySelector(".ai-classify-button");
      if (existingButton) {
        existingButton.remove();
      }

      // 创建新按钮
      const button = document.createElement("button");
      button.className = "ai-classify-button";
      button.innerHTML = "🤖 AI 分类";

      // Cubox 风格的按钮样式
      button.style.cssText = `
        position: absolute;
        top: ${isNewVersion ? "20px" : "80px"};
        right: 20px;
        height: 32px;
        padding: 0 12px;
        border-radius: 4px;
        background: radial-gradient(100% 100% at 50% 100%, rgba(255, 255, 255, 0) 0%, rgba(189, 138, 184, 0.25) 100%), #2c46f1;
        box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.06), 0 -2px 0 0 rgba(0, 0, 0, 0.15) inset;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        z-index: 9999;
      `;

      // 添加悬停效果
      button.addEventListener("mouseover", () => {
        button.style.background =
          "linear-gradient(0deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.2) 100%), radial-gradient(100% 100% at 50% 100%, rgba(255, 255, 255, 0) 0%, rgba(189, 138, 184, 0.25) 100%), #2c46f1";
      });

      button.addEventListener("mouseout", () => {
        button.style.background = "radial-gradient(100% 100% at 50% 100%, rgba(255, 255, 255, 0) 0%, rgba(189, 138, 184, 0.25) 100%), #2c46f1";
      });

      // 添加点击效果
      button.addEventListener("mousedown", () => {
        button.style.background = "linear-gradient(0deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.2) 100%), radial-gradient(100% 100% at 50% 100%, rgba(255, 255, 255, 0) 0%, rgba(189, 138, 184, 0.25) 100%), #2c46f1";
        button.style.boxShadow = "none";
      });

      button.addEventListener("mouseup", () => {
        button.style.background = "radial-gradient(100% 100% at 50% 100%, rgba(255, 255, 255, 0) 0%, rgba(189, 138, 184, 0.25) 100%), #2c46f1";
        button.style.boxShadow = "0 4px 8px 0 rgba(0, 0, 0, 0.06), 0 -2px 0 0 rgba(0, 0, 0, 0.15) inset";
      });

      // 添加点击事件
      button.addEventListener("click", () => {
        const cardIdMatch = location.href.match(/\/cards\/(\d+)/) || location.href.match(/\/my\/card\?id=(\d+)/);
        if (cardIdMatch) {
          button.disabled = true;
          button.style.opacity = "0.5";
          button.innerHTML = "🤖 分析中...";
          fetchArticleDetails(cardIdMatch[1], button);
        }
      });

      // 确保 reader div 是相对定位
      if (getComputedStyle(readerDiv).position === "static") {
        readerDiv.style.position = "relative";
      }

      // 直接将按钮添加到 reader div
      readerDiv.appendChild(button);

      // 同时更新建议框的位置
      const suggestionBox = document.querySelector(".cubox-ai-suggestions");
      if (suggestionBox) {
        suggestionBox.style.position = "absolute";
        suggestionBox.style.top = isNewVersion ? "60px" : "120px";
        suggestionBox.style.right = "20px";
      }
    }
  }, 100);

  // 5秒后清除定时器，避免无限等待
  setTimeout(() => clearInterval(waitForReader), 5000);
}

new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    console.log("URL changed:", url);
    lastUrl = url;
    checkAndProcessPage();
  }
}).observe(document, { subtree: true, childList: true });

// 初始检查
checkAndProcessPage();

function checkAndProcessPage() {
  console.log("Checking page...");

  // 清除可能存在的建议框
  const existingContainer = document.querySelector(".cubox-ai-suggestions");
  if (existingContainer) {
    existingContainer.remove();
  }

  // 匹配两种不同格式的 URL
  const cardIdMatch = location.href.match(/\/cards\/(\d+)/) || location.href.match(/\/my\/card\?id=(\d+)/);
  console.log("Card ID match:", cardIdMatch);

  if (cardIdMatch) {
    console.log("Found card ID:", cardIdMatch[1]);
    addClassifyButton();
  }
}

async function fetchArticleDetails(cardId, button) {
  const token = getCuboxToken();
  console.log("Using token:", token ? "已获取" : "未获取");

  if (!token) {
    console.error("无法获取 Cubox token，请确保已登录");
    showToast("请先登录 Cubox");
    resetButton(button);
    return;
  }

  try {
    console.log("Fetching article details for card:", cardId);
    const response = await fetch(`https://cubox.pro/c/api/norm/card/visit/${cardId}`, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded",
        authorization: token,
        origin: "https://cubox.pro",
        referer: "https://cubox.pro/",
      },
      body: "markAsRead=true",
    });

    const data = await response.json();
    console.log("API response:", data.code === 200 ? "成功" : "失败", data.code);

    if (data.code === 200) {
      console.log("Sending article data to background script");
      chrome.runtime.sendMessage(
        {
          type: "ANALYZE_ARTICLE",
          article: {
            title: data.data.title,
            content: data.data.content,
            description: data.data.description,
          },
        },
        (response) => {
          if (response && response.status === "processing") {
            showToast("正在分析文章...");
          }
        }
      );
    } else {
      console.error("API 请求失败:", data);
      showToast("获取文章信息失败");
      resetButton(button);
    }
  } catch (error) {
    console.error("获取文章详情失败:", error);
    showToast("获取文章信息失败");
    resetButton(button);
  }
}

function resetButton(button) {
  if (button) {
    button.disabled = false;
    button.style.opacity = "1";
    button.innerHTML = "🤖 AI 分类";
    button.style.background = "radial-gradient(100% 100% at 50% 100%, rgba(255, 255, 255, 0) 0%, rgba(189, 138, 184, 0.25) 100%), #2c46f1";
    button.style.boxShadow = "0 4px 8px 0 rgba(0, 0, 0, 0.06), 0 -2px 0 0 rgba(0, 0, 0, 0.15) inset";
  }
}

// 监听来自 background script 的分类建议
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const button = document.querySelector(".ai-classify-button");

  if (message.type === "CLASSIFICATION_SUGGESTIONS") {
    showSuggestions(message.suggestions, message.tags);
    resetButton(button);
  } else if (message.type === "CLASSIFICATION_ERROR") {
    console.error("Classification error:", message.error);
    showToast(message.error);
    resetButton(button);
  }
});

function showSuggestions(suggestions, tags = []) {
  // 过滤掉没有标题的分类
  const validSuggestions = suggestions.filter((suggestion) => suggestion.groupName && suggestion.groupName.trim());

  // 如果没有有效的建议，直接返回
  if (validSuggestions.length === 0) {
    showToast("未找到合适的分类建议", "error");
    return;
  }

  // 移除可能已存在的建议框
  const existingContainer = document.querySelector(".cubox-ai-suggestions");
  if (existingContainer) {
    existingContainer.remove();
  }

  // 判断是否是新版页面
  const isNewVersion = location.href.includes("/cards/");
  const readerSelector = isNewVersion ? "#reader" : "#cubox-reader";

  // 获取 reader div
  const readerDiv = document.querySelector(readerSelector);
  if (!readerDiv) return;

  // 创建分类建议UI
  const container = document.createElement("div");
  container.className = "cubox-ai-suggestions";
  container.style.cssText = `
    position: absolute;
    top: ${isNewVersion ? "60px" : "120px"};
    right: 20px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    padding: 4px;
    border-radius: 8px;
    border: 3px solid rgba(153, 153, 153, 0.2);
    box-shadow: 0 8px 32px 0 rgba(24, 24, 24, 0.12);
    min-width: 200px;
    max-width: 300px;
    z-index: 9999;
  `;

  // 分类部分
  const categoriesHtml = `
    <div class="categories-section" style="margin-bottom: 12px;">
      <div style="
        height: 40px;
        border-radius: 4px;
        background: radial-gradient(100% 100% at 50% 100%, rgba(255, 255, 255, 0) 0%, rgba(189, 138, 184, 0.25) 100%), #2c46f1;
        display: flex;
        padding: 0 10px;
        justify-content: space-between;
        align-items: center;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
      ">
        <span>推荐分类</span>
        <span style="
          background: #fff;
          color: #6a6a6b;
          border-radius: 3px;
          padding: 0 4px;
          font-size: 12px;
          height: 18px;
          display: flex;
          align-items: center;
        ">${validSuggestions.length}</span>
      </div>
      <div class="suggestions-list" style="display: flex; flex-direction: column; gap: 4px; padding: 4px;">
        ${validSuggestions
          .map(
            (suggestion) => `
          <button class="suggestion-btn" data-group-id="${suggestion.groupId}" style="
            height: 40px;
            border-radius: 4px;
            border: none;
            background: none;
            display: flex;
            padding: 0 10px;
            align-items: center;
            color: #191919;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            text-align: left;
            border: 1px solid transparent;
          ">${suggestion.groupName}</button>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  // 标签部分
  const tagsHtml =
    tags.length > 0
      ? `
    <div class="tags-section">
      <div style="
        height: 40px;
        border-radius: 4px;
        background: radial-gradient(100% 100% at 50% 100%, rgba(255, 255, 255, 0) 0%, rgba(189, 138, 184, 0.25) 100%), #2c46f1;
        display: flex;
        padding: 0 10px;
        justify-content: space-between;
        align-items: center;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 4px;
      ">
        <span>推荐标签</span>
        <span style="
          background: #fff;
          color: #6a6a6b;
          border-radius: 3px;
          padding: 0 4px;
          font-size: 12px;
          height: 18px;
          display: flex;
          align-items: center;
        ">${tags.length}</span>
      </div>
      <div class="tags-list" style="display: flex; flex-wrap: wrap; gap: 8px; padding: 8px;">
        ${tags
          .map(
            (tag) => `
          <button class="tag-btn" style="
            height: 28px;
            border-radius: 14px;
            border: none;
            background: #f2f3f5;
            display: flex;
            padding: 0 12px;
            align-items: center;
            color: #191919;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid transparent;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            transition: all 0.2s ease;
          ">${tag}</button>
        `
          )
          .join("")}
      </div>
    </div>
  `
      : "";

  container.innerHTML = categoriesHtml + tagsHtml;

  // 直接将建议框添加到 reader div
  readerDiv.appendChild(container);

  // 添加分类按钮事件
  container.querySelectorAll(".suggestion-btn").forEach((btn) => {
    btn.addEventListener("mouseover", () => {
      btn.style.border = "1px solid rgba(0, 0, 0, 0.05)";
      btn.style.background = "rgba(0, 0, 0, 0.05)";
    });

    btn.addEventListener("mouseout", () => {
      btn.style.border = "1px solid transparent";
      btn.style.background = "none";
    });

    btn.addEventListener("click", async () => {
      const groupId = btn.dataset.groupId;
      await applyClassification(groupId);

      // 获取当前的标签功能状态
      chrome.storage.local.get(["enableTags"], async (result) => {
        if (!result.enableTags) {
          // 如果标签功能未启用，直接移除整个建议框
          const existingContainer = document.querySelector(".cubox-ai-suggestions");
          if (existingContainer) {
            existingContainer.remove();
          }
          const button = document.querySelector(".ai-classify-button");
          if (button) {
            resetButton(button);
          }
        } else {
          // 如果标签功能已启用，只隐藏分类部分
          const categoriesSection = container.querySelector(".categories-section");
          if (categoriesSection) {
            categoriesSection.style.display = "none";
          }
        }
      });
    });
  });

  // 添加标签按钮事件
  container.querySelectorAll(".tag-btn").forEach((btn) => {
    btn.addEventListener("mouseover", () => {
      if (!btn.disabled) {
        btn.style.background = "#e9eaec";
      }
    });

    btn.addEventListener("mouseout", () => {
      if (!btn.disabled) {
        btn.style.background = "#f2f3f5";
      }
    });

    btn.addEventListener("click", async () => {
      const tagName = btn.textContent.trim();
      await applyTag(tagName);

      // 获取当前的标签功能状态
      chrome.storage.local.get(["enableTags"], async (result) => {
        if (!result.enableTags) {
          // 如果标签功能未启用，点击标签后关闭整个弹出框并重置按钮
          const existingContainer = document.querySelector(".cubox-ai-suggestions");
          if (existingContainer) {
            existingContainer.remove();
          }
          const button = document.querySelector(".ai-classify-button");
          if (button) {
            resetButton(button);
          }
        } else {
          // 如果标签功能已启用，保持原有行为
          btn.style.cssText = `
            height: 28px;
            border-radius: 14px;
            border: none;
            background: #e8f3ff;
            display: flex;
            padding: 0 12px;
            align-items: center;
            color: #2c46f1;
            font-size: 13px;
            font-weight: 500;
            cursor: default;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            transition: all 0.2s ease;
          `;
          btn.disabled = true;
        }
      });
    });
  });
}

async function applyClassification(groupId) {
  // 从 URL 中获取 cardId，支持两种格式
  const cardIdMatch = location.href.match(/\/cards\/(\d+)/) || location.href.match(/\/my\/card\?id=(\d+)/);
  const cardId = cardIdMatch[1];

  try {
    const response = await fetch("https://cubox.pro/c/api/v3/search_engine/update", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: getCuboxToken(),
      },
      body: `userSearchEngineID=${cardId}&groupId=${groupId}`,
    });

    if (response.ok) {
      showToast("分类成功！");
    }
  } catch (error) {
    console.error("应用分类失败:", error);
    showToast("分类失败，请重试");
  }
}

async function applyTag(tagName) {
  // 从 URL 中获取 cardId，支持两种格式
  const cardIdMatch = location.href.match(/\/cards\/(\d+)/) || location.href.match(/\/my\/card\?id=(\d+)/);
  const cardId = cardIdMatch[1];

  try {
    // 使用 encodeURIComponent 对标签名进行编码
    const encodedTagName = encodeURIComponent(tagName);
    const response = await fetch("https://cubox.pro/c/api/v3/search_engine/update", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: getCuboxToken(),
      },
      body: `userSearchEngineID=${cardId}&linkedTagNames=${encodeURIComponent(JSON.stringify([{ name: tagName }]))}`,
    });

    if (response.ok) {
      showToast("标签已添加", "success");
    } else {
      throw new Error("添加标签失败");
    }
  } catch (error) {
    console.error("添加标签失败:", error);
    showToast("添加标签失败，请重试");
  }
}

function showToast(message, type = "error") {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 8px;
    border-radius: 100px;
    font-size: 12px;
    backdrop-filter: blur(50px);
    -webkit-backdrop-filter: blur(50px);
    background: rgba(255, 255, 255, 0.8);
    border: 0.8px solid rgba(0, 0, 0, 0.05);
    color: ${type === "error" ? "#dc3545" : "#2c46f1"};
    display: flex;
    align-items: center;
    gap: 5px;
    z-index: 10000;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
