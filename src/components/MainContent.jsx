import React from 'react'
import HomeView from '../views/HomeView.jsx'
import DetailView from '../views/DetailView.jsx'
import LongTermView from '../views/LongTermView.jsx'
import JournalView from '../views/JournalView.jsx'
import AiAssistantView from '../views/AiAssistantView.jsx'
import SettingsView from '../views/SettingsView.jsx'

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
  onUserUpdate
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col relative bg-page transition-colors duration-300">
      <div className={`flex-1 min-h-0 ${currentView === 'settings' ? 'p-0' : 'p-4 pt-8'} md:p-8 md:pt-2`}>
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
          />
        )}
      </div>
    </div>
  )
}
