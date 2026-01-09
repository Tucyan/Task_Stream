import React, { useState, useEffect, useRef } from 'react';
import * as api from '../services/api';
import taskEventBus from '../utils/eventBus';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AiAssistantView() {
    const [userId, setUserId] = useState(1);
    // 移动端 (< 768px) 默认关闭，桌面端默认打开
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
    const [settingsOpen, setSettingsOpen] = useState(false);
    
    // 数据状态
    const [dialogues, setDialogues] = useState([]);
    const [currentDialogueId, setCurrentDialogueId] = useState(null);
    const [messages, setMessages] = useState([]); // [{角色, 内容: 字符串 | 数组, ...}]
    const [inputValue, setInputValue] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    
    // 配置状态
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

    // 引用
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const touchStartRef = useRef(null); // 用于滑动检测
    const userIdRef = useRef(1);
    const messagesRef = useRef([]);
    const currentDialogueIdRef = useRef(null);
    const activeStreamDialogueIdRef = useRef(null);
    const abortControllerRef = useRef(null);
    const cacheWriteTimeoutRef = useRef(null);
    const streamTraceRef = useRef({ chunk: 0, eventLine: 0, dataLine: 0, partial: 0, cards: 0, errors: 0 });

    const nowTs = () => new Date().toISOString();

    const traceLog = (layer, message, fields) => {
        let payload = '';
        if (fields && typeof fields === 'object') {
            try {
                payload = ' ' + JSON.stringify(fields);
            } catch {
                payload = ' ' + String(fields);
            }
        }
        console.log(`[TS][${layer}] ${nowTs()} ${message}${payload}`);
    };

    const getLastDialogueKey = (uid) => `taskStreamAi:lastDialogueId:${uid}`;
    const getPendingActionsKey = (uid) => `taskStreamAi:pendingActions:${uid}`;
    const getMessagesCacheKey = (uid, did) => `taskStreamAi:cachedMessages:${uid}:${did}`;

    const safeJsonParse = (value, fallback) => {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    };

    const readPendingActions = (uid) => {
        const raw = localStorage.getItem(getPendingActionsKey(uid));
        const parsed = safeJsonParse(raw, {});
        return parsed && typeof parsed === 'object' ? parsed : {};
    };

    const writePendingActions = (uid, pending) => {
        localStorage.setItem(getPendingActionsKey(uid), JSON.stringify(pending || {}));
    };

    const flushMessagesCache = (uid, did, messageList) => {
        if (!uid || !did) return;
        try {
            sessionStorage.setItem(getMessagesCacheKey(uid, did), JSON.stringify(messageList || []));
        } catch (e) {
            console.error(e);
        }
    };

    const extractPendingActionIdsFromMessages = (messageList) => {
        const ids = [];
        for (const msg of Array.isArray(messageList) ? messageList : []) {
            const content = typeof msg?.content === 'string' ? [{ type: 'text', text: msg.content }] : msg?.content;
            if (!Array.isArray(content)) continue;
            for (const item of content) {
                if (item?.type !== 'card') continue;
                const actionId = item?.data?.action_id;
                const confirmation = item?.data?.user_confirmation;
                if (!actionId) continue;
                if (confirmation === 'Y' || confirmation === 'N') continue;
                ids.push(actionId);
            }
        }
        return Array.from(new Set(ids));
    };

    const updateCardConfirmationInMessages = (messageList, actionId, confirmation) => {
        let changed = false;
        const next = (Array.isArray(messageList) ? messageList : []).map(msg => {
            const content = typeof msg?.content === 'string' ? [{ type: 'text', text: msg.content }] : msg?.content;
            if (!Array.isArray(content)) return msg;
            let contentChanged = false;
            const nextContent = content.map(item => {
                if (item?.type !== 'card') return item;
                const card = item?.data;
                if (!card || card.action_id !== actionId) return item;
                contentChanged = true;
                changed = true;
                return { ...item, data: { ...card, user_confirmation: confirmation } };
            });
            if (!contentChanged) return msg;
            return { ...msg, content: nextContent };
        });
        return { changed, messages: next };
    };

    const reconcilePendingActionsForDialogue = async (uid, did, messageList) => {
        const pending = readPendingActions(uid);
        const now = Date.now();
        const relevantActionIds = extractPendingActionIdsFromMessages(messageList);

        const nextPending = { ...pending };
        for (const actionId of Object.keys(nextPending)) {
            const entry = nextPending[actionId];
            if (!entry || typeof entry !== 'object') continue;
            if (entry.dialogueId !== did) continue;
            if (!relevantActionIds.includes(actionId)) {
                delete nextPending[actionId];
            }
        }

        let nextMessages = messageList;
        for (const actionId of relevantActionIds) {
            const entry = nextPending[actionId] || { dialogueId: did, leftAt: null };
            const leftAt = entry.leftAt;

            if (typeof leftAt === 'number' && now - leftAt >= 30000) {
                const result = updateCardConfirmationInMessages(nextMessages, actionId, 'N');
                nextMessages = result.messages;
                delete nextPending[actionId];
                api.cancelAiAction(actionId, uid).catch((e) => {
                    const msg = String(e?.message || '');
                    if (!msg.includes('Action not found') && !msg.includes('timeout')) {
                        console.error(e);
                    }
                });
            } else {
                nextPending[actionId] = { ...entry, dialogueId: did, leftAt: null };
            }
        }

        writePendingActions(uid, nextPending);
        return nextMessages;
    };

    const extractActionConfirmationsFromMessages = (messageList) => {
        const map = {};
        for (const msg of Array.isArray(messageList) ? messageList : []) {
            const content = typeof msg?.content === 'string' ? [{ type: 'text', text: msg.content }] : msg?.content;
            if (!Array.isArray(content)) continue;
            for (const item of content) {
                if (item?.type !== 'card') continue;
                const actionId = item?.data?.action_id;
                const confirmation = item?.data?.user_confirmation;
                if (!actionId) continue;
                if (confirmation === 'Y' || confirmation === 'N') {
                    map[actionId] = confirmation;
                }
            }
        }
        return map;
    };

    const applyActionConfirmationsToMessages = (messageList, confirmations) => {
        let next = messageList;
        for (const [actionId, confirmation] of Object.entries(confirmations || {})) {
            const result = updateCardConfirmationInMessages(next, actionId, confirmation);
            next = result.messages;
        }
        return next;
    };

    const markLeaveTimeForPendingActions = (uid, did, messageList) => {
        const pending = readPendingActions(uid);
        const now = Date.now();
        const ids = extractPendingActionIdsFromMessages(messageList);
        if (ids.length === 0) return;

        const nextPending = { ...pending };
        for (const actionId of ids) {
            const entry = nextPending[actionId];
            nextPending[actionId] = {
                ...(entry && typeof entry === 'object' ? entry : {}),
                dialogueId: did,
                leftAt: now
            };
        }
        writePendingActions(uid, nextPending);
    };

    const setLastDialogueId = (uid, did) => {
        const key = getLastDialogueKey(uid);
        if (!did) {
            localStorage.removeItem(key);
            return;
        }
        localStorage.setItem(key, String(did));
    };

    // 初始化
    useEffect(() => {
        let isActive = true;
        const run = async () => {
            const savedUser = localStorage.getItem('taskStreamUser');
            let uid = 1;
            if (savedUser) {
                try {
                    const u = JSON.parse(savedUser);
                    uid = u.id;
                } catch (e) { console.error(e); }
            }
            userIdRef.current = uid;
            if (!isActive) return;
            setUserId(uid);
            await loadConfig(uid);
            const sorted = await loadDialogues(uid);
            if (!isActive) return;

            const lastRaw = localStorage.getItem(getLastDialogueKey(uid));
            const lastDid = lastRaw ? Number(lastRaw) : null;
            const exists = lastDid && Array.isArray(sorted) && sorted.some(d => d.id === lastDid);
            const didToSelect = exists ? lastDid : (sorted?.[0]?.id ?? null);

            if (didToSelect) {
                await selectDialogue(didToSelect, uid);
            } else {
                setLastDialogueId(uid, null);
            }
        };

        run();

        return () => {
            isActive = false;
            const uid = userIdRef.current;
            const did = activeStreamDialogueIdRef.current ?? currentDialogueIdRef.current;
            if (uid && did) {
                if (cacheWriteTimeoutRef.current) clearTimeout(cacheWriteTimeoutRef.current);
                flushMessagesCache(uid, did, messagesRef.current);
                markLeaveTimeForPendingActions(uid, did, messagesRef.current);
            }
            abortControllerRef.current?.abort();
        };
    }, []);

    // 新消息自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        currentDialogueIdRef.current = currentDialogueId;
    }, [currentDialogueId]);

    useEffect(() => {
        const uid = userId;
        const did = currentDialogueId;
        if (!uid || !did) return;
        if (cacheWriteTimeoutRef.current) clearTimeout(cacheWriteTimeoutRef.current);
        cacheWriteTimeoutRef.current = setTimeout(() => {
            flushMessagesCache(uid, did, messagesRef.current);
        }, 250);
        return () => {
            if (cacheWriteTimeoutRef.current) clearTimeout(cacheWriteTimeoutRef.current);
        };
    }, [userId, currentDialogueId, messages]);

    const loadConfig = async (uid) => {
        try {
            const res = await api.getAiConfig(uid);
            // 确保数值字段是数字 (API 可能会返回它们，但以防万一)
            setAiConfig(prev => ({
                ...prev,
                ...res,
                openai_base_url: res?.openai_base_url ?? prev.openai_base_url ?? ''
            }));
        } catch (e) {
            console.error("加载 AI 配置失败", e);
        }
    };

    const loadDialogues = async (uid) => {
        try {
            const res = await api.getDialogues(uid);
            // 按 ID 降序排序（最新优先）
            const sorted = res.sort((a, b) => b.id - a.id);
            setDialogues(sorted);
            return sorted;
        } catch (e) {
            console.error("加载对话列表失败", e);
            return [];
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

    const selectDialogue = async (did, uidOverride) => {
        const uid = uidOverride ?? userIdRef.current ?? userId;
        if (currentDialogueId === did) return;
        setCurrentDialogueId(did);
        setMessages([]); // 清空当前视图
        setLastDialogueId(uid, did);

        if (!did) return; // 选中了“新对话”

        let cachedReconciled = null;
        try {
            const cachedRaw = sessionStorage.getItem(getMessagesCacheKey(uid, did));
            const cached = safeJsonParse(cachedRaw, null);
            if (Array.isArray(cached) && cached.length > 0) {
                const reconciled = await reconcilePendingActionsForDialogue(uid, did, cached);
                cachedReconciled = reconciled;
                setMessages(reconciled);
            }
        } catch (e) {
            console.error(e);
        }

        try {
            const res = await api.getDialogue(did, uid);
            // 解析消息
            // 后端返回：{ messages: [ [userMsg, aiMsg], ... ] } 或类似结构？
            
            const parsedMessages = [];
            if (res.messages && Array.isArray(res.messages)) {
                res.messages.forEach(turn => {
                    if (Array.isArray(turn)) {
                        turn.forEach(msg => {
                            if (msg) {
                                let content = msg.content;
                                
                                // 将后端混合内容转换为前端格式
                                if (Array.isArray(content)) {
                                    content = content.map(item => {
                                        // 后端文本类型为 0
                                        if (item.type === 0) {
                                            return { type: 'text', text: item.data?.content || '' };
                                        } else {
                                            // 后端卡片类型 > 0
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
            const backendReconciled = await reconcilePendingActionsForDialogue(uid, did, parsedMessages);

            if (Array.isArray(cachedReconciled) && cachedReconciled.length > 0) {
                if (backendReconciled.length >= cachedReconciled.length) {
                    setMessages(backendReconciled);
                    flushMessagesCache(uid, did, backendReconciled);
                } else {
                    const confirmations = extractActionConfirmationsFromMessages(backendReconciled);
                    const merged = applyActionConfirmationsToMessages(cachedReconciled, confirmations);
                    setMessages(merged);
                    flushMessagesCache(uid, did, merged);
                }
            } else {
                setMessages(backendReconciled);
                flushMessagesCache(uid, did, backendReconciled);
            }
        } catch (e) {
            console.error("加载对话历史失败", e);
        }
    };

    const onCardConfirmationChange = (actionId, confirmation) => {
        const uid = userIdRef.current;
        const did = currentDialogueIdRef.current;
        setMessages(prev => {
            const result = updateCardConfirmationInMessages(prev, actionId, confirmation);
            if (result.changed) {
                flushMessagesCache(uid, did, result.messages);
            }
            return result.messages;
        });
        const pending = readPendingActions(uid);
        if (pending[actionId]) {
            const nextPending = { ...pending };
            delete nextPending[actionId];
            writePendingActions(uid, nextPending);
        }
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isStreaming) return;
        
        const text = inputValue.trim();
        setInputValue("");
        
        let targetDialogueId = currentDialogueId;
        
        // 如果是新对话，则自动创建
        if (!targetDialogueId) {
            try {
                const newTitle = text.slice(0, 20) + (text.length > 20 ? "..." : "");
                const res = await api.createDialogue(userId, newTitle);
                targetDialogueId = res.id;
                setCurrentDialogueId(targetDialogueId);
                setLastDialogueId(userId, targetDialogueId);
                // 刷新列表
                await loadDialogues(userId);
            } catch (e) {
                alert("创建对话失败: " + e.message);
                return;
            }
        }

        // 在本地添加用户消息
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);

        // 开始流式传输
        setIsStreaming(true);
        activeStreamDialogueIdRef.current = targetDialogueId;
        const assistantMsg = { role: 'assistant', content: [] }; // 内容将是段落数组
        setMessages(prev => [...prev, assistantMsg]);

        try {
            streamTraceRef.current = { chunk: 0, eventLine: 0, dataLine: 0, partial: 0, cards: 0, errors: 0 };
            const { url, options } = api.getChatStreamOptions(targetDialogueId, userId, text);
            traceLog('FE.SSE', 'stream.start', { dialogueId: targetDialogueId, userId, contentLen: text.length });
            const controller = new AbortController();
            abortControllerRef.current = controller;
            const response = await fetch(`${api.API_BASE_URL || 'http://localhost:8000'}${url}`, { ...options, signal: controller.signal });
            
            traceLog('FE.SSE', 'fetch.response', { ok: response.ok, status: response.status, statusText: response.statusText });
            if (!response.ok) throw new Error(response.statusText);
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let currentEvent = null;
            const yieldToBrowser = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                streamTraceRef.current.chunk += 1;
                const chunkSeq = streamTraceRef.current.chunk;
                if (chunkSeq <= 5 || chunkSeq % 50 === 0) {
                    const sample = chunk.length > 160 ? chunk.slice(0, 160) + '...' : chunk;
                    traceLog('FE.SSE', 'recv.chunk', { seq: chunkSeq, len: chunk.length, sample });
                }
                const lines = (buffer + chunk).split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.substring(7).trim();
                        streamTraceRef.current.eventLine += 1;
                        const evSeq = streamTraceRef.current.eventLine;
                        if (evSeq <= 8) {
                            traceLog('FE.SSE', 'recv.event_line', { seq: evSeq, event: currentEvent });
                        }
                    } else if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6).trim();
                        if (!dataStr) continue;
                        
                        try {
                            streamTraceRef.current.dataLine += 1;
                            const dataSeq = streamTraceRef.current.dataLine;
                            if (currentEvent === 'cards' || currentEvent === 'error' || dataSeq <= 6) {
                                const sample = dataStr.length > 200 ? dataStr.slice(0, 200) + '...' : dataStr;
                                traceLog('FE.SSE', 'recv.data_line', { seq: dataSeq, event: currentEvent, len: dataStr.length, sample });
                            }
                            const data = JSON.parse(dataStr);
                            handleStreamEvent(currentEvent, data);
                            if (currentEvent === 'cards') {
                                await yieldToBrowser();
                            }
                        } catch (e) {
                            console.error("解析错误", e);
                        }
                    }
                }
            }
            traceLog('FE.SSE', 'stream.done', { dialogueId: targetDialogueId, ...streamTraceRef.current });
        } catch (e) {
            if (e?.name !== 'AbortError') {
                console.error(e);
                traceLog('FE.SSE', 'stream.error', { message: String(e?.message || e) });
                setMessages(prev => [...prev, { role: 'system', content: "错误: " + e.message }]);
            } else {
                traceLog('FE.SSE', 'stream.abort', { dialogueId: targetDialogueId });
            }
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    };

    const handleStreamEvent = (event, data) => {
        if (event !== 'partial_text' && event !== 'cards' && event !== 'error') return;
        const did = activeStreamDialogueIdRef.current ?? currentDialogueIdRef.current;
        const uid = userIdRef.current;
        if (event === 'partial_text') {
            streamTraceRef.current.partial += 1;
            const seq = streamTraceRef.current.partial;
            if (seq <= 5 || seq % 50 === 0) {
                const t = data?.delta !== undefined ? data.delta : data?.content;
                const sample = typeof t === 'string' ? (t.length > 60 ? t.slice(0, 60) + '...' : t) : '';
                traceLog('FE.EVENT', 'partial_text', { dialogueId: did, userId: uid, seq, len: (t || '').length, sample });
            }
        } else if (event === 'cards') {
            streamTraceRef.current.cards += 1;
            const cards = Array.isArray(data?.cards) ? data.cards : [];
            traceLog('FE.EVENT', 'cards', {
                dialogueId: did,
                userId: uid,
                seq: streamTraceRef.current.cards,
                cardCount: cards.length,
                types: cards.map(c => c?.type)
            });
        } else if (event === 'error') {
            streamTraceRef.current.errors += 1;
            traceLog('FE.EVENT', 'error', { dialogueId: did, userId: uid, message: data?.message });
        }
        setMessages(prev => {
            const startedAt = performance.now();
            const newMessages = [...prev];
            const lastMsgIndex = newMessages.length - 1;
            // 深拷贝最后一条消息及其内容以确保不可变性
            const lastMsg = { ...newMessages[lastMsgIndex] };
            
            // 确保内容是数组（并复制它）
            if (typeof lastMsg.content === 'string') {
                lastMsg.content = [{ type: 'text', text: lastMsg.content }];
            } else if (Array.isArray(lastMsg.content)) {
                lastMsg.content = [...lastMsg.content];
            } else {
                lastMsg.content = [];
            }
            
            // 更新新数组中的消息
            newMessages[lastMsgIndex] = lastMsg;

            if (event === 'partial_text') {
                const text = data.delta !== undefined ? data.delta : data.content;
                const lastSegmentIndex = lastMsg.content.length - 1;
                const lastSegment = lastMsg.content[lastSegmentIndex];
                
                if (lastSegment && lastSegment.type === 'text') {
                    // 创建新的片段对象以避免直接修改
                    lastMsg.content[lastSegmentIndex] = { ...lastSegment, text: lastSegment.text + text };
                } else {
                    lastMsg.content.push({ type: 'text', text: text });
                }
            } else if (event === 'cards') {
                data.cards.forEach(card => {
                    // 防止重复卡片（如果有 action_id 则进行检查）
                    const isDuplicate = lastMsg.content.some(c => 
                        c.type === 'card' && 
                        c.data && 
                        c.data.action_id && 
                        card.action_id && 
                        c.data.action_id === card.action_id
                    );
                    
                    if (!isDuplicate) {
                        lastMsg.content.push({ type: 'card', data: card });

                        const actionId = card?.action_id;
                        const confirmation = card?.user_confirmation;
                        if (actionId && confirmation !== 'Y' && confirmation !== 'N') {
                            const uid = userIdRef.current;
                            const did = activeStreamDialogueIdRef.current ?? currentDialogueIdRef.current;
                            if (uid && did) {
                                const pending = readPendingActions(uid);
                                if (!pending[actionId]) {
                                    writePendingActions(uid, { ...pending, [actionId]: { dialogueId: did, leftAt: null } });
                                }
                            }
                        }
                        
                        // 检查自动确认的操作（或后端立即确认的操作）
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
                lastMsg.content.push({ type: 'text', text: `\n[错误: ${data.message}]` });
            }

            const costMs = Math.round(performance.now() - startedAt);
            if (event === 'cards' || costMs >= 8) {
                traceLog('FE.RENDER', 'setMessages.applied', { dialogueId: did, userId: uid, event, costMs, segments: lastMsg.content.length });
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
        
        // 重置
        touchStartRef.current = null;
        
        // 水平滑动检测 (阈值 50px，且水平 > 垂直)
        if (Math.abs(xDiff) > 50 && Math.abs(xDiff) > Math.abs(yDiff)) {
            // 右滑（打开）
            if (xDiff > 0 && !sidebarOpen) {
                // 仅允许从左侧边缘区域（如屏幕的前 50%）开始打开
                setSidebarOpen(true);
            }
            // 左滑（关闭）
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
            
            {/* 侧边栏遮罩层（移动端） */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* 侧边栏 */}
            <div className={`${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0'} fixed md:relative z-40 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col overflow-hidden shadow-2xl md:shadow-none`}>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="font-bold text-lg dark:text-white truncate">历史对话</h2>
                </div>
                
                {/* 新建对话按钮 */}
                <div className="p-2">
                    <button 
                        onClick={() => selectDialogue(null)}
                        className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${!currentDialogueId ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                    >
                        <i className="fa-solid fa-plus"></i>
                        <span>新建对话</span>
                    </button>
                </div>

                {/* 对话列表 */}
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

                {/* 设置按钮（固定在底部） */}
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

            {/* 切换侧边栏按钮（悬浮） */}
            <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`absolute top-4 ${sidebarOpen ? 'left-64' : 'left-0'} ml-2 z-20 p-2 text-gray-500 hover:text-primary transition-all hidden md:block`}
            >
                <i className={`fa-solid ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'}`}></i>
            </button>

            {/* 主聊天区域 */}
            <div className="flex-1 flex flex-col h-full relative">
                {/* 头部 */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm z-10">
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                            {currentDialogueId ? (dialogues.find(d => d.id === currentDialogueId)?.title || `对话 ${currentDialogueId}`) : "新对话"}
                        </h2>
                    </div>
                </div>

                {/* 消息 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {messages.length === 0 && !currentDialogueId && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                            <i className="fa-solid fa-robot text-6xl mb-4"></i>
                            <p>开始一个新的对话吧</p>
                        </div>
                    )}
                    
                    {messages.map((msg, idx) => (
                        <MessageItem key={idx} role={msg.role} content={msg.content} userId={userId} onCardConfirmationChange={onCardConfirmationChange} />
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* 输入区域 */}
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

            {/* 设置弹窗 */}
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

function MessageItem({ role, content, userId, onCardConfirmationChange }) {
    // 如果内容只是字符串（旧格式或简单消息）
    if (typeof content === 'string') {
        content = [{ type: 'text', text: content }];
    }
    
    // 安全检查
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
                            {item.type === 'card' && <CardItem card={item.data} userId={userId} onCardConfirmationChange={onCardConfirmationChange} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CardItem({ card, userId, onCardConfirmationChange }) {
    const { type, data, action_id, user_confirmation } = card;
    const [actionStatus, setActionStatus] = useState(() => {
        if (user_confirmation === 'Y') return 'confirmed';
        if (user_confirmation === 'N') return 'cancelled';
        return null;
    }); // 'confirming', 'cancelling', 'confirmed', 'cancelled', 'failed' (确认中, 取消中, 已确认, 已取消, 失败)
    const [subTaskDetails, setSubTaskDetails] = useState({});
    const [longTermTaskDetails, setLongTermTaskDetails] = useState({});

    useEffect(() => {
        if (user_confirmation === 'Y') setActionStatus('confirmed');
        else if (user_confirmation === 'N') setActionStatus('cancelled');
        else if (actionStatus === 'confirmed' || actionStatus === 'cancelled') setActionStatus(null);
    }, [user_confirmation, actionStatus]);

    // 获取引用任务的详细信息（子任务和长期任务）
    useEffect(() => {
        const fetchDetails = async () => {
            // 1. 识别要获取的子任务
            let subTaskIdsToFetch = new Set();
            
            // 用于创建长期任务（类型 4）
            if (type === 4 && data.sub_task_ids) {
                const ids = typeof data.sub_task_ids === 'string' 
                    ? Object.keys(JSON.parse(data.sub_task_ids)) 
                    : Object.keys(data.sub_task_ids);
                ids.forEach(id => subTaskIdsToFetch.add(id));
            }

            // 用于更新任务 (类型 3) - 特别是子任务 ID 的变更
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

            // 2. 识别要获取的长期任务
            let longTermIdsToFetch = new Set();
            if (type === 3 && (data.updated?.long_term_task_id || data.original?.long_term_task_id)) {
                if (data.updated?.long_term_task_id) longTermIdsToFetch.add(data.updated.long_term_task_id);
                if (data.original?.long_term_task_id) longTermIdsToFetch.add(data.original.long_term_task_id);
            }

            // 3. 获取子任务
            const subIds = Array.from(subTaskIdsToFetch);
            if (subIds.length > 0) {
                const details = {};
                await Promise.all(subIds.map(async (id) => {
                    try {
                        const task = await api.getTaskById(id);
                        details[id] = task;
                    } catch (e) {
                        console.error(`获取任务 ${id} 失败`, e);
                        details[id] = { title: `任务 #${id}` }; 
                    }
                }));
                setSubTaskDetails(prev => ({ ...prev, ...details }));
            }

            // 4. 获取长期任务
            const ltIds = Array.from(longTermIdsToFetch);
            if (ltIds.length > 0) {
                const details = {};
                await Promise.all(ltIds.map(async (id) => {
                    try {
                        const task = await api.getLongTermTaskById(id);
                        details[id] = task;
                    } catch (e) {
                        console.error(`获取长期任务 ${id} 失败`, e);
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
                onCardConfirmationChange?.(action_id, 'Y');
                
                // 通过 EventBus 更新其他视图
                // 类型 1: 创建任务, 2: 删除任务, 3: 更新任务, 4: 创建长期任务
                if ([1, 2, 3, 4].includes(type)) {
                     taskEventBus.emit('task-updated');
                } else if (type === 7) {
                     // 类型 7: 更新日记
                     taskEventBus.emit('journal-updated');
                }
            } else {
                await api.cancelAiAction(action_id, userId);
                setActionStatus('cancelled');
                onCardConfirmationChange?.(action_id, 'N');
            }
        } catch (e) {
            const msg = String(e?.message || '');
            const isNotFoundOrTimeout = msg.includes('Action not found') || msg.includes('timeout') || msg.includes('Not Found');
            if (isNotFoundOrTimeout) {
                setActionStatus('cancelled');
                onCardConfirmationChange?.(action_id, 'N');
                return;
            }
            alert("操作失败: " + msg);
            setActionStatus('failed');
        }
    };

    const renderCardContent = () => {
        switch (type) {
            case 1: // 创建任务
                return (
                    <div className="border-l-4 border-green-500 pl-3 py-1 bg-green-50 dark:bg-green-900/20">
                        <h4 className="font-bold text-green-700 dark:text-green-400 mb-1">🆕 创建任务</h4>
                        <div><strong>标题:</strong> {data.title}</div>
                        {data.description && <div><strong>描述:</strong> {data.description}</div>}
                        {data.due_date && <div><strong>截止:</strong> {data.due_date}</div>}
                    </div>
                );
            case 2: { // 删除任务
                const showDesc = data.description && !data.description.toString().startsWith('ID:');
                return (
                    <div className="border-l-4 border-red-500 pl-3 py-1 bg-red-50 dark:bg-red-900/20">
                        <h4 className="font-bold text-red-700 dark:text-red-400 mb-1">⚠️ 确认删除</h4>
                        <div><strong>{data.title}</strong></div>
                        {showDesc && <div>{data.description}</div>}
                    </div>
                );
            }
            case 3: // 更新任务
                return (
                    <div className="border-l-4 border-blue-500 pl-3 py-1 bg-blue-50 dark:bg-blue-900/20">
                        <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-1">📝 更新任务</h4>
                        {/* 按要求隐藏 ID */}
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
                                                    
                                                    if (oldWeight === newWeight) return null; // 该任务没有变化
                                                    
                                                    if (oldWeight === undefined) {
                                                        // 新增
                                                        return (
                                                            <div key={id} className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 p-1 rounded border border-green-100 dark:border-green-800">
                                                                <span className="text-green-600 dark:text-green-400 font-bold">+</span>
                                                                <span className="flex-1 truncate" title={taskTitle}>{taskTitle}</span>
                                                                <span className="text-[10px] bg-green-100 dark:bg-green-800 px-1 rounded text-green-700 dark:text-green-300">权重: {newWeight}</span>
                                                            </div>
                                                        );
                                                    } else if (newWeight === undefined) {
                                                        // 移除
                                                        return (
                                                            <div key={id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 p-1 rounded border border-red-100 dark:border-red-800">
                                                                <span className="text-red-600 dark:text-red-400 font-bold">-</span>
                                                                <span className="flex-1 truncate" title={taskTitle}>{taskTitle}</span>
                                                                <span className="text-[10px] bg-red-100 dark:bg-red-800 px-1 rounded text-red-700 dark:text-red-300">权重: {oldWeight}</span>
                                                            </div>
                                                        );
                                                    } else {
                                                        // 变更
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

                                // 格式化显示值
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
            case 4: // 创建长期任务
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
            case 7: // 更新日记
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
            
            {/* 操作按钮 */}
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
