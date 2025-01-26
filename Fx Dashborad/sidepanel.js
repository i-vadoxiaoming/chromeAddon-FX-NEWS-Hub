// Optional: Add any additional functionality here
console.log('Side Panel Loaded');

let currentPage = 0;
const articlesPerPage = 10;
let allArticles = [];
let isLoading = false;
let currentType = 'news';

// 获取页面元素
const loadingIndicator = document.getElementById('loading');
const contentContainer = document.getElementById('content');
if (!contentContainer) {
  console.error('Content container element not found!');
}
const errorMessage = document.getElementById('error-message');

// 更新UI显示状态
function setLoading(isLoading) {
  loadingIndicator.style.display = isLoading ? 'block' : 'none';
  contentContainer.style.display = isLoading ? 'none' : 'block';
}

// 显示错误信息
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setLoading(false);
}

// 切换标签页
function switchTab(type) {
  currentType = type;
  
  // 更新标签页样式
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === type);
  });
  
  // 清空内容并重新加载
  contentContainer.innerHTML = '';
  updateRSS(type);
}

// 从Chrome存储获取RSS数据
async function fetchRSSData(type = currentType) {
  try {
    const data = await chrome.storage.local.get(`rssData_${type}`);
    const contentDiv = document.getElementById('rss-content');
    
    if (data[`rssData_${type}`] && data[`rssData_${type}`].articles) {
      allArticles = data[`rssData_${type}`].articles;
      
      // 显示最新更新时间
      const lastUpdated = document.createElement('div');
      lastUpdated.className = 'last-updated';
      lastUpdated.textContent = `Last Updated: ${data[`rssData_${type}`].last_updated}`;
      contentDiv.appendChild(lastUpdated);
      
      await loadMoreArticles();
    } else {
      // 如果没有数据，尝试从后台获取
      chrome.runtime.sendMessage({ 
        action: 'updateRSS',
        type: currentType
      });
      
      contentDiv.innerHTML = '<div class="loading">Loading RSS feeds...</div>';
    }
  } catch (error) {
    console.error('Error loading RSS data:', error);
    document.getElementById('rss-content').innerHTML = 
      '<div class="error">Error loading RSS feed data. Please try refreshing.</div>';
  }
}

// 从 GitHub 获取文件内容
async function fetchFileFromGitHub(filePath, githubToken) {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const url = `https://api.github.com/repos/chenyijun777/chromeAddon/contents/${filePath}`;
    console.log('Fetching file from:', url); // 打印请求的 URL

    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Fx Dashboard'
    };
    if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`;
    }

    try {
        const response = await fetch(proxyUrl + url, { headers });
        console.log('Response status:', response.status); // 打印响应状态码
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Response data:', data); // 打印响应数据
        const content = atob(data.content); // 解码 base64 内容
        return JSON.parse(content);
    } catch (error) {
        console.error('Error fetching file from GitHub:', error);
        return null;
    }
}

// 获取最新的 RSS 数据
async function getLatestRssData(contentType = 'news', lang = 'en', githubToken) {
    const indexPath = `Fx%20Dashborad/rss_data/output/news/file_index.json`;
    console.log('Index path:', indexPath); // 打印文件路径
    const index = await fetchFileFromGitHub(indexPath, githubToken);
    if (!index || !index[lang]) {
        return null;
    }

    const latestFile = index[lang][0]; // 获取最新的文件
    const filePath = `Fx Dashborad/rss_data/output/${contentType}/${lang}/${latestFile}`;
    return fetchFileFromGitHub(filePath, githubToken);
}

// 创建文章元素
function createArticleElement(article) {
  const articleDiv = document.createElement('div');
  articleDiv.className = 'article';
  
  // 始终创建图片容器，保持布局一致
  const imageContainer = document.createElement('div');
  imageContainer.className = 'article-image-container';
  
  if (article.image_url) {
    const image = document.createElement('img');
    image.src = article.image_url;
    image.className = 'article-image';
    image.alt = article.title;
    
    // 添加图片加载错误处理
    image.onerror = () => {
      imageContainer.innerHTML = `
        <div class="image-placeholder">
          <span>FX</span>
        </div>
      `;
    };
    
    imageContainer.appendChild(image);
  } else {
    // 如果没有图片，显示占位符
    imageContainer.innerHTML = `
      <div class="image-placeholder">
        <span>FX</span>
      </div>
    `;
  }
  
  articleDiv.appendChild(imageContainer);
  
  // 创建文章内容容器
  const contentContainer = document.createElement('div');
  contentContainer.className = 'article-content';
  
  const title = document.createElement('div');
  title.className = 'article-title';
  
  const link = document.createElement('a');
  link.href = article.link;
  link.className = 'article-link';
  link.textContent = article.title;
  link.target = '_blank';
  
  title.appendChild(link);
  
  const date = document.createElement('div');
  date.className = 'article-date';
  date.textContent = article.date;
  
  contentContainer.appendChild(title);
  contentContainer.appendChild(date);
  articleDiv.appendChild(contentContainer);
  
  return articleDiv;
}

// 加载更多文章
async function loadMoreArticles() {
  if (isLoading) {
    console.log('Already loading, skipping...');
    return;
  }

  isLoading = true;
  loadingIndicator.style.display = 'block';
  console.log(`Loading page ${currentPage + 1}...`);

  try {
    const start = currentPage * articlesPerPage;
    const end = start + articlesPerPage;
    const articlesToLoad = allArticles.slice(start, end);

    if (articlesToLoad.length > 0) {
      console.log(`Loading ${articlesToLoad.length} articles...`);
      renderArticles(articlesToLoad);
      currentPage++;
    } else {
      console.log('No more articles to load');
    }
  } catch (error) {
    console.error('Error loading more articles:', error);
  } finally {
    loadingIndicator.style.display = 'none';
    isLoading = false;
  }
}

// 监听滚动事件
function handleScroll() {
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
  const clientHeight = document.documentElement.clientHeight || document.body.clientHeight;

  // 添加调试信息
  console.log(`Scroll position: ${scrollTop + clientHeight}/${scrollHeight}`);
  console.log(`ScrollTop: ${scrollTop}, ClientHeight: ${clientHeight}, ScrollHeight: ${scrollHeight}`);

  // 检查是否接近底部
  if (scrollTop + clientHeight >= scrollHeight - 50) { // 调整为更接近底部时触发
    console.log('Loading more articles...');
    loadMoreArticles();
  }
}

// 渲染文章列表
function renderArticles(articles) {
    const articleList = document.getElementById('article-list');
    if (!articleList) {
        console.error('Article list container not found');
        return;
    }
    articleList.innerHTML = ''; // 清空现有内容

    articles.forEach(article => {
        const articleCard = document.createElement('div');
        articleCard.className = 'article-card';

        // 缩略图
        const image = document.createElement('img');
        image.src = article.image_url || 'https://via.placeholder.com/50';
        image.alt = article.title;
        image.className = 'article-image';
        articleCard.appendChild(image);

        // 内容区域
        const content = document.createElement('div');
        content.className = 'article-content';

        // 标题（带超链接）
        const title = document.createElement('a');
        title.className = 'article-title';
        title.href = article.link || '#';
        title.textContent = article.title;
        title.target = '_blank'; // 在新标签页打开
        content.appendChild(title);

        // 描述
        if (article.description) {
            const description = document.createElement('p');
            description.className = 'article-description';
            description.textContent = article.description;
            content.appendChild(description);
        }

        articleCard.appendChild(content);
        articleList.appendChild(articleCard);
    });
}

// 获取并显示RSS数据
async function updateRSS(type = 'news') {
  try {
    setLoading(true);
    errorMessage.style.display = 'none';

    // 发送消息给background.js
    const response = await chrome.runtime.sendMessage({ 
      action: 'updateRSS',
      type: type
    });
    
    if (response.status === 'success') {
      // 直接渲染所有文章
      allArticles = response.data.articles;
      contentContainer.innerHTML = ''; // 清空现有内容
      renderArticles(allArticles); // 渲染所有文章
    } else {
      showError(response.message || 'Failed to load RSS feeds');
    }
  } catch (error) {
    showError(error.message || 'An unexpected error occurred');
  } finally {
    setLoading(false);
  }
}

// 监听窗口大小变化
window.addEventListener('resize', () => {
  const bodyWidth = document.body.clientWidth;
  console.log(`Current panel width: ${bodyWidth}px`);
  // 可以根据宽度动态调整布局
});

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 确保内容容器有足够的高度
  contentContainer.style.minHeight = 'calc(100vh - 100px)'; // 减去header和loading的高度

  // 添加滚动监听
  window.addEventListener('scroll', handleScroll);

  // Tab 切换事件
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.dataset.tab);
    });
  });

  // 默认加载 news tab
  const newsButton = document.querySelector('.tab-button[data-tab="news"]');
  if (newsButton) {
    newsButton.classList.add('active');
    updateRSS('news');
  }

  // 添加刷新按钮事件监听
  const refreshButton = document.getElementById('refresh-button');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      updateRSS(currentType);
    });
  }

  // 初始化加载数据
  const githubToken = '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'; // 如果需要访问私有仓库，提供 GitHub Token
  const latestNews = await getLatestRssData('news', 'en', githubToken);
  if (latestNews && latestNews.articles) {
    renderArticles(latestNews.articles);
  } else {
    console.error('No articles found');
  }

  setTimeout(() => {
    document.getElementById('search-input').focus();
  }, 100); // 延迟 100 毫秒
});