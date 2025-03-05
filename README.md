# AI 问答助手

一个基于 deepseek v3/r1 的智能问答系统，支持上下文对话。

## 功能特点

- 实时对话交互
- 支持上下文理解
- 简洁优雅的绿色主题界面
- 响应式设计，适配各种设备

## 安装步骤

1. 克隆项目并进入目录：
```bash
cd ai_qa_agent
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

3. 配置环境变量：
- 复制 `.env` 文件并填入你的 OpenAI API 密钥：
```bash
cp .env.example .env
```
- 编辑 `.env` 文件，将 `your_api_key_here` 替换为你的实际 API 密钥

4. 运行应用：
```bash
python app.py
```

5. 在浏览器中访问：
```
http://localhost:5000
```

## 使用说明

1. 在输入框中输入你的问题
2. 点击发送按钮或按回车键发送消息
3. 等待 AI 助手的回复
4. 可以继续提问，AI 会记住对话上下文

## 技术栈

- 后端：Flask + Flask-SocketIO
- 前端：HTML5 + CSS3 + JavaScript
- AI：OpenAI GPT-4
- 实时通信：WebSocket 
