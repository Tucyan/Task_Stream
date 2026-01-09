import React, { useState, useEffect } from 'react'
import * as api from '../services/api.js'

export default function SubtaskEditor({ visible, onClose, onSave, subtask, parentTaskId }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [tags, setTags] = useState('')
  const [recordResult, setRecordResult] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [result, setResult] = useState('')
  
  // 子任务特定状态
  const [status, setStatus] = useState(1) // 1: 未开始, 2: 进行中, 3: 已完成
  const [proportion, setProportion] = useState(1.0) // 子任务权重

  useEffect(() => {
    if (subtask) {
      setTitle(subtask.title || '')
      setDescription(subtask.desc || subtask.description || '')
      setDate(subtask.date || subtask.assigned_date || '')
      setStartTime(subtask.startTime || subtask.assigned_start_time || '')
      setEndTime(subtask.endTime || subtask.assigned_end_time || '')
      setTags(subtask.tags ? (Array.isArray(subtask.tags) ? subtask.tags.join(', ') : subtask.tags) : '')
      setRecordResult(subtask.record_result || 0)
      setDueDate(subtask.due_date || '')
      setResult(subtask.result || '')
      setStatus(subtask.status || 1)

      // 从父级任务的 sub_task_ids 获取权重
      const getProportion = async () => {
        if (parentTaskId) {
          try {
            const parentTask = await api.getLongTermTaskById(parentTaskId);
            if (parentTask && parentTask.sub_task_ids && parentTask.sub_task_ids[subtask.id]) {
              const subtaskData = parentTask.sub_task_ids[subtask.id];
              if (typeof subtaskData === 'object' && subtaskData !== null) {
                // 新格式: {weight: x, progress: y}
                setProportion(subtaskData.weight || 1.0);
              } else {
                // 旧格式: 仅权重值
                setProportion(subtaskData || 1.0);
              }
            } else {
              setProportion(1.0);
            }
          } catch (error) {
            console.error('获取子任务权重失败:', error);
            setProportion(1.0);
          }
        } else {
          setProportion(subtask.proportion || 1.0);
        }
      };
      getProportion();
    } else {
      setTitle('')
      setDescription('')
      const today = new Date().toISOString().split('T')[0]
      setDate(today)
      setStartTime('09:00')
      setEndTime('10:00')
      setTags('')
      setRecordResult(0)
      setDueDate('')
      setResult('')
      setStatus(1)
      setProportion(1.0)
    }
  }, [subtask, visible, parentTaskId])

  const handleSubmit = async () => {
    if (!title) return alert('请输入任务标题')
    
    try {
      // 获取当前任务数据以保留其他字段
      const currentTask = await api.getTaskById(subtask.id);
      
      // 使用新值更新任务
      const updatedTask = {
        ...currentTask,
        title,
        description,
        assigned_date: date,
        assigned_start_time: startTime,
        assigned_end_time: endTime,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        record_result: recordResult,
        due_date: dueDate,
        result,
        status
      };
      
      console.log('[SubtaskEditor] Saving subtask, long_term_task_id:', updatedTask.long_term_task_id);
      console.log('[SubtaskEditor] Full update data:', updatedTask);
      
      // 更新任务
      await api.updateTask(subtask.id, updatedTask);
      
      // 更新父级长期任务中的权重
      const parentTask = await api.getLongTermTaskById(parentTaskId);
      if (parentTask && parentTask.sub_task_ids) {
        const updatedSubTaskIds = { ...parentTask.sub_task_ids };
        
        // 处理旧格式和新格式数据
        if (typeof updatedSubTaskIds[subtask.id] === 'object' && updatedSubTaskIds[subtask.id] !== null) {
          // 新格式: {weight: x, progress: y}
          updatedSubTaskIds[subtask.id] = {
            ...updatedSubTaskIds[subtask.id],
            weight: proportion
          };
        } else {
          // 旧格式: 仅权重值
          updatedSubTaskIds[subtask.id] = proportion;
        }
        
        console.log('[SubtaskEditor] 更新子任务权重:', updatedSubTaskIds);
        
        await api.updateLongTermTask(parentTaskId, {
          ...parentTask,
          user_id: parentTask.user_id,
          created_at: parentTask.created_at,
          sub_task_ids: updatedSubTaskIds
        });
      }
      
      onSave && onSave();
      onClose();
    } catch (error) {
      console.error('更新子任务失败:', error);
      alert('更新子任务失败，请重试');
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl transform transition-all flex flex-col max-h-[90vh] border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* 头部 */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            编辑子任务
          </h2>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <i className="fa-solid fa-times text-lg"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            
            {/* 标题区域 */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">任务标题</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-lg font-medium dark:text-white" 
                placeholder="请输入任务标题..."
              />
            </div>

            {/* 时间和日期行 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">执行日期</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]" 
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">开始时间</label>
                <input 
                  type="time" 
                  value={startTime} 
                  onChange={e => setStartTime(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]" 
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">结束时间</label>
                <input 
                  type="time" 
                  value={endTime} 
                  onChange={e => setEndTime(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]" 
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
                  value={tags} 
                  onChange={e => setTags(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white" 
                  placeholder="例如: 工作, 紧急 (用逗号分隔)"
                />
              </div>
            </div>
            
            {/* 状态、记录成果、截止日期行 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">任务状态</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer dark:text-white"
                >
                  <option value={1}>未开始</option>
                  <option value={2}>进行中</option>
                  <option value={3}>已完成</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">记录成果</label>
                <select 
                  value={recordResult} 
                  onChange={e => setRecordResult(Number(e.target.value))} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer dark:text-white"
                >
                  <option value={0}>不需要记录</option>
                  <option value={1}>需要记录</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">截止时间</label>
                <input 
                  type="datetime-local" 
                  value={dueDate} 
                  onChange={e => setDueDate(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]" 
                />
              </div>
            </div>

            {/* 权重区域 (子任务特定) */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">任务权重</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={proportion}
                  onChange={(e) => setProportion(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary"
                />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-12 text-center bg-gray-100 dark:bg-gray-700 rounded-lg py-1">
                  {proportion}
                </span>
              </div>
            </div>
            
            {/* 描述区域 */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">任务描述</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none min-h-[100px] dark:text-white" 
                placeholder="添加任务详情描述..."
              />
            </div>

            {/* 成果总结 (仅针对现有任务) */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">成果总结</label>
              <textarea 
                value={result} 
                onChange={e => setResult(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none min-h-[80px] dark:text-white" 
                placeholder="记录任务完成后的成果..." 
              />
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-4">
          <button 
            onClick={onClose} 
            className="flex-1 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSubmit} 
            className="flex-1 px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-save"></i>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
