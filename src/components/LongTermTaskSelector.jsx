import React, { useState, useEffect } from 'react'
import * as api from '../services/api.js'

export default function LongTermTaskSelector({ visible, onClose, onSelect, currentUserId, selectedLongTermTaskId }) {
  const [longTermTasks, setLongTermTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (visible && currentUserId) {
      fetchLongTermTasks()
      setSelectedId(selectedLongTermTaskId)
    }
  }, [visible, currentUserId, selectedLongTermTaskId])

  const fetchLongTermTasks = async () => {
    setLoading(true)
    try {
      // 获取长期任务
      const tasks = await api.getAllUncompletedLongTermTasks(currentUserId)
      setLongTermTasks(tasks)
    } catch (error) {
      console.error('获取长期任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = () => {
    if (selectedId) {
      const selectedTask = longTermTasks.find(task => task.id === selectedId)
      onSelect(selectedTask)
    } else {
      onSelect(null) // 取消绑定
    }
    onClose()
  }

  const filteredTasks = longTermTasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md p-6 rounded-2xl shadow-2xl transform transition-all max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">选择长期任务</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜索长期任务..."
            className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto mb-4">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <i className="fa-solid fa-spinner fa-spin text-primary text-2xl"></i>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <i className="fa-solid fa-tasks text-4xl mb-4 opacity-20"></i>
              <p>没有找到相关的长期任务</p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="longTermTask"
                  checked={!selectedId}
                  onChange={() => setSelectedId(null)}
                  className="mr-3"
                />
                <div className="flex-1">
                  <p className="font-medium">不绑定长期任务</p>
                  <p className="text-xs text-gray-400">创建一个独立的任务</p>
                </div>
              </label>
              
              {filteredTasks.map(task => (
                <label key={task.id} className="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="longTermTask"
                    checked={selectedId === task.id}
                    onChange={() => setSelectedId(task.id)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-gray-400 line-clamp-1">{task.description}</p>
                    {task.due_date && (
                      <p className="text-xs text-gray-400 mt-1">
                        <i className="fa-regular fa-calendar mr-1"></i>
                        {new Date(task.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
            取消
          </button>
          <button onClick={handleSelect} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-lg shadow-lg hover:shadow-primary/50 hover:brightness-110 transition-all">
            确认选择
          </button>
        </div>
      </div>
    </div>
  )
}