import React from 'react'

export default function ResultModal({ visible, onClose }) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card w-full max-w-lg p-6 rounded-2xl shadow-2xl scale-100 transition-all">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary">
          <i className="fa-solid fa-trophy"></i> 恭喜完成!
        </h3>
        <p className="mb-4 text-sm opacity-70 dark:text-gray-400">请记录该任务的具体成果 (Markdown):</p>
        <textarea className="w-full h-32 bg-gray-50 dark:bg-gray-800 border-none rounded-xl p-4 focus:ring-2 ring-primary outline-none mb-4 dark:text-white" placeholder="- 成果 1..." />
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
          <div className="text-center opacity-50 dark:text-gray-400">
            <i className="fa-solid fa-image text-2xl mb-1"></i>
            <div className="text-xs">点击上传成果图片</div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">跳过</button>
          <button onClick={onClose} className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold shadow-lg hover:shadow-primary/50">保存成果</button>
        </div>
      </div>
    </div>
  )
}

