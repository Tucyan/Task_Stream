import React, { useEffect, useMemo, useState } from 'react'
import * as api from '../services/api.js'

const REMINDER_TYPES = ['Message', 'Task', 'LongTermTask']

function toDatetimeLocalValue(time) {
  if (!time || typeof time !== 'string') return ''
  if (time.includes('T')) return time.slice(0, 16)
  if (time.includes(' ')) return time.replace(' ', 'T').slice(0, 16)
  return ''
}

function toBackendTime(datetimeLocalValue) {
  if (!datetimeLocalValue || typeof datetimeLocalValue !== 'string') return ''
  if (datetimeLocalValue.includes('T')) return datetimeLocalValue.replace('T', ' ').slice(0, 16)
  return datetimeLocalValue.slice(0, 16)
}

function normalizeIncomingList(list) {
  const items = Array.isArray(list) ? list : []
  return items.map((item, idx) => {
    const type = typeof item?.type === 'string' ? item.type : 'Message'
    const time = toDatetimeLocalValue(item?.time)
    const content = typeof item?.content === 'string' ? item.content : ''
    const taskIdRaw = item?.task_id
    const task_id =
      taskIdRaw === null || taskIdRaw === undefined || taskIdRaw === '' ? '' : Number(taskIdRaw)
    return {
      client_id: `${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
      type,
      time,
      content,
      task_id: Number.isFinite(task_id) ? task_id : ''
    }
  })
}

function buildPayload(list) {
  const items = Array.isArray(list) ? list : []
  return items.map((item) => {
    const payload = {
      type: item.type,
      time: toBackendTime(item.time),
      content: item.content
    }
    if (item.type === 'Task' || item.type === 'LongTermTask') {
      payload.task_id = Number(item.task_id)
    }
    return payload
  })
}

function validateItems(items) {
  const list = Array.isArray(items) ? items : []
  for (let i = 0; i < list.length; i += 1) {
    const it = list[i]
    if (!REMINDER_TYPES.includes(it?.type)) return `第 ${i + 1} 条的 type 不合法`
    if (!it?.time) return `第 ${i + 1} 条缺少 time`
    const backendTime = toBackendTime(it.time)
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(backendTime)) return `第 ${i + 1} 条 time 格式不正确`
    if (!it?.content || !String(it.content).trim()) return `第 ${i + 1} 条缺少 content`
    if (it.type === 'Task' || it.type === 'LongTermTask') {
      if (it.task_id === '' || it.task_id === null || it.task_id === undefined) {
        return `第 ${i + 1} 条缺少 task_id`
      }
      const n = Number(it.task_id)
      if (!Number.isFinite(n) || n <= 0) return `第 ${i + 1} 条 task_id 不合法`
    }
  }
  return ''
}

export default function ReminderQueueModal({ visible, onClose, userId, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [activeTab, setActiveTab] = useState('list')
  const [jsonDraft, setJsonDraft] = useState('')

  const itemCountLabel = useMemo(() => `${Array.isArray(items) ? items.length : 0} 条`, [items])

  useEffect(() => {
    if (!visible) return
    if (!userId) return
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .getReminderList(userId)
      .then((list) => {
        if (cancelled) return
        const normalized = normalizeIncomingList(list)
        setItems(normalized)
        setJsonDraft(JSON.stringify(buildPayload(normalized), null, 2))
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.message || '加载失败')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [visible, userId])

  useEffect(() => {
    if (!visible) return
    if (activeTab !== 'json') return
    setJsonDraft(JSON.stringify(buildPayload(items), null, 2))
  }, [activeTab, items, visible])

  if (!visible) return null

  const patchItem = (clientId, patch) => {
    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).map((it) => (it.client_id === clientId ? { ...it, ...patch } : it))
    )
  }

  const addItem = () => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const time = `${yyyy}-${mm}-${dd}T${hh}:${min}`
    setItems((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      {
        client_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: 'Message',
        time,
        content: '',
        task_id: ''
      }
    ])
    setActiveTab('list')
  }

  const removeItem = (clientId) => {
    setItems((prev) => (Array.isArray(prev) ? prev : []).filter((it) => it.client_id !== clientId))
  }

  const clearAll = () => {
    setItems([])
    setActiveTab('list')
  }

  const applyJson = () => {
    setError('')
    try {
      const parsed = JSON.parse(jsonDraft)
      const normalized = normalizeIncomingList(parsed)
      const validationError = validateItems(normalized)
      if (validationError) {
        setError(validationError)
        return
      }
      setItems(normalized)
      setActiveTab('list')
    } catch (e) {
      setError(e?.message || 'JSON 解析失败')
    }
  }

  const save = async () => {
    setError('')
    const validationError = validateItems(items)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload(items)
      const saved = await api.updateReminderList(userId, payload)
      const normalized = normalizeIncomingList(saved)
      setItems(normalized)
      setJsonDraft(JSON.stringify(buildPayload(normalized), null, 2))
      if (typeof onSaved === 'function') onSaved(saved)
      onClose()
    } catch (e) {
      setError(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-3 md:p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl transform transition-all flex flex-col max-h-[92vh] border border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-bell text-yellow-500"></i>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white truncate">提醒队列编辑</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                {itemCountLabel}
              </span>
            </div>
            <div className="text-xs opacity-60 dark:text-gray-400 mt-1">保存后会按 time 升序自动整理</div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-none"
          >
            <i className="fa-solid fa-times text-lg"></i>
          </button>
        </div>

        <div className="px-5 md:px-6 pt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                activeTab === 'list'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              列表编辑
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                activeTab === 'json'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              JSON 编辑
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addItem}
              className="px-3 py-2 rounded-xl text-sm bg-yellow-500 text-white hover:bg-yellow-500/90 transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-plus"></i>
              新增
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-2 rounded-xl text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              清空
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 md:px-6 pt-3">
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
              {error}
            </div>
          </div>
        )}

        <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activeTab === 'json' ? (
            <div className="space-y-3">
              <textarea
                value={jsonDraft}
                onChange={(e) => setJsonDraft(e.target.value)}
                className="w-full min-h-[50vh] md:min-h-[52vh] px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-xs md:text-sm dark:text-white"
                spellCheck={false}
              />
              <div className="flex justify-end">
                <button
                  onClick={applyJson}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-check"></i>
                  应用 JSON
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
                <i className="fa-solid fa-bell"></i>
              </div>
              <div className="mt-3 text-sm opacity-70 dark:text-gray-400">当前没有提醒</div>
              <div className="mt-4">
                <button
                  onClick={addItem}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110 transition-all inline-flex items-center gap-2"
                >
                  <i className="fa-solid fa-plus"></i>
                  新增提醒
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((it, idx) => (
                <div
                  key={it.client_id}
                  className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400">第 {idx + 1} 条</div>
                    </div>
                    <button
                      onClick={() => removeItem(it.client_id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors flex-none"
                      title="删除"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3">
                      <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">类型</div>
                      <select
                        value={it.type}
                        onChange={(e) => patchItem(it.client_id, { type: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer dark:text-white"
                      >
                        {REMINDER_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-4">
                      <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">时间</div>
                      <input
                        type="datetime-local"
                        value={it.time}
                        onChange={(e) => patchItem(it.client_id, { time: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]"
                      />
                    </div>

                    <div className="md:col-span-5">
                      <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">关联任务 ID（可选/必填）</div>
                      <input
                        type="number"
                        value={it.task_id}
                        onChange={(e) =>
                          patchItem(it.client_id, { task_id: e.target.value === '' ? '' : Number(e.target.value) })
                        }
                        disabled={it.type === 'Message'}
                        className={`w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark] ${
                          it.type === 'Message'
                            ? 'bg-gray-100 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                            : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                        }`}
                        placeholder={it.type === 'Message' ? 'Message 类型不需要' : '请输入任务 ID'}
                        min={1}
                      />
                    </div>

                    <div className="md:col-span-12">
                      <div className="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">内容</div>
                      <textarea
                        value={it.content}
                        onChange={(e) => patchItem(it.client_id, { content: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none min-h-[90px] dark:text-white"
                        placeholder="请输入提醒内容..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 md:p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={saving}
          >
            取消
          </button>
          <button
            onClick={save}
            className="flex-1 px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:brightness-100"
            disabled={saving || loading}
          >
            <i className={`fa-solid ${saving ? 'fa-spinner animate-spin' : 'fa-check'}`}></i>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
