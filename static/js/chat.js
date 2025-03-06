document.addEventListener('DOMContentLoaded', () => {
    const socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });

    // 添加连接状态监听
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
    });

    // 添加消息接收监听
    socket.on('receive_message', (data) => {
        addMessage(data.message, data.type, data.format, data.reasoning_content);
        // 再次滚动到底部，确保长响应完全显示
        setTimeout(scrollToBottom, 100);
    });

    socket.on('error', (data) => {
        console.error('Server error:', data.message);
        addMessage(data.message, 'error');
        setTimeout(scrollToBottom, 100);
    });

    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const conversationList = document.getElementById('conversation-list');
    const newChatBtn = document.getElementById('new-chat-btn');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const modelSelect = document.getElementById('model-select');
    
    let currentConversationId = null;
    let conversationHistory = [];
    let conversationToDelete = null;

    const chatInputContainer = document.querySelector('.chat-input-container');
    
    // 检查是否是新对话
    function updateInputPosition() {
        const hasMessages = chatMessages.querySelectorAll('.message:not(.system)').length > 0;
        if (!hasMessages) {
            chatInputContainer.classList.add('new-chat');
            // 添加欢迎标题
            if (!document.querySelector('.welcome-title')) {
                const welcomeTitle = document.createElement('div');
                welcomeTitle.className = 'welcome-title';
                welcomeTitle.innerHTML = `
                    <div class="welcome-en">Hancks' Super Individual System Awakens!</div>
                `;
                chatMessages.appendChild(welcomeTitle);
            }
        } else {
            chatInputContainer.classList.remove('new-chat');
            // 移除欢迎标题
            const welcomeTitle = document.querySelector('.welcome-title');
            if (welcomeTitle) {
                welcomeTitle.remove();
            }
        }
    }

    // 发送消息函数
    function sendMessage() {
        const message = userInput.value.trim();
        if (message) {
            // 如果没有当前对话，创建新对话
            if (!currentConversationId) {
                fetch('/api/conversations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                })
                .then(response => response.json())
                .then(conversation => {
                    currentConversationId = conversation.id;
                    sendMessageToServer(message);
                    loadConversations();
                });
            } else {
                sendMessageToServer(message);
            }
        }
    }

    function sendMessageToServer(message) {
        // 添加用户消息到界面
        addMessage(message, 'user');
        
        // 清空输入框
        userInput.value = '';
        
        // 更新输入框位置
        updateInputPosition();
        
        // 如果是新对话的第一条消息，立即更新标题
        if (document.querySelectorAll('.message:not(.system)').length === 1) {
            let title = message.slice(0, 30);
            if (message.length > 30) {
                title += '...';
            }
            
            const activeConvTitle = document.querySelector('.conversation-item.active .conversation-title');
            if (activeConvTitle) {
                activeConvTitle.textContent = title;
            }
            
            updateConversationTitle(currentConversationId, title);
        }
        
        // 发送消息到服务器
        socket.emit('send_message', { 
            message: message,
            conversation_id: currentConversationId,
            model: modelSelect.value,
            history: conversationHistory
        });
    }

    // 加载对话列表
    function loadConversations() {
        fetch('/api/conversations')
            .then(response => response.json())
            .then(conversations => {
                conversationList.innerHTML = '';
                conversations.forEach(conv => {
                    const item = document.createElement('div');
                    item.className = `conversation-item${conv.id === currentConversationId ? ' active' : ''}`;
                    
                    const info = document.createElement('div');
                    info.className = 'conversation-info';
                    info.innerHTML = `
                        <div class="conversation-title" contenteditable="true">${conv.title}</div>
                        <div class="conversation-time">${new Date(conv.timestamp).toLocaleString()}</div>
                    `;
                    
                    // 处理标题编辑
                    const titleDiv = info.querySelector('.conversation-title');
                    titleDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });
                    
                    titleDiv.addEventListener('focus', () => {
                        titleDiv.classList.add('editing');
                    });
                    
                    titleDiv.addEventListener('blur', () => {
                        titleDiv.classList.remove('editing');
                        const newTitle = titleDiv.textContent.trim();
                        if (newTitle && newTitle !== conv.title) {
                            updateConversationTitle(conv.id, newTitle);
                        }
                    });
                    
                    titleDiv.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            titleDiv.blur();
                        }
                    });
                    
                    info.addEventListener('click', () => loadConversation(conv.id));
                    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'action-btn delete-btn';
                    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showDeleteModal(conv.id);
                    });
                    
                    item.appendChild(info);
                    item.appendChild(deleteBtn);
                    conversationList.appendChild(item);
                });
            });
    }

    // 更新对话标题
    function updateConversationTitle(conversationId, newTitle) {
        fetch(`/api/conversations/${conversationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: newTitle })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                loadConversations();
            }
        });
    }

    // 显示删除确认对话框
    function showDeleteModal(conversationId) {
        conversationToDelete = conversationId;
        deleteModal.classList.add('show');
    }

    // 隐藏删除确认对话框
    function hideDeleteModal() {
        deleteModal.classList.remove('show');
        conversationToDelete = null;
    }

    // 删除对话
    function deleteConversation(conversationId) {
        fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                if (conversationId === currentConversationId) {
                    currentConversationId = null;
                    conversationHistory = [];
                    chatMessages.innerHTML = '';
                }
                loadConversations();
            }
        })
        .finally(() => {
            hideDeleteModal();
        });
    }

    // 加载特定对话
    function loadConversation(conversationId) {
        fetch(`/api/conversations/${conversationId}`)
            .then(response => response.json())
            .then(conversation => {
                currentConversationId = conversation.id;
                conversationHistory = [];
                chatMessages.innerHTML = '';
                
                // 添加历史消息
                conversation.messages.forEach(msg => {
                    addMessage(
                        msg.message, 
                        msg.type, 
                        msg.type === 'assistant' ? 'html' : 'text',
                        msg.reasoning_content
                    );
                });
                
                // 更新侧边栏选中状态
                document.querySelectorAll('.conversation-item').forEach(item => {
                    item.classList.remove('active');
                    if (item.querySelector('.conversation-title').textContent === conversation.title) {
                        item.classList.add('active');
                    }
                });

                // 更新模型选择器
                if (conversation.model) {
                    modelSelect.value = conversation.model;
                }

                // 更新输入框位置
                updateInputPosition();
            });
    }

    // 创建新对话
    function createNewConversation() {
        fetch('/api/conversations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        .then(response => response.json())
        .then(conversation => {
            currentConversationId = conversation.id;
            conversationHistory = [];
            chatMessages.innerHTML = '';
            loadConversations();
            updateInputPosition();
        });
    }

    function addMessage(message, type, format = 'text', reasoning_content = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const messageMain = document.createElement('div');
        messageMain.className = 'message-main';
        
        // 添加头像
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        let avatar = '🐰'; // 默认用户头像
        
        if (type === 'assistant') {
            // 检查当前选择的模型
            const currentModel = document.getElementById('model-select').value;
            if (currentModel === 'rockettrend') {
                avatar = '🔍';
            } else {
                // 根据是否有思维链内容来判断是哪个模型
                avatar = reasoning_content ? '🚀' : '🤖';
            }
        } else if (type === 'system') {
            avatar = '🤖';
        }
        
        avatarDiv.textContent = avatar;
        messageMain.appendChild(avatarDiv);
        
        // 添加消息文本容器
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        
        // 如果是R1模型（有reasoning_content），添加最终答案标签
        if (type === 'assistant' && reasoning_content) {
            textDiv.innerHTML = `
                <div class="final-answer-header">
                    <i class="fas fa-check-circle"></i>
                    <span>最终答案</span>
                </div>
            `;
        }
        
        if (format === 'html') {
            textDiv.innerHTML += message;
            // 对新添加的代码块应用语法高亮
            textDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        } else {
            const messageContent = document.createElement('div');
            messageContent.textContent = message;
            textDiv.appendChild(messageContent);
        }
        
        messageMain.appendChild(textDiv);
        contentDiv.appendChild(messageMain);
        messageDiv.appendChild(contentDiv);
        
        // 如果有思维链内容，添加思维链显示
        if (reasoning_content) {
            const reasoningDiv = document.createElement('div');
            reasoningDiv.className = 'reasoning-content';
            reasoningDiv.innerHTML = `
                <div class="reasoning-header">
                    <i class="fas fa-brain"></i>
                    <span>思维链</span>
                </div>
                <div class="reasoning-body">${reasoning_content}</div>
            `;
            contentDiv.appendChild(reasoningDiv);
        }
        
        chatMessages.appendChild(messageDiv);
        
        // 确保添加消息后自动滚动到底部
        setTimeout(() => {
            scrollToBottom();
        }, 50); // 短暂延时确保DOM更新
        
        // Add to conversation history
        conversationHistory.push({ message, type });
    }
    
    // 滚动到底部的辅助函数
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 添加发送按钮点击事件
    sendButton.addEventListener('click', sendMessage);

    // 添加输入框回车事件
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 添加新对话按钮事件
    newChatBtn.addEventListener('click', createNewConversation);

    // 添加删除确认按钮事件
    cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    confirmDeleteBtn.addEventListener('click', () => {
        if (conversationToDelete) {
            deleteConversation(conversationToDelete);
        }
    });

    // 点击模态框背景关闭
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            hideDeleteModal();
        }
    });

    // 初始加载对话列表
    loadConversations();
    
    // 监听窗口大小变化，确保滚动位置正确
    window.addEventListener('resize', () => {
        if (chatMessages.scrollHeight > chatMessages.clientHeight) {
            // 如果用户之前已经滚动到底部或接近底部，则保持滚动到底部
            if (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100) {
                scrollToBottom();
            }
        }
    });

    // 初始化时更新输入框位置
    updateInputPosition();
});