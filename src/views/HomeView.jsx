import React, { useState, useEffect, useRef } from 'react'
import { getMemo, updateMemo, getUrgentTasks } from '../services/api'
import taskEventBus from '../utils/eventBus'

export default function HomeView({ todayTasks, onToggleTask, deadlines, getUrgencyClass, onAddTask, onDeleteTask, userId }) {
  const [urgentTasks, setUrgentTasks] = useState([])
  const [urgentPage, setUrgentPage] = useState(0)
  const [pageSize, setPageSize] = useState(3)
  const containerRef = useRef(null)

  useEffect(() => {
    const fetchUrgent = () => {
      if (userId) {
        getUrgentTasks(userId).then(data => {
          setUrgentTasks(Array.isArray(data) ? data : [])
        })
      }
    }

    fetchUrgent()
    setUrgentPage(0)

    const handleUpdate = () => fetchUrgent()
    taskEventBus.on('task-updated', handleUpdate)

    return () => {
      taskEventBus.off('task-updated', handleUpdate)
    }
  }, [userId])

  useEffect(() => {
    if (!containerRef.current) return

    const calculatePageSize = () => {
      if (!containerRef.current) return
      const height = containerRef.current.clientHeight
      const padding = 48 // p-6 (24px) * 2
      const gap = 16     // gap-4 (16px)
      const minCardHeight = 100 // 最小卡片高度
      
      const availableHeight = height - padding
      // Calculation: n * minH + (n-1) * gap <= availableH
      // => n * (minH + gap) - gap <= availableH
      // => n * (minH + gap) <= availableH + gap
      // => n <= (availableH + gap) / (minH + gap)
      
      const n = Math.floor((availableHeight + gap) / (minCardHeight + gap))
      setPageSize(Math.max(1, n))
    }

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(calculatePageSize)
    })
    
    observer.observe(containerRef.current)
    calculatePageSize()
    
    return () => observer.disconnect()
  }, [])

  const totalPages = Math.ceil(urgentTasks.length / pageSize) || 1
  
  useEffect(() => {
    if (urgentPage >= totalPages) {
      setUrgentPage(Math.max(0, totalPages - 1))
    }
  }, [pageSize, totalPages])

  const pagedUrgentTasks = urgentTasks.slice(urgentPage * pageSize, (urgentPage + 1) * pageSize)

  const handlePrevUrgent = () => setUrgentPage(p => Math.max(0, p - 1))
  const handleNextUrgent = () => setUrgentPage(p => Math.min(totalPages - 1, p + 1))

  function getRemainTime(dueDate) {
  const now = new Date()
  const end = new Date(dueDate)
  let diff = Math.floor((end - now) / 1000)
  if (diff <= 0) return '已截止'
  const days = Math.floor(diff / (60 * 60 * 24))
  const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60))
  const minutes = Math.floor((diff % (60 * 60)) / 60)
  const seconds = diff % 60
  let str = ''
  if (days > 0) str += `${days}天`
  if (hours > 0) str += `${hours}小时`
  if (minutes > 0) str += `${minutes}分`
  if (seconds > 0) str += `${seconds}秒`
  return str
}

  const [memoContent, setMemoContent] = useState('')
  const [memoDate, setMemoDate] = useState('')
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (userId) {
      getMemo(userId).then(data => {
        if (data) {
          setMemoContent(data.content || '')
          if (data.updated_at) {
             const date = new Date(data.updated_at);
             setMemoDate(`${date.getMonth() + 1}月${date.getDate()}日`);
          }
        }
      })
    }
  }, [userId])

  const handleMemoChange = (e) => {
    const newContent = e.target.value
    setMemoContent(newContent)
    
    // Debounce save
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
        if (userId) {
            updateMemo(userId, newContent).then(data => {
                 if (data && data.updated_at) {
                    const date = new Date(data.updated_at);
                    setMemoDate(`${date.getMonth() + 1}月${date.getDate()}日`);
                 }
            })
        }
    }, 1000)
  }

  // Mobile View Swipe Logic
  const [mobileView, setMobileView] = useState(0) // 0: Welcome+Today, 1: Memo+Urgent
  const touchStartRef = useRef(null)
  
  const handleTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientX
  }
  
  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return
    
    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStartRef.current - touchEnd
    
    // Threshold for swipe (e.g., 50px)
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swiped Left -> Next View
        setMobileView(prev => Math.min(1, prev + 1))
      } else {
        // Swiped Right -> Prev View
        setMobileView(prev => Math.max(0, prev - 1))
      }
    }
    
    touchStartRef.current = null
  }

  return (
    <div 
      className="max-w-7xl mx-auto h-full flex flex-col md:flex-row gap-4 md:gap-6 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Column 1: Welcome + Today Tasks */}
      <div className={`flex-1 flex flex-col gap-4 md:gap-6 transition-all duration-300 ${mobileView === 0 ? 'block' : 'hidden md:flex'} h-full overflow-y-auto md:overflow-visible pb-4 md:pb-0`}>
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-primary to-purple-400 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden group min-h-[160px] md:h-40 shrink-0">
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">早安!</h2>
          <p className="opacity-90">今天有 {todayTasks.filter(t => !t.completed).length} 项待办，请合理安排时间。</p>
          <button className="mt-4 px-4 py-2 bg-white/20 backdrop-blur-md rounded-lg text-sm hover:bg-white/30 transition-colors">查看概览</button>
        </div>
        
        {/* Today Tasks */}
        <div className="flex-1 bg-card rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[400px] md:min-h-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold dark:text-white">今日日程</h3>
            <button onClick={onAddTask} className="w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center">
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {todayTasks.map((task, index) => (
              <div key={index} className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all cursor-pointer">
                <div onClick={() => onToggleTask(index)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${task.completed ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600'}`}>
                  {task.completed && <i className="fa-solid fa-check text-white text-xs"></i>}
                </div>
                <div className="flex-1">
                  <div className={`font-medium text-base dark:text-white ${task.completed ? 'line-through opacity-50' : ''}`}>{task.title}</div>
                  <div className="flex gap-2 text-xs mt-1 text-gray-400">
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400">{task.time}</span>
                    {task.tags.map((tag, i) => (
                      <span key={i} className="text-primary">#{tag}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => onDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-2">
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column 2: Memo + Urgent Tasks */}
      <div className={`w-full md:w-96 flex flex-col gap-4 md:gap-6 transition-all duration-300 ${mobileView === 1 ? 'block' : 'hidden md:flex'} h-full overflow-y-auto md:overflow-visible pb-4 md:pb-0`}>
        {/* Memo Card */}
        <div className="bg-card rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col relative min-h-[160px] md:h-40 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-500 dark:text-gray-400 text-sm">近期目标 (Memo)</h3>
            <i className="fa-solid fa-pen text-xs text-primary cursor-pointer"></i>
          </div>
          <textarea 
            className="w-full flex-1 bg-transparent resize-none outline-none text-sm leading-relaxed dark:text-white" 
            placeholder="在这里写下你的近期小目标..." 
            value={memoContent}
            onChange={handleMemoChange}
          />
          <div className="absolute bottom-4 right-6 text-xs text-gray-400 dark:text-gray-500">{memoDate || '今天'}</div>
        </div>

        {/* Urgent Tasks */}
        <div ref={containerRef} className="flex-1 bg-card rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col relative group justify-center min-h-[200px] md:min-h-0">
          {/* 左切换按钮 */}
          <button  
            onClick={handlePrevUrgent} 
            className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-primary hover:text-white shadow-md z-10 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-gray-600 dark:text-gray-300 backdrop-blur-sm"
          >
            <i className="fa-solid fa-angle-left"></i>
          </button>

          {/* 右切换按钮 */}
          <button 
            onClick={handleNextUrgent} 
            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-primary hover:text-white shadow-md z-10 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-gray-600 dark:text-gray-300 backdrop-blur-sm"
          >
            <i className="fa-solid fa-angle-right"></i>
          </button>

          <div className="w-full px-2 flex flex-col gap-4 flex-1 min-h-0">
            {pagedUrgentTasks.map(task => {
  const now = new Date()
  const end = new Date(task.due_date)
  let diff = Math.floor((end - now) / 1000)
  let days = Math.floor(diff / (60 * 60 * 24))
  
  let cardClass = ''
  
  if (diff <= 0) {
    cardClass = 'bg-gray-400 border-gray-400'
  } else if (days < 3) {
    cardClass = 'bg-red-500 border-red-500'
  } else if (days < 7) {
    cardClass = 'bg-amber-400 border-amber-400'
  } else {
    cardClass = 'bg-emerald-500 border-emerald-500'
  }
  
  return (
    <div
      key={task.id}
      className={`rounded-2xl p-4 flex flex-col items-center justify-between border-2 shadow-sm transition-all text-white flex-1 max-h-32 max-w-xs ${cardClass}`}
    >
      <div className="mb-2 font-bold text-2xl tracking-wider drop-shadow-md">
        {getRemainTime(task.due_date)}
      </div>
      <div className="w-full bg-white/95 dark:bg-gray-900/90 backdrop-blur-sm rounded-xl px-3 py-2 text-center shadow-sm">
        <div className="font-bold text-base text-gray-800 dark:text-gray-100 line-clamp-2">
          {task.title}
        </div>
      </div>
    </div>
  )
})}
            {pagedUrgentTasks.length === 0 && (
              <div className="text-gray-400 text-center py-6">暂无急需处理任务</div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile View Indicators */}
      <div className="md:hidden absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <div className={`w-2 h-2 rounded-full transition-colors ${mobileView === 0 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
        <div className={`w-2 h-2 rounded-full transition-colors ${mobileView === 1 ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
      </div>
    </div>
  )
}

