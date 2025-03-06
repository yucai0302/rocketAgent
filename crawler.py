import requests
from bs4 import BeautifulSoup

def get_weibo_hot_trends():
    """获取微博热搜数据"""
    try:
        url = 'https://weibo.com/ajax/side/hotSearch'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': 'https://weibo.com/',
            'Connection': 'keep-alive'
        }
        response = requests.get(url, headers=headers)
        data = response.json()
        hot_items = data.get('data', {}).get('realtime', [])
        
        result = "<div class='hot-trends-section weibo-trends'>\n"
        result += "<h2 class='hot-trends-title'>当前微博热搜</h2>\n"
        result += "<ol class='hot-trends-list'>\n"
        for i, item in enumerate(hot_items[:10], 1):
            title = item.get('note', '')
            link = f"https://s.weibo.com/weibo?q={title}"
            result += f"<li><a href=\"{link}\" target=\"_blank\" class='hot-trend-item'>{title}</a></li>\n"
        result += "</ol>\n</div>\n"
        return result
    except Exception as e:
        return f"获取微博热搜失败：{str(e)}"

def get_toutiao_hot_trends():
    """获取今日头条热搜数据"""
    try:
        url = 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers)
        data = response.json()
        
        result = "<div class='hot-trends-section toutiao-trends'>\n"
        result += "<h2 class='hot-trends-title'>当前头条热搜</h2>\n"
        result += "<ol class='hot-trends-list'>\n"
        for i, item in enumerate(data['data'][:10], 1):
            title = item['Title']
            link = f"https://www.toutiao.com/search/?keyword={title}"
            result += f"<li><a href=\"{link}\" target=\"_blank\" class='hot-trend-item'>{title}</a></li>\n"
        result += "</ol>\n</div>\n"
        return result
    except Exception as e:
        return f"获取头条热搜失败：{str(e)}"

def get_hot_trends():
    """获取热搜数据（整合微博和今日头条）"""
    try:
        weibo_trends = get_weibo_hot_trends()
        toutiao_trends = get_toutiao_hot_trends()
        return weibo_trends + "\n" + toutiao_trends
    except Exception as e:
        return f"获取热搜数据失败：{str(e)}"