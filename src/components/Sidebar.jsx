import React, { useState, useEffect } from 'react'
import { getHeatmapData } from '../services/api.js'

/**
 * 侧边栏组件
 * 包含应用导航和热力图展示
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.currentView - 当前选中的视图
 * @param {Function} props.setCurrentView - 设置当前视图的函数
 * @param {string} props.primaryColor - 主色调
 * @param {number} props.userId - 用户ID
 * @param {number} props.heatmapTrigger - 热力图刷新触发器
 * @param {Function} props.onHeatmapClick - 热力图点击事件处理函数
 * @param {string} [props.className=''] - 自定义CSS类名
 * @returns {JSX.Element} - Sidebar组件
 */
export default function Sidebar({ currentView, setCurrentView, primaryColor, userId, heatmapTrigger, onHeatmapClick, className = '' }) {
  // 热力图显示的当前日期
  const [heatmapDate, setHeatmapDate] = useState(new Date())
  // 热力图数据，存储每月每天的活动强度
  const [heatmapData, setHeatmapData] = useState([])

  // 当前月份的年份、月份、天数和第一天是星期几
  const year = heatmapDate.getFullYear()
  const month = heatmapDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  // 计算需要填充的空单元格数量，以保持固定的6行（6 * 7 = 42个单元格）
  const totalCells = firstDayOfMonth + daysInMonth
  const cellsToFill = 42 - totalCells

  // 当热力图日期、用户ID或刷新触发器变化时，重新获取热力图数据
  useEffect(() => {
    console.log('Sidebar: useEffect triggered', { userId, heatmapDate, heatmapTrigger })
    if (!userId) {
      console.warn('Sidebar: userId is missing')
      return
    }
    const fetchHeatmap = async () => {
      try {
        const queryYear = heatmapDate.getFullYear()
        const queryMonth = heatmapDate.getMonth() + 1
        console.log('Sidebar: Fetching heatmap', { queryYear, queryMonth, userId })
        
        const data = await getHeatmapData(queryYear, queryMonth, userId)
        console.log('Sidebar: Heatmap data received', data)
        setHeatmapData(data)
      } catch (error) {
        console.error("Sidebar: Error fetching heatmap data", error)
      }
    }
    fetchHeatmap()
  }, [heatmapDate, userId, heatmapTrigger])

  /**
   * 将十六进制颜色转换为RGB格式
   * 
   * @param {string} hex - 十六进制颜色值
   * @returns {Object|null} - RGB颜色对象或null
   */
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  /**
   * 根据热力图数据获取单元格样式
   * 
   * @param {number} day - 日期（1-31）
   * @returns {Object} - CSS样式对象
   */
  const getHeatmapCellStyle = (day) => {
    // heatmapData索引0对应日期1
    const level = heatmapData[day - 1] || 0
    
    if (level === 0) return {}

    const rgb = hexToRgb(primaryColor || '#6366f1')
    if (!rgb) return {}

    // 将热力图等级映射到透明度
    // 等级1-6对应透明度0.15-1.0
    const opacity = Math.min(level * 0.16 + 0.04, 1)

    return {
      backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
    }
  }

  /**
   * 切换到上一个月
   */
  const prevMonth = () => {
    setHeatmapDate(new Date(year, month - 1, 1))
  }

  /**
   * 切换到下一个月
   */
  const nextMonth = () => {
    setHeatmapDate(new Date(year, month + 1, 1))
  }

  /**
   * 根据当前视图返回导航项的CSS类名
   * 
   * @param {string} view - 视图名称
   * @returns {string} - CSS类名
   */
  const navClass = (view) => (
    currentView === view
      ? 'bg-primary text-white shadow-lg shadow-primary/30 font-bold'
      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
  )

  return (
    <aside className={`h-full w-64 bg-card border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm z-20 transition-colors duration-300 ${className}`}>
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
