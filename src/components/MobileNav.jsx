import React, { useState, useEffect } from 'react'
import { getHeatmapData } from '../services/api.js'

export default function MobileNav({ currentView, setCurrentView, primaryColor, userId, heatmapTrigger, onHeatmapClick, className = '' }) {
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [heatmapDate, setHeatmapDate] = useState(new Date())
  const [heatmapData, setHeatmapData] = useState([])
  
  // Auto-scale logic
  const [scale, setScale] = useState(1)
  const MIN_REQUIRED_WIDTH = 370 // 7 buttons * ~50px + padding

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < MIN_REQUIRED_WIDTH) {
        setScale(width / MIN_REQUIRED_WIDTH)
      } else {
        setScale(1)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const year = heatmapDate.getFullYear()
  const month = heatmapDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  const totalCells = firstDayOfMonth + daysInMonth
  const cellsToFill = 42 - totalCells

  useEffect(() => {
    if (!userId || !showHeatmap) return // Only fetch if visible to save bandwidth
    
    const fetchHeatmap = async () => {
      try {
        const queryYear = heatmapDate.getFullYear()
        const queryMonth = heatmapDate.getMonth() + 1
        console.log('MobileNav: Fetching heatmap', { queryYear, queryMonth, userId })
        
        const data = await getHeatmapData(queryYear, queryMonth, userId)
        setHeatmapData(data)
      } catch (error) {
        console.error("MobileNav: Error fetching heatmap data", error)
      }
    }
    fetchHeatmap()
  }, [heatmapDate, userId, heatmapTrigger, showHeatmap])

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  const getHeatmapCellStyle = (day) => {
    const level = heatmapData[day - 1] || 0
    if (level === 0) return {}

    const rgb = hexToRgb(primaryColor || '#6366f1')
    if (!rgb) return {}

    const opacity = Math.min(level * 0.16 + 0.04, 1)
    return {
      backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
    }
  }

  const prevMonth = (e) => {
    e.stopPropagation()
    setHeatmapDate(new Date(year, month - 1, 1))
  }

  const nextMonth = (e) => {
    e.stopPropagation()
    setHeatmapDate(new Date(year, month + 1, 1))
  }

  const navClass = (view) => (
    currentView === view
      ? 'text-primary bg-primary/10'
      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
  )

  return (
    <nav className={`w-full bg-card border-t border-gray-200 dark:border-gray-700 flex flex-col z-20 transition-colors duration-300 ${className}`}>
      {/* Collapsible Heatmap Area - Moved to top of bottom bar so it expands upwards */}
      {showHeatmap && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50 animate-in slide-in-from-bottom-2 duration-200 order-first">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase opacity-50 dark:text-gray-300 dark:opacity-100">完成度热力图</span>
            <div className="flex gap-4 text-sm items-center dark:text-gray-300 bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-sm">
              <button onClick={prevMonth} className="hover:text-primary w-6 h-6 flex items-center justify-center"><i className="fa-solid fa-chevron-left"></i></button>
              <span className="min-w-[4rem] text-center font-medium">{year}年{month + 1}月</span>
              <button onClick={nextMonth} className="hover:text-primary w-6 h-6 flex items-center justify-center"><i className="fa-solid fa-chevron-right"></i></button>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm">
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[10px] opacity-50 font-bold dark:text-gray-300 dark:opacity-100">
              <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="w-full pt-[100%]"></div>
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const n = i + 1
                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`
                return (
                  <div 
                    key={n} 
                    onClick={() => {
                      setCurrentView('detail')
                      onHeatmapClick && onHeatmapClick(dayStr)
                      setShowHeatmap(false) // Auto close on selection
                    }} 
                    className="w-full pt-[100%] rounded-sm cursor-pointer hover:ring-2 ring-primary relative transition-all border border-gray-100 dark:border-gray-700" 
                    style={getHeatmapCellStyle(n)}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] opacity-0 hover:opacity-100 bg-black/50 text-white rounded-sm">{n}</span>
                  </div>
                )
              })}
              {Array.from({ length: cellsToFill > 0 ? cellsToFill : 0 }).map((_, i) => (
                <div key={`empty-end-${i}`} className="w-full pt-[100%]"></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Toolbar */}
      <div className="flex items-center justify-center px-2 py-2 order-last overflow-hidden">
        <div 
          className="flex justify-between"
          style={{
            transform: `scale(${scale})`,
            width: scale < 1 ? `${MIN_REQUIRED_WIDTH}px` : '100%',
            transformOrigin: 'center center'
          }}
        >
          <button onClick={() => setCurrentView('home')} className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 w-12 shrink-0 ${navClass('home')}`}>
            <i className="fa-solid fa-house text-lg"></i>
            <span className="text-[10px] whitespace-nowrap">主页</span>
          </button>
          <button onClick={() => setCurrentView('detail')} className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 w-12 shrink-0 ${navClass('detail')}`}>
            <i className="fa-solid fa-list-check text-lg"></i>
            <span className="text-[10px] whitespace-nowrap">日程</span>
          </button>
          <button onClick={() => setCurrentView('longterm')} className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 w-12 shrink-0 ${navClass('longterm')}`}>
            <i className="fa-solid fa-timeline text-lg"></i>
            <span className="text-[10px] whitespace-nowrap">长期</span>
          </button>
          <button onClick={() => setCurrentView('journal')} className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 w-12 shrink-0 ${navClass('journal')}`}>
            <i className="fa-solid fa-book-open text-lg"></i>
            <span className="text-[10px] whitespace-nowrap">日志</span>
          </button>
          <button onClick={() => setCurrentView('ai')} className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 w-12 shrink-0 ${navClass('ai')}`}>
            <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
            <span className="text-[10px] whitespace-nowrap">AI</span>
          </button>
          <button onClick={() => setCurrentView('settings')} className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 w-12 shrink-0 ${navClass('settings')}`}>
            <i className="fa-solid fa-sliders text-lg"></i>
            <span className="text-[10px] whitespace-nowrap">设置</span>
          </button>
          
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1 self-center shrink-0"></div>

          <button 
            onClick={() => setShowHeatmap(!showHeatmap)} 
            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 w-12 shrink-0 ${showHeatmap ? 'text-primary bg-primary/10' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
          >
            <i className={`fa-solid ${showHeatmap ? 'fa-chevron-down' : 'fa-fire'} text-lg`}></i>
            <span className="text-[10px] whitespace-nowrap">热力</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
