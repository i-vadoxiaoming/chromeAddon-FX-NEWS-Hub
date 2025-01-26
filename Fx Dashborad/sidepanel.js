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

  if (scrollTop + clientHeight >= scrollHeight - 100) {
    console.log('Loading more articles...');
    loadMoreArticles();
  }
}

// 渲染文章列表
function renderArticles(articles) {
  if (!contentContainer) {
    console.error('Cannot render articles: content container is null');
    return;
  }

  const articleList = document.createElement('div');
  articleList.className = 'article-list';

  articles.forEach(article => {
    const articleCard = document.createElement('div');
    articleCard.className = 'article-card';

    // 缩略图
    const imageContainer = document.createElement('div');
    const image = document.createElement('img');
    image.src = article.image_url || 'https://via.placeholder.com/300x180';
    image.alt = article.title;
    image.className = 'article-image';
    imageContainer.appendChild(image);
    articleCard.appendChild(imageContainer);

    // 内容区域
    const content = document.createElement('div');
    content.className = 'article-content';

    // 标题
    const title = document.createElement('h3');
    title.className = 'article-title';
    title.textContent = article.title;
    content.appendChild(title);

    // 描述
    if (article.description) {
      const description = document.createElement('p');
      description.className = 'article-description';
      description.textContent = article.description;
      content.appendChild(description);
    }

    // Read More 按钮
    if (article.link) {
      const readMore = document.createElement('a');
      readMore.href = article.link;
      readMore.className = 'read-more';
      readMore.textContent = 'Read More';
      readMore.target = '_blank';
      content.appendChild(readMore);
    }

    articleCard.appendChild(content);
    articleList.appendChild(articleCard);
  });

  contentContainer.appendChild(articleList);
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
      // 重置分页状态
      currentPage = 0;
      allArticles = response.data.articles;
      contentContainer.innerHTML = ''; // 清空现有内容
      loadMoreArticles(); // 加载第一页
    } else {
      showError(response.message || 'Failed to load RSS feeds');
    }
  } catch (error) {
    showError(error.message || 'An unexpected error occurred');
  } finally {
    setLoading(false);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 确保内容容器有足够的高度
  contentContainer.style.minHeight = '100vh';

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
});