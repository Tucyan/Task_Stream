import React, { useState, useEffect } from 'react'
import * as api from '../services/api.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function JournalView({ userId }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [journalContent, setJournalContent] = useState('')
  const [journalStatus, setJournalStatus] = useState([])
  const [isPreview, setIsPreview] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false) // Mobile calendar toggle state

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  // Fetch journal status for the current month
  useEffect(() => {
    if (userId) {
      api.getJournalStatus(year, month + 1, userId)
        .then(statusList => {
          console.log('Journal status list:', statusList);
          setJournalStatus(statusList || []);
        })
        .catch(console.error);
    }
  }, [year, month, userId]);

  useEffect(() => {
    // Construct date string YYYY-MM-DD
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    api.getJournalByDate(dateStr, userId)
      .then(data => {
        setJournalContent(data ? data.content : '');
        // If there is content, default to preview mode, otherwise edit mode
        setIsPreview(!!(data && data.content));
      })
      .catch(console.error);
  }, [year, month, selectedDay, userId]);

  const saveJournal = () => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    api.updateJournalContent(dateStr, journalContent, userId)
      .then(res => {
        if(res.success) {
          // Refresh journal status list
          api.getJournalStatus(year, month + 1, userId)
            .then(statusList => {
              console.log('Refreshed journal status list:', statusList);
              setJournalStatus(statusList || []);
            })
            .catch(console.error);
          alert('日志保存成功！'); // Or a better notification
        }
      })
      .catch(console.error);
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDay(1)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDay(1)
  }

  const handleDayClick = (day) => {
    setSelectedDay(day)
    setIsCalendarOpen(false) // Close calendar after selection on mobile
  }
  return (
    <div className="h-full flex flex-col md:flex-row gap-4 md:gap-6 max-w-7xl mx-auto relative">
      {/* Mobile Calendar Toggle Header */}
      <div 
        className="md:hidden flex items-center justify-between bg-card rounded-2xl p-4 shadow-sm cursor-pointer border border-gray-100 dark:border-gray-700"
        onClick={() => setIsCalendarOpen(!isCalendarOpen)}
      >
        <div className="flex items-center gap-2 dark:text-white">
          <i className="fa-solid fa-calendar-days text-primary"></i>
          <span className="font-bold">{year}年{month + 1}月</span>
          <span className="text-sm opacity-60 ml-2">已写 {journalStatus.filter(Boolean).length} 篇</span>
        </div>
        <i className={`fa-solid fa-chevron-down transition-transform duration-300 ${isCalendarOpen ? 'rotate-180' : ''} text-gray-400`}></i>
      </div>

      <div className={`
        md:w-80 bg-card rounded-3xl p-6 shadow-sm flex flex-col md:flex
        fixed md:static inset-x-4 top-20 z-50 md:z-auto
        transition-all duration-300 origin-top
        ${isCalendarOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 md:scale-y-100 md:opacity-100 hidden md:flex'}
        border border-gray-100 dark:border-gray-700 md:border-none
      `}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg dark:text-white">日志归档</h3>
          <div className="flex items-center gap-2 text-sm dark:text-gray-300">
            <button onClick={(e) => { e.stopPropagation(); prevMonth() }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <span className="font-medium min-w-[80px] text-center">{year}年{month + 1}月</span>
            <button onClick={(e) => { e.stopPropagation(); nextMonth() }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs opacity-50 font-bold dark:text-gray-400">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells for padding start of month */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square"></div>
          ))}
          {Array.from({ length: daysInMonth }).map((_, d) => {
            const day = d + 1
            const active = day === selectedDay
            // Check if day has entry using journalStatus list
            const hasEntry = journalStatus[d]
            
            return (
              <div 
                key={day} 
                onClick={() => handleDayClick(day)}
                className={`aspect-square rounded-full flex items-center justify-center text-sm cursor-pointer transition-all relative ${active ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300'}`}
              >
                {day}
                {hasEntry && (
                  <span className={`absolute bottom-1 w-1 h-1 rounded-full ${active ? 'bg-white' : 'bg-primary'}`}></span>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-400 mb-2">统计</div>
          <div className="flex justify-between items-center">
            <span className="dark:text-gray-300">本月已写</span>
            <span className="font-bold text-xl text-primary">{journalStatus.filter(Boolean).length} <span className="text-xs text-gray-400 font-normal">篇</span></span>
          </div>
        </div>
      </div>
      {/* Mobile Backdrop */}
      {isCalendarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsCalendarOpen(false)}
        ></div>
      )}

      <div className="flex-1 bg-card rounded-3xl p-6 md:p-8 shadow-sm flex flex-col relative overflow-hidden h-[calc(100vh-140px)] md:h-auto">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <i className="fa-solid fa-feather text-9xl"></i>
        </div>
        <div className="flex justify-between items-end mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
          <div>
            <h2 className="text-3xl font-bold text-primary">{month + 1}月 {selectedDay}日, {currentDate.toLocaleString('zh-CN', { weekday: 'long' })}</h2>
            <p className="text-sm opacity-60 mt-1 dark:text-gray-400">记录此刻的想法...</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsPreview(!isPreview)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {isPreview ? '编辑模式' : '预览 Markdown'}
            </button>
            <button onClick={saveJournal} className="px-4 py-2 bg-primary text-white rounded-lg text-sm shadow hover:brightness-110">保存日志</button>
          </div>
        </div>
        {isPreview ? (
          <div className="flex-1 w-full overflow-y-auto p-4 prose dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{journalContent}</ReactMarkdown>
          </div>
        ) : (
          <textarea 
            value={journalContent} 
            onChange={(e) => setJournalContent(e.target.value)} 
            className="flex-1 w-full bg-transparent border-none outline-none resize-none font-mono text-base leading-relaxed p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:bg-gray-50 dark:focus:bg-gray-800 focus:ring-0 dark:text-gray-200" 
            placeholder="# 今日总结\n\n- 完成了 Task Stream 的原型设计\n- 学习了 Vue3 的新特性\n\n感觉效率很高，明天继续保持。" 
          />
        )}
      </div>
    </div>
  )
}

