import feedparser
import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re
import time
from datetime import datetime
from PIL import Image
from io import BytesIO
import os
from requests.exceptions import RequestException
import base64

class RSSParser:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
        self.session = requests.Session()
        self.image_cache = {}

    def get_rss_urls(self, content_type='news'):
        """从本地配置文件读取RSS源"""
        try:
            # 根据内容类型选择配置文件
            config_file = f'config_{content_type}.json'
            config_path = os.path.join(os.path.dirname(__file__), config_file)
            if os.path.exists(config_path):
                with open(config_path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    rss_sources = config.get('rssSources', {
                        'zh': [],  # 中文新闻源
                        'en': [],  # 英文新闻源
                        'jp': []   # 日文新闻源
                    })
                    print(f"Loaded {content_type} RSS URLs for multiple languages")
                    return rss_sources
            else:
                print(f"Config file not found at: {config_path}")
        except Exception as e:
            print(f"Error reading RSS URLs from config: {e}")
        
        # 如果出错或没有配置文件，返回空源
        default_sources = {
            'en': [],
            'zh': [],
            'jp': []
        }
        print(f"Using empty {content_type} RSS URLs")
        return default_sources

    def parse_all_feeds(self, content_type='news'):
        """解析所有配置的RSS源"""
        articles_by_lang = {
            'zh': [],
            'en': [],
            'jp': []
        }
        
        rss_sources = self.get_rss_urls(content_type)
        print(f"\nProcessing {content_type} feeds:")
        for lang, urls in rss_sources.items():
            if not urls:  # 如果没有配置RSS源，跳过这个语言
                print(f"No {content_type} RSS sources configured for {lang}")
                continue
                    
            print(f"\nProcessing {len(urls)} {lang} {content_type} RSS feeds...")
            for url in urls:
                try:
                    print(f"\nProcessing RSS feed: {url}")
                    feed_articles = self.parse_single_feed(url)
                    if feed_articles:
                        articles_by_lang[lang].extend(feed_articles)
                        print(f"Successfully added {len(feed_articles)} articles from {url}")
                    else:
                        print(f"No valid articles found in {url}")
                except Exception as e:
                    print(f"Error processing feed {url}: {e}")
                    continue

            print(f"Total articles for {lang}: {len(articles_by_lang[lang])}")
        
        return articles_by_lang

    def parse_single_feed(self, rss_url):
        """解析单个RSS源"""
        try:
            print(f"Fetching RSS feed: {rss_url}")
            feed = feedparser.parse(rss_url)
            
            if feed.bozo:
                print(f"Warning: RSS feed has errors: {feed.bozo_exception}")
            
            articles = []
            total = len(feed.entries)
            
            print(f"Found {total} articles in {rss_url}")
            for i, entry in enumerate(feed.entries, 1):
                print(f"Processing article {i}/{total}: {entry.get('title', '')}")
                
                # 改进日期处理
                date = ''
                try:
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                        date = datetime.fromtimestamp(time.mktime(entry.published_parsed)).isoformat()
                    elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                        date = datetime.fromtimestamp(time.mktime(entry.updated_parsed)).isoformat()
                    else:
                        # 如果没有日期，使用当前时间
                        date = datetime.now().isoformat()
                except Exception as e:
                    print(f"Error parsing date for article: {e}")
                    date = datetime.now().isoformat()
                
                article = {
                    'title': entry.get('title', ''),
                    'link': entry.get('link', ''),
                    'date': date,
                    'description': entry.get('description', '')
                }

                # 1. 首先尝试从RSS XML中获取图片
                image_url = None
                
                # 检查所有可能的RSS图片字段
                if hasattr(entry, 'media_thumbnail'):
                    image_url = entry.media_thumbnail[0]['url']
                    print(f"Found media_thumbnail: {image_url}")
                elif hasattr(entry, 'media_content'):
                    for media in entry.media_content:
                        if 'image' in media.get('type', '').lower():
                            image_url = media['url']
                            print(f"Found media_content: {image_url}")
                            break
                elif hasattr(entry, 'enclosures'):
                    for enclosure in entry.enclosures:
                        if 'image' in enclosure.get('type', '').lower():
                            image_url = enclosure.href
                            print(f"Found enclosure: {image_url}")
                            break
                elif hasattr(entry, 'links'):
                    for link in entry.links:
                        if 'image' in link.get('type', '').lower():
                            image_url = link.href
                            print(f"Found link: {image_url}")
                            break

                # 2. 如果RSS中没有图片，从文章内容中提取
                if not image_url:
                    # 先检查description中的图片
                    if article['description']:
                        image_url = self.extract_image_from_html(article['description'], article['link'])
                        if image_url:
                            print(f"Found image in description: {image_url}")
                    
                    # 如果description中没有，访问文章页面
                    if not image_url:
                        image_url = self.get_article_image(article['link'])
                        if image_url:
                            print(f"Found image in article page: {image_url}")

                # 3. 如果都没找到，使用默认图片
                if image_url:
                    # 验证图片URL是否有效
                    if self.is_valid_image(image_url):
                        article['image_url'] = image_url
                        print(f"Using valid image: {image_url}")
                    else:
                        default_image = self.get_default_image(article)
                        article['image_url'] = default_image
                        print(f"Image invalid, using default: {default_image}")
                else:
                    default_image = self.get_default_image(article)
                    article['image_url'] = default_image
                    print(f"No image found, using default: {default_image}")

                articles.append(article)

            return articles

        except Exception as e:
            print(f"Error parsing RSS feed {rss_url}: {e}")
            import traceback
            traceback.print_exc()
            return []

    def is_valid_image(self, url):
        """检查URL是否是有效的图片"""
        try:
            if url in self.image_cache:
                return self.image_cache[url]

            response = self.session.head(url, timeout=5)
            content_type = response.headers.get('content-type', '')
            is_valid = (
                response.status_code == 200 and
                'image' in content_type and
                not any(x in url.lower() for x in ['icon', 'logo', 'avatar', 'banner'])
            )
            self.image_cache[url] = is_valid
            return is_valid
        except:
            return False

    def get_image_size(self, url):
        """获取图片尺寸"""
        try:
            response = self.session.get(url, timeout=5)
            img = Image.open(BytesIO(response.content))
            return img.size
        except:
            return (0, 0)

    def extract_image_from_html(self, html_content, article_url):
        """从HTML内容中提取合适的图片URL"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            candidates = []
            
            # 1. 首先查找Open Graph和Twitter卡片图片（通常是文章主图）
            og_image = soup.find('meta', {'property': 'og:image'})
            if og_image and og_image.get('content'):
                url = og_image['content']
                if self.is_valid_image(url):
                    return url
                    
            twitter_image = soup.find('meta', {'name': 'twitter:image'})
            if twitter_image and twitter_image.get('content'):
                url = twitter_image['content']
                if self.is_valid_image(url):
                    return url

            # 2. 查找文章主要内容区域的图片
            content_areas = soup.find_all(['article', 'div'], {'class': re.compile(
                r'article|post|entry|content|body', re.I)})
            
            for area in content_areas:
                # 查找所有图片
                for img in area.find_all('img'):
                    src = img.get('src', '')
                    if not src:
                        continue
                        
                    # 处理相对URL
                    if not src.startswith(('http://', 'https://')):
                        src = urljoin(article_url, src)
                    
                    # 检查是否是有效图片
                    if not self.is_valid_image(src):
                        continue
                    
                    # 计算图片得分
                    score = 0
                    
                    # 检查图片尺寸
                    width = img.get('width', '').strip()
                    height = img.get('height', '').strip()
                    
                    if width.isdigit() and height.isdigit():
                        w, h = int(width), int(height)
                    else:
                        w, h = self.get_image_size(src)
                    
                    # 根据尺寸评分
                    if w >= 400 and h >= 300:
                        score += 5
                    elif w >= 300 or h >= 300:
                        score += 3
                        
                    # 检查图片类名
                    img_class = ' '.join(img.get('class', []) or [])
                    if re.search(r'featured|main|large|article-image', img_class, re.I):
                        score += 3
                        
                    # 检查alt文本
                    alt = img.get('alt', '')
                    if alt and len(alt) > 20:
                        score += 2
                        
                    # 检查图片URL
                    if 'article' in src.lower() or 'content' in src.lower():
                        score += 2
                        
                    candidates.append((src, score))
            
            # 返回得分最高的图片
            if candidates:
                candidates.sort(key=lambda x: x[1], reverse=True)
                return candidates[0][0]

        except Exception as e:
            print(f"Error extracting image from HTML: {e}")
            import traceback
            traceback.print_exc()
        
        return None

    def get_article_image(self, article_url):
        """从文章页面获取图片"""
        try:
            print(f"Fetching article: {article_url}")
            response = self.session.get(article_url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            image_url = self.extract_image_from_html(response.text, article_url)
            if image_url:
                return urljoin(article_url, image_url)
            
        except Exception as e:
            print(f"Error fetching article image from {article_url}: {e}")
        return None

    def get_default_image(self, article_type):
        """根据文章类型返回默认图片"""
        default_images = {
            'forex': 'https://editorial.fxstreet.com/images/Markets/Currencies/Major/EURUSD-1_Large.jpg',
            'stocks': 'https://editorial.fxstreet.com/images/Markets/Indices/Major/SP500_Large.jpg',
            'commodities': 'https://editorial.fxstreet.com/images/Markets/Commodities/Energy/Oil_Large.jpg',
            'crypto': 'https://editorial.fxstreet.com/images/Markets/Cryptocurrencies/Bitcoin_Large.jpg',
            'economy': 'https://editorial.fxstreet.com/images/Economic/economic-calendar_Large.jpg',
            'default': 'https://editorial.fxstreet.com/images/Markets/Currencies/Major/EURUSD-1_Large.jpg'
        }

        # 根据标题或描述判断文章类型
        text = (article_type.get('title', '') + ' ' + article_type.get('description', '')).lower()
        
        if any(word in text for word in ['forex', 'eur', 'usd', 'gbp', 'jpy', 'currency']):
            return default_images['forex']
        elif any(word in text for word in ['stocks', 'dow', 'nasdaq', 's&p', 'index']):
            return default_images['stocks']
        elif any(word in text for word in ['gold', 'oil', 'commodity', 'commodities']):
            return default_images['commodities']
        elif any(word in text for word in ['bitcoin', 'crypto', 'btc', 'eth']):
            return default_images['crypto']
        elif any(word in text for word in ['gdp', 'economy', 'inflation', 'fed', 'rate']):
            return default_images['economy']
        
        return default_images['default']

    def save_to_json(self, base_filename='rss_data'):
        """保存解析结果到JSON文件，按语言分类"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_dir = os.path.join(os.path.dirname(__file__), 'output')
        saved_files = []

        # 分别处理 news 和 strategy
        for content_type in ['news', 'strategy']:
            print(f"\nProcessing {content_type} content:")
            # 获取对应类型的RSS源
            articles_by_lang = self.parse_all_feeds(content_type)
            
            type_dir = os.path.join(output_dir, content_type)
            os.makedirs(type_dir, exist_ok=True)
            
            has_content = False
            for lang, articles in articles_by_lang.items():
                if articles:  # 只保存有文章的语言
                    has_content = True
                    lang_dir = os.path.join(type_dir, lang)
                    os.makedirs(lang_dir, exist_ok=True)
                    
                    filename = f"{base_filename}_{lang}_{timestamp}.json"
                    filepath = os.path.join(lang_dir, filename)
                    
                    if content_type == 'strategy':
                        strategy_articles = articles[:5]
                        for article in strategy_articles:
                            article['title'] = f"Strategy: {article['title']}"
                            article['type'] = 'strategy'
                        articles_to_save = strategy_articles
                    else:
                        articles_to_save = articles
                    
                    data = {
                        'last_updated': datetime.now().isoformat(),
                        'language': lang,
                        'type': content_type,
                        'articles': articles_to_save
                    }

                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    
                    saved_files.append(filepath)
                    print(f"Saved {len(articles_to_save)} {lang} {content_type} articles to {filepath}")
            
            if has_content:
                # 只为有内容的类型生成文件索引
                self.save_file_index(type_dir)
        
        return saved_files

    def save_file_index(self, output_dir):
        """保存文件索引"""
        print(f"\nGenerating file index for directory: {output_dir}")
        index = {}
        
        # 检查目录是否存在
        if not os.path.exists(output_dir):
            print(f"Error: Directory does not exist: {output_dir}")
            return
        
        # 遍历语言目录
        for lang in ['en', 'jp', 'zh']:
            lang_dir = os.path.join(output_dir, lang)
            if os.path.exists(lang_dir):
                # 获取该语言目录下的所有JSON文件
                files = [f for f in os.listdir(lang_dir) if f.endswith('.json')]
                if files:
                    # 按文件名降序排序（新的文件在前）
                    files.sort(reverse=True)
                    index[lang] = files
                    print(f"Found {len(files)} files for {lang}:")
                    for f in files:
                        print(f"  - {f}")
                else:
                    print(f"No JSON files found in {lang_dir}")
        
        if not index:
            print("Warning: No files found in any language directory")
            return
        
        # 保存索引文件
        index_path = os.path.join(output_dir, 'file_index.json')
        try:
            with open(index_path, 'w', encoding='utf-8') as f:
                json.dump(index, f, ensure_ascii=False, indent=2)
            print(f"Successfully saved file index to: {index_path}")
            # 验证文件内容
            with open(index_path, 'r', encoding='utf-8') as f:
                loaded_index = json.load(f)
                print(f"Verified index content: {json.dumps(loaded_index, indent=2)}")
        except Exception as e:
            print(f"Error saving file index: {e}")

def fetch_rss_feed(url):
    try:
        response = requests.get(url, timeout=10)  # 设置超时时间
        response.raise_for_status()  # 检查 HTTP 状态码
        return response.content
    except RequestException as e:
        print(f"Error fetching RSS feed from {url}: {e}")
        return None

def parse_rss_feed(content):
    try:
        feed = feedparser.parse(content)
        if feed.bozo:  # 检查是否有解析错误
            print(f"Error parsing RSS feed: {feed.bozo_exception}")
            return None
        return feed
    except Exception as e:
        print(f"Error parsing RSS feed: {e}")
        return None

def save_to_json(data, file_path):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Data saved to {file_path}")
    except IOError as e:
        print(f"Error saving data to {file_path}: {e}")

def load_from_json(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (IOError, json.JSONDecodeError) as e:
        print(f"Error loading data from {file_path}: {e}")
        return None

def process_rss_feed(url, output_dir):
    content = fetch_rss_feed(url)
    if not content:
        return None

    feed = parse_rss_feed(content)
    if not feed:
        return None

    articles = []
    for entry in feed.entries:
        article = {
            'title': entry.title,
            'link': entry.link,
            'date': entry.get('published', ''),
            'description': entry.get('description', ''),
            'image_url': entry.get('media_content', [{}])[0].get('url', '') if 'media_content' in entry else ''
        }
        articles.append(article)

    # 生成文件名
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    file_name = f"rss_data_{timestamp}.json"
    file_path = os.path.join(output_dir, file_name)

    # 保存数据
    save_to_json({'articles': articles, 'last_updated': timestamp}, file_path)
    return file_path

def main():
    parser = RSSParser()
    parser.save_to_json()

if __name__ == '__main__':
    main()

def save_to_json(data, file_path):
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Data saved to {file_path}")
    except IOError as e:
        print(f"Error saving data to {file_path}: {e}")

def load_from_json(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (IOError, json.JSONDecodeError) as e:
        print(f"Error loading data from {file_path}: {e}")
        return None 