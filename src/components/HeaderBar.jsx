import React, { useState, useEffect } from 'react'
import * as api from '../services/api.js'

export default function HeaderBar({ pageTitle, onLogout, user, onUserUpdate }) {
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)  // 控制下拉菜单显示
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // 添加初始化日志
  useEffect(() => {
    console.log('[HeaderBar初始化] 组件初始化');
    console.log('[HeaderBar初始化] 用户信息:', user);
    console.log('[HeaderBar初始化] 初始昵称:', nickname);
  }, [user, nickname]);

  // 更新昵称
  const handleUpdateNickname = async () => {
    console.log('[昵称更新] 开始更新昵称流程')
    console.log('[昵称更新] 当前用户信息:', user)
    console.log('[昵称更新] 输入的昵称:', nickname)
    
    if (!nickname.trim()) {
      console.log('[昵称更新] 昵称为空，更新失败')
      setError('昵称不能为空')
      return
    }
    
    console.log('[昵称更新] 昵称验证通过，开始发送API请求')
    setLoading(true)
    setError('')
    try {
      console.log('[昵称更新] 发送请求参数:', { userId: user.id, nickname })
      await api.updateNickname(user.id, nickname)
      console.log('[昵称更新] API请求成功')
      
      // 更新本地用户信息和localStorage
      const updatedUser = { ...user, nickname: nickname }
      console.log('[昵称更新] 更新本地用户信息:', updatedUser)
      
      // 更新localStorage中的用户信息
      const savedUser = localStorage.getItem('taskStreamUser')
      if (savedUser) {
        const userInfo = JSON.parse(savedUser)
        userInfo.nickname = nickname
        localStorage.setItem('taskStreamUser', JSON.stringify(userInfo))
        console.log('[昵称更新] 更新localStorage中的用户信息')
      }
      
      // 通知父组件用户信息已更新
      if (onUserUpdate) {
        console.log('[昵称更新] 通知父组件用户信息已更新')
        onUserUpdate(updatedUser)
      }
      
      setSuccess('昵称更新成功')
      // 3秒后清除成功消息
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      console.error('[昵称更新] API请求失败:', e)
      console.error('[昵称更新] 错误详情:', e.message)
      setError(e.message || '更新昵称失败')
    } finally {
      setLoading(false)
      console.log('[昵称更新] 更新流程结束')
    }
  }

  // 更新密码
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
      // 3秒后清除成功消息
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || '更新密码失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="h-16 px-8 flex items-center justify-between z-10">
        <div className="text-lg font-medium opacity-80 dark:text-white dark:opacity-100">{pageTitle}</div>
        <div className="flex items-center gap-6">
          <div className="relative">
            <button 
              className="flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 rounded-full transition-all"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <span className="text-sm font-medium dark:text-white">{user?.nickname || user?.username || '用户'}</span>
              <i className="fa-solid fa-chevron-down text-xs opacity-50 dark:text-gray-400"></i>
            </button>
            {showDropdown && (
              <div 
                className="absolute right-0 top-full mt-2 w-48 bg-card rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2"
                onMouseEnter={() => setShowDropdown(true)}
                onMouseLeave={() => setShowDropdown(false)}
              >
                <button 
                  onClick={() => {
                    setShowProfileModal(true)
                    setShowDropdown(false)
                  }}
                  className="block w-full text-left px-3 py-2 rounded-lg hover:bg-primary/10 hover:text-primary text-sm dark:text-gray-200"
                >
                  账户设置
                </button>
                <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                <button 
                  onClick={() => {
                    onLogout()
                    setShowDropdown(false)
                  }} 
                  className="block w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-500 text-sm"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 账户设置弹窗 */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md p-8 rounded-2xl shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold dark:text-white">账户设置</h2>
              <button 
                onClick={() => {
                  setShowProfileModal(false)
                  setError('')
                  setSuccess('')
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* 用户信息显示 */}
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">用户名</div>
                <div className="font-medium dark:text-white">{user?.username}</div>
              </div>

              {/* 昵称修改 */}
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-300">昵称</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={nickname} 
                    onChange={e => {
                      console.log('[昵称输入] 用户输入昵称:', e.target.value);
                      setNickname(e.target.value);
                    }} 
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  />
                  <button 
                    onClick={handleUpdateNickname}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? '更新中...' : '更新'}
                  </button>
                </div>
              </div>

              {/* 密码修改 */}
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-300">修改密码</label>
                <input 
                  type="password" 
                  value={currentPassword} 
                  onChange={e => setCurrentPassword(e.target.value)} 
                  placeholder="当前密码"
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none dark:text-white"
                />
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="新密码"
                  className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none dark:text-white"
                />
                <button 
                  onClick={handleUpdatePassword}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? '更新中...' : '修改密码'}
                </button>
              </div>

              {/* 错误和成功消息 */}
              {error && <div className="text-red-500 text-sm">{error}</div>}
              {success && <div className="text-green-500 text-sm">{success}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

