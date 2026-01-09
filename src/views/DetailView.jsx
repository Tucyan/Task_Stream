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
    <div className="h-full min-h-0 flex flex-col gap-4 md:gap-6 max-w-7xl mx-auto w-full">
      {/* 桌面端头部 - 移动端隐藏，大屏显示 */}
      <div className="hidden sm:flex sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold dark:text-white">每日任务</h2>
        <div className="flex items-center gap-3">
          {/* 搜索 - 桌面端 */}
          <div className="relative group flex-none">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors"></i>
            <input 
              type="text" 
              value={detailSearch} 
              onChange={(e) => setDetailSearch(e.target.value)} 
              placeholder="搜索任务..." 
              className="pl-10 pr-4 py-2.5 rounded-xl bg-card border border-gray-100 dark:border-gray-700 focus:ring-2 ring-primary/20 outline-none w-64 transition-all shadow-sm dark:text-white dark:bg-gray-800" 
            />
          </div>
          <button onClick={onAddTask} className="bg-primary text-white px-4 py-2.5 rounded-lg shadow-lg shadow-primary/30 hover:brightness-110 transition-all flex items-center gap-2 shrink-0">
            <i className="fa-solid fa-plus"></i>
            <span>新建任务</span>
          </button>
        </div>
      </div>

      {/* 移动端搜索栏 - 在移动端显示，集成添加按钮 */}
      <div className="sm:hidden flex items-center gap-2">
        <div className="relative group flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors"></i>
          <input 
            type="text" 
            value={detailSearch} 
            onChange={(e) => setDetailSearch(e.target.value)} 
            placeholder="搜索每日任务..." 
            className="pl-10 pr-4 py-2.5 rounded-xl bg-card border border-gray-100 dark:border-gray-700 focus:ring-2 ring-primary/20 outline-none w-full transition-all shadow-sm dark:text-white dark:bg-gray-800" 
          />
        </div>
        <button onClick={onAddTask} className="bg-primary text-white px-3 py-2.5 rounded-lg shadow-lg shadow-primary/30 hover:brightness-110 transition-all flex items-center gap-2 shrink-0">
          <i className="fa-solid fa-plus"></i>
        </button>
      </div>

      {/* 筛选区域 */}
      <div className="bg-card rounded-xl md:rounded-2xl p-3 md:p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
        {/* 日期筛选 - 在宽屏中左对齐 */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 p-2 rounded-lg border border-gray-200 dark:border-gray-700 w-full sm:w-96 sm:mr-auto">
          <i className="fa-regular fa-calendar text-gray-400 dark:text-gray-300 ml-2 shrink-0"></i>
          <input 
            type="date" 
            value={filterDateStart} 
            onChange={(e) => setFilterDateStart(e.target.value)} 
            className="bg-transparent border-none outline-none text-sm flex-1 text-gray-600 dark:text-gray-300 min-w-0" 
          />
          <span className="text-gray-400 dark:text-gray-300 shrink-0 text-xs">至</span>
          <input 
            type="date" 
            value={filterDateEnd} 
            onChange={(e) => setFilterDateEnd(e.target.value)} 
            className="bg-transparent border-none outline-none text-sm flex-1 text-gray-600 dark:text-gray-300 min-w-0" 
          />
          <button 
            onClick={clearDateFilter} 
            className={`text-xs text-red-400 hover:text-red-600 whitespace-nowrap px-2 border-l border-gray-300 dark:border-gray-600 ml-1 ${(filterDateStart || filterDateEnd) ? '' : 'invisible pointer-events-none'}`}
          >
            清除
          </button>
        </div>
        
        {/* 状态筛选 - 在宽屏中右对齐 */}
        <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-lg w-full sm:w-80 sm:ml-auto">
          <button 
            onClick={() => setDetailFilter('all')} 
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${detailFilter === 'all' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <span>全部</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'all' ? 'bg-primary/10 text-primary' : ''}`}>
              {baseDetailTasks ? baseDetailTasks.length : 0}
            </span>
          </button>
          <button 
            onClick={() => setDetailFilter('pending')} 
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${detailFilter === 'pending' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <span>待办</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'pending' ? 'bg-primary/10 text-primary' : ''}`}>
              {baseDetailTasks ? baseDetailTasks.filter(t => !t.completed).length : 0}
            </span>
          </button>
          <button 
            onClick={() => setDetailFilter('completed')} 
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1 ${detailFilter === 'completed' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <span>已完成</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'completed' ? 'bg-primary/10 text-primary' : ''}`}>
              {baseDetailTasks ? baseDetailTasks.filter(t => t.completed).length : 0}
            </span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 md:space-y-6">
        {filteredDetailTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <i className="fa-solid fa-clipboard-list text-4xl mb-4 opacity-20"></i>
            <p>没有找到相关任务</p>
          </div>
        )}
        {filteredDetailTasks.map((task) => (
          <div key={task.id} className="bg-card rounded-xl md:rounded-2xl p-2.5 md:p-3 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group relative overflow-hidden">
            <div className="flex gap-2 md:gap-3">
              <div className={`mt-1 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 cursor-pointer flex items-center justify-center transition-colors shrink-0 ${task.completed ? 'bg-primary border-primary' : 'border-gray-300 hover:border-primary'}`} onClick={() => onToggleDetailedTask(task.id)}>
                {task.completed && <i className="fa-solid fa-check text-white text-[8px] md:text-[10px]"></i>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1 gap-1">
                  <h4 className={`text-sm md:text-base font-bold pr-2 dark:text-white ${task.completed ? 'line-through opacity-50' : ''}`}>{task.title}</h4>

                </div>
                <p className={`text-xs text-gray-500 dark:text-gray-400 mb-1 md:mb-2 line-clamp-1 md:line-clamp-2 ${task.completed ? 'opacity-50' : ''}`}>{task.desc}</p>
                <div className="flex flex-wrap items-center gap-1 md:gap-2">
                  {task.tags.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 md:px-2 md:py-0.5 bg-primary/5 text-primary rounded text-[9px] md:text-[10px] font-medium border border-primary/10">#{tag}</span>
                  ))}
                  <div className="ml-auto flex gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { console.log('点击了编辑按钮', { ...task, long_term_task_id: task.long_term_task_id }); onEditTask({ ...task, long_term_task_id: task.long_term_task_id }); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-primary text-[10px] md:text-xs">
                      <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onClick={() => onDeleteTask(task.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500 text-[10px] md:text-xs">
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
