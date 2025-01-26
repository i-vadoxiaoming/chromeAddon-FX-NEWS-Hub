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

// 从 Supabase 获取数据
async function fetchDataFromSupabase() {
    const supabaseUrl = 'https://jfhncvkdqrhasbffxeub.supabase.co'; // 替换为你的 Supabase URL
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmaG5jdmtkcXJoYXNiZmZ4ZXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4ODUyMjYsImV4cCI6MjA1MzQ6MTIyNn0.dEp6lCwwj76Fjl22eszcw8M6q8vyTy_UoWRklH86QmI'; // 替换为你的 Supabase API 密钥
    const tableName = 'rss'; // 替换为你的表名

    try {
        console.log('Fetching data from Supabase...'); // 打印请求开始
        const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=title,link,description,image_url`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        console.log('Response status:', response.status); // 打印响应状态码
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Data received:', data); // 打印接收到的数据
        return data;
    } catch (error) {
        console.error('Error fetching data from Supabase:', error);
        return null;
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
    console.log('DOMContentLoaded event fired'); // 确保事件监听器已触发

    // 从 Supabase 获取数据
    const data = await fetchDataFromSupabase();

    if (data) {
        console.log('Data received:', data); // 打印接收到的数据
        renderArticles(data); // 渲染文章列表
    } else {
        console.error('Failed to fetch data from Supabase'); // 打印数据获取失败
    }
});