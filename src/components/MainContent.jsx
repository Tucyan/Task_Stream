import React from 'react'
import HomeView from '../views/HomeView.jsx'
import DetailView from '../views/DetailView.jsx'
import LongTermView from '../views/LongTermView.jsx'
import JournalView from '../views/JournalView.jsx'
import AiAssistantView from '../views/AiAssistantView.jsx'
import SettingsView from '../views/SettingsView.jsx'

/**
 * 主内容区域组件
 * 根据当前视图状态渲染不同的页面内容
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.currentView - 当前选中的视图
 * @param {Array} props.todayTasks - 今日任务列表
 * @param {Function} props.onToggleTask - 切换任务完成状态的函数
 * @param {Array} props.deadlines - 截止日期列表
 * @param {Function} props.getUrgencyClass - 获取紧急程度CSS类的函数
 * @param {string} props.detailFilter - 详细视图的过滤器
 * @param {Function} props.setDetailFilter - 设置详细视图过滤器的函数
 * @param {string} props.detailSearch - 详细视图的搜索关键词
 * @param {Function} props.setDetailSearch - 设置详细视图搜索关键词的函数
 * @param {string} props.filterDateStart - 日期范围过滤的开始日期
 * @param {Function} props.setFilterDateStart - 设置日期范围过滤开始日期的函数
 * @param {string} props.filterDateEnd - 日期范围过滤的结束日期
 * @param {Function} props.setFilterDateEnd - 设置日期范围过滤结束日期的函数
 * @param {Function} props.clearDateFilter - 清除日期范围过滤的函数
 * @param {Array} props.filteredDetailTasks - 过滤后的详细任务列表
 * @param {Array} props.baseDetailTasks - 基础详细任务列表
 * @param {Function} props.onToggleDetailedTask - 切换详细任务完成状态的函数
 * @param {boolean} props.isDarkMode - 是否为深色模式
 * @param {Function} props.toggleDarkMode - 切换深色/浅色模式的函数
 * @param {Object} props.settings - 用户设置
 * @param {Function} props.setSettings - 设置用户设置的函数
 * @param {Array} props.presetColors - 预设颜色列表
 * @param {Function} props.resetTheme - 重置主题的函数
 * @param {Function} props.saveSettings - 保存用户设置的函数
 * @param {Function} props.onAddTask - 添加任务的函数
 * @param {Function} props.onEditTask - 编辑任务的函数
 * @param {Function} props.onDeleteTask - 删除任务的函数
 * @param {number} props.userId - 用户ID
 * @param {Function} props.onTaskUpdate - 任务更新事件处理函数
 * @param {Object} props.user - 用户信息
 * @param {Function} props.onLogout - 登出函数
 * @param {Function} props.onUserUpdate - 用户信息更新回调函数
 * @returns {JSX.Element} - MainContent组件
 */
export default function MainContent({
  currentView,
  todayTasks,
  onToggleTask,
  deadlines,
  getUrgencyClass,
  detailFilter,
  setDetailFilter,
  detailSearch,
  setDetailSearch,
  filterDateStart,
  setFilterDateStart,
  filterDateEnd,
  setFilterDateEnd,
  clearDateFilter,
  filteredDetailTasks,
  baseDetailTasks,
  onToggleDetailedTask,
  isDarkMode,
  toggleDarkMode,
  settings,
  setSettings,
  presetColors,
  resetTheme,
  saveSettings,
  onAddTask,
  onEditTask,
  onDeleteTask,
  userId,
  onTaskUpdate,
  user,
  onLogout,
  onUserUpdate,
  onOpenReminderEditor
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col relative bg-page transition-colors duration-300">
      <div className={`flex-1 min-h-0 ${currentView === 'settings' || currentView === 'ai' || currentView === 'journal' ? 'p-0' : 'p-4 pt-8'} md:p-8 md:pt-2`}>
        {currentView === 'home' && (
          <HomeView 
            todayTasks={todayTasks} 
            onToggleTask={onToggleTask} 
            deadlines={deadlines} 
            getUrgencyClass={getUrgencyClass}
            onAddTask={onAddTask}
            onDeleteTask={onDeleteTask}
            userId={userId}
          />
        )}
        {currentView === 'detail' && (
          <DetailView
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
            onToggleDetailedTask={onToggleDetailedTask}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
          />
        )}
        {currentView === 'longterm' && (
          <LongTermView userId={userId} onTaskUpdate={onTaskUpdate} />
        )}
        {currentView === 'journal' && (
          <JournalView userId={userId} />
        )}
        {currentView === 'ai' && (
          <AiAssistantView />
        )}
        {currentView === 'settings' && (
          <SettingsView
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            settings={settings}
            setSettings={setSettings}
            presetColors={presetColors}
            resetTheme={resetTheme}
            saveSettings={saveSettings}
            user={user}
            onLogout={onLogout}
            onUserUpdate={onUserUpdate}
            onOpenReminderEditor={onOpenReminderEditor}
          />
        )}
      </div>
    </div>
  )
}
