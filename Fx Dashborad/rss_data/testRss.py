import feedparser
import re
from urllib.parse import urljoin

def parse_rss(rss_url):
    """
    解析RSS源并提取标题、缩略图和链接
    
    Args:
        rss_url (str): RSS源的URL
    
    Returns:
        list: 包含文章信息的字典列表
    """
    # 解析RSS源
    feed = feedparser.parse(rss_url)
    articles = []
    
    for entry in feed.entries:
        article = {
            'title': entry.title,
            'link': entry.link,
            'thumbnail': None
        }
        
        # 尝试不同的方式获取缩略图
        # 1. 从媒体内容中获取
        if hasattr(entry, 'media_content'):
            for media in entry.media_content:
                if media.get('type', '').startswith('image/'):
                    article['thumbnail'] = media.get('url')
                    break
        
        # 2. 从媒体缩略图中获取
        if not article['thumbnail'] and hasattr(entry, 'media_thumbnail'):
            if entry.media_thumbnail:
                article['thumbnail'] = entry.media_thumbnail[0]['url']
        
        # 3. 从内容中提取第一张图片
        if not article['thumbnail'] and hasattr(entry, 'content'):
            content = entry.content[0].value if isinstance(entry.content, list) else entry.content
            img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', content)
            if img_match:
                img_url = img_match.group(1)
                # 处理相对URL
                if not img_url.startswith(('http://', 'https://')):
                    img_url = urljoin(article['link'], img_url)
                article['thumbnail'] = img_url
        
        articles.append(article)
    
    return articles

# 使用示例
if __name__ == "__main__":
    # 替换为你想要解析的RSS源URL
    rss_url = "https://www.investing.com/rss/news.rss"
    try:
        articles = parse_rss(rss_url)
        for article in articles:
            print("标题:", article['title'])
            print("链接:", article['link'])
            print("缩略图:", article['thumbnail'])
            print("-" * 50)
    except Exception as e:
        print(f"解析RSS时发生错误: {e}")