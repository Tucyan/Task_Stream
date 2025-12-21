import React, { useState } from 'react'
import * as api from '../services/api.js'

export default function SettingsView({ isDarkMode, toggleDarkMode, settings, setSettings, presetColors, resetTheme, saveSettings, user, onLogout, onUserUpdate, onOpenReminderEditor }) {
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isAccountOpen, setIsAccountOpen] = useState(false)

  const handleUpdateNickname = async () => {
    if (!nickname.trim()) {
      setError('昵称不能为空')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.updateNickname(user.id, nickname)
      const updatedUser = { ...user, nickname: nickname }
      const savedUser = localStorage.getItem('taskStreamUser')
      if (savedUser) {
        const userInfo = JSON.parse(savedUser)
        userInfo.nickname = nickname
        localStorage.setItem('taskStreamUser', JSON.stringify(userInfo))
      }
      if (onUserUpdate) onUserUpdate(updatedUser)
      setSuccess('昵称更新成功')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || '更新昵称失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      setError('请输入当前密码和新密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.updatePassword(user.id, currentPassword, newPassword)
      setSuccess('密码更新成功')
      setCurrentPassword('')
      setNewPassword('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || '更新密码失败')
    } finally {
      setLoading(false)
    }
  }
  
  const handleColorChange = (key, value) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    // Debouncing could be added here, but for now let's rely on onBlur or just saving on discrete actions
  }

  const handleColorBlur = () => {
    saveSettings(settings)
  }

  const handlePresetColor = (color) => {
    const newSettings = { ...settings, primary: color }
    setSettings(newSettings)
    saveSettings(newSettings)
  }

  return (
    <div className="max-w-4xl mx-auto h-full min-h-0 flex flex-col">
      <div className="bg-card md:rounded-3xl rounded-none shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="p-6 md:p-8 border-b border-gray-100 dark:border-gray-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold mb-2 dark:text-white">个性化设置</h2>
            <p className="text-sm opacity-60 dark:text-gray-400">定制属于你的 Task Stream 视觉体验</p>
          </div>
          <button
            onClick={onOpenReminderEditor}
            className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center hover:bg-yellow-500/10 dark:hover:bg-yellow-500/10 transition-colors border border-transparent hover:border-yellow-500/20"
            title="提醒设置"
            type="button"
          >
            <i className="fa-solid fa-bell text-yellow-500"></i>
          </button>
        </div>
        <div className="md:p-8 p-0 space-y-6 md:space-y-10 flex-1 min-h-0 overflow-y-auto pr-2">
          {/* 移动端专用的用户设置区域 */}
          <section className="md:hidden bg-primary/5 md:rounded-2xl rounded-none border-y md:border border-primary/10 dark:border-gray-700 overflow-hidden">
            <h3 
              className="font-bold p-6 flex items-center justify-between cursor-pointer dark:text-white hover:bg-primary/5 transition-colors"
              onClick={() => setIsAccountOpen(!isAccountOpen)}
            >
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-user-gear"></i> 账户设置
              </span>
              <i className={`fa-solid fa-chevron-down transition-transform duration-300 ${isAccountOpen ? 'rotate-180' : ''}`}></i>
            </h3>
            
            {isAccountOpen && (
              <div className="space-y-6 px-6 pb-6">
                <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">用户名</div>
                <div className="font-medium dark:text-white flex justify-between items-center">
                  {user?.username}
                  <button onClick={onLogout} className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100">退出登录</button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-300">修改昵称</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={nickname} 
                    onChange={e => setNickname(e.target.value)} 
                    placeholder="输入新昵称"
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  />
                  <button 
                    onClick={handleUpdateNickname}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    更新
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-300">修改密码</label>
                <input 
                  type="password" 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)} 
                  placeholder="当前密码"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none dark:text-white mb-2"
                />
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    placeholder="新密码"
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  />
                  <button 
                    onClick={handleUpdatePassword}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    修改
                  </button>
                </div>
              </div>

              {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
              {success && <div className="text-green-500 text-sm bg-green-50 p-2 rounded">{success}</div>}
            </div>
          )}
          </section>

          <section className="px-6 md:px-0">
            <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><i className="fa-solid fa-moon"></i> 明暗模式</h3>
            <div className="flex gap-4">
              <button onClick={() => toggleDarkMode(false)} className={`flex-1 p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-center gap-2 dark:text-gray-800 ${!isDarkMode ? 'ring-2 ring-primary' : ''}`}>
                <i className="fa-regular fa-sun"></i> 浅色 (Light)
              </button>
              <button onClick={() => toggleDarkMode(true)} className={`flex-1 p-4 rounded-xl border border-gray-700 bg-gray-800 text-white hover:bg-gray-700 transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'ring-2 ring-primary' : ''}`}>
                <i className="fa-solid fa-moon"></i> 深色 (Dark)
              </button>
            </div>
          </section>
          <section className="px-6 md:px-0">
            <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><i className="fa-solid fa-palette"></i> 强调色 (Accent Color)</h3>
            <div className="flex gap-4 flex-wrap">
              {presetColors.map((color) => (
                <div key={color} onClick={() => handlePresetColor(color)} className="w-12 h-12 rounded-full cursor-pointer shadow-sm flex items-center justify-center transition-transform hover:scale-110" style={{ backgroundColor: color }}>
                  {settings.primary === color && <i className="fa-solid fa-check text-white text-lg drop-shadow-md"></i>}
                </div>
              ))}
            </div>
          </section>
          <section className="bg-gray-50 dark:bg-gray-800/50 p-6 md:rounded-2xl rounded-none border-y md:border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold mb-6 flex items-center justify-between dark:text-white">
              <span className="flex items-center gap-2"><i className="fa-solid fa-sliders"></i> 高级自定义设置</span>
              <span className="text-xs font-normal bg-primary text-white px-2 py-1 rounded">PRO</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <span className="text-sm font-medium dark:text-gray-200">强调色 (Primary)</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono opacity-50 dark:text-gray-400">{settings.primary}</span>
                  <input type="color" value={settings.primary} onChange={(e) => handleColorChange('primary', e.target.value)} onBlur={handleColorBlur} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <span className="text-sm font-medium dark:text-gray-200">背景色 (Background)</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono opacity-50 dark:text-gray-400">{settings.bg}</span>
                  <input type="color" value={settings.bg} onChange={(e) => handleColorChange('bg', e.target.value)} onBlur={handleColorBlur} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <span className="text-sm font-medium dark:text-gray-200">卡片色 (Card)</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono opacity-50 dark:text-gray-400">{settings.card}</span>
                  <input type="color" value={settings.card} onChange={(e) => handleColorChange('card', e.target.value)} onBlur={handleColorBlur} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                <span className="text-sm font-medium dark:text-gray-200">文字色 (Text)</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono opacity-50 dark:text-gray-400">{settings.text}</span>
                  <input type="color" value={settings.text} onChange={(e) => handleColorChange('text', e.target.value)} onBlur={handleColorBlur} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={resetTheme} className="text-sm text-red-400 hover:text-red-500 underline">恢复默认主题</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
