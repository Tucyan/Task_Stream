import React, { useState, useEffect } from 'react'

export default function LongTermTaskModal({ visible, onClose, onSave, task }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.desc || task.description || '')
      setStartDate(task.start_date || '')
      setDueDate(task.due_date || '')
    } else {
      setTitle('')
      setDescription('')
      const today = new Date().toISOString().split('T')[0]
      setStartDate(today)
      // Default to 1 month later
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      setDueDate(nextMonth.toISOString().slice(0, 16))
    }
  }, [task, visible])

  if (!visible) return null

  const handleSubmit = () => {
    if (!title) return alert('请输入目标标题')
    
    const taskData = {
      // If editing, preserve other fields first
      ...(task || {}),
      title,
      description,
      start_date: startDate,
      due_date: dueDate,
      progress: task ? task.progress : 0
    }

    onSave(taskData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md p-6 rounded-2xl shadow-2xl transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white">{task ? '编辑长期目标' : '新建长期目标'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase opacity-50 block mb-1 dark:text-gray-400">标题</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none dark:text-white" 
              placeholder="目标标题"
            />
          </div>
          
          <div>
            <label className="text-xs font-bold uppercase opacity-50 block mb-1 dark:text-gray-400">描述</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none resize-none h-20 dark:text-white" 
              placeholder="目标描述"
            />
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold uppercase opacity-50 block mb-1 dark:text-gray-400">开始日期</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none dark:text-white dark:[color-scheme:dark]" 
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold uppercase opacity-50 block mb-1 dark:text-gray-400">截止时间</label>
              <input 
                type="datetime-local" 
                value={dueDate} 
                onChange={e => setDueDate(e.target.value)} 
                className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none dark:text-white dark:[color-scheme:dark]" 
              />
            </div>
          </div>

          <button onClick={handleSubmit} className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-primary/50 hover:brightness-110 transition-all mt-4">
            保存目标
          </button>
        </div>
      </div>
    </div>
  )
}
