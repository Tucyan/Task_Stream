const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
//这里导入了服务器的公网ip
import sha256 from 'js-sha256';

/**
 * 通用 Fetch 请求封装
 * @param {string} url - 请求 URL
 * @param {object} options - Fetch 选项
 * @returns {Promise<any>} - 返回 JSON 数据
 */
async function request(url, options = {}) {
    // 为昵称更新请求添加特殊标记
    const isNicknameUpdate = url.includes('/api/v1/auth/nickname');
    // 为长期任务请求添加特殊标记
    const isLongTermTaskRequest = url.includes('/long-term-tasks');
    
    if (isNicknameUpdate) {
        if (import.meta.env.DEV) {
            console.log('[API请求] 开始昵称更新请求');
            console.log('[API请求] 请求URL:', url);
            console.log('[API请求] 请求方法:', options.method);
            console.log('[API请求] 请求头:', options.headers);
            console.log('[API请求] 请求体:', options.body);
            console.log('[API请求] 更新任务数据:', options.body);
        }
    } else if (isLongTermTaskRequest && options.body) {
        if (import.meta.env.DEV) {
            console.log('[API请求] 长期任务请求');
            console.log('[API请求] 请求URL:', url);
            console.log('[API请求] 请求方法:', options.method);
            try {
                const bodyData = JSON.parse(options.body);
                console.log('[API请求] sub_task_ids:', bodyData.sub_task_ids);
                console.log('[API请求] sub_task_ids类型:', typeof bodyData.sub_task_ids);
                console.log('[API请求] sub_task_ids字符串:', JSON.stringify(bodyData.sub_task_ids));
            } catch (e) {
                console.log('[API请求] 请求体:', options.body);
            }
        }
    } else {
        if (import.meta.env.DEV) {
            console.log('API Request:', url, options);
        }
    }
    
    const response = await fetch(`${API_BASE_URL}${url}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    if (isNicknameUpdate) {
        if (import.meta.env.DEV) {
            console.log('[API响应] 昵称更新响应状态:', response.status, response.statusText);
        }
    } else {
        if (import.meta.env.DEV) {
            console.log('API Response:', response.status, response.statusText);
        }
    }

    if (!response.ok) {
        // 尝试获取详细的错误信息
        let errorMessage = `API Error: ${response.statusText}`;
        try {
            const errorData = await response.json();
            if (isNicknameUpdate) {
                console.error('[API错误] 昵称更新错误详情:', errorData);
            } else {
                console.error('Error Details:', errorData);
            }
            if (errorData.detail) {
                // 如果detail是数组，格式化每个错误
                if (Array.isArray(errorData.detail)) {
                    errorMessage = 'Validation errors:\n' + errorData.detail.map(err => {
                        return `- ${err.loc ? err.loc.join('.') + ': ' : ''}${err.msg}`;
                    }).join('\n');
                } else {
                    errorMessage = `API Error: ${errorData.detail}`;
                }
            }
        } catch (e) {
            console.error('Could not parse error response:', e);
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

/**
 * 根据筛选日期范围获取范围内的全部任务
 * @param {string} startDate - 开始日期 (YYYY-MM-DD)
 * @param {string} endDate - 结束日期 (YYYY-MM-DD)
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} - 任务列表
 */
export async function getTasksInDateRange(startDate, endDate, userId) {
    return request(`/api/v1/tasks?start_date=${startDate}&end_date=${endDate}&user_id=${userId}`);
}

/**
 * 获取指定用户的所有任务
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} - 任务列表
 */
export async function getAllTasksForUser(userId) {
    return request(`/api/v1/tasks?user_id=${userId}`);
}

/**
 * 获取所有长期任务
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} - 长期任务列表
 */
export async function getAllLongTermTasks(userId) {
    return request(`/api/v1/long-term-tasks?user_id=${userId}`);
}

/**
 * 获取所有未完成的长期任务(按截止时间排序)
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} - 长期任务列表
 */
export async function getAllUncompletedLongTermTasks(userId) {
    return request(`/api/v1/long-term-tasks/uncompleted?user_id=${userId}`);
}

export async function getUrgentTasks(userId) {
    return request(`/api/v1/tasks/urgent?user_id=${userId}`);
}



/**
 * 创建新任务
 * @param {object} taskData - 任务数据
 * @returns {Promise<object>} - 创建的任务
 */
export async function createTask(taskData) {
    return request('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
    });
}

/**
 * 删除任务
 * @param {number} taskId - 任务 ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
export async function deleteTask(taskId) {
    return request(`/api/v1/tasks/${taskId}`, {
        method: 'DELETE',
    });
}

/**
 * 获取指定ID的任务
 * @param {number} taskId - 任务 ID
 * @returns {Promise<object>} - 任务对象
 */
export async function getTaskById(taskId) {
    return request(`/api/v1/tasks/${taskId}`);
}

/**
 * 获取指定ID的长期任务
 * @param {number} taskId - 长期任务 ID
 * @returns {Promise<object>} - 长期任务对象
 */
export async function getLongTermTaskById(taskId) {
    return request(`/api/v1/long-term-tasks/${taskId}`);
}

/**
 * 更新任务信息
 * @param {number} taskId - 任务 ID
 * @param {object} taskData - 更新的任务数据
 * @returns {Promise<boolean>} - 是否更新成功
 */
export async function updateTask(taskId, taskData) {
    return request(`/api/v1/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(taskData),
    });
}

/**
 * 创建长期任务
 * @param {object} taskData - 长期任务数据
 * @returns {Promise<object>} - 创建的长期任务
 */
export async function createLongTermTask(taskData) {
    return request('/api/v1/long-term-tasks', {
        method: 'POST',
        body: JSON.stringify(taskData),
    });
}

/**
 * 删除长期任务
 * @param {number} taskId - 长期任务 ID
 * @returns {Promise<boolean>} - 是否删除成功
 */
export async function deleteLongTermTask(taskId) {
    return request(`/api/v1/long-term-tasks/${taskId}`, {
        method: 'DELETE',
    });
}

/**
 * 更新长期任务信息
 * @param {number} taskId - 长期任务 ID
 * @param {object} taskData - 更新的长期任务数据
 * @returns {Promise<boolean>} - 是否更新成功
 */
export async function updateLongTermTask(taskId, taskData) {
    return request(`/api/v1/long-term-tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(taskData),
    });
}

/**
 * 获取对应日期的日志
 * @param {string} date - 日期 (YYYY-MM-DD)
 * @param {number} userId - 用户 ID
 * @returns {Promise<object|null>} - 日志对象
 */
export async function getJournalByDate(date, userId) {
    return request(`/api/v1/journals/${date}?user_id=${userId}`);
}

/**
 * 更新对应日期的日志内容
 * @param {string} date - 日期 (YYYY-MM-DD)
 * @param {string} content - 新的日志内容
 * @param {number} userId - 用户 ID
 * @returns {Promise<boolean>} - 是否更新成功
 */
export async function updateJournalContent(date, content, userId) {
    // 使用新的 PUT /api/v1/journals/{date} 接口
    return request(`/api/v1/journals/${date}`, {
        method: 'PUT',
        body: JSON.stringify({ content, user_id: userId }),
    });
}

/**
 * 获取指定月份有日志的日期列表
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array<number>>} - 有日志的日期列表
 */
export async function getJournalDates(year, month, userId) {
    return request(`/api/v1/journals/dates?year=${year}&month=${month}&user_id=${userId}`);
}

/**
 * 获取指定月份的日志状态列表
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array<boolean>>} - 日志状态列表
 */
export async function getJournalStatus(year, month, userId) {
    return request(`/api/v1/journals/status?year=${year}&month=${month}&user_id=${userId}`);
}

/**
 * 根据年以及月份获取热力图信息
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array<number>>} - 热力图数据
 */
export async function getHeatmapData(year, month, userId) {
    return request(`/api/v1/stats/heatmap?year=${year}&month=${month}&user_id=${userId}`);
}

/**
 * 用户注册接口
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<object>} - 注册结果
 */
export async function register(username, password) {
    // 注册时前端需传递 passwordHash 字段
    const passwordHash = await hashPassword(password);
    return request('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, passwordHash }),
    });
}

// 前端密码哈希函数（与后端一致，SHA256）
async function hashPassword(password) {
    // 使用 js-sha256 库进行哈希
    return sha256(password);
}

/**
 * 用户登录接口
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<object>} - 登录结果
 */
export async function login(username, password) {
    // 登录时前端需传递 passwordHash 字段
    const passwordHash = await hashPassword(password);
    return request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, passwordHash }),
    });
}

/**
 * 用户注册接口（支持昵称）
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} nickname - 昵称（可选）
 * @returns {Promise<object>} - 注册结果
 */
export async function registerWithNickname(username, password, nickname) {
    // 注册时前端需传递 passwordHash 字段
    const passwordHash = await hashPassword(password);
    return request('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, passwordHash, nickname }),
    });
}

/**
 * 修改用户密码
 * @param {number} userId - 用户 ID
 * @param {string} currentPassword - 当前密码
 * @param {string} newPassword - 新密码
 * @returns {Promise<object>} - 修改结果
 */
export async function updatePassword(userId, currentPassword, newPassword) {
    // 前端不需要哈希密码，后端会处理
    return request('/api/v1/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ 
            user_id: userId, 
            current_password: currentPassword,
            new_password: newPassword
        }),
    });
}

/**
 * 修改用户昵称
 * @param {number} userId - 用户 ID
 * @param {string} newNickname - 新昵称
 * @returns {Promise<object>} - 修改结果
 */
export async function updateNickname(userId, newNickname) {
    console.log('[API - 昵称更新] 开始调用更新昵称API')
    console.log('[API - 昵称更新] 请求参数:', { userId, newNickname })
    
    const requestData = { 
        user_id: userId, 
        new_nickname: newNickname
    };
    
    console.log('[API - 昵称更新] 请求体数据:', requestData)
    
    try {
        const result = await request('/api/v1/auth/nickname', {
            method: 'PUT',
            body: JSON.stringify(requestData),
        });
        console.log('[API - 昵称更新] API调用成功，返回结果:', result)
        return result;
    } catch (error) {
        console.error('[API - 昵称更新] API调用失败:', error)
        throw error;
    }
}

/**
 * 获取用户设置
 * @param {number} userId - 用户 ID
 * @returns {Promise<object|null>} - 设置对象
 */
export async function getSettings(userId) {
    return request(`/api/v1/settings/${userId}`);
}

/**
 * 创建用户设置
 * @param {object} settingsData - 设置数据
 * @returns {Promise<object>} - 创建的设置对象
 */
export async function createSettings(settingsData) {
    return request('/api/v1/settings', {
        method: 'POST',
        body: JSON.stringify(settingsData),
    });
}

/**
 * 更新用户设置
 * @param {number} userId - 用户 ID
 * @param {object} settingsData - 更新的设置数据
 * @returns {Promise<object>} - 更新后的设置对象
 */
export async function updateSettings(userId, settingsData) {
    return request(`/api/v1/settings/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(settingsData),
    });
}

/**
 * 获取用户备忘录
 * @param {number} userId - 用户 ID
 * @returns {Promise<object|null>} - 备忘录对象
 */
export async function getMemo(userId) {
    return request(`/api/v1/memos/${userId}`);
}

/**
 * 更新用户备忘录
 * @param {number} userId - 用户 ID
 * @param {string} content - 备忘录内容
 * @returns {Promise<object>} - 更新后的备忘录对象
 */
export async function updateMemo(userId, content) {
    return request(`/api/v1/memos/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
    });
}
