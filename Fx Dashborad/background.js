// RSS data path
const RSS_DATA_PATH = 'rss_data/output';

// 获取RSS数据
async function fetchRSS(type = 'news') {
  try {
    console.log(`Reading ${type} RSS data...`);
    let allArticles = [];
    
    // 读取文件索引
    const indexPath = `${RSS_DATA_PATH}/${type}/file_index.json`;
    console.log(`Reading index from: ${indexPath}`);
    
    const indexUrl = chrome.runtime.getURL(indexPath);
    const indexResponse = await fetch(indexUrl);
    if (!indexResponse.ok) {
      console.warn(`Failed to load index for ${type}`);
      return {
        last_updated: new Date().toISOString(),
        articles: []
      };
    }
    
    const fileIndex = await indexResponse.json();
    console.log(`File index loaded for ${type}:`, fileIndex);

    // 按语言顺序读取文件
    const languages = ['en', 'jp', 'zh'];
    for (const lang of languages) {
      const files = fileIndex[lang] || [];
      console.log(`Processing ${files.length} ${type} files for ${lang}`);
      
      // 按照索引中的顺序读取文件
      for (const fileName of files) {
        const filePath = `${RSS_DATA_PATH}/${type}/${lang}/${fileName}`;
        try {
          console.log(`Reading file: ${filePath}`);
          const fileUrl = chrome.runtime.getURL(filePath);
          const response = await fetch(fileUrl);
          if (!response.ok) {
            console.warn(`Failed to load file: ${filePath}, status: ${response.status}`);
            continue;
          }
          
          const data = await response.json();
          if (data && data.articles && Array.isArray(data.articles)) {
            console.log(`Successfully loaded ${data.articles.length} articles from ${filePath}`);
            allArticles = allArticles.concat(data.articles);
          }
        } catch (error) {
          console.warn(`Error loading file ${filePath}:`, error);
        }
      }
    }
    
    if (allArticles.length === 0) {
      console.warn('No articles loaded');
      return {
        last_updated: new Date().toISOString(),
        articles: []
      };
    }
    
    console.log(`Total articles loaded: ${allArticles.length}`);
    return {
      last_updated: new Date().toISOString(),
      articles: allArticles
    };
    
  } catch (error) {
    console.error('Error loading RSS data:', error);
    throw error;
  }
}

// 设置基本的消息处理
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  // 确保立即激活
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  // 确保立即接管所有页面
  event.waitUntil(self.clients.claim());
});

// 保持 Service Worker 活跃
setInterval(() => {
  console.log('Service Worker heartbeat');
}, 20000);

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateRSS') {
    fetchRSS(message.type)
      .then(data => {
        // 直接返回数据给发送者
        sendResponse({ status: 'success', data: data });
      })
      .catch(error => {
        console.error('Error in fetchRSS:', error);
        sendResponse({ status: 'error', message: error.message });
      });
    
    // 保持消息通道开放
    return true;
  }
});

// 初始化设置
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  
  // 设置侧边栏
  chrome.sidePanel.setOptions({
    path: 'sidepanel.html',
    enabled: true
  });
});

// 处理扩展图标点击
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});
   