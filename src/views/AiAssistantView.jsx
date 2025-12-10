import React from 'react'

export default function AiAssistantView() {
  return (
    <div className="h-full max-w-5xl mx-auto flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">AI 智能助手</h2>
          <p className="text-sm opacity-60 dark:text-gray-400">您的个人效率专家，随时为您服务</p>
        </div>
        <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-all">
                <i className="fa-solid fa-rotate-left mr-1"></i> 重置对话
            </button>
             <button className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:text-primary transition-all">
                <i className="fa-solid fa-gear mr-1"></i> 模型设置
            </button>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden relative">
        
        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* AI Welcome Message */}
            <div className="flex gap-4 max-w-3xl">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                    <i className="fa-solid fa-robot"></i>
                </div>
                <div className="space-y-1">
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none text-sm leading-relaxed text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <p>你好！我是 Task Stream 的 AI 助手。我可以帮你规划日程、拆解长期目标、或者分析你的效率报告。</p>
                        <p className="mt-2 text-gray-500 dark:text-gray-400">你可以试着问我：</p>
                        <ul className="list-disc list-inside mt-1 space-y-1 text-primary/80 dark:text-primary">
                            <li>"帮我把'学习React'拆解成一周的学习计划"</li>
                            <li>"分析一下我上周的时间分配情况"</li>
                            <li>"创建一个下周一上午10点的会议任务"</li>
                        </ul>
                    </div>
                    <span className="text-[10px] text-gray-400 pl-1">刚刚</span>
                </div>
            </div>

            {/* User Message Example */}
            <div className="flex gap-4 max-w-3xl ml-auto flex-row-reverse">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 shrink-0">
                    <i className="fa-solid fa-user"></i>
                </div>
                <div className="space-y-1 text-right">
                    <div className="bg-primary p-4 rounded-2xl rounded-tr-none text-sm leading-relaxed text-white shadow-md shadow-primary/20 text-left">
                        <p>我想制定一个减肥计划，目标是一个月减重 5 斤，请帮我生成长期任务。</p>
                    </div>
                    <span className="text-[10px] text-gray-400 pr-1">2分钟前</span>
                </div>
            </div>

             {/* AI Response Example */}
             <div className="flex gap-4 max-w-3xl">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
                    <i className="fa-solid fa-robot"></i>
                </div>
                <div className="space-y-1">
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl rounded-tl-none text-sm leading-relaxed text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 shadow-sm">
                        <p>好的，已为您生成"一月减重计划"长期任务，并拆解为以下子任务：</p>
                        <div className="mt-3 bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                             <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                <span className="font-bold">一月减重计划</span>
                             </div>
                             <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-2"><i className="fa-regular fa-square"></i> 每日晨跑3公里 (循环)</div>
                                <div className="flex items-center gap-2"><i className="fa-regular fa-square"></i> 晚餐控制碳水摄入</div>
                                <div className="flex items-center gap-2"><i className="fa-regular fa-square"></i> 每周日记录体重变化</div>
                             </div>
                        </div>
                        <p className="mt-3">是否需要将其添加到您的长期任务列表中？</p>
                    </div>
                    <span className="text-[10px] text-gray-400 pl-1">刚刚</span>
                </div>
            </div>

        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <div className="relative">
                <textarea 
                    placeholder="输入您的问题或指令..." 
                    className="w-full pl-4 pr-12 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 ring-primary/20 resize-none h-12 min-h-[48px] max-h-32 transition-all dark:text-white"
                    rows="1"
                ></textarea>
                <button className="absolute right-2 bottom-2 w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-lg hover:brightness-110 transition-all">
                    <i className="fa-solid fa-paper-plane text-xs"></i>
                </button>
            </div>
            <div className="flex justify-center mt-2">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <i className="fa-solid fa-bolt text-yellow-400"></i> Powered by Gemini Pro
                </span>
            </div>
        </div>
      </div>
    </div>
  )
}
