import React from 'react'

export default function SettingsView({ isDarkMode, toggleDarkMode, settings, setSettings, presetColors, resetTheme, saveSettings }) {
  
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
      <div className="bg-card rounded-3xl shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="p-8 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-2 dark:text-white">个性化设置</h2>
          <p className="text-sm opacity-60 dark:text-gray-400">定制属于你的 Task Stream 视觉体验</p>
        </div>
        <div className="p-8 space-y-10 flex-1 min-h-0 overflow-y-auto pr-2">
          <section>
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
          <section>
            <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><i className="fa-solid fa-palette"></i> 强调色 (Accent Color)</h3>
            <div className="flex gap-4 flex-wrap">
              {presetColors.map((color) => (
                <div key={color} onClick={() => handlePresetColor(color)} className="w-12 h-12 rounded-full cursor-pointer shadow-sm flex items-center justify-center transition-transform hover:scale-110" style={{ backgroundColor: color }}>
                  {settings.primary === color && <i className="fa-solid fa-check text-white text-lg drop-shadow-md"></i>}
                </div>
              ))}
            </div>
          </section>
          <section className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
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
