import React from 'react'

export default function DetailView({
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
  onAddTask,
  onEditTask,
  onDeleteTask
}) {
  return (
    <div className="h-full min-h-0 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h2 className="text-2xl font-bold dark:text-white">我的日程</h2>
          <p className="text-sm opacity-60 dark:text-gray-400 hidden md:block">管理您的所有任务与计划</p>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3 min-w-0">
          <div className="relative group flex-1 md:flex-none">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors"></i>
            <input type="text" value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} placeholder="搜索任务..." className="pl-10 pr-4 py-2.5 rounded-xl bg-card border border-gray-100 dark:border-gray-700 focus:ring-2 ring-primary/20 outline-none w-full md:w-64 transition-all shadow-sm dark:text-white dark:bg-gray-800" />
          </div>
          <button onClick={onAddTask} className="bg-primary text-white px-4 py-2.5 rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 transition-all flex items-center gap-2 shrink-0">
            <i className="fa-solid fa-plus"></i> <span className="hidden sm:inline">新建任务</span>
          </button>
        </div>
      </div>
      <div className="bg-card rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 p-2 rounded-xl border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
            <i className="fa-regular fa-calendar text-gray-400 dark:text-gray-300 ml-2 shrink-0"></i>
            <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full sm:w-32 text-gray-600 dark:text-gray-300 min-w-0" />
            <span className="text-gray-400 dark:text-gray-300 shrink-0">-</span>
            <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full sm:w-32 text-gray-600 dark:text-gray-300 min-w-0" />
            <button onClick={clearDateFilter} className={`text-xs text-red-400 hover:text-red-600 whitespace-nowrap px-2 border-l border-gray-300 dark:border-gray-600 ml-1 ${(filterDateStart || filterDateEnd) ? '' : 'invisible pointer-events-none'}`}>清除</button>
          </div>
        </div>
        <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-xl w-full lg:w-auto">
          <button onClick={() => setDetailFilter('all')} className={`flex-1 lg:flex-none justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${detailFilter === 'all' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <span>全部</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'all' ? 'bg-primary/10 text-primary' : ''}`}>{baseDetailTasks ? baseDetailTasks.length : 0}</span>
          </button>
          <button onClick={() => setDetailFilter('pending')} className={`flex-1 lg:flex-none justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${detailFilter === 'pending' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <span>待办</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'pending' ? 'bg-primary/10 text-primary' : ''}`}>{baseDetailTasks ? baseDetailTasks.filter(t => !t.completed).length : 0}</span>
          </button>
          <button onClick={() => setDetailFilter('completed')} className={`flex-1 lg:flex-none justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${detailFilter === 'completed' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <span>已完成</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'completed' ? 'bg-primary/10 text-primary' : ''}`}>{baseDetailTasks ? baseDetailTasks.filter(t => t.completed).length : 0}</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {filteredDetailTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <i className="fa-solid fa-clipboard-list text-4xl mb-4 opacity-20"></i>
            <p>没有找到相关任务</p>
          </div>
        )}
        {filteredDetailTasks.map((task) => (
          <div key={task.id} className="bg-card rounded-2xl p-3 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group relative overflow-hidden">
            <div className="flex gap-3">
              <div className={`mt-1 w-5 h-5 rounded-full border-2 cursor-pointer flex items-center justify-center transition-colors shrink-0 ${task.completed ? 'bg-primary border-primary' : 'border-gray-300 hover:border-primary'}`} onClick={() => onToggleDetailedTask(task.id)}>
                {task.completed && <i className="fa-solid fa-check text-white text-[10px]"></i>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <h4 className={`text-base font-bold truncate pr-2 dark:text-white ${task.completed ? 'line-through opacity-50' : ''}`}>{task.title}</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
                      {task.startTime} - {task.endTime}
                    </span>
                  </div>
                </div>
                <p className={`text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-1 ${task.completed ? 'opacity-50' : ''}`}>{task.desc}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {task.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-primary/5 text-primary rounded-md text-[10px] font-medium border border-primary/10">#{tag}</span>
                  ))}
                  <div className="ml-auto flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { console.log('点击了编辑按钮', { ...task, long_term_task_id: task.long_term_task_id }); onEditTask({ ...task, long_term_task_id: task.long_term_task_id }); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-primary text-xs">
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onClick={() => onDeleteTask(task.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500 text-xs">
                      <i className="fa-regular fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
