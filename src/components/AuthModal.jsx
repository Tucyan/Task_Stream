import React, { useState } from 'react'
import * as api from '../services/api.js'

export default function AuthModal({ visible, isRegistering, setIsRegistering, onAuthSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')  // 添加昵称状态
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!visible) return null

  // 处理登录或注册
  const handleAuth = async () => {
    setLoading(true)
    setError('')
    try {
      let result
      if (isRegistering) {
        // 使用新的注册API，支持昵称
        result = await api.registerWithNickname(username, password, nickname)
      } else {
        result = await api.login(username, password)
      }
      if (result && result.id) {
        onAuthSuccess(result)
      } else {
        setError('认证失败，请检查账号和密码')
      }
    } catch (e) {
      setError(e.message || '认证失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md p-8 rounded-2xl shadow-2xl transform transition-all">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Task Stream</h1>
          <p className="text-sm opacity-60 dark:text-gray-400">唯美 · 简洁 · 高效</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase opacity-50 dark:text-gray-400">账号</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="user@example.com" className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white" />
          </div>
          {isRegistering && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase opacity-50 dark:text-gray-400">昵称</label>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="输入昵称（可选）" className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white" />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase opacity-50 dark:text-gray-400">密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white" />
          </div>
          {error && <div className="text-red-500 text-sm text-center mt-2">{error}</div>}
          <button onClick={handleAuth} disabled={loading} className="w-full bg-primary text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-primary/50 hover:brightness-110 transition-all mt-6">
            {loading ? '处理中...' : (isRegistering ? '立即注册' : '进入 Task Stream')}
          </button>
          <div className="text-center mt-4">
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-sm text-primary hover:underline">
              {isRegistering ? '已有账号？去登录' : '没有账号？注册新账号'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


