import React, { useState, useEffect, useMemo } from 'react'
import * as api from '../services/api.js'
import LongTermTaskModal from '../components/LongTermTaskModal.jsx'
import SubtaskManager from '../components/SubTaskManager.jsx'
import SubtaskEditor from '../components/SubtaskEditor.jsx'
import taskEventBus from '../utils/eventBus.js'

export default function LongTermView({ userId, onTaskUpdate }) {
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [detailFilter, setDetailFilter] = useState('all')
  const [detailSearch, setDetailSearch] = useState('')
  const [expandedTasks, setExpandedTasks] = useState({})
  
  const [longTermTasks, setLongTermTasks] = useState([])

  // Modal State
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  
  // Subtask Manager State
  const [showSubtaskManager, setShowSubtaskManager] = useState(false)
  const [currentLongTermTaskId, setCurrentLongTermTaskId] = useState(null)
  const [showSubtaskEditor, setShowSubtaskEditor] = useState(false)
  const [editingSubtask, setEditingSubtask] = useState(null)

  const fetchTasks = () => {
      api.getAllLongTermTasks(userId)
        .then(tasks => {
            const mapped = tasks.map(t => ({
                id: t.id,
                title: t.title,
                desc: t.description,
                start_date: t.start_date,
                due_date: t.due_date,
                progress: t.progress * 100,
                tags: [],
                completed: t.progress === 1.0,
                sub_task_ids: t.sub_task_ids || {}, // Ensure sub_task_ids is a dictionary
                user_id: t.user_id, // 添加 user_id 字段
                created_at: t.created_at, // 添加 created_at 字段
                subTasks: t.subtasks.map(st => ({
                    ...st, // Keep all fields
                    completed: st.status === 3
                }))
            }));
            setLongTermTasks(mapped);
        })
        .catch(console.error);
  }

  useEffect(() => {
      fetchTasks();
  }, [userId]);

  const baseFilteredTasks = useMemo(() => {
    return longTermTasks.filter(task => {
      // 1. Search Filter
      if (detailSearch) {
        const searchLower = detailSearch.toLowerCase()
        const matchesTitle = task.title.toLowerCase().includes(searchLower)
        const matchesDesc = (task.desc || '').toLowerCase().includes(searchLower)
        if (!matchesTitle && !matchesDesc) return false
      }

      // 2. Date Filter (Based on start_date)
      if (filterDateStart) {
        if (!task.start_date || task.start_date < filterDateStart) return false
      }
      if (filterDateEnd) {
        if (!task.start_date || task.start_date > filterDateEnd) return false
      }

      return true
    })
  }, [longTermTasks, detailSearch, filterDateStart, filterDateEnd])

  const displayTasks = useMemo(() => {
    return baseFilteredTasks.filter(task => {
       if (detailFilter === 'pending' && task.completed) return false
       if (detailFilter === 'completed' && !task.completed) return false
       return true
    })
  }, [baseFilteredTasks, detailFilter])

  const toggleExpand = (id) => {
    setExpandedTasks(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const toggleSubTask = async (subTaskId) => {
       let parentTaskIndex = -1;
       let subTaskIndex = -1;
       
       // Use displayTasks to find the task, but we need to update longTermTasks state
       longTermTasks.some((t, i) => {
           const sIndex = t.subTasks.findIndex(s => s.id === subTaskId);
           if(sIndex !== -1) {
               parentTaskIndex = i;
               subTaskIndex = sIndex;
               return true;
           }
           return false;
       });

       if(parentTaskIndex !== -1 && subTaskIndex !== -1) {
           const parent = longTermTasks[parentTaskIndex];
           const sub = parent.subTasks[subTaskIndex];
           const newStatus = sub.completed ? 0 : 3; // 0 for incomplete, 3 for complete
           
           // Optimistic update
           const newSub = { ...sub, completed: !sub.completed, status: newStatus };
           const newSubTasks = [...parent.subTasks];
           newSubTasks[subTaskIndex] = newSub;
           
           const newParent = { ...parent, subTasks: newSubTasks };
           const newLongTermTasks = [...longTermTasks];
           newLongTermTasks[parentTaskIndex] = newParent;
           
           setLongTermTasks(newLongTermTasks);
           
           try {
               // 获取任务的完整信息
               const existingTask = await api.getTaskById(sub.id);
               
               // Update the subtask status - backend will automatically calculate and update the parent's progress
               await api.updateTask(sub.id, { 
                 ...existingTask,
                 status: newStatus 
               });
               
               // After successfully updating the subtask, refresh tasks to get the latest state
               fetchTasks();
               // 发布任务更新事件，通知其他视图刷新
               taskEventBus.emit('task-updated');
               onTaskUpdate && onTaskUpdate();
           } catch (err) {
               console.error("Failed to update subtask", err);
               // Revert local state on failure
               setLongTermTasks(longTermTasks);
           }
       }
   }

   // CRUD Handlers
   const handleAddTask = () => {
     setEditingTask(null)
     setShowModal(true)
   }
   
   // Subtask Management Handlers
   const handleAddSubtask = (longTermTaskId) => {
    setCurrentLongTermTaskId(longTermTaskId)
    setShowSubtaskManager(true)
  }

  const handleEditSubtask = async (subtaskId, parentTaskId) => {
    try {
      // Get the subtask data
      const subtask = await api.getTaskById(subtaskId);
      if (subtask) {
        // Set the subtask data for editing
        setEditingSubtask({
          ...subtask,
          parentTaskId: parentTaskId
        });
        setShowSubtaskEditor(true);
      }
    } catch (error) {
      console.error('获取子任务信息失败:', error);
    }
  }

  const handleDeleteSubtask = async (subtaskId, parentTaskId) => {
    if (window.confirm('确定要删除这个子任务吗？')) {
      try {
        // Get the parent long-term task
        const parentTask = longTermTasks.find(t => t.id === parentTaskId);
        
        // Remove the association with the long-term task by setting long_term_task_id to null
        await api.updateTask(subtaskId, {
          ...await api.getTaskById(subtaskId),
          long_term_task_id: null
        });
        
        // Update the sub_task_ids in the parent long-term task
        if (parentTask && parentTask.sub_task_ids) {
          const updatedSubTaskIds = { ...parentTask.sub_task_ids };
          delete updatedSubTaskIds[subtaskId];
          
          await api.updateLongTermTask(parentTaskId, {
            ...parentTask,
            user_id: parentTask.user_id,
            created_at: parentTask.created_at,
            sub_task_ids: updatedSubTaskIds
          });
        }
        
        // Refresh tasks to update the UI
        fetchTasks();
        // 发布任务更新事件，通知其他视图刷新
        taskEventBus.emit('task-updated');
        onTaskUpdate && onTaskUpdate();
      } catch (error) {
        console.error('删除子任务失败:', error);
      }
    }
  }
   
   const handleSaveSubtasks = async (subtasks) => {
     try {
       // 获取当前长期任务的子任务ID和权重信息
       const currentLongTermTask = longTermTasks.find(t => t.id === currentLongTermTaskId);
       const currentSubTaskIds = currentLongTermTask ? currentLongTermTask.sub_task_ids || {} : {};
       
       // Process each subtask
       for (const subtask of subtasks) {
         if (subtask.mode === 'select') {
           // 获取现有任务的完整信息
           const existingTask = await api.getTaskById(subtask.id);
           
           // Associate existing task with the long-term task
           const taskToUpdate = { 
             ...existingTask,
             long_term_task_id: currentLongTermTaskId 
           };
           
           console.log('[LongTermView] Updating existing subtask with long_term_task_id:', currentLongTermTaskId);
           console.log('[LongTermView] Update task data:', taskToUpdate);
           
           await api.updateTask(subtask.id, taskToUpdate);
           
           // 更新子任务权重信息 - 新格式: {"task_id": weight}
           currentSubTaskIds[subtask.id] = subtask.proportion || 1.0;
         } else if (subtask.mode === 'create') {
           // Create new task and associate it with the long-term task
          const newTask = {
            title: subtask.title,
            description: subtask.description,
            assigned_date: subtask.assigned_date,
            assigned_start_time: subtask.assigned_start_time,
            assigned_end_time: subtask.assigned_end_time,
            tags: subtask.tags,
            record_result: subtask.record_result,
            due_date: subtask.due_date,
            long_term_task_id: currentLongTermTaskId,
            user_id: userId,
            status: 1 // Set initial status to "Not Started"
          };
           
           console.log('[LongTermView] Creating new subtask with long_term_task_id:', currentLongTermTaskId);
           console.log('[LongTermView] New task data:', newTask);
           
           const createdTask = await api.createTask(newTask);
           
           // 更新子任务权重信息 - 新格式: {"task_id": weight}
           currentSubTaskIds[createdTask.id] = subtask.proportion || 1.0;
         }
       }
       
       // 更新长期任务的子任务ID和权重信息 - 新格式: {"task_id": weight}
       await api.updateLongTermTask(currentLongTermTaskId, {
         ...currentLongTermTask,
         user_id: userId,  // 确保包含user_id
         created_at: currentLongTermTask.created_at || new Date().toISOString(),  // 确保包含created_at
         sub_task_ids: currentSubTaskIds
       });
       
       // Refresh the tasks to show the updated subtasks
       fetchTasks();
       // 发布任务更新事件，通知其他视图刷新
       taskEventBus.emit('task-updated');
       onTaskUpdate && onTaskUpdate();
     } catch (error) {
       console.error('保存子任务失败:', error);
     }
   }

   const handleEditTask = (task) => {
     setEditingTask(task)
     setShowModal(true)
   }

   const handleDeleteTask = (taskId) => {
     if (window.confirm('确定要删除这个长期目标吗？')) {
       api.deleteLongTermTask(taskId)
         .then(() => {
           fetchTasks()
           // 发布任务更新事件，通知其他视图刷新
           taskEventBus.emit('task-updated');
           onTaskUpdate && onTaskUpdate();
         })
         .catch(console.error)
     }
   }

   const handleSaveTask = (taskData) => {
     if (editingTask) {
       // Ensure sub_task_ids is a dictionary if it exists
       const updatedTaskData = {
         ...taskData,
         sub_task_ids: taskData.sub_task_ids || {}
       };
       
       // 添加日志以查看sub_task_ids的内容
       console.log('[LongTermView] 保存长期任务，sub_task_ids:', updatedTaskData.sub_task_ids);
       console.log('[LongTermView] sub_task_ids类型:', typeof updatedTaskData.sub_task_ids);
       console.log('[LongTermView] sub_task_ids字符串:', JSON.stringify(updatedTaskData.sub_task_ids));
       
       api.updateLongTermTask(editingTask.id, { ...editingTask, ...updatedTaskData, user_id: userId, created_at: editingTask.created_at || new Date().toISOString() })
         .then(() => {
           fetchTasks()
           // 发布任务更新事件，通知其他视图刷新
           taskEventBus.emit('task-updated');
           onTaskUpdate && onTaskUpdate();
         })
         .catch(console.error)
     } else {
       // For new tasks, initialize with empty dictionary for sub_task_ids
       const newTaskData = {
         ...taskData,
         sub_task_ids: {}
       };
       
       // 添加日志以查看sub_task_ids的内容
       console.log('[LongTermView] 创建长期任务，sub_task_ids:', newTaskData.sub_task_ids);
       console.log('[LongTermView] sub_task_ids类型:', typeof newTaskData.sub_task_ids);
       console.log('[LongTermView] sub_task_ids字符串:', JSON.stringify(newTaskData.sub_task_ids));
       
       api.createLongTermTask({ ...newTaskData, user_id: userId })
         .then(() => {
           fetchTasks()
           // 发布任务更新事件，通知其他视图刷新
           taskEventBus.emit('task-updated');
           onTaskUpdate && onTaskUpdate();
         })
         .catch(console.error)
     }
   }

  return (
    <div className="h-full min-h-0 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Filter Section - Consistent with DetailView */}
      <div className="flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h2 className="text-2xl font-bold dark:text-white">长期任务</h2>
          <p className="text-sm opacity-60 dark:text-gray-400 hidden md:block">规划您的长远目标与里程碑</p>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3 min-w-0">
          <div className="relative group flex-1 md:flex-none">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors"></i>
            <input type="text" value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} placeholder="搜索任务..." className="pl-10 pr-4 py-2.5 rounded-xl bg-card border border-gray-100 dark:border-gray-700 focus:ring-2 ring-primary/20 outline-none w-full md:w-64 transition-all shadow-sm dark:text-white dark:bg-gray-800" />
          </div>
          <button onClick={handleAddTask} className="bg-primary text-white px-4 py-2.5 rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 transition-all flex items-center gap-2 shrink-0">
            <i className="fa-solid fa-plus"></i> <span className="hidden sm:inline">新建目标</span>
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
            <button onClick={() => {setFilterDateStart(''); setFilterDateEnd('')}} className={`text-xs text-red-400 hover:text-red-600 whitespace-nowrap px-2 border-l border-gray-300 dark:border-gray-600 ml-1 ${(filterDateStart || filterDateEnd) ? '' : 'invisible pointer-events-none'}`}>清除</button>
          </div>
        </div>
        <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-xl w-full lg:w-auto">
          <button onClick={() => setDetailFilter('all')} className={`flex-1 lg:flex-none justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${detailFilter === 'all' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <span>全部</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'all' ? 'bg-primary/10 text-primary' : ''}`}>{baseFilteredTasks.length}</span>
          </button>
          <button onClick={() => setDetailFilter('pending')} className={`flex-1 lg:flex-none justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${detailFilter === 'pending' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <span>进行中</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'pending' ? 'bg-primary/10 text-primary' : ''}`}>{baseFilteredTasks.filter(t => !t.completed).length}</span>
          </button>
          <button onClick={() => setDetailFilter('completed')} className={`flex-1 lg:flex-none justify-center px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${detailFilter === 'completed' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            <span>已达成</span>
            <span className={`bg-gray-200 dark:bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full ${detailFilter === 'completed' ? 'bg-primary/10 text-primary' : ''}`}>{baseFilteredTasks.filter(t => t.completed).length}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {displayTasks.map((task) => (
          <div key={task.id} className="bg-card rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group relative overflow-hidden">
            <div className="flex gap-4">
               {/* Progress Circle/Icon */}
              <div className="mt-1 w-10 h-10 rounded-full border-4 border-gray-100 dark:border-gray-600 flex items-center justify-center shrink-0 relative">
                 <svg className="w-full h-full absolute inset-0 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-100 dark:text-gray-600"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="text-primary transition-all duration-1000 ease-out"
                      strokeDasharray={`${task.progress}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                 </svg>
                 <span className="text-[10px] font-bold text-primary">{Math.round(task.progress)}%</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className={`text-lg font-bold dark:text-white ${task.completed ? 'line-through opacity-50' : ''}`}>{task.title}</h4>
                    <p className={`text-sm text-gray-500 dark:text-gray-400 line-clamp-1 ${task.completed ? 'opacity-50' : ''}`}>{task.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                      <button onClick={() => handleEditTask(task)} className="w-8 h-8 rounded-full hover:bg-gray-50 dark:hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-primary transition-all" title="编辑">
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button onClick={() => handleDeleteTask(task.id)} className="w-8 h-8 rounded-full hover:bg-gray-50 dark:hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all" title="删除">
                        <i className="fa-regular fa-trash-can"></i>
                      </button>
                    </div>
                    <button 
                      onClick={() => toggleExpand(task.id)}
                      className={`w-8 h-8 rounded-full bg-gray-50 dark:bg-black/20 flex items-center justify-center text-gray-500 hover:text-primary hover:bg-primary/10 transition-all ${expandedTasks[task.id] ? 'rotate-180' : ''}`}
                    >
                      <i className="fa-solid fa-chevron-down"></i>
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {task.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-primary/5 text-primary rounded-md text-[10px] font-medium border border-primary/10">#{tag}</span>
                  ))}
                </div>

                {/* Subtasks Section - Expandable */}
                <div className={`grid transition-all duration-300 ease-in-out ${expandedTasks[task.id] ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <div className="bg-gray-50 dark:bg-black/20 rounded-xl p-3 space-y-2">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">子任务清单</div>
                        {task.subTasks.map(sub => (
                            <div key={sub.id} className="group/sub flex items-center gap-3 p-2 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary/30 transition-all">
                                <div 
                                  onClick={() => toggleSubTask(sub.id)}
                                  className={`w-4 h-4 rounded border cursor-pointer flex items-center justify-center transition-colors ${sub.completed ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-600 hover:border-primary'}`}
                                >
                                    {sub.completed && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                                </div>
                                <div className="flex-1">
                                    <span className={`text-sm ${sub.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{sub.title}</span>
                                    {task.sub_task_ids && task.sub_task_ids[sub.id] && (
                                        <span className="ml-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                                            权重: {task.sub_task_ids[sub.id]}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => handleEditSubtask(sub.id, task.id)}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-primary transition-colors text-xs"
                                    title="编辑"
                                  >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteSubtask(sub.id, task.id)}
                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-500 transition-colors text-xs"
                                    title="删除"
                                  >
                                    <i className="fa-regular fa-trash-can"></i>
                                  </button>
                                </div>
                            </div>
                        ))}
                         <button 
                           onClick={() => handleAddSubtask(task.id)}
                           className="w-full py-2 text-xs text-gray-400 hover:text-primary border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1"
                         >
                            <i className="fa-solid fa-plus"></i> 添加子任务
                        </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        ))}
      </div>
      
      <LongTermTaskModal 
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveTask}
        task={editingTask}
      />
      
      <SubtaskManager
        visible={showSubtaskManager}
        onClose={() => setShowSubtaskManager(false)}
        onSave={handleSaveSubtasks}
        currentUserId={userId}
        longTermTaskId={currentLongTermTaskId}
      />
      
      <SubtaskEditor
        visible={showSubtaskEditor}
        onClose={() => setShowSubtaskEditor(false)}
        onSave={() => {
          fetchTasks();
          // 发布任务更新事件，通知其他视图刷新
          taskEventBus.emit('task-updated');
          onTaskUpdate && onTaskUpdate();
        }}
        subtask={editingSubtask}
        parentTaskId={editingSubtask?.parentTaskId}
      />
    </div>
  )
}
