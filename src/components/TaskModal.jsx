import React, { useState, useEffect } from 'react'

export default function TaskModal({ visible, onClose, onSave, task, currentUserId }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [tags, setTags] = useState('')
  const [recordResult, setRecordResult] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [result, setResult] = useState('')

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.desc || task.description || '')
      setDate(task.date || task.assigned_date || '')
      setStartTime(task.startTime || task.assigned_start_time || '')
      setEndTime(task.endTime || task.assigned_end_time || '')
      setTags(task.tags ? (Array.isArray(task.tags) ? task.tags.join(', ') : task.tags) : '')
      setRecordResult(task.record_result || 0)
      setDueDate(task.due_date || '')
      setResult(task.result || '')
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
    }
  }, [task, visible])

  if (!visible) return null

  const handleSubmit = () => {
    if (!title) return alert('请输入任务标题')
    
    const taskData = {
      title,
      description,
      assigned_date: date,
      assigned_start_time: startTime,
      assigned_end_time: endTime,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      record_result: recordResult,
      due_date: dueDate,
      long_term_task_id: task?.long_term_task_id || null
    }

    // 如果是编辑模式，包含结果字段
    if (task) {
      taskData.result = result
    }

    onSave(taskData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl transform transition-all flex flex-col max-h-[90vh] border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {task ? '编辑任务' : '新建任务'}
          </h2>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <i className="fa-solid fa-times text-lg"></i>
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            
            {/* Title Section */}
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

            {/* Time & Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">执行日期</label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]" 
                  />
                </div>
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

            {/* Tags & Options Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
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
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">截止时间 (Deadline)</label>
                <input 
                  type="datetime-local" 
                  value={dueDate} 
                  onChange={e => setDueDate(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]" 
                />
              </div>
            </div>
            
            {/* Description Section */}
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">任务描述</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none min-h-[100px] dark:text-white" 
                placeholder="添加任务详情描述..."
              />
            </div>

            {/* Result Description (Only for existing tasks) */}
            {task && (
              <div>
                <label className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2 block">成果总结</label>
                <textarea 
                  value={result} 
                  onChange={e => setResult(e.target.value)} 
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none min-h-[80px] dark:text-white" 
                  placeholder="记录任务完成后的成果..." 
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
            <i className="fa-solid fa-check"></i>
            保存任务
          </button>
        </div>
      </div>
    </div>
  )
}
