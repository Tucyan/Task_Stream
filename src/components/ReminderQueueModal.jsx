import React, { useEffect, useState } from 'react'

const REMINDER_SETTINGS_KEY = 'taskStreamReminderSettings'
const DEFAULT_REMINDER_SETTINGS = { vibration: true, sound: true, snooze_minutes: 10 }

function loadReminderSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_REMINDER_SETTINGS }
  try {
    const raw = localStorage.getItem(REMINDER_SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const snooze_minutes = Number(parsed?.snooze_minutes)
    return {
      vibration: parsed?.vibration !== false,
      sound: parsed?.sound !== false,
      snooze_minutes: Number.isFinite(snooze_minutes) && snooze_minutes > 0 ? Math.min(180, Math.floor(snooze_minutes)) : 10
    }
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS }
  }
}

function saveReminderSettings(next) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(next))
  } catch {
  }
}

export default function ReminderQueueModal({ visible, onClose, userId, onSaved }) {
  const [reminderSettings, setReminderSettings] = useState(DEFAULT_REMINDER_SETTINGS)
  const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 767px)').matches

  useEffect(() => {
    if (!visible) return
    setReminderSettings(loadReminderSettings())
  }, [visible])

  const patchSettings = (patch) => {
    setReminderSettings((prev) => {
      const nextRaw = { ...(prev || DEFAULT_REMINDER_SETTINGS), ...(patch || {}) }
      const snooze_minutes = Number(nextRaw.snooze_minutes)
      const next = {
        vibration: nextRaw.vibration !== false,
        sound: nextRaw.sound !== false,
        snooze_minutes: Number.isFinite(snooze_minutes) && snooze_minutes > 0 ? Math.min(180, Math.floor(snooze_minutes)) : 10
      }
      saveReminderSettings(next)
      if (typeof onSaved === 'function') onSaved(next)
      return next
    })
  }

  if (!visible || !isMobile) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-3 md:p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl transform transition-all flex flex-col max-h-[92vh] border border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-gear text-primary"></i>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white truncate">提醒设置</h2>
            </div>
            <div className="text-xs opacity-60 dark:text-gray-400 mt-1">仅保存在当前设备的 localStorage</div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <i className="fa-solid fa-times text-lg"></i>
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-800 dark:text-white">提醒设置（本地）</div>
                  <div className="text-xs opacity-70 dark:text-gray-400 mt-1">仅保存在当前设备的 localStorage</div>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center flex-none">
                  <i className="fa-solid fa-sliders"></i>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-800 dark:text-white">震动提醒</div>
                    <div className="text-xs opacity-70 dark:text-gray-400 mt-1">通知到达时触发震动</div>
                  </div>
                  <button
                    onClick={() => patchSettings({ vibration: !reminderSettings.vibration })}
                    className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                      reminderSettings.vibration ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    aria-label="震动提醒"
                    type="button"
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        reminderSettings.vibration ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-800 dark:text-white">响铃提醒</div>
                    <div className="text-xs opacity-70 dark:text-gray-400 mt-1">通知到达时播放系统通知声音</div>
                  </div>
                  <button
                    onClick={() => patchSettings({ sound: !reminderSettings.sound })}
                    className={`w-12 h-7 rounded-full p-1 transition-colors flex items-center ${
                      reminderSettings.sound ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    aria-label="响铃提醒"
                    type="button"
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        reminderSettings.sound ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 items-end">
                  <div>
                    <div className="text-sm font-bold text-gray-800 dark:text-white">延后时间（分钟）</div>
                    <div className="text-xs opacity-70 dark:text-gray-400 mt-1">点击“延后”后再次提醒的间隔</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => patchSettings({ snooze_minutes: Math.max(1, (reminderSettings.snooze_minutes || 10) - 1) })}
                        className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                        aria-label="减少 1 分钟"
                      >
                        <i className="fa-solid fa-minus"></i>
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={reminderSettings.snooze_minutes}
                        onChange={(e) => patchSettings({ snooze_minutes: e.target.value === '' ? 10 : Number(e.target.value) })}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white dark:[color-scheme:dark]"
                      />
                      <button
                        type="button"
                        onClick={() => patchSettings({ snooze_minutes: Math.min(180, (reminderSettings.snooze_minutes || 10) + 1) })}
                        className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                        aria-label="增加 1 分钟"
                      >
                        <i className="fa-solid fa-plus"></i>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...DEFAULT_REMINDER_SETTINGS }
                      setReminderSettings(next)
                      saveReminderSettings(next)
                      if (typeof onSaved === 'function') onSaved(next)
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                  >
                    恢复默认
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110 transition-all"
            type="button"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
