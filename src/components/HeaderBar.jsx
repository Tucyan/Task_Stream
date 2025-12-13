import React from 'react'
import UserProfile from './UserProfile.jsx'

export default function HeaderBar({ pageTitle, onLogout, user, onUserUpdate }) {
  return (
    <header className="h-16 px-8 flex items-center justify-between z-10 md:flex hidden">
      <div className="text-lg font-medium opacity-80 dark:text-white dark:opacity-100">{pageTitle}</div>
      <div className="flex items-center gap-6">
        <UserProfile user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
      </div>
    </header>
  )
}
