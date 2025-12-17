import React, { useState, useEffect } from 'react'
import * as api from '../services/api.js'

/**
 * 用户资料组件
 * 显示用户信息，提供昵称修改和密码修改功能
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.user - 用户信息对象
 * @param {Function} props.onLogout - 登出函数
 * @param {Function} props.onUserUpdate - 用户信息更新回调函数
 * @param {boolean} [props.compact=false] - 是否使用紧凑模式
 * @returns {JSX.Element} - UserProfile组件
 */
export default function UserProfile({ user, onLogout, onUserUpdate, compact = false }) {
  // 状态管理
  const [showProfileModal, setShowProfileModal] = useState(false) // 是否显示资料模态框
  const [showDropdown, setShowDropdown] = useState(false) // 是否显示下拉菜单
  const [nickname, setNickname] = useState(user?.nickname || '') // 昵称
  const [currentPassword, setCurrentPassword] = useState('') // 当前密码
  const [newPassword, setNewPassword] = useState('') // 新密码
  const [loading, setLoading] = useState(false) // 加载状态
  const [error, setError] = useState('') // 错误信息
  const [success, setSuccess] = useState('') // 成功信息

  // 用户信息更新时，同步更新昵称
  useEffect(() => {
    setNickname(user?.nickname || '')
  }, [user])

  /**
   * 更新用户昵称
   * 调用API更新昵称，并更新本地存储和父组件状态
   */
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
      
      // 更新本地存储的用户信息
      const savedUser = localStorage.getItem('taskStreamUser')
      if (savedUser) {
        const userInfo = JSON.parse(savedUser)
        userInfo.nickname = nickname
        localStorage.setItem('taskStreamUser', JSON.stringify(userInfo))
      }
      
      // 通知父组件更新用户信息
      if (onUserUpdate) {
        onUserUpdate(updatedUser)
      }
      
      setSuccess('昵称更新成功')
      setTimeout(() => setSuccess(''), 3000) // 3秒后清空成功信息
    } catch (e) {
      setError(e.message || '更新昵称失败')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 更新用户密码
   * 调用API更新密码，成功后清空输入框
   */
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
      setCurrentPassword('') // 清空当前密码输入框
      setNewPassword('') // 清空新密码输入框
      setTimeout(() => setSuccess(''), 3000) // 3秒后清空成功信息
    } catch (e) {
      setError(e.message || '更新密码失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative z-50">
      <button 
        className={`flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all ${compact ? 'p-2' : 'px-3 py-1.5'}`}
        onClick={() => setShowDropdown(!showDropdown)}
      >
        {!compact && (
          <span className="text-sm font-medium dark:text-white">{user?.nickname || user?.username || '用户'}</span>
        )}
        {compact ? (
           <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
             <i className="fa-solid fa-user text-xs"></i>
           </div>
        ) : (
           <i className="fa-solid fa-chevron-down text-xs opacity-50 dark:text-gray-400"></i>
        )}
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)}></div>
          <div 
            className="absolute right-0 top-full mt-2 w-48 bg-card rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-50"
          >
            {compact && (
               <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700 mb-1">
                 {user?.nickname || user?.username}
               </div>
            )}
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
        </>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
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
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">用户名</div>
                <div className="font-medium dark:text-white">{user?.username}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-gray-300">昵称</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={nickname} 
                    onChange={e => setNickname(e.target.value)} 
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  />
                  <button 
                    onClick={handleUpdateNickname}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? '更新' : '更新'}
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

              {error && <div className="text-red-500 text-sm">{error}</div>}
              {success && <div className="text-green-500 text-sm">{success}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
