import React, { useEffect, useMemo, useRef, useState } from 'react'
import AuthModal from './components/AuthModal.jsx'
import Sidebar from './components/Sidebar.jsx'
import MobileNav from './components/MobileNav.jsx'
import HeaderBar from './components/HeaderBar.jsx'
import MainContent from './components/MainContent.jsx'
import ResultModal from './components/ResultModal.jsx'
import TaskModal from './components/TaskModal.jsx'
import ReminderQueueModal from './components/ReminderQueueModal.jsx'
import * as api from './services/api.js'
import taskEventBus from './utils/eventBus.js'

const REMINDER_SETTINGS_KEY = 'taskStreamReminderSettings'
const DEFAULT_REMINDER_SETTINGS = { vibration: true, sound: true, snooze_minutes: 10 }

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [currentView, setCurrentView] = useState('home')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [userId, setUserId] = useState(1) // Mock user ID
  const [user, setUser] = useState(null) // 存储用户信息
  const reminderNotifInitRef = useRef(false)
  const reminderNotifListenerRef = useRef(null)
  const lastReminderUserIdRef = useRef(null)
  const localNotificationsRef = useRef(null)
  const reminderChannelIdRef = useRef(null)

  const isNativePlatform = useMemo(() => {
    if (typeof window === 'undefined') return false
    const cap = window.Capacitor
    if (!cap) return false
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform()
    return !!cap.isNativePlatform
  }, [])

  const getLocalNotifications = async () => {
    if (!isNativePlatform) return null
    if (localNotificationsRef.current) return localNotificationsRef.current
    const cap = typeof window !== 'undefined' ? window.Capacitor : null
    const ln = cap?.Plugins?.LocalNotifications || null
    localNotificationsRef.current = ln
    return ln
  }

  const loadReminderSettings = () => {
    if (typeof window === 'undefined') return { ...DEFAULT_REMINDER_SETTINGS }
    try {
      const raw = localStorage.getItem(REMINDER_SETTINGS_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      const snooze_minutes = Number(parsed?.snooze_minutes)
      return {
        vibration: parsed?.vibration !== false,
        sound: parsed?.sound !== false,
        snooze_minutes:
          Number.isFinite(snooze_minutes) && snooze_minutes > 0 ? Math.min(180, Math.floor(snooze_minutes)) : 10
      }
    } catch {
      return { ...DEFAULT_REMINDER_SETTINGS }
    }
  }

  const reminderChannelIdFor = (settings) => {
    const v = settings?.vibration !== false ? 1 : 0
    const s = settings?.sound !== false ? 1 : 0
    return `reminders_v${v}_s${s}`
  }

  // Loading Screen States
  const [isLoading, setIsLoading] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [heatmapTrigger, setHeatmapTrigger] = useState(0)

  const finishLoading = () => {
    setIsFadingOut(true)
    setTimeout(() => {
      setIsLoading(false)
      setIsFadingOut(false)
    }, 500) // Duration matches CSS transition
  }

  // 在组件初始化时检查localStorage中的登录状态和设置
  useEffect(() => {
    const initApp = async () => {
      // 1. 尝试加载用户设置（优先从本地缓存加载以避免样式闪烁）
      const savedSettings = localStorage.getItem('taskStreamSettings')
      if (savedSettings) {
        try {
          const parsedSettings = JSON.parse(savedSettings)
          setSettings(parsedSettings)
          setIsDarkMode(parsedSettings.theme_mode === 'dark')
        } catch (e) {
          console.error('Failed to parse saved settings:', e)
        }
      }

      // 2. 检查登录状态
      const savedUser = localStorage.getItem('taskStreamUser')
      if (savedUser) {
        try {
          const userInfo = JSON.parse(savedUser)
          setIsLoggedIn(true)
          setUserId(userInfo.id)
          setUser(userInfo)
          
          // 异步更新最新设置（后台静默更新）
          await loadSettings(userInfo.id)
          syncReminderNotifications(userInfo.id).catch(() => {})
        } catch (e) {
          console.error('Failed to parse saved user info:', e)
          localStorage.removeItem('taskStreamUser')
        }
      }
      
      // 3. 完成初始化，渐隐Loading
      finishLoading()
    }

    initApp()
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return
    if (!userId) return
    if (!isNativePlatform) return
    lastReminderUserIdRef.current = userId
    syncReminderNotifications(userId).catch(() => {})
  }, [isLoggedIn, userId, isNativePlatform])

  useEffect(() => {
    if (!isNativePlatform) return
    const onWake = () => {
      if (!isLoggedIn) return
      if (!userId) return
      if (typeof document !== 'undefined' && document.visibilityState && document.visibilityState !== 'visible') return
      syncReminderNotifications(userId).catch(() => {})
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    const interval = setInterval(onWake, 5 * 60 * 1000)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [isLoggedIn, userId, isNativePlatform])

  useEffect(() => {
    if (!isNativePlatform) return
    if (isLoggedIn) return
    const lastUid = lastReminderUserIdRef.current
    if (!lastUid) return
    lastReminderUserIdRef.current = null
    const storageKey = `taskStream:scheduledReminderIds:${lastUid}`
    ;(async () => {
      try {
        const raw = localStorage.getItem(storageKey)
        const ids = raw ? JSON.parse(raw) : []
        if (Array.isArray(ids) && ids.length > 0) {
          const LocalNotifications = await getLocalNotifications()
          if (LocalNotifications) {
            LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {})
          }
        }
      } catch {
      }
    })()
    try {
      localStorage.removeItem(storageKey)
    } catch {
    }
  }, [isLoggedIn, isNativePlatform])

  // 处理用户信息更新
  const handleUserUpdate = (updatedUser) => {
    console.log('[App] 用户信息已更新:', updatedUser)
    setUser(updatedUser)
  }

  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [showReminderQueueModal, setShowReminderQueueModal] = useState(false)
  const [pendingReminderAction, setPendingReminderAction] = useState(null)
  const [pendingSnoozeMinutes, setPendingSnoozeMinutes] = useState(10)

  const parseReminderAt = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null
    const m = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/)
    if (!m) return null
    const year = Number(m[1])
    const month = Number(m[2]) - 1
    const day = Number(m[3])
    const hour = Number(m[4])
    const minute = Number(m[5])
    const d = new Date(year, month, day, hour, minute, 0, 0)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const reminderStableId = (reminder) => {
    const raw = JSON.stringify({
      type: reminder?.type ?? '',
      time: reminder?.time ?? '',
      content: reminder?.content ?? '',
      task_id: reminder?.task_id ?? null
    })
    let hash = 0
    for (let i = 0; i < raw.length; i += 1) {
      hash = (hash * 31 + raw.charCodeAt(i)) | 0
    }
    const n = Math.abs(hash)
    return (n % 2147483647) || 1
  }

  const ensureReminderNotificationsReady = async () => {
    if (!isNativePlatform) return false

    const LocalNotifications = await getLocalNotifications()
    if (!LocalNotifications) return false

    const perm = await LocalNotifications.checkPermissions()
    if (perm?.display !== 'granted') {
      const asked = await LocalNotifications.requestPermissions()
      if (asked?.display !== 'granted') return false
    }

    try {
      const settings = loadReminderSettings()
      const channelId = reminderChannelIdFor(settings)
      if (!reminderNotifInitRef.current || reminderChannelIdRef.current !== channelId) {
        const channel = {
          id: channelId,
          name: 'Task Stream Reminders',
          importance: settings.sound || settings.vibration ? 5 : 3,
          visibility: 1,
          vibration: !!settings.vibration
        }
        if (!settings.sound) channel.sound = null
        await LocalNotifications.createChannel(channel)
        reminderChannelIdRef.current = channelId
      }
    } catch {
    }

    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'TASKSTREAM_REMINDER_ACTIONS',
            actions: [
              {
                id: 'ACK',
                title: '知道了'
              },
              {
                id: 'SNOOZE',
                title: '延后'
              }
            ]
          }
        ]
      })
    } catch {
    }

    if (!reminderNotifListenerRef.current) {
      reminderNotifListenerRef.current = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        async (event) => {
          const reminder = event?.notification?.extra?.reminder
          if (!reminder) return

          if (event?.actionId === 'SNOOZE') {
            const settings = loadReminderSettings()
            const minutes = Number(settings?.snooze_minutes) || 10
            const snoozeAt = new Date(Date.now() + minutes * 60 * 1000)
            const id = Math.floor(Date.now() % 2147483647) || 1
            const channelId = reminderChannelIdFor(settings)
            await LocalNotifications.schedule({
              notifications: [
                {
                  id,
                  title: 'Task Stream 提醒（已延后）',
                  body: reminder?.content || '提醒',
                  schedule: { at: snoozeAt, allowWhileIdle: true },
                  channelId,
                  actionTypeId: 'TASKSTREAM_REMINDER_ACTIONS',
                  extra: {
                    source: 'taskstream_reminder',
                    snoozed: true,
                    reminder
                  }
                }
              ]
            })
            return
          }

          if (event?.actionId === 'ACK') return

          if (event?.actionId === 'tap' || !event?.actionId) {
            const settings = loadReminderSettings()
            setPendingReminderAction({ reminder, notification: event?.notification || null })
            setPendingSnoozeMinutes(Number(settings?.snooze_minutes) || 10)
            return
          }
        }
      )
    }

    try {
      const exact = await LocalNotifications.checkExactNotificationSetting?.()
      if (exact && exact.value && exact.value !== 'granted') {
        await LocalNotifications.changeExactNotificationSetting?.()
      }
    } catch {
    }

    reminderNotifInitRef.current = true
    return true
  }

  const syncReminderNotifications = async (uidOverride) => {
    const uid = uidOverride ?? userId
    if (!uid || !isNativePlatform) return
    const ready = await ensureReminderNotificationsReady()
    if (!ready) return
    const LocalNotifications = await getLocalNotifications()
    if (!LocalNotifications) return
    const settings = loadReminderSettings()
    const channelId = reminderChannelIdFor(settings)

    const storageKey = `taskStream:scheduledReminderIds:${uid}`
    let oldIds = []
    try {
      const raw = localStorage.getItem(storageKey)
      oldIds = raw ? JSON.parse(raw) : []
    } catch {
      oldIds = []
    }
    if (Array.isArray(oldIds) && oldIds.length > 0) {
      try {
        await LocalNotifications.cancel({
          notifications: oldIds.map((id) => ({ id }))
        })
      } catch {
      }
    }

    const list = await api.getReminderList(uid)
    const now = Date.now()
    const upcoming = (Array.isArray(list) ? list : [])
      .map((r) => ({ r, at: parseReminderAt(r?.time) }))
      .filter((x) => x.at && x.at.getTime() >= now - 5000)
      .sort((a, b) => a.at.getTime() - b.at.getTime())

    const maxToSchedule = 120
    const notifications = upcoming.slice(0, maxToSchedule).map(({ r, at }) => {
      const baseId = reminderStableId(r)
      const atMs = at.getTime()
      const id = (baseId + (atMs % 1000000)) % 2147483647
      return {
        id: id || baseId,
        title: 'Task Stream 提醒',
        body: r?.content || '提醒',
        schedule: { at, allowWhileIdle: true },
        channelId,
        actionTypeId: 'TASKSTREAM_REMINDER_ACTIONS',
        extra: {
          source: 'taskstream_reminder',
          userId: uid,
          reminder: r
        }
      }
    })

    const newIds = notifications.map((n) => n.id)
    try {
      localStorage.setItem(storageKey, JSON.stringify(newIds))
    } catch {
    }

    const chunkSize = 50
    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize)
      await LocalNotifications.schedule({ notifications: chunk })
    }
  }

  const scheduleReminderSnooze = async (reminder, minutesRaw) => {
    if (!isNativePlatform) return
    const LocalNotifications = await getLocalNotifications()
    if (!LocalNotifications) return
    const ready = await ensureReminderNotificationsReady()
    if (!ready) return
    const settings = loadReminderSettings()
    const minutes = Math.min(180, Math.max(1, Math.floor(Number(minutesRaw) || settings.snooze_minutes || 10)))
    const snoozeAt = new Date(Date.now() + minutes * 60 * 1000)
    const id = Math.floor(Date.now() % 2147483647) || 1
    const channelId = reminderChannelIdFor(settings)
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Task Stream 提醒（已延后）',
          body: reminder?.content || '提醒',
          schedule: { at: snoozeAt, allowWhileIdle: true },
          channelId,
          actionTypeId: 'TASKSTREAM_REMINDER_ACTIONS',
          extra: {
            source: 'taskstream_reminder',
            snoozed: true,
            reminder
          }
        }
      ]
    })
  }

  const [settings, setSettings] = useState({
    primary: '#6366f1',
    bg: '#f3f4f6',
    text: '#1f2937',
    card: '#ffffff',
    theme_mode: 'light'
  })

  // Load settings from backend
  const loadSettings = async (uid) => {
    try {
      const data = await api.getSettings(uid)
      if (data) {
        const newSettings = {
          primary: data.primary,
          bg: data.bg,
          text: data.text,
          card: data.card,
          theme_mode: data.theme_mode || 'light'
        }
        setSettings(newSettings)
        setIsDarkMode(data.theme_mode === 'dark')
        // 同步更新本地缓存
        localStorage.setItem('taskStreamSettings', JSON.stringify(newSettings))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Save settings to backend
  const saveSettings = (newSettings) => {
    const settingsData = {
      user_id: userId,
      primary: newSettings.primary,
      bg: newSettings.bg,
      text: newSettings.text,
      card: newSettings.card,
      theme_mode: newSettings.theme_mode
    }

    // 先更新本地缓存，保证下次加载即刻生效
    localStorage.setItem('taskStreamSettings', JSON.stringify(newSettings))
    
    api.updateSettings(userId, settingsData)
      .then(updated => {
          console.log('Settings updated:', updated)
          setSettings(newSettings) // Ensure state is consistent
      })
      .catch(err => {
          // If update failed, maybe settings don't exist yet
          console.log('Update failed, trying to create settings...', err)
          api.createSettings(settingsData)
            .then(created => {
                console.log('Settings created:', created)
                setSettings(newSettings)
            })
            .catch(e => console.error('Failed to save settings:', e))
      })
  }

  const presetColors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6']

  const [todayTasks, setTodayTasks] = useState([])
  const [detailFilter, setDetailFilter] = useState('all')
  const [detailSearch, setDetailSearch] = useState('')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [detailedTasks, setDetailedTasks] = useState([])

  // Helper to refresh tasks
  const refreshTasks = () => {
      const today = new Date().toISOString().split('T')[0];
      api.getTasksInDateRange(today, today, userId)
        .then(tasks => {
           console.log('[App] refreshTasks - todayTasks raw API response:', tasks);
           const mappedTasks = tasks.map(t => ({
             ...t,
             time: `${t.assigned_start_time || '00:00'} - ${t.assigned_end_time || '23:59'}`,
             startTime: t.assigned_start_time || '00:00',
             endTime: t.assigned_end_time || '23:59',
             date: t.assigned_date || today,
             desc: t.description || "",
             completed: t.status === 3
           }));
           setTodayTasks(mappedTasks);
        })
        .catch(console.error);

      // Fetch detailed tasks based on whether date filters are set
      if(filterDateStart && filterDateEnd) {
          api.getTasksInDateRange(filterDateStart, filterDateEnd, userId)
            .then(tasks => {
                console.log('[App] refreshTasks - detailedTasks (range) raw API response:', tasks);
                const mapped = tasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    desc: t.description,
                    date: t.assigned_date,
                    startTime: t.assigned_start_time,
                    endTime: t.assigned_end_time,
                    due_date: t.due_date,
                    tags: t.tags || [],
                    record_result: t.record_result,
                    result: t.result,
                    result_picture_url: t.result_picture_url,
                    long_term_task_id: t.long_term_task_id || t.longTermTaskId,
                    status: t.status,
                    completed: t.status === 3
                }));
                setDetailedTasks(mapped);
            })
            .catch(console.error);
      } else {
          // If no date range is specified, fetch all tasks for the user
          api.getAllTasksForUser(userId)
            .then(tasks => {
                console.log('[App] refreshTasks - detailedTasks (all) raw API response:', tasks);
                const mapped = tasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    desc: t.description,
                    date: t.assigned_date,
                    startTime: t.assigned_start_time,
                    endTime: t.assigned_end_time,
                    due_date: t.due_date,
                    tags: t.tags || [],
                    record_result: t.record_result,
                    result: t.result,
                    result_picture_url: t.result_picture_url,
                    long_term_task_id: t.long_term_task_id || t.longTermTaskId,
                    status: t.status,
                    completed: t.status === 3
                }));
                setDetailedTasks(mapped);
            })
            .catch(console.error);
      }
  }

  // Fetch today's tasks
  useEffect(() => {
    if (isLoggedIn) {
      refreshTasks();
    }
  }, [isLoggedIn, userId]);
  
  // 监听任务更新事件
  const handleTaskUpdate = () => {
    refreshTasks();
    setHeatmapTrigger(prev => prev + 1);
  };

  useEffect(() => {
    // 订阅任务更新事件
    taskEventBus.on('task-updated', handleTaskUpdate);
    
    // 清理函数，取消订阅
    return () => {
      taskEventBus.off('task-updated', handleTaskUpdate);
    };
  }, [userId, filterDateStart, filterDateEnd]);

  const [deadlines, setDeadlines] = useState([
    { title: '项目一期交付', date: '2025-12-05', level: 'high', countdown: '01:23:45', progress: 80 },
    { title: '提交年度总结报告', date: '2025-12-10', level: 'medium', countdown: '06:12:00', progress: 50 },
    { title: '服务器续费', date: '2025-12-20', level: 'low', countdown: '15:00:00', progress: 20 }
  ])
  
  // Fetch uncompleted long term tasks for deadlines
  useEffect(() => {
     if(isLoggedIn) {
         api.getAllUncompletedLongTermTasks(userId)
            .then(tasks => {
                // Map to deadline format
                const mappedDeadlines = tasks.map(t => ({
                    title: t.title,
                    date: t.due_date,
                    level: 'medium', // Default or logic to determine
                    countdown: '00:00:00', // Need logic to calc
                    progress: t.progress * 100
                }));
                // setDeadlines(mappedDeadlines); // Uncomment to use real data
            })
            .catch(console.error);
     }
  }, [isLoggedIn, userId])

  // Fetch detailed tasks when filter changes
  useEffect(() => {
      if(isLoggedIn) {
          if(filterDateStart && filterDateEnd) {
              // If date range is specified, fetch tasks in that range
              api.getTasksInDateRange(filterDateStart, filterDateEnd, userId)
                .then(tasks => {
                    console.log('[App] useEffect - detailedTasks (range) raw API response:', tasks);
                    const mapped = tasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        desc: t.description,
                        date: t.assigned_date,
                        startTime: t.assigned_start_time,
                        endTime: t.assigned_end_time,
                        due_date: t.due_date,
                        tags: t.tags || [],
                        record_result: t.record_result,
                        result: t.result,
                        result_picture_url: t.result_picture_url,
                    long_term_task_id: t.long_term_task_id || t.longTermTaskId,
                    status: t.status,
                    completed: t.status === 3
                }));
                    setDetailedTasks(mapped);
                })
                .catch(console.error);
          } else {
              // If no date range is specified, fetch all tasks for the user
              api.getAllTasksForUser(userId)
                .then(tasks => {
                    console.log('[App] useEffect - detailedTasks (all) raw API response:', tasks);
                    const mapped = tasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        desc: t.description,
                        date: t.assigned_date,
                        startTime: t.assigned_start_time,
                        endTime: t.assigned_end_time,
                        due_date: t.due_date,
                        tags: t.tags || [],
                        record_result: t.record_result,
                        result: t.result,
                        result_picture_url: t.result_picture_url,
                    long_term_task_id: t.long_term_task_id || t.longTermTaskId,
                    status: t.status,
                    completed: t.status === 3
                }));
                    setDetailedTasks(mapped);
                })
                .catch(console.error);
          }
      }
  }, [isLoggedIn, filterDateStart, filterDateEnd, userId]);


  const pageTitle = useMemo(() => {
    const titles = {
      home: '概览仪表盘',
      detail: '详细日程管理',
      longterm: '长期目标规划',
      journal: '每日日志',
      ai: 'AI 智能助手',
      settings: '系统设置'
    }
    return titles[currentView]
  }, [currentView])

  const cssVariables = useMemo(() => ({
    '--primary-color': settings.primary,
    '--bg-color': settings.bg,
    '--text-color': settings.text,
    '--card-bg': settings.card
  }), [settings])

  const baseDetailTasks = useMemo(() => {
    return detailedTasks.filter((task) => {
      if (filterDateStart && task.date < filterDateStart) return false
      if (filterDateEnd && task.date > filterDateEnd) return false
      if (detailSearch) {
        const query = detailSearch.toLowerCase()
        return (
          task.title.toLowerCase().includes(query) ||
          (task.desc && task.desc.toLowerCase().includes(query)) ||
          (task.tags && task.tags.some((tag) => tag.toLowerCase().includes(query)))
        )
      }
      return true
    })
  }, [detailedTasks, filterDateStart, filterDateEnd, detailSearch])

  const filteredDetailTasks = useMemo(() => {
    return baseDetailTasks.filter((task) => {
      if (detailFilter === 'pending' && task.completed) return false
      if (detailFilter === 'completed' && !task.completed) return false
      return true
    }).sort((a, b) => {
      // Handle null dates by placing them at the end
      if (a.date === null && b.date === null) {
        // Both dates are null, compare start times
        if (a.startTime === null && b.startTime === null) return 0;
        if (a.startTime === null) return 1;
        if (b.startTime === null) return -1;
        return a.startTime.localeCompare(b.startTime);
      }
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      
      // Compare dates if they are different
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      
      // Dates are the same, compare start times with null checks
      if (a.startTime === null && b.startTime === null) return 0;
      if (a.startTime === null) return 1;
      if (b.startTime === null) return -1;
      return a.startTime.localeCompare(b.startTime);
    })
  }, [baseDetailTasks, detailFilter])

  useEffect(() => {
    document.body.className = 'bg-page text-txt h-screen overflow-hidden selection:bg-primary selection:text-white'
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setDeadlines((prev) => prev.map((d) => {
        const parts = d.countdown.split(':').map(Number)
        let seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
        if (seconds > 0) seconds -= 1
        else seconds = 86400
        const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
        const s = String(seconds % 60).padStart(2, '0')
        return { ...d, countdown: `${h}:${m}:${s}` }
      }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const clearDateFilter = () => {
    setFilterDateStart('')
    setFilterDateEnd('')
  }

  const login = () => {
    setIsLoggedIn(true)
    setCurrentView('home')
  }

  const getUrgencyClass = (level) => {
    if (level === 'high') return 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
    if (level === 'medium') return 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300'
    return 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
  }

  const getHeatmapColor = (n) => {
    const opacity = ((Math.sin(n) + 1) / 2) * 0.8 + 0.1
    return `rgba(var(--primary-color-rgb, 99, 102, 241), ${opacity})`
  }

  const toggleTask = (index) => {
    const t = todayTasks[index]
    const newStatus = t.completed ? 0 : 3 // Toggle between 0 and 3
    const newTask = { ...t, status: newStatus, completed: !t.completed }
    
    // Optimistic update
    setTodayTasks((prev) => {
      const next = [...prev]
      next[index] = newTask
      return next
    })

    // 构建完整的任务对象以符合后端 Task schema 的要求
    const taskUpdateData = {
      id: t.id,
      user_id: userId,
      title: t.title,
      description: t.description || "",
      status: newStatus,
      due_date: t.due_date || "",
      created_at: t.created_at || new Date().toISOString(), // 使用现有值或当前时间
      updated_at: new Date().toISOString(), // 设置为当前时间
      assigned_date: t.assigned_date || "",
      assigned_start_time: t.assigned_start_time || "",
      assigned_end_time: t.assigned_end_time || "",
      tags: t.tags || [], // 保持为数组格式，后端会处理JSON序列化
      record_result: t.record_result ? 1 : 0, // 将布尔值转换为整数
      result: t.result || "",
      result_picture_url: t.result_picture_url || [], // 保持为数组格式，后端会处理JSON序列化
      long_term_task_id: t.long_term_task_id || 0
    }
    
    console.log('Sending task update data:', taskUpdateData);
    
    api.updateTask(t.id, taskUpdateData)
      .then(() => {
        // 成功更新后通过事件总线通知所有组件刷新
        taskEventBus.emit('task-updated')
      })
      .catch(err => {
        console.error("Failed to update task", err)
        // Revert on failure
        setTodayTasks((prev) => {
            const next = [...prev]
            next[index] = t
            return next
        })
      })

    if (!t.completed && t.recordResult) {
      setTimeout(() => setShowResultModal(true), 300)
    }
  }

  const toggleDarkMode = (isDark) => {
    setIsDarkMode(isDark)
    const newSettings = isDark
      ? { ...settings, bg: '#0f172a', card: '#1e293b', text: '#f8fafc', theme_mode: 'dark' }
      : { ...settings, bg: '#f3f4f6', card: '#ffffff', text: '#1f2937', theme_mode: 'light' }
    
    // Optimistically update state
    setSettings(newSettings)
    // Persist to backend
    saveSettings(newSettings)
  }

  const resetTheme = () => {
    const defaultSettings = { primary: '#6366f1', bg: '#f3f4f6', card: '#ffffff', text: '#1f2937', theme_mode: 'light' }
    setIsDarkMode(false)
    setSettings(defaultSettings)
    saveSettings(defaultSettings)
  }

  // 只重置本地状态，不保存到后端
  const resetLocalTheme = () => {
    const defaultSettings = { primary: '#6366f1', bg: '#f3f4f6', card: '#ffffff', text: '#1f2937', theme_mode: 'light' }
    setIsDarkMode(false)
    setSettings(defaultSettings)
  }

  const toggleDetailedTask = (id) => {
    const task = detailedTasks.find(t => t.id === id)
    if (!task) return

    const newStatus = task.completed ? 0 : 3
    const newTask = { ...task, status: newStatus, completed: !task.completed }

    setDetailedTasks((prev) => prev.map((t) => (t.id === id ? newTask : t)))
    
    // 构建完整的任务对象以符合后端 Task schema 的要求
    const taskUpdateData = {
      id: task.id,
      user_id: userId,
      title: task.title,
      description: task.desc || "",
      status: newStatus,
      due_date: task.date || "",
      created_at: task.created_at || new Date().toISOString(), // 使用现有值或当前时间
      updated_at: new Date().toISOString(), // 设置为当前时间
      assigned_date: task.date || "",
      assigned_start_time: task.startTime || "",
      assigned_end_time: task.endTime || "",
      tags: task.tags || [], // 保持为数组格式，后端会处理JSON序列化
      record_result: task.record_result ? 1 : 0, // 将布尔值转换为整数
      result: task.result || "",
      result_picture_url: task.result_picture_url || [], // 保持为数组格式，后端会处理JSON序列化
      long_term_task_id: task.long_term_task_id || 0
    }
    
    console.log('Sending detailed task update data:', taskUpdateData);
    
    api.updateTask(task.id, taskUpdateData)
      .then(() => {
        // 成功更新后通过事件总线通知所有组件刷新
        taskEventBus.emit('task-updated')
      })
      .catch(err => {
          console.error("Failed to update detailed task", err)
          setDetailedTasks((prev) => prev.map((t) => (t.id === id ? task : t)))
      })
  }

  // Task CRUD Handlers
  const handleAddTask = () => {
    setEditingTask(null)
    setShowTaskModal(true)
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setShowTaskModal(true)
  }

  const handleDeleteTask = (taskId) => {
    if (window.confirm('确定要删除这个任务吗？')) {
      api.deleteTask(taskId)
        .then(() => {
          taskEventBus.emit('task-updated')
        })
        .catch(console.error)
    }
  }

  const handleSaveTask = (taskData) => {
    if (editingTask) {
      // 构建完整的任务对象以符合后端 Task schema 的要求
      const completeTaskData = {
        id: editingTask.id,
        user_id: userId,
        title: taskData.title || editingTask.title,
        description: taskData.description || editingTask.description || editingTask.desc || "",
        status: editingTask.status !== undefined ? editingTask.status : (editingTask.completed ? 3 : 0),
        due_date: taskData.due_date || editingTask.due_date || "",
        created_at: editingTask.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assigned_date: taskData.assigned_date || taskData.date || editingTask.assigned_date || "",
        assigned_start_time: taskData.assigned_start_time || taskData.startTime || editingTask.assigned_start_time || "",
        assigned_end_time: taskData.assigned_end_time || taskData.endTime || editingTask.assigned_end_time || "",
        tags: taskData.tags || editingTask.tags || [],
        record_result: taskData.record_result !== undefined ? taskData.record_result : (editingTask.record_result ? 1 : 0),
        result: taskData.result !== undefined ? taskData.result : (editingTask.result || ""),
        result_picture_url: editingTask.result_picture_url || [],
        long_term_task_id: editingTask.long_term_task_id || 0
      }
      
      console.log('Sending complete task update data:', completeTaskData);
      
      api.updateTask(editingTask.id, completeTaskData)
        .then(() => {
          taskEventBus.emit('task-updated')
        })
        .catch(console.error)
    } else {
      // 创建新任务时，确保所有必需字段都有值
      const newTaskData = {
        user_id: userId,
        title: taskData.title,
        description: taskData.description || "",
        status: 0, // 新任务默认为待办状态
        due_date: taskData.due_date || "",
        assigned_date: taskData.assigned_date || taskData.date || "",
        assigned_start_time: taskData.assigned_start_time || taskData.startTime || "",
        assigned_end_time: taskData.assigned_end_time || taskData.endTime || "",
        tags: taskData.tags || [],
        record_result: taskData.record_result || 0,
        result: "",
        result_picture_url: [],
        long_term_task_id: 0
      }
      
      api.createTask(newTaskData)
        .then(() => {
          taskEventBus.emit('task-updated')
        })
        .catch(console.error)
    }
  }

  const handleHeatmapClick = (dateStr) => {
    setFilterDateStart(dateStr)
    setFilterDateEnd(dateStr)
    setDetailFilter('all') // Reset status filter to show all tasks for that day
  }

  return (
    <div style={cssVariables} className={`h-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      {isLoading && (
        // 加载覆盖层，支持渐隐
        <div 
          className={`absolute inset-0 z-[100] flex items-center justify-center bg-page text-txt transition-opacity duration-500 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm opacity-60 dark:text-gray-400">正在加载...</p>
          </div>
        </div>
      )}
      {!isLoggedIn && (
        <AuthModal
          visible={!isLoggedIn}
          isRegistering={isRegistering}
          setIsRegistering={setIsRegistering}
          onAuthSuccess={async (userInfo) => {
            // 立即显示加载层以遮挡界面变化
            setIsLoading(true)
            setIsFadingOut(false)

            setIsLoggedIn(true)
            setUserId(userInfo.id)
            setUser(userInfo) // 保存用户信息
            // 将用户信息保存到localStorage
            localStorage.setItem('taskStreamUser', JSON.stringify(userInfo))
            
            // 等待设置加载完成后再显示主界面
            await loadSettings(userInfo.id)
            syncReminderNotifications(userInfo.id).catch(() => {})
            setCurrentView('home')

            // 渐隐Loading
            finishLoading()
          }}
        />
      )}
          {isLoggedIn && (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
              <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
                getHeatmapColor={getHeatmapColor}
                primaryColor={settings.primary}
                userId={userId}
                heatmapTrigger={heatmapTrigger}
                onHeatmapClick={handleHeatmapClick}
                className="hidden md:flex flex-none"
              />
              <main className="flex-1 min-h-0 flex flex-col relative overflow-hidden bg-page transition-colors duration-300 pb-[60px] md:pb-0">
                <HeaderBar 
                  pageTitle={pageTitle} 
                  onLogout={() => {
                    setIsLoggedIn(false)
                    setUser(null)
                    // 清除localStorage中的用户信息和设置
                    localStorage.removeItem('taskStreamUser')
                    localStorage.removeItem('taskStreamSettings')
                    // 仅重置本地主题状态，避免覆盖后端数据
                    resetLocalTheme()
                  }} 
                  user={user} 
                  onUserUpdate={handleUserUpdate}
                  onOpenReminderEditor={() => setShowReminderQueueModal(true)}
                />
                <MainContent
                  currentView={currentView}
                  todayTasks={todayTasks}
                  onToggleTask={toggleTask}
                  deadlines={deadlines}
                  getUrgencyClass={getUrgencyClass}
                  detailFilter={detailFilter}
                  setDetailFilter={setDetailFilter}
                  detailSearch={detailSearch}
                  setDetailSearch={setDetailSearch}
                  filterDateStart={filterDateStart}
                  setFilterDateStart={setFilterDateStart}
                  filterDateEnd={filterDateEnd}
                  setFilterDateEnd={setFilterDateEnd}
                  clearDateFilter={clearDateFilter}
                  filteredDetailTasks={filteredDetailTasks}
                  baseDetailTasks={baseDetailTasks}
                  onToggleDetailedTask={toggleDetailedTask}
                  isDarkMode={isDarkMode}
                  toggleDarkMode={toggleDarkMode}
                  settings={settings}
                  setSettings={setSettings}
                  presetColors={presetColors}
                  resetTheme={resetTheme}
                  saveSettings={saveSettings}
                  // Pass user data to SettingsView for mobile profile management
                  user={user}
                  onLogout={() => {
                    setIsLoggedIn(false)
                    setUser(null)
                    localStorage.removeItem('taskStreamUser')
                    localStorage.removeItem('taskStreamSettings')
                    resetLocalTheme()
                  }}
                  onUserUpdate={handleUserUpdate}
                  onOpenReminderEditor={() => setShowReminderQueueModal(true)}
                  // New props for CRUD
                  onAddTask={handleAddTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                  userId={userId}
                  onTaskUpdate={handleTaskUpdate}
                />
              </main>
              <MobileNav
                currentView={currentView}
                setCurrentView={setCurrentView}
                primaryColor={settings.primary}
                userId={userId}
                heatmapTrigger={heatmapTrigger}
                onHeatmapClick={handleHeatmapClick}
                user={user}
                onLogout={() => {
                  setIsLoggedIn(false)
                  setUser(null)
                  localStorage.removeItem('taskStreamUser')
                  localStorage.removeItem('taskStreamSettings')
                  resetLocalTheme()
                }}
                onUserUpdate={handleUserUpdate}
                className="md:hidden absolute bottom-0 left-0 right-0 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]"
              />
            </div>
          )}
      <ResultModal visible={showResultModal} onClose={() => setShowResultModal(false)} />
      <TaskModal 
        visible={showTaskModal} 
        onClose={() => setShowTaskModal(false)} 
        onSave={handleSaveTask} 
        task={editingTask} 
        currentUserId={user?.id}
      />
      {pendingReminderAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-3 md:p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl transform transition-all flex flex-col max-h-[92vh] border border-gray-100 dark:border-gray-700">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100 dark:border-gray-700">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-bell text-yellow-500"></i>
                  <div className="text-lg font-bold text-gray-800 dark:text-white truncate">提醒</div>
                </div>
                <div className="text-xs opacity-60 dark:text-gray-400 mt-1">从通知进入，可在此延后</div>
              </div>
              <button
                onClick={() => setPendingReminderAction(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-none"
              >
                <i className="fa-solid fa-times text-lg"></i>
              </button>
            </div>

            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <div className="text-sm text-gray-800 dark:text-white whitespace-pre-wrap break-words">
                  {pendingReminderAction?.reminder?.content || '提醒'}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">延后分钟</div>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={pendingSnoozeMinutes}
                  onChange={(e) => setPendingSnoozeMinutes(Math.min(180, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setPendingReminderAction(null)}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                知道了
              </button>
              <button
                onClick={async () => {
                  const reminder = pendingReminderAction?.reminder
                  setPendingReminderAction(null)
                  if (!reminder) return
                  try {
                    await scheduleReminderSnooze(reminder, pendingSnoozeMinutes)
                  } catch {
                  }
                }}
                className="flex-1 px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110 transition-all"
              >
                延后
              </button>
            </div>
          </div>
        </div>
      )}
      <ReminderQueueModal
        visible={showReminderQueueModal}
        onClose={() => setShowReminderQueueModal(false)}
        userId={userId}
        onSaved={() => syncReminderNotifications(userId).catch(() => {})}
      />
    </div>
  )
}

export default App
