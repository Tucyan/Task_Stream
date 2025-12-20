import React from 'react'
import UserProfile from './UserProfile.jsx'

/**
 * 页面顶部导航栏组件
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.pageTitle - 当前页面标题
 * @param {Function} props.onLogout - 登出函数
 * @param {Object} props.user - 用户信息对象
 * @param {Function} props.onUserUpdate - 用户信息更新回调函数
 * @returns {JSX.Element} - HeaderBar组件
 */
export default function HeaderBar({ pageTitle, onLogout, user, onUserUpdate, onOpenReminderEditor }) {
  return (
    <header className="h-16 px-8 flex items-center justify-between z-10 md:flex hidden">
      <div className="text-lg font-medium opacity-80 dark:text-white dark:opacity-100">{pageTitle}</div>
      <div className="flex items-center gap-6">
        <button
          onClick={onOpenReminderEditor}
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-yellow-500/10 dark:hover:bg-yellow-500/10 transition-colors border border-transparent hover:border-yellow-500/20"
          title="编辑提醒队列"
          type="button"
        >
          <i className="fa-solid fa-bell text-yellow-500"></i>
        </button>
        <UserProfile user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
      </div>
    </header>
  )
}
