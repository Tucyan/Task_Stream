import React, { useState, useEffect } from 'react'

export default function Sidebar({ currentView, setCurrentView, primaryColor, userId, heatmapTrigger, onHeatmapClick }) {
  const [heatmapDate, setHeatmapDate] = useState(new Date())
  const [heatmapData, setHeatmapData] = useState([])

  const year = heatmapDate.getFullYear()
  const month = heatmapDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  // Calculate empty cells needed to maintain fixed 6 rows (6 * 7 = 42 cells total)
  const totalCells = firstDayOfMonth + daysInMonth
  const cellsToFill = 42 - totalCells

  useEffect(() => {
    if (!userId) return
    const fetchHeatmap = async () => {
      try {
        const queryYear = heatmapDate.getFullYear()
        const queryMonth = heatmapDate.getMonth() + 1
        const response = await fetch(`http://127.0.0.1:8000/heatmap?year=${queryYear}&month=${queryMonth}&user_id=${userId}`)
        if (response.ok) {
          const data = await response.json()
          setHeatmapData(data)
        }
      } catch (error) {
        console.error("Failed to fetch heatmap data", error)
      }
    }
    fetchHeatmap()
  }, [heatmapDate, userId, heatmapTrigger])

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  const getHeatmapCellStyle = (day) => {
    // heatmapData index 0 corresponds to day 1
    const level = heatmapData[day - 1] || 0
    
    if (level === 0) return {}

    const rgb = hexToRgb(primaryColor || '#6366f1')
    if (!rgb) return {}

    // Map level 1-6 to opacity 0.15 - 1.0
    // level 0 is handled above (empty)
    // level 1: 0.15
    // level 2: 0.3
    // level 3: 0.45
    // level 4: 0.6
    // level 5: 0.8
    // level 6: 1.0
    const opacity = Math.min(level * 0.16 + 0.04, 1)

    return {
      backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
    }
  }

  const prevMonth = () => {
    setHeatmapDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setHeatmapDate(new Date(year, month + 1, 1))
  }

  const navClass = (view) => (
    currentView === view
      ? 'bg-primary text-white shadow-lg shadow-primary/30 font-bold'
      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
  )

  return (
    <aside className="h-full w-64 bg-card border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm z-20 transition-colors duration-300">
      <div className="p-6">
        <div className="flex items-center gap-3 text-primary text-2xl font-bold mb-8">
          <i className="fa-solid fa-layer-group"></i>
          <span>Task Stream</span>
        </div>
        <nav className="space-y-2">
          <button onClick={() => setCurrentView('home')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${navClass('home')}`}>
            <i className="fa-solid fa-house"></i> 主页
          </button>
          <button onClick={() => setCurrentView('detail')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${navClass('detail')}`}>
            <i className="fa-solid fa-list-check"></i> 详细日程
          </button>
          <button onClick={() => setCurrentView('longterm')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${navClass('longterm')}`}>
            <i className="fa-solid fa-timeline"></i> 长期任务
          </button>
          <button onClick={() => setCurrentView('journal')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${navClass('journal')}`}>
            <i className="fa-solid fa-book-open"></i> 日志
          </button>
          <button onClick={() => setCurrentView('ai')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${navClass('ai')}`}>
            <i className="fa-solid fa-wand-magic-sparkles"></i> AI 助手
          </button>
          <button onClick={() => setCurrentView('settings')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${navClass('settings')}`}>
            <i className="fa-solid fa-sliders"></i> 个性化设置
          </button>
        </nav>
      </div>
      <div className="mt-auto p-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold uppercase opacity-50 dark:text-gray-300 dark:opacity-100">完成度热力图</span>
          <div className="flex gap-1 text-xs items-center dark:text-gray-300">
            <button onClick={prevMonth} className="hover:text-primary w-4 h-4 flex items-center justify-center"><i className="fa-solid fa-chevron-left"></i></button>
            <span className="min-w-[3.5rem] text-center">{year}年{month + 1}月</span>
            <button onClick={nextMonth} className="hover:text-primary w-4 h-4 flex items-center justify-center"><i className="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] opacity-50 font-bold dark:text-gray-300 dark:opacity-100">
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
    </aside>
  )
}
