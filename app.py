from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
import os
from dotenv import load_dotenv
import requests
import json
import markdown2
import re
from datetime import datetime
import threading
from openai import OpenAI

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # 启用CORS
socketio = SocketIO(app, 
    cors_allowed_origins="*", 
    async_mode='threading',
    ping_interval=25,
    ping_timeout=5,
    max_http_buffer_size=1e8,
    allow_upgrades=True,
    http_compression=True,
    compression_threshold=1024,
    logger=True,
    engineio_logger=True
)  # 使用 threading 作为异步模式

# 初始化OpenAI客户端
client = OpenAI(
    api_key=os.getenv('DEEPSEEK_API_KEY'),
    base_url="https://api.deepseek.com/v1"
)

# 存储聊天记录
chat_history = {}
conversations = {}
data_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data/conversations.json')

# 确保数据目录存在
os.makedirs(os.path.dirname(data_file), exist_ok=True)

# 加载存储的对话
def load_conversations():
    global conversations
    if os.path.exists(data_file):
        try:
            with open(data_file, 'r', encoding='utf-8') as f:
                conversations = json.load(f)
            print(f"Loaded {len(conversations)} conversations from file")
        except Exception as e:
            print(f"Error loading conversations: {str(e)}")
            conversations = {}
    else:
        print("No saved conversations found")
        conversations = {}

# 保存对话
def save_conversations():
    try:
        with open(data_file, 'w', encoding='utf-8') as f:
            json.dump(conversations, f, ensure_ascii=False, indent=2)
        print("Conversations saved")
    except Exception as e:
        print(f"Error saving conversations: {str(e)}")

# 启动时加载对话
load_conversations()

# 自动保存对话的线程
def autosave_thread():
    while True:
        threading.Event().wait(60)  # 每60秒保存一次
        save_conversations()

threading.Thread(target=autosave_thread, daemon=True).start()

def process_code_blocks(text):
    """处理代码块，为其添加语法高亮的类"""
    pattern = r'```(\w*)\n(.*?)\n```'
    def replacement(match):
        language = match.group(1) or 'plaintext'
        code = match.group(2)
        return f'<pre><code class="language-{language}">{code}</code></pre>'
    
    processed_text = re.sub(pattern, replacement, text, flags=re.DOTALL)
    return processed_text

def format_response(text):
    """格式化响应文本，将markdown转换为HTML"""
    text = process_code_blocks(text)
    html = markdown2.markdown(text, extras=['fenced-code-blocks', 'tables'])
    return html

@app.route('/')
def index():
    """渲染主页"""
    return render_template('index.html')

# API 路由
@app.route('/api/conversations', methods=['GET'])
def get_conversations():
    """获取所有对话列表"""
    # 将字典转换为列表并按时间戳排序
    conv_list = list(conversations.values())
    conv_list.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    return jsonify(conv_list)

@app.route('/api/conversations', methods=['POST'])
def create_conversation():
    """创建新对话"""
    conversation_id = str(len(conversations) + 1)
    while conversation_id in conversations:
        conversation_id = str(int(conversation_id) + 1)
        
    conversation = {
        'id': conversation_id,
        'title': f'新对话 {conversation_id}',
        'timestamp': datetime.now().isoformat(),
        'messages': []
    }
    conversations[conversation_id] = conversation
    save_conversations()
    return jsonify(conversation)

@app.route('/api/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    """获取特定对话"""
    if conversation_id in conversations:
        return jsonify(conversations[conversation_id])
    return jsonify({'error': 'Conversation not found'}), 404

@app.route('/api/conversations/<conversation_id>', methods=['PUT'])
def update_conversation(conversation_id):
    """更新对话标题"""
    if conversation_id in conversations:
        data = request.get_json()
        conversations[conversation_id]['title'] = data.get('title', conversations[conversation_id]['title'])
        # 更新时间戳
        conversations[conversation_id]['timestamp'] = datetime.now().isoformat()
        save_conversations()
        return jsonify({'success': True})
    return jsonify({'error': 'Conversation not found'}), 404

@app.route('/api/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    """删除对话"""
    if conversation_id in conversations:
        del conversations[conversation_id]
        save_conversations()
        return jsonify({'success': True})
    return jsonify({'error': 'Conversation not found'}), 404

@socketio.on('connect')
def handle_connect():
    """处理WebSocket连接"""
    print('Client connected')
    # 为新连接的客户端初始化聊天记录
    chat_history[request.sid] = []

@socketio.on('disconnect')
def handle_disconnect():
    """处理WebSocket断开连接"""
    print('Client disconnected')
    # 清理聊天记录
    if request.sid in chat_history:
        del chat_history[request.sid]

@socketio.on('send_message')
def handle_message(data):
    """处理用户消息"""
    user_message = data['message']
    session_id = request.sid
    conversation_id = data.get('conversation_id')
    model = data.get('model', 'deepseek-chat-v3')  # 默认使用 V3 模型
    
    # 添加用户消息到聊天记录
    chat_history[session_id].append({"role": "user", "content": user_message})
    
    # 如果提供了对话ID，则更新对话
    if conversation_id and conversation_id in conversations:
        # 更新对话消息
        conversations[conversation_id]['messages'].append({
            'message': user_message,
            'type': 'user',
            'timestamp': datetime.now().isoformat()
        })
        # 更新对话时间戳
        conversations[conversation_id]['timestamp'] = datetime.now().isoformat()
        # 保存使用的模型
        conversations[conversation_id]['model'] = model
        
        # 如果这是第一条消息，且标题仍为默认标题，则将对话标题更新为用户的问题
        if len(conversations[conversation_id]['messages']) == 1 and conversations[conversation_id]['title'].startswith('新对话'):
            # 截取用户消息的前30个字符作为标题
            title = user_message[:30]
            if len(user_message) > 30:
                title += "..."
            conversations[conversation_id]['title'] = title
            print(f"Updated conversation title to: {title}")
    
    try:
        # 如果选择了RocketTrend模型，调用爬虫获取热搜数据
        if model == "rockettrend":
            from crawler import get_hot_trends
            ai_response = get_hot_trends()
            reasoning_content = None
        else:
            # 打印当前使用的 API key（仅显示前几个字符）
            api_key = os.getenv('DEEPSEEK_API_KEY')
            if not api_key:
                raise Exception("DEEPSEEK_API_KEY environment variable is not set")
            print(f"Using DeepSeek API key: {api_key[:8]}...")
            print(f"Using model: {model}")
            
            # 获取对话历史记录，最多取最近10条
            messages = []
            # 添加系统消息
            messages.append({"role": "system", "content": "You are a helpful assistant"})
            
            if session_id in chat_history:
                messages.extend(chat_history[session_id][-10:])  # 最多取最近10条记录
            
            # 根据选择的模型调用不同的 API
            try:
                if model == "deepseek-chat-r1":
                    # 调用 R1 模型 API
                    response = client.chat.completions.create(
                        model="deepseek-reasoner",
                        messages=messages,
                        temperature=0.7,
                        max_tokens=1000
                    )
                    
                    # 获取响应内容和思维链
                    ai_response = response.choices[0].message.content
                    reasoning_content = getattr(response.choices[0].message, 'reasoning_content', None)
                    print("Reasoning content:", reasoning_content)
                else:
                    # 调用 V3 模型 API
                    response = client.chat.completions.create(
                        model="deepseek-chat",
                        messages=messages,
                        temperature=0.7,
                        max_tokens=1000
                    )
                    ai_response = response.choices[0].message.content
                    reasoning_content = None
            except Exception as api_error:
                print(f"API Error: {str(api_error)}")
                raise Exception(f"API调用失败: {str(api_error)}")
        
        if not ai_response:
            raise Exception("Empty response from DeepSeek API")
        
        # 添加AI响应到聊天记录
        chat_history[session_id].append({"role": "assistant", "content": ai_response})
        
        # 将markdown转换为HTML
        formatted_response = format_response(ai_response)
        
        # 如果提供了对话ID，则更新对话
        if conversation_id and conversation_id in conversations:
            message_data = {
                'message': formatted_response,
                'type': 'assistant',
                'format': 'html',
                'timestamp': datetime.now().isoformat()
            }
            # 如果有思维链内容，添加到消息数据中
            if reasoning_content:
                message_data['reasoning_content'] = reasoning_content
            conversations[conversation_id]['messages'].append(message_data)
            save_conversations()
        
        # 发送响应给客户端
        response_data = {
            'message': formatted_response,
            'type': 'assistant',
            'format': 'html',
            'conversation_id': conversation_id
        }
        # 如果有思维链内容，添加到响应数据中
        if reasoning_content:
            response_data['reasoning_content'] = reasoning_content
        socketio.emit('receive_message', response_data)
        
    except Exception as e:
        error_message = f"Error: {str(e)}"
        print(f"Detailed error: {error_message}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        socketio.emit('error', {'message': error_message})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=80)