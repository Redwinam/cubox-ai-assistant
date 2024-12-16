let categories = [];

document.addEventListener("DOMContentLoaded", () => {
  // 加载已保存的设置
  loadSettings();

  // 初始化标签页切换
  initializeTabs();

  // 绑定按钮事件
  document.getElementById("saveButton").addEventListener("click", saveSettings);
  document.getElementById("refreshCategories").addEventListener("click", fetchCuboxCategories);
  document.getElementById("saveCategoriesButton").addEventListener("click", saveCategories);
});

function initializeTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // 移除所有活动状态
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));

      // 设置当前标签页为活动状态
      tab.classList.add("active");
      const tabId = tab.dataset.tab;
      document.getElementById(tabId).classList.add("active");
    });
  });
}

function loadSettings() {
  chrome.storage.local.get(["apiKey", "apiEndpoint", "model", "categories"], (result) => {
    if (result.apiKey) {
      document.getElementById("apiKey").value = result.apiKey;
    }
    if (result.apiEndpoint) {
      document.getElementById("apiEndpoint").value = result.apiEndpoint;
    }
    if (result.model) {
      document.getElementById("model").value = result.model;
    }
    if (result.categories) {
      categories = result.categories;
      renderCategories();
    }
  });
}

function saveSettings() {
  const apiKey = document.getElementById("apiKey").value.trim();
  const apiEndpoint = document.getElementById("apiEndpoint").value.trim();
  const model = document.getElementById("model").value.trim();

  try {
    // 验证必填字段
    if (!apiKey) {
      throw new Error("请输入 API Key");
    }

    if (!model) {
      throw new Error("请输入模型名称");
    }

    // 保存设置
    chrome.storage.local.set(
      {
        apiKey,
        apiEndpoint: apiEndpoint || "https://api.openai.com/v1/chat/completions",
        model: model || "gpt-3.5-turbo",
      },
      () => {
        showStatus("设置已保存", "success");
      }
    );
  } catch (error) {
    showStatus(error.message, "error");
  }
}

// 从页面获取 token
async function getCuboxToken() {
  try {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 如果当前不在 Cubox 页面，提示用户
    if (!tab.url.includes("cubox.pro")) {
      throw new Error("请先打开 Cubox 网站");
    }

    // 从页面获取 token
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 直接从 localStorage 获取 token
        const token = localStorage.getItem("token");

        // 如果有 token，尝试验证其有效性
        if (token) {
          // 立即发起一个验证请求
          return fetch("https://cubox.pro/c/api/v2/group/my", {
            headers: {
              accept: "application/json",
              authorization: token,
            },
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.code === 200) {
                return { token, valid: true };
              }
              return { token: null, valid: false };
            })
            .catch(() => ({ token: null, valid: false }));
        }

        return Promise.resolve({ token: null, valid: false });
      },
    });

    const { token, valid } = await result[0].result;

    if (!token || !valid) {
      throw new Error("请先登录 Cubox（在 Cubox 网站上）");
    }

    return token;
  } catch (error) {
    if (error.message.includes("Cannot access contents of url")) {
      throw new Error("请授予扩展访问 Cubox 网站的权限");
    }
    throw error;
  }
}

async function fetchCuboxCategories() {
  const button = document.getElementById("refreshCategories");
  const originalText = button.innerHTML;
  button.disabled = true;
  button.innerHTML = "<span>⌛</span> 更新中...";

  try {
    const token = await getCuboxToken();
    console.log("Token obtained successfully");

    const response = await fetch("https://cubox.pro/c/api/v2/group/my", {
      headers: {
        accept: "application/json",
        authorization: token,
      },
    });

    if (!response.ok) {
      throw new Error("获取分类失败: " + response.status);
    }

    const data = await response.json();
    console.log("API response:", data);

    if (data.code !== 200) {
      throw new Error(data.message || "获取分类失败");
    }

    // 合并新旧分类数据，保留描述信息
    const newCategories = data.data.map((category) => {
      const existingCategory = categories.find((c) => c.groupId === category.groupId);
      return {
        ...category,
        description: existingCategory?.description || "",
      };
    });

    // 更新分类数据
    categories = newCategories;

    // 保存到存储
    await chrome.storage.local.set({ categories });

    // 重新渲染分类列表
    renderCategories();

    showStatus("分类已更新", "success", true);
  } catch (error) {
    console.error("获取分类失败:", error);
    showStatus(error.message, "error", true);
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

function renderCategories() {
  const container = document.getElementById("categoriesList");
  container.innerHTML = categories
    .map(
      (category, index) => `
    <tr>
      <td>
        <div class="category-name">${category.groupName}</div>
        <div class="category-id">ID: ${category.groupId}</div>
      </td>
      <td>
        <textarea
          class="description-input"
          placeholder="添加分类描述，帮助 AI 更准确地进行分类..."
          data-index="${index}"
          onchange="window.updateDescription(${index}, this.value)"
        >${category.description || ""}</textarea>
      </td>
    </tr>
  `
    )
    .join("");
}

// 需要在全局作用域定义，这样 HTML 中的 onchange 事件才能访问到
window.updateDescription = function (index, value) {
  categories[index].description = value;
};

function saveCategories() {
  chrome.storage.local.set({ categories }, () => {
    showStatus("分类设置已保存", "success", true);
  });
}

function showStatus(message, type, isCategory = false) {
  const status = document.getElementById(isCategory ? "categoryStatus" : "status");
  status.textContent = message;
  status.className = `status ${type}`;

  setTimeout(() => {
    status.className = "status";
  }, 3000);
}
