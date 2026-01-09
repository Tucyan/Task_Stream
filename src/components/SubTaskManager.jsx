import React, { useState, useEffect } from 'react'
import * as api from '../services/api.js'

export default function SubtaskManager({ visible, onClose, onSave, currentUserId, longTermTaskId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState({})
  const [mode, setMode] = useState('select') // 'select' (选择) 或 'create' (创建)
  
  // 新任务状态
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskDate, setNewTaskDate] = useState('')
  const [newTaskStartTime, setNewTaskStartTime] = useState('')
  const [newTaskEndTime, setNewTaskEndTime] = useState('')
  const [newTaskTags, setNewTaskTags] = useState('')
  const [newTaskRecordResult, setNewTaskRecordResult] = useState(0)
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskProportion, setNewTaskProportion] = useState(1.0) // 新任务的权重
  
  const [taskProportions, setTaskProportions] = useState({}) // 存储每个任务的比例

  useEffect(() => {
    if (visible && currentUserId) {
      fetchTasks()
      // 初始化日期为今天
      setNewTaskDate(new Date().toISOString().split('T')[0])
      setNewTaskStartTime('09:00')
      setNewTaskEndTime('10:00')
    }
  }, [visible, currentUserId])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      // 获取所有未完成的任务，排除已经关联到其他长期任务的
      const allTasks = await api.getAllTasksForUser(currentUserId)
      const unassociatedTasks = allTasks.filter(task => 
        !task.long_term_task_id && task.status !== 3 // 排除已完成和已关联的任务
      )
      setTasks(unassociatedTasks)
    } catch (error) {
      console.error('获取任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (mode === 'select') {
      // 确保 selectedTaskIds 是对象
      if (Array.isArray(selectedTaskIds)) {
        console.error('selectedTaskIds is array, converting to object');
        const convertedSelectedTaskIds = {};
        selectedTaskIds.forEach(id => {
          convertedSelectedTaskIds[id] = true;
        });
        setSelectedTaskIds(convertedSelectedTaskIds);
        return;
      }
      
      // 保存选中的任务作为子任务，包含比例信息
      console.log('selectedTaskIds type:', typeof selectedTaskIds);
      console.log('selectedTaskIds value:', selectedTaskIds);
      console.log('Array.isArray(selectedTaskIds):', Array.isArray(selectedTaskIds));
      const subtasksWithProportions = Object.keys(selectedTaskIds).filter(id => selectedTaskIds[id]).map(id => ({ 
        id, 
        mode: 'select',
        proportion: taskProportions[id] || 1.0 // 默认比例为1.0
      }))
      onSave(subtasksWithProportions)
    } else {
      // 创建新任务作为子任务
      if (newTaskTitle.trim()) {
        const newTask = {
          title: newTaskTitle,
          description: newTaskDescription,
          assigned_date: newTaskDate,
          assigned_start_time: newTaskStartTime,
          assigned_end_time: newTaskEndTime,
          tags: newTaskTags.split(',').map(t => t.trim()).filter(t => t),
          record_result: newTaskRecordResult,
          due_date: newTaskDueDate,
          mode: 'create',
          proportion: newTaskProportion // 使用设置的权重
        }
        onSave([newTask])
      } else {
        return alert('请输入任务标题');
      }
    }
    onClose()
    // 重置状态
    setSelectedTaskIds({})
    setTaskProportions({})
    setNewTaskTitle('')
    setNewTaskDescription('')
    setNewTaskDate(new Date().toISOString().split('T')[0])
    setNewTaskStartTime('09:00')
    setNewTaskEndTime('10:00')
    setNewTaskTags('')
    setNewTaskRecordResult(0)
    setNewTaskDueDate('')
    setNewTaskProportion(1.0) // 重置新任务权重
    setMode('select')
  }

  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds(prev => {
      const newSelection = { ...prev };
      if (newSelection[taskId]) {
        delete newSelection[taskId];
      } else {
        newSelection[taskId] = true;
      }
      return newSelection;
    });
  }
  
  const updateTaskProportion = (taskId, proportion) => {
    setTaskProportions(prev => ({
      ...prev,
      [taskId]: parseFloat(proportion) || 1.0
    }));
  }

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">管理子任务</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <i className="fa-solid fa-times text-xl"></i>
          </button>
        </div>

        {/* 模式切换 */}
        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-4">
          <button
            onClick={() => setMode('select')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'select' 
                ? 'bg-white dark:bg-gray-600 text-primary dark:text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            选择现有任务
          </button>
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              mode === 'create' 
                ? 'bg-white dark:bg-gray-600 text-primary dark:text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            创建新任务
          </button>
        </div>

        {/* 搜索框 - 仅在选择模式下显示 */}
        {mode === 'select' && (
          <div className="mb-4">
            <div className="relative">
              <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-400"></i>
              <input
                type="text"
                placeholder="搜索任务..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-900 dark:!text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <i className="fa-solid fa-spinner fa-spin text-primary text-xl"></i>
            </div>
          ) : mode === 'select' ? (
            <div className="space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {searchTerm ? '没有找到匹配的任务' : '没有可关联的任务'}
                </div>
              ) : (
                filteredTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => toggleTaskSelection(task.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedTaskIds[task.id]
                        ? 'bg-primary/5 dark:bg-primary/20 border-primary/30 dark:border-primary/50'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-primary/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                        selectedTaskIds[task.id]
                          ? 'bg-primary border-primary'
                          : 'border-gray-300 dark:border-gray-500'
                      }`}>
                        {selectedTaskIds[task.id] && (
                          <i className="fa-solid fa-check text-white text-xs"></i>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800 dark:text-white">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>
                        )}
                        {task.due_date && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                            <i className="fa-regular fa-calendar"></i>
                            <span>{task.due_date}</span>
                          </div>
                        )}
                        {selectedTaskIds[task.id] && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-xs text-gray-500 dark:text-gray-400">权重:</label>
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={taskProportions[task.id] || 1.0}
                                onChange={(e) => updateTaskProportion(task.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400 w-8 text-right">
                                {taskProportions[task.id] || 1.0}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* 标题区域 */}
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">任务标题 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newTaskTitle} 
                  onChange={e => setNewTaskTitle(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-lg font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500" 
                  placeholder="请输入任务标题..."
                />
              </div>

              {/* 时间和日期行 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">执行日期</label>
                  <input 
                  type="date" 
                  value={newTaskDate} 
                  onChange={e => setNewTaskDate(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-gray-900 dark:text-white dark:[color-scheme:dark]" 
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">开始时间</label>
                <input 
                  type="time" 
                  value={newTaskStartTime} 
                  onChange={e => setNewTaskStartTime(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-gray-900 dark:text-white dark:[color-scheme:dark]" 
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">结束时间</label>
                <input 
                  type="time" 
                  value={newTaskEndTime} 
                  onChange={e => setNewTaskEndTime(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-gray-900 dark:text-white dark:[color-scheme:dark]" 
                />
                </div>
              </div>

              {/* 标签区域 */}
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">标签</label>
              <div className="relative">
                <i className="fa-solid fa-tags absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-400"></i>
                <input 
                  type="text" 
                    value={newTaskTags} 
                  onChange={e => setNewTaskTags(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500" 
                  placeholder="例如: 工作, 紧急 (用逗号分隔)"
                  />
                </div>
              </div>
              
              {/* 记录成果、截止日期和权重行 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">记录成果</label>
                  <select 
                value={newTaskRecordResult} 
                onChange={e => setNewTaskRecordResult(Number(e.target.value))} 
                className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer text-gray-900 dark:text-white dark:[color-scheme:dark]"
              >
                    <option value={0}>不需要记录</option>
                    <option value={1}>需要记录</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">截止时间</label>
                  <input 
                    type="datetime-local" 
                    value={newTaskDueDate} 
                    onChange={e => setNewTaskDueDate(e.target.value)} 
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-gray-900 dark:text-white dark:[color-scheme:dark]" 
                  />
                </div>
              </div>

              {/* 权重区域 */}
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">任务权重</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={newTaskProportion}
                    onChange={(e) => setNewTaskProportion(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary"
                  />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-12 text-center bg-gray-100 dark:bg-gray-700 rounded-lg py-1">
                    {newTaskProportion}
                  </span>
                </div>
              </div>

              {/* 描述区域 */}
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">任务描述</label>
                <textarea 
                  value={newTaskDescription} 
                  onChange={e => setNewTaskDescription(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none min-h-[100px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500" 
                  placeholder="添加任务详情描述..."
                />
              </div>

            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-check"></i>
            {mode === 'select' ? '确认选择' : '创建任务'}
          </button>
        </div>
      </div>
    </div>
  )
}
