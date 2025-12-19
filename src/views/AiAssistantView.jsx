import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api';
import taskEventBus from '../utils/eventBus';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AiAssistantView() {
    const [userId, setUserId] = useState(1);
    // Default to closed on mobile (< 768px), open on desktop
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
    const [settingsOpen, setSettingsOpen] = useState(false);
    
    // Data States
    const [dialogues, setDialogues] = useState([]);
    const [currentDialogueId, setCurrentDialogueId] = useState(null);
    const [messages, setMessages] = useState([]); // [{role, content: string | array, ...}]
    const [inputValue, setInputValue] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    
    // Config State
    const [aiConfig, setAiConfig] = useState({
        api_key: '',
        model: 'qwen-flash',
        openai_base_url: '',
        prompt: '',
        character: '默认',
        long_term_memory: '',
        is_enable_prompt: 0,
        is_auto_confirm_create_request: 0,
        is_auto_confirm_update_request: 0,
        is_auto_confirm_delete_request: 0,
        is_auto_confirm_create_reminder: 0
    });

    // Refs
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const touchStartRef = useRef(null); // For swipe detection

    // Initialize
    useEffect(() => {
        const savedUser = localStorage.getItem('taskStreamUser');
        let uid = 1;
        if (savedUser) {
            try {
                const u = JSON.parse(savedUser);
                uid = u.id;
            } catch (e) { console.error(e); }
        }
        setUserId(uid);
        
        loadConfig(uid);
        loadDialogues(uid);
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadConfig = async (uid) => {
        try {
            const res = await api.getAiConfig(uid);
            // Ensure numeric fields are numbers (API might return them, but just in case)
            setAiConfig(prev => ({
                ...prev,
                ...res,
                openai_base_url: res?.openai_base_url ?? prev.openai_base_url ?? ''
            }));
        } catch (e) {
            console.error("Failed to load AI config", e);
        }
    };

    const loadDialogues = async (uid) => {
        try {
            const res = await api.getDialogues(uid);
            // Sort by id desc (newest first)
            const sorted = res.sort((a, b) => b.id - a.id);
            setDialogues(sorted);
        } catch (e) {
            console.error("Failed to load dialogues", e);
        }
    };

    const handleDeleteDialogue = async (e, did) => {
        e.stopPropagation();
        if (!confirm("确定要删除这个对话吗？")) return;
        try {
            await api.deleteDialogue(did, userId);
            setDialogues(prev => prev.filter(d => d.id !== did));
            if (currentDialogueId === did) {
                selectDialogue(null);
            }
        } catch (err) {
            alert("删除失败: " + err.message);
        }
    };

    const selectDialogue = async (did) => {
        if (currentDialogueId === did) return;
        setCurrentDialogueId(did);
        setMessages([]); // Clear current view
        
        if (!did) return; // "New Chat" selected

        try {
            const res = await api.getDialogue(did, userId);
            // Parse messages
            // Backend returns: { messages: [ [userMsg, aiMsg], ... ] } or similar structure?
            // ai_test.html says: data.messages.forEach(turn => { if(isArray(turn)) turn.forEach(...) })
            
            const parsedMessages = [];
            if (res.messages && Array.isArray(res.messages)) {
                res.messages.forEach(turn => {
                    if (Array.isArray(turn)) {
                        turn.forEach(msg => {
                            if (msg) {
                                let content = msg.content;
                                
                                // Transform backend mixed content to frontend format
                                if (Array.isArray(content)) {
                                    content = content.map(item => {
                                        // Backend text type is 0
                                        if (item.type === 0) {
                                            return { type: 'text', text: item.data?.content || '' };
                                        } else {
                                            // Backend card types are > 0
                                            return { type: 'card', data: item };
                                        }
                                    });
                                }
                                
                                parsedMessages.push({
                                    role: msg.role,
                                    content: content
                                });
                            }
                        });
                    }
                });
            }
            setMessages(parsedMessages);
        } catch (e) {
            console.error("Failed to load dialogue history", e);
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isStreaming) return;
        
        const text = inputValue.trim();
        setInputValue("");
        
        let targetDialogueId = currentDialogueId;
        
        // Auto-create dialogue if new
        if (!targetDialogueId) {
            try {
                const newTitle = text.slice(0, 20) + (text.length > 20 ? "..." : "");
                const res = await api.createDialogue(userId, newTitle);
                targetDialogueId = res.id;
                setCurrentDialogueId(targetDialogueId);
                // Refresh list
                await loadDialogues(userId);
            } catch (e) {
                alert("创建对话失败: " + e.message);
                return;
            }
        }

        // Add user message locally
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);

        // Start streaming
        setIsStreaming(true);
        const assistantMsg = { role: 'assistant', content: [] }; // Content will be array of segments
        setMessages(prev => [...prev, assistantMsg]);

        try {
            const { url, options } = api.getChatStreamOptions(targetDialogueId, userId, text);
            const response = await fetch(`${api.API_BASE_URL || 'http://localhost:8000'}${url}`, options);
            
            if (!response.ok) throw new Error(response.statusText);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let currentEvent = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = (buffer + chunk).split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.substring(7).trim();
                    } else if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6).trim();
                        if (!dataStr) continue;
                        
                        try {
                            const data = JSON.parse(dataStr);
                            handleStreamEvent(currentEvent, data);
                        } catch (e) {
                            console.error("Parse error", e);
                        }
                    }
                }
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'system', content: "Error: " + e.message }]);
        } finally {
            setIsStreaming(false);
        }
    };

    const handleStreamEvent = (event, data) => {
        setMessages(prev => {
            const newMessages = [...prev];
            const lastMsgIndex = newMessages.length - 1;
            // Deep copy the last message and its content to ensure immutability
            const lastMsg = { ...newMessages[lastMsgIndex] };
            
            // Ensure content is array (and copy it)
            if (typeof lastMsg.content === 'string') {
                lastMsg.content = [{ type: 'text', text: lastMsg.content }];
            } else if (Array.isArray(lastMsg.content)) {
                lastMsg.content = [...lastMsg.content];
            } else {
                lastMsg.content = [];
            }
            
            // Update the message in the new array
            newMessages[lastMsgIndex] = lastMsg;

            if (event === 'partial_text') {
                const text = data.delta !== undefined ? data.delta : data.content;
                const lastSegmentIndex = lastMsg.content.length - 1;
                const lastSegment = lastMsg.content[lastSegmentIndex];
                
                if (lastSegment && lastSegment.type === 'text') {
                    // Create new segment object to avoid mutation
                    lastMsg.content[lastSegmentIndex] = { ...lastSegment, text: lastSegment.text + text };
                } else {
                    lastMsg.content.push({ type: 'text', text: text });
                }
            } else if (event === 'cards') {
                data.cards.forEach(card => {
                    // Prevent duplicate cards (check by action_id if available)
                    const isDuplicate = lastMsg.content.some(c => 
                        c.type === 'card' && 
                        c.data && 
                        c.data.action_id && 
                        card.action_id && 
                        c.data.action_id === card.action_id
                    );
                    
                    if (!isDuplicate) {
                        lastMsg.content.push({ type: 'card', data: card });
                        
                        // Check for auto-confirmed actions (or actions confirmed by backend immediately)
                        if (card.user_confirmation === 'Y') {
                            if ([1, 2, 3, 4].includes(card.type)) {
                                taskEventBus.emit('task-updated');
                            } else if (card.type === 7) {
                                taskEventBus.emit('journal-updated');
                            }
                        }
                    }
                });
            } else if (event === 'error') {
                lastMsg.content.push({ type: 'text', text: `\n[Error: ${data.message}]` });
            }

            return newMessages;
        });
    };

    const handleTouchStart = (e) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    };

    const handleTouchEnd = (e) => {
        if (!touchStartRef.current) return;
        
        const touchEnd = {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY
        };
        
        const xDiff = touchEnd.x - touchStartRef.current.x;
        const yDiff = touchEnd.y - touchStartRef.current.y;
        
        // Reset
        touchStartRef.current = null;
        
        // Horizontal swipe detection (threshold 50px, and horizontal > vertical)
        if (Math.abs(xDiff) > 50 && Math.abs(xDiff) > Math.abs(yDiff)) {
            // Swipe Right (Open)
            if (xDiff > 0 && !sidebarOpen) {
                // Only allow opening if started from the left edge area (e.g. first 50% of screen)
                setSidebarOpen(true);
            }
            // Swipe Left (Close)
            else if (xDiff < 0 && sidebarOpen) {
                setSidebarOpen(false);
            }
        }
    };

    const updateConfig = async () => {
        try {
            await api.updateAiConfig(userId, aiConfig);
            alert("设置已保存");
            setSettingsOpen(false);
        } catch (e) {
            alert("保存失败: " + e.message);
        }
    };

    return (
        <div 
            className="flex h-full w-full bg-gray-50 dark:bg-gray-900 overflow-hidden relative"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            
            {/* Sidebar Backdrop (Mobile) */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <div className={`${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0'} fixed md:relative z-40 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col overflow-hidden shadow-2xl md:shadow-none`}>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="font-bold text-lg dark:text-white truncate">历史对话</h2>
                </div>
                
                {/* New Chat Button */}
                <div className="p-2">
                    <button 
                        onClick={() => selectDialogue(null)}
                        className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${!currentDialogueId ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                    >
                        <i className="fa-solid fa-plus"></i>
                        <span>新建对话</span>
                    </button>
                </div>

                {/* Dialogue List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {dialogues.map(d => (
                        <div key={d.id} className="group relative">
                            <button
                                onClick={() => selectDialogue(d.id)}
                                className={`w-full text-left px-4 py-3 rounded-lg text-sm truncate transition-colors ${currentDialogueId === d.id ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                            >
                                <div className="font-medium truncate pr-6">{d.title || "无标题对话"}</div>
                            </button>
                            <button
                                onClick={(e) => handleDeleteDialogue(e, d.id)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="删除对话"
                            >
                                <i className="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    ))}
                </div>

                {/* Settings Button (Fixed at bottom) */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
                    <button 
                        onClick={() => setSettingsOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <i className="fa-solid fa-gear"></i>
                        <span>AI 设置</span>
                    </button>
                </div>
            </div>

            {/* Toggle Sidebar Button (Floating) */}
            <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`absolute top-4 ${sidebarOpen ? 'left-64' : 'left-0'} ml-2 z-20 p-2 text-gray-500 hover:text-primary transition-all hidden md:block`}
            >
                <i className={`fa-solid ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
            </button>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full relative">
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10">
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                            {currentDialogueId ? (dialogues.find(d => d.id === currentDialogueId)?.title || `对话 ${currentDialogueId}`) : "新对话"}
                        </h2>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.length === 0 && !currentDialogueId && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                            <i className="fa-solid fa-robot text-6xl mb-4"></i>
                            <p>开始一个新的对话吧</p>
                        </div>
                    )}
                    
                    {messages.map((msg, idx) => (
                        <MessageItem key={idx} role={msg.role} content={msg.content} userId={userId} />
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                    <div className="max-w-4xl mx-auto relative">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="输入消息..."
                            className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 ring-primary/20 resize-none h-14 max-h-32 dark:text-white"
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isStreaming}
                            className="absolute right-2 bottom-3 w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <i className={`fa-solid ${isStreaming ? 'fa-spinner fa-spin' : 'fa-paper-plane'} text-xs`}></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {settingsOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="font-bold text-lg dark:text-white">AI 设置</h3>
                            <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <i className="fa-solid fa-times text-xl"></i>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                                <input 
                                    type="password" 
                                    value={aiConfig.api_key} 
                                    onChange={e => setAiConfig({...aiConfig, api_key: e.target.value})}
                                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">OPENAI_BASE_URL</label>
                                <input 
                                    type="text" 
                                    value={aiConfig.openai_base_url ?? ''} 
                                    onChange={e => setAiConfig({...aiConfig, openai_base_url: e.target.value})}
                                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                                    placeholder="https://api.openai.com/v1"
                                />
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
                                <input 
                                    type="text" 
                                    value={aiConfig.model} 
                                    onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                                    placeholder="qwen-flash"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Character (人设)</label>
                                <select 
                                    value={aiConfig.character}
                                    onChange={e => setAiConfig({...aiConfig, character: e.target.value})}
                                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="默认">默认</option>
                                    <option value="温柔">温柔</option>
                                    <option value="正式">正式</option>
                                    <option value="幽默">幽默</option>
                                    <option value="严厉">严厉</option>
                                </select>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">System Prompt</label>
                                <textarea 
                                    value={aiConfig.prompt} 
                                    onChange={e => setAiConfig({...aiConfig, prompt: e.target.value})}
                                    className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white h-24 resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    checked={aiConfig.is_enable_prompt === 1}
                                    onChange={e => setAiConfig({...aiConfig, is_enable_prompt: e.target.checked ? 1 : 0})}
                                    id="enable_prompt"
                                />
                                <label htmlFor="enable_prompt" className="text-sm text-gray-700 dark:text-gray-300">启用 Prompt</label>
                            </div>

                            <hr className="border-gray-100 dark:border-gray-700" />
                            <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400">自动确认设置</h4>

                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { k: 'is_auto_confirm_create_request', l: '自动确认创建' },
                                    { k: 'is_auto_confirm_update_request', l: '自动确认更新' },
                                    { k: 'is_auto_confirm_delete_request', l: '自动确认删除' },
                                    { k: 'is_auto_confirm_create_reminder', l: '自动确认提醒' },
                                ].map(item => (
                                    <div key={item.k} className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={aiConfig[item.k] === 1}
                                            onChange={e => setAiConfig({...aiConfig, [item.k]: e.target.checked ? 1 : 0})}
                                            id={item.k}
                                        />
                                        <label htmlFor={item.k} className="text-sm text-gray-700 dark:text-gray-300">{item.l}</label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                            <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">取消</button>
                            <button onClick={updateConfig} className="px-4 py-2 rounded-lg bg-primary text-white hover:brightness-110">保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function normalizeMarkdownText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/<br\s*\/?>/gi, '\n');
}

function remarkSoftBreakToHardBreak() {
    return (tree) => {
        const visit = (node) => {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'code' || node.type === 'inlineCode') return;

            if (Array.isArray(node.children)) {
                const nextChildren = [];
                for (const child of node.children) {
                    if (child?.type === 'text' && typeof child.value === 'string' && child.value.includes('\n')) {
                        const parts = child.value.split('\n');
                        for (let i = 0; i < parts.length; i++) {
                            if (parts[i]) nextChildren.push({ type: 'text', value: parts[i] });
                            if (i < parts.length - 1) nextChildren.push({ type: 'break' });
                        }
                        continue;
                    }
                    visit(child);
                    nextChildren.push(child);
                }
                node.children = nextChildren;
            }
        };

        visit(tree);
    };
}

const markdownComponents = {
    a: (props) => (
        <a
            {...props}
            target="_blank"
            rel="noreferrer"
            className={`break-words underline underline-offset-2 ${props.className || ''}`}
        />
    ),
    pre: (props) => (
        <pre
            {...props}
            className={`overflow-x-auto rounded-lg p-3 bg-gray-50 dark:bg-gray-900/40 ${props.className || ''}`}
        />
    ),
    code: ({ inline, className, children, ...props }) => {
        if (inline) {
            return (
                <code
                    {...props}
                    className={`rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 ${className || ''}`}
                >
                    {children}
                </code>
            );
        }
        return (
            <code {...props} className={className}>
                {children}
            </code>
        );
    },
    table: ({ className, ...props }) => (
        <div className="w-full overflow-x-auto">
            <table {...props} className={`table-auto ${className || ''}`} />
        </div>
    ),
};

function MessageItem({ role, content, userId }) {
    // If content is just a string (old format or simple message)
    if (typeof content === 'string') {
        content = [{ type: 'text', text: content }];
    }
    
    // Safety check
    if (!Array.isArray(content)) content = [];

    const isUser = role === 'user';

    return (
        <div className={`flex gap-4 w-full md:w-auto md:max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-full items-center justify-center shrink-0 hidden md:flex ${isUser ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : 'bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg'}`}>
                <i className={`fa-solid ${isUser ? 'fa-user' : 'fa-robot'}`}></i>
            </div>
            
            <div className={`space-y-2 w-full md:w-auto ${isUser ? 'text-right' : 'text-left'}`}>
                <div className={`block md:inline-block p-4 rounded-2xl w-full md:w-auto ${isUser ? 'md:rounded-tr-none bg-primary text-white' : 'md:rounded-tl-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 shadow-sm'} text-sm leading-relaxed overflow-hidden`}>
                    {content.map((item, idx) => (
                        <div key={idx} className={item.type === 'card' ? 'my-2' : ''}>
                            {item.type === 'text' && 
                                <div className={`${isUser ? 'text-right' : 'text-left'}`}>
                                    <div className={`block text-left prose prose-sm max-w-none dark:prose-invert prose-code:before:content-none prose-code:after:content-none`}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm, remarkSoftBreakToHardBreak]}
                                            components={markdownComponents}
                                        >
                                            {normalizeMarkdownText(item.text)}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            }
                            {item.type === 'card' && <CardItem card={item.data} userId={userId} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CardItem({ card, userId }) {
    const { type, data, action_id, user_confirmation } = card;
    const [actionStatus, setActionStatus] = useState(() => {
        if (user_confirmation === 'Y') return 'confirmed';
        if (user_confirmation === 'N') return 'cancelled';
        return null;
    }); // 'confirming', 'cancelling', 'confirmed', 'cancelled', 'failed'
    const [subTaskDetails, setSubTaskDetails] = useState({});
    const [longTermTaskDetails, setLongTermTaskDetails] = useState({});

    // Fetch details for referenced tasks (Subtasks and Long Term Tasks)
    useEffect(() => {
        const fetchDetails = async () => {
            // 1. Identify Subtasks to fetch
            let subTaskIdsToFetch = new Set();
            
            // For Create Long Term Task (Type 4)
            if (type === 4 && data.sub_task_ids) {
                const ids = typeof data.sub_task_ids === 'string' 
                    ? Object.keys(JSON.parse(data.sub_task_ids)) 
                    : Object.keys(data.sub_task_ids);
                ids.forEach(id => subTaskIdsToFetch.add(id));
            }

            // For Update Task (Type 3) - specifically for sub_task_ids changes
            if (type === 3 && (data.updated?.sub_task_ids || data.original?.sub_task_ids)) {
                const parseIds = (val) => {
                    if (!val) return [];
                    try {
                        const obj = typeof val === 'string' ? JSON.parse(val) : val;
                        return Object.keys(obj);
                    } catch { return []; }
                };

                [...parseIds(data.updated.sub_task_ids), ...parseIds(data.original.sub_task_ids)]
                    .forEach(id => subTaskIdsToFetch.add(id));
            }

            // 2. Identify Long Term Tasks to fetch
            let longTermIdsToFetch = new Set();
            if (type === 3 && (data.updated?.long_term_task_id || data.original?.long_term_task_id)) {
                if (data.updated?.long_term_task_id) longTermIdsToFetch.add(data.updated.long_term_task_id);
                if (data.original?.long_term_task_id) longTermIdsToFetch.add(data.original.long_term_task_id);
            }

            // 3. Fetch Subtasks
            const subIds = Array.from(subTaskIdsToFetch);
            if (subIds.length > 0) {
                const details = {};
                await Promise.all(subIds.map(async (id) => {
                    try {
                        const task = await api.getTaskById(id);
                        details[id] = task;
                    } catch (e) {
                        console.error(`Failed to fetch task ${id}`, e);
                        details[id] = { title: `任务 #${id}` }; 
                    }
                }));
                setSubTaskDetails(prev => ({ ...prev, ...details }));
            }

            // 4. Fetch Long Term Tasks
            const ltIds = Array.from(longTermIdsToFetch);
            if (ltIds.length > 0) {
                const details = {};
                await Promise.all(ltIds.map(async (id) => {
                    try {
                        const task = await api.getLongTermTaskById(id);
                        details[id] = task;
                    } catch (e) {
                        console.error(`Failed to fetch long term task ${id}`, e);
                        details[id] = { title: `长期任务 #${id}` };
                    }
                }));
                setLongTermTaskDetails(prev => ({ ...prev, ...details }));
            }
        };
        
        fetchDetails();
    }, [type, data]);

    const handleAction = async (act) => {
        if (actionStatus) return;
        
        setActionStatus(act === 'confirm' ? 'confirming' : 'cancelling');
        try {
            if (act === 'confirm') {
                await api.confirmAiAction(action_id, userId);
                setActionStatus('confirmed');
                
                // Update other views via EventBus
                // Type 1: Create Task, 2: Delete Task, 3: Update Task, 4: Create Long Term
                if ([1, 2, 3, 4].includes(type)) {
                     taskEventBus.emit('task-updated');
                } else if (type === 7) {
                     // Type 7: Update Journal
                     taskEventBus.emit('journal-updated');
                }
            } else {
                await api.cancelAiAction(action_id, userId);
                setActionStatus('cancelled');
            }
        } catch (e) {
            alert("操作失败: " + e.message);
            setActionStatus('failed');
        }
    };

    const renderCardContent = () => {
        switch (type) {
            case 1: // Create Task
                return (
                    <div className="border-l-4 border-green-500 pl-3 py-1 bg-green-50 dark:bg-green-900/20">
                        <h4 className="font-bold text-green-700 dark:text-green-400 mb-1">🆕 创建任务</h4>
                        <div><strong>标题:</strong> {data.title}</div>
                        {data.description && <div><strong>描述:</strong> {data.description}</div>}
                        {data.due_date && <div><strong>截止:</strong> {data.due_date}</div>}
                    </div>
                );
            case 2: { // Delete Task
                const showDesc = data.description && !data.description.toString().startsWith('ID:');
                return (
                    <div className="border-l-4 border-red-500 pl-3 py-1 bg-red-50 dark:bg-red-900/20">
                        <h4 className="font-bold text-red-700 dark:text-red-400 mb-1">⚠️ 确认删除</h4>
                        <div><strong>{data.title}</strong></div>
                        {showDesc && <div>{data.description}</div>}
                    </div>
                );
            }
            case 3: // Update Task
                return (
                    <div className="border-l-4 border-blue-500 pl-3 py-1 bg-blue-50 dark:bg-blue-900/20">
                        <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-1">📝 更新任务</h4>
                        {/* ID hidden as requested */}
                        <div className="mt-2 space-y-2">
                            {Object.keys(data.updated).map(key => {
                                if (['id', 'user_id', 'created_at', 'updated_at', 'priority'].includes(key)) return null;
                                const oldVal = data.original[key];
                                const newVal = data.updated[key];
                                if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                                
                                if (key === 'sub_task_ids') {
                                    let oldObj = {}, newObj = {};
                                    try { oldObj = typeof oldVal === 'string' ? JSON.parse(oldVal) : (oldVal || {}); } catch { oldObj = {}; }
                                    try { newObj = typeof newVal === 'string' ? JSON.parse(newVal) : (newVal || {}); } catch { newObj = {}; }
                                    
                                    const allIds = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
                                    
                                    return (
                                        <div key={key} className="text-xs">
                                            <div className="font-bold text-gray-500">关联子任务变更</div>
                                            <div className="mt-1 space-y-1">
                                                {Array.from(allIds).map(id => {
                                                    const oldWeight = oldObj[id];
                                                    const newWeight = newObj[id];
                                                    const task = subTaskDetails[id];
                                                    const taskTitle = task ? task.title : `任务 #${id}`;
                                                    
                                                    if (oldWeight === newWeight) return null; // No change for this specific task
                                                    
                                                    if (oldWeight === undefined) {
                                                        // Added
                                                        return (
                                                            <div key={id} className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 p-1 rounded border border-green-100 dark:border-green-800">
                                                                <span className="text-green-600 dark:text-green-400 font-bold">+</span>
                                                                <span className="flex-1 truncate" title={taskTitle}>{taskTitle}</span>
                                                                <span className="text-[10px] bg-green-100 dark:bg-green-800 px-1 rounded text-green-700 dark:text-green-300">权重: {newWeight}</span>
                                                            </div>
                                                        );
                                                    } else if (newWeight === undefined) {
                                                        // Removed
                                                        return (
                                                            <div key={id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 p-1 rounded border border-red-100 dark:border-red-800">
                                                                <span className="text-red-600 dark:text-red-400 font-bold">-</span>
                                                                <span className="flex-1 truncate" title={taskTitle}>{taskTitle}</span>
                                                                <span className="text-[10px] bg-red-100 dark:bg-red-800 px-1 rounded text-red-700 dark:text-red-300">权重: {oldWeight}</span>
                                                            </div>
                                                        );
                                                    } else {
                                                        // Changed
                                                        return (
                                                            <div key={id} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-1 rounded border border-blue-100 dark:border-blue-800">
                                                                <span className="text-blue-600 dark:text-blue-400 font-bold">~</span>
                                                                <span className="flex-1 truncate" title={taskTitle}>{taskTitle}</span>
                                                                <span className="text-[10px] bg-blue-100 dark:bg-blue-800 px-1 rounded text-blue-700 dark:text-blue-300">{oldWeight} ➔ {newWeight}</span>
                                                            </div>
                                                        );
                                                    }
                                                })}
                                            </div>
                                        </div>
                                    );
                                }

                                // Format values for display
                                let displayOld = oldVal;
                                let displayNew = newVal;
                                let label = key;

                                if (key === 'status') {
                                    const statusMap = { 0: '未开始', 1: '未开始', 2: '进行中', 3: '已完成' };
                                    displayOld = statusMap[oldVal] || oldVal;
                                    displayNew = statusMap[newVal] || newVal;
                                    label = '状态';
                                } else if (key === 'long_term_task_id') {
                                    const getLtTitle = (id) => {
                                        if (!id) return '无';
                                        const t = longTermTaskDetails[id];
                                        return t ? t.title : `长期任务 #${id}`;
                                    };
                                    displayOld = getLtTitle(oldVal);
                                    displayNew = getLtTitle(newVal);
                                    label = '关联长期任务';
                                } else if (key === 'title') {
                                    label = '标题';
                                } else if (key === 'description') {
                                    label = '描述';
                                } else if (key === 'due_date') {
                                    label = '截止日期';
                                } else if (key === 'start_date') {
                                    label = '开始日期';
                                } else if (key === 'progress') {
                                    label = '进度';
                                }

                                return (
                                    <div key={key} className="text-xs">
                                        <div className="font-bold text-gray-500">{label}</div>
                                        <div className="flex gap-2 mt-1">
                                            <div className="flex-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                                                - {typeof displayOld === 'string' ? displayOld : JSON.stringify(displayOld)}
                                            </div>
                                            <div className="flex-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                                                + {typeof displayNew === 'string' ? displayNew : JSON.stringify(displayNew)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 4: // Create Long Term Task
                return (
                    <div className="border-l-4 border-purple-500 pl-3 py-1 bg-purple-50 dark:bg-purple-900/20">
                        <h4 className="font-bold text-purple-700 dark:text-purple-400 mb-1">🚀 创建长期任务</h4>
                        <div><strong>标题:</strong> {data.title}</div>
                        {data.sub_task_ids && (
                            <div className="mt-2 space-y-1">
                                <div className="text-xs font-bold text-gray-500">包含子任务:</div>
                                {Object.keys(data.sub_task_ids).length > 0 ? (
                                    Object.keys(data.sub_task_ids).map(id => {
                                        const task = subTaskDetails[id];
                                        const weight = data.sub_task_ids[id];
                                        return (
                                            <div key={id} className="text-xs bg-white dark:bg-gray-800 p-1.5 rounded border border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                <span className="truncate flex-1" title={task ? task.title : `任务 #${id}`}>
                                                    {task ? task.title : '加载中...'}
                                                </span>
                                                <span className="text-gray-400 ml-2 text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                                    权重: {weight}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-gray-400 italic">无子任务</div>
                                )}
                            </div>
                        )}
                    </div>
                );
            case 7: // Update Journal
                 return (
                    <div className="border-l-4 border-orange-500 pl-3 py-1 bg-orange-50 dark:bg-orange-900/20">
                        <h4 className="font-bold text-orange-700 dark:text-orange-400 mb-1">📔 更新日记</h4>
                        <div><strong>日期:</strong> {data.before.date}</div>
                        <div className="flex gap-2 mt-2 text-xs">
                            <div className="flex-1 bg-orange-100 dark:bg-orange-900/30 p-2 rounded">
                                <div className="text-gray-500 mb-1">修改前</div>
                                <div className="whitespace-pre-wrap">{data.before.content || '(空)'}</div>
                            </div>
                            <div className="flex-1 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                                <div className="text-gray-500 mb-1">修改后</div>
                                <div className="whitespace-pre-wrap">{data.after.content}</div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs"><pre>{JSON.stringify(data, null, 2)}</pre></div>;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-2 my-2 text-sm">
            {renderCardContent()}
            
            {/* Action Buttons */}
            {action_id && (
                <div className="mt-3 flex gap-2">
                    {actionStatus === 'confirmed' ? (
                        <div className="text-green-600 font-bold flex items-center gap-1"><i className="fa-solid fa-check"></i> 已确认 (Y)</div>
                    ) : actionStatus === 'cancelled' ? (
                        <div className="text-red-600 font-bold flex items-center gap-1"><i className="fa-solid fa-times"></i> 已取消 (N)</div>
                    ) : (
                        <>
                            <button 
                                onClick={() => handleAction('confirm')}
                                disabled={actionStatus === 'confirming' || actionStatus === 'cancelling'}
                                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-xs"
                            >
                                {actionStatus === 'confirming' ? '确认中...' : '✅ 确认'}
                            </button>
                            <button 
                                onClick={() => handleAction('cancel')}
                                disabled={actionStatus === 'confirming' || actionStatus === 'cancelling'}
                                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 text-xs"
                            >
                                {actionStatus === 'cancelling' ? '取消中...' : '❌ 取消'}
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
