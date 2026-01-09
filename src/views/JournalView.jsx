import React, { useState, useEffect } from 'react'
import * as api from '../services/api.js'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import taskEventBus from '../utils/eventBus.js'

export default function JournalView({ userId }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date().getDate())
  const [journalContent, setJournalContent] = useState('')
  const [journalStatus, setJournalStatus] = useState([])
  const [isPreview, setIsPreview] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false) // 移动端日历展开状态
  const [refreshKey, setRefreshKey] = useState(0)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  // 获取当前月份的日志状态
  useEffect(() => {
    if (userId) {
      api.getJournalStatus(year, month + 1, userId)
        .then(statusList => {
          console.log('Journal status list:', statusList);
          setJournalStatus(statusList || []);
        })
        .catch(console.error);
    }
  }, [year, month, userId, refreshKey]);

  useEffect(() => {
    // 构建日期字符串 YYYY-MM-DD
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    api.getJournalByDate(dateStr, userId)
      .then(data => {
        setJournalContent(data ? data.content : '');
        // 如果有内容，默认为预览模式，否则为编辑模式
        setIsPreview(!!(data && data.content));
      })
      .catch(console.error);
  }, [year, month, selectedDay, userId, refreshKey]);

  useEffect(() => {
    const handleUpdate = () => {
        setRefreshKey(prev => prev + 1);
    }
    taskEventBus.on('journal-updated', handleUpdate);
    return () => {
        taskEventBus.off('journal-updated', handleUpdate);
    }
  }, []);

  const saveJournal = () => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    api.updateJournalContent(dateStr, journalContent, userId)
      .then(res => {
        if(res.success) {
          // 刷新日志状态列表
          api.getJournalStatus(year, month + 1, userId)
            .then(statusList => {
              console.log('Refreshed journal status list:', statusList);
              setJournalStatus(statusList || []);
            })
            .catch(console.error);
          alert('日志保存成功！'); // 或者使用更好的通知组件
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
    setIsCalendarOpen(false) // 移动端选择后关闭日历
  }
  return (
    <div className="h-full flex flex-col md:flex-row gap-4 md:gap-6 md:max-w-7xl mx-auto relative">
      {/* Mobile Calendar Toggle Header */}
      <div 
        className="md:hidden flex items-center justify-between bg-card rounded-2xl p-4 shadow-sm cursor-pointer border border-gray-100 dark:border-gray-700 mt-2"
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
        fixed md:static inset-x-0 top-20 z-50 md:z-auto
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
          <div className="flex justify-between items-center mb-2">
            <span className="dark:text-gray-300">本月已写</span>
            <span className="font-bold text-xl text-primary">{journalStatus.filter(Boolean).length} <span className="text-xs text-gray-400 font-normal">/ {daysInMonth} 篇</span></span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-black/20 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-1000" 
              style={{ width: `${(journalStatus.filter(Boolean).length / daysInMonth) * 100}%` }}
            />
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

      {/* 内容区域 */}
      <div className="flex-1 bg-card md:rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-w-0 mb-4 md:mb-0">
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <i className="fa-solid fa-pen-nib text-lg md:text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold dark:text-white">{year}年{month + 1}月{selectedDay}日</h2>
              <p className="text-xs md:text-sm text-gray-400">
                {journalStatus[selectedDay-1] ? '今日已记录' : '记录此刻的想法...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button 
              onClick={() => setIsPreview(!isPreview)}
              className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 flex items-center justify-center text-gray-400 transition-all"
              title={isPreview ? "编辑" : "预览"}
            >
              <i className={`fa-solid ${isPreview ? 'fa-pen-to-square' : 'fa-eye'} text-sm md:text-base`}></i>
            </button>
            <button 
              onClick={saveJournal}
              className="bg-primary text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 transition-all flex items-center gap-2 text-sm md:text-base"
            >
              <i className="fa-solid fa-check"></i>
              <span className="hidden sm:inline">保存记录</span>
              <span className="sm:hidden">保存</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {isPreview ? (
            <div className="h-full overflow-y-auto p-4 md:p-8">
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {journalContent || '*今日暂无记录，点击右上角编辑按钮开始写作...*'}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <textarea
              value={journalContent}
              onChange={(e) => setJournalContent(e.target.value)}
              placeholder="在这里输入你的日志内容，支持 Markdown 语法..."
              className="w-full h-full p-4 md:p-8 bg-transparent outline-none resize-none text-sm md:text-lg leading-relaxed dark:text-gray-300 placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          )}
        </div>
      </div>
    </div>
  )
}

