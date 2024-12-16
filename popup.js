let categories = [];

document.addEventListener("DOMContentLoaded", () => {
  // 加载已保存的设置
  loadSettings();

  // 初始化标签页切换
  initializeTabs();

  // 绑定按钮事件
  document.getElementById("saveButton").addEventListener("click", saveSettings);
  document.getElementById("refreshCategories").addEventListener("click", fetchCuboxCategories);

  // 绑定字数限制复选框事件
  const enableMaxLength = document.getElementById("enableMaxLength");
  const maxLength = document.getElementById("maxLength");
  const lengthInput = maxLength.parentElement;

  enableMaxLength.addEventListener("change", () => {
    maxLength.disabled = !enableMaxLength.checked;
    lengthInput.classList.toggle("disabled", !enableMaxLength.checked);
    if (enableMaxLength.checked && !maxLength.value) {
      maxLength.value = "2000"; // 默认值
    }
  });

  // 绑定生成标签复选框事件
  const enableTags = document.getElementById("enableTags");
  enableTags.addEventListener("change", () => {
    // 直接保存设置
    chrome.storage.local.set({ enableTags: enableTags.checked }, () => {
      showStatus("设置已保存", "success");
    });
  });
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
  chrome.storage.local.get(["apiKey", "apiEndpoint", "model", "categories", "enableMaxLength", "maxLength", "enableTags"], (result) => {
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

    // 加载字数限制设置
    const enableMaxLength = document.getElementById("enableMaxLength");
    const maxLength = document.getElementById("maxLength");
    const lengthInput = maxLength.parentElement;

    enableMaxLength.checked = result.enableMaxLength || false;
    maxLength.disabled = !enableMaxLength.checked;
    lengthInput.classList.toggle("disabled", !enableMaxLength.checked);
    if (result.maxLength) {
      maxLength.value = result.maxLength;
    }

    // 加载标签设置
    const enableTags = document.getElementById("enableTags");
    enableTags.checked = result.enableTags || false;
  });
}

function saveSettings() {
  const apiKey = document.getElementById("apiKey").value.trim();
  const apiEndpoint = document.getElementById("apiEndpoint").value.trim();
  const model = document.getElementById("model").value.trim();
  const enableMaxLength = document.getElementById("enableMaxLength").checked;
  const maxLength = document.getElementById("maxLength").value;
  const enableTags = document.getElementById("enableTags").checked;

  try {
    // 验证必填字段
    if (!apiKey) {
      throw new Error("请输入 API Key");
    }

    if (!model) {
      throw new Error("请输入模型名称");
    }

    // 验证字数限制
    if (enableMaxLength) {
      const lengthValue = parseInt(maxLength);
      if (!lengthValue || lengthValue < 100) {
        throw new Error("请输入有效的字数限制（至少 100 字）");
      }
    }

    // 保存设置
    chrome.storage.local.set(
      {
        apiKey,
        apiEndpoint: apiEndpoint || "https://api.openai.com/v1/chat/completions",
        model: model || "gpt-3.5-turbo",
        enableMaxLength,
        maxLength: enableMaxLength ? maxLength : null,
        enableTags,
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

    // 保存现有的描述信息
    const existingDescriptions = {};
    categories.forEach((category) => {
      if (category.description) {
        existingDescriptions[category.groupId] = category.description;
      }
    });

    // 合并新旧分类数据，保留描述信息
    const newCategories = data.data.map((category) => ({
      ...category,
      description: existingDescriptions[category.groupId] || "",
    }));

    // 更新分类数据
    categories = newCategories;

    // 保存到存储
    await chrome.storage.local.set({ categories });
    console.log("Saved updated categories:", categories);

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

  // 过滤掉没有标题的分类，但只用于显示
  const validCategories = categories.filter((category) => category.groupName && category.groupName.trim());

  container.innerHTML = validCategories
    .map(
      (category) => `
    <tr>
      <td>
        <div class="category-name">${category.groupName}</div>
        <div class="category-id">ID: ${category.groupId}</div>
      </td>
      <td>
        <textarea
          class="description-input"
          placeholder="添加分类描述，帮助 AI 更准确地进行分类..."
          data-group-id="${category.groupId}"
        >${category.description || ""}</textarea>
      </td>
    </tr>
  `
    )
    .join("");

  // 更新分类数量状态
  const categoryStatus = document.getElementById("categoryStatus");
  if (categoryStatus) {
    categoryStatus.textContent = `共 ${validCategories.length} 个分类`;
    categoryStatus.className = "status success";
  }

  // 为所有 textarea 添加事件监听器
  document.querySelectorAll(".description-input").forEach((textarea) => {
    // 自动调整高度
    autoResizeTextarea(textarea);

    // 添加输入事件监听器
    textarea.addEventListener("input", () => {
      autoResizeTextarea(textarea);
    });

    // 添加失焦事件监听器
    textarea.addEventListener("blur", () => {
      const groupId = textarea.dataset.groupId;
      updateDescription(groupId, textarea.value);
    });
  });
}

// 修改为普通函数
function updateDescription(groupId, value) {
  // 在完整的 categories 数组中查找和更新
  const category = categories.find((c) => c.groupId === groupId);
  if (category) {
    category.description = value;
    console.log(`Updating description for category ${groupId}:`, value);

    // 立即保存到 storage
    chrome.storage.local.set({ categories }, () => {
      console.log("Categories saved after description update:", categories);
      showStatus("描述已保存", "success", true);
    });
  }
}

// 自动调整 textarea 高度的函数
function autoResizeTextarea(textarea) {
  // 设置一个较小的初始高度
  textarea.style.height = "32px";

  // 计算实际需要的高度
  const scrollHeight = textarea.scrollHeight;

  // 如果内容只有一行，保持最小高度
  if (scrollHeight <= 32) {
    textarea.style.height = "32px";
  } else {
    textarea.style.height = scrollHeight + "px";
  }
}

function showStatus(message, type, isCategory = false) {
  const status = document.getElementById(isCategory ? "categoryStatus" : "status");
  const originalText = status.textContent;
  const isCountMessage = originalText.includes("共") && originalText.includes("个分类");

  status.textContent = message;
  status.className = `status ${type}`;

  if (!isCountMessage) {
    setTimeout(() => {
      status.className = "status";
      // 如果是分类状态，且之前显示的是分类数量，则恢复显示分类数量
      if (isCategory && categories.length > 0) {
        const validCategories = categories.filter((category) => category.groupName && category.groupName.trim());
        status.textContent = `共 ${validCategories.length} 个分类`;
        status.className = "status success";
      }
    }, 3000);
  }
}
