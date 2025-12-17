# 统一中文注释规范

## 1. 总则

- 所有注释必须使用中文
- 注释应简洁明了，避免冗余
- 注释应准确反映代码逻辑和功能
- 注释应与代码保持同步更新
- 避免使用拼音或不规范的中文表达

## 2. Python文件注释规范

### 2.1 模块级注释

```python
"""
模块名称：module_name
模块功能：描述模块的主要功能和用途
作者：可选
创建日期：可选
更新日期：可选
"""
```

### 2.2 类注释

```python
class ClassName:
    """
    类名：ClassName
    功能：描述类的主要用途和职责
    
    属性：
        attribute1: 描述属性1
        attribute2: 描述属性2
    
    方法：
        method1(): 描述方法1
        method2(): 描述方法2
    """
```

### 2.3 函数注释

```python
def function_name(param1, param2):
    """
    功能：描述函数的主要功能
    
    参数：
        param1 (类型): 描述参数1
        param2 (类型): 描述参数2
    
    返回值：
        返回类型: 描述返回值
    
    异常：
        ExceptionType: 描述可能抛出的异常
    """
```

### 2.4 行内注释

```python
# 描述单行代码的功能或逻辑
variable = value  # 行尾注释，描述变量赋值
```

### 2.5 块注释

```python
# 描述复杂逻辑的开始
# 多行注释，每行一个#号
# 详细说明逻辑的各个步骤
# 描述复杂逻辑的结束
```

## 3. JavaScript/JSX文件注释规范

### 3.1 模块级注释

```javascript
/*
 * 模块名称：module_name
 * 模块功能：描述模块的主要功能和用途
 * 作者：可选
 * 创建日期：可选
 * 更新日期：可选
 */
```

### 3.2 函数注释（JSDoc格式）

```javascript
/**
 * 功能：描述函数的主要功能
 * @param {类型} param1 - 描述参数1
 * @param {类型} param2 - 描述参数2
 * @returns {类型} - 描述返回值
 * @throws {类型} - 描述可能抛出的异常
 */
function functionName(param1, param2) {
    // 函数体
}
```

### 3.3 组件注释（JSDoc格式）

```jsx
/**
 * 组件名称：ComponentName
 * 功能：描述组件的主要用途
 * @param {类型} prop1 - 描述属性1
 * @param {类型} prop2 - 描述属性2
 * @returns {React.Element} - React组件
 */
function ComponentName({ prop1, prop2 }) {
    // 组件体
}
```

### 3.4 行内注释

```javascript
// 描述单行代码的功能或逻辑
const variable = value; // 行尾注释，描述变量赋值
```

### 3.5 块注释

```javascript
/*
 * 描述复杂逻辑的开始
 * 多行注释，每行一个*号
 * 详细说明逻辑的各个步骤
 * 描述复杂逻辑的结束
 */
```

## 4. 特殊情况处理

### 4.1 复杂逻辑注释

对于复杂的业务逻辑或算法，应添加详细的注释，说明逻辑流程和设计思路。

### 4.2 遗留代码注释

对于需要重构或优化的代码，应添加注释标记：

```python
# TODO: 需要重构的代码
# FIXME: 需要修复的bug
# OPTIMIZE: 需要优化的代码
```

```javascript
// TODO: 需要重构的代码
// FIXME: 需要修复的bug
// OPTIMIZE: 需要优化的代码
```

### 4.3 常量注释

对于常量，应添加注释说明其含义和用途：

```python
MAX_RETRY = 3  # 最大重试次数
DEFAULT_TIMEOUT = 10  # 默认超时时间（秒）
```

```javascript
const MAX_RETRY = 3; // 最大重试次数
const DEFAULT_TIMEOUT = 10; // 默认超时时间（秒）
```

## 5. 注释示例

### 5.1 Python示例

```python
"""
模块名称：user_service
模块功能：用户相关业务逻辑处理
"""

class UserService:
    """
    用户服务类
    功能：处理用户的注册、登录、信息更新等业务逻辑
    
    属性：
        db: 数据库会话对象
    
    方法：
        register(): 用户注册
        login(): 用户登录
        update_info(): 更新用户信息
    """
    
    def __init__(self, db):
        """
        初始化用户服务
        
        参数：
            db (Session): 数据库会话对象
        """
        self.db = db
    
    def register(self, username, password):
        """
        用户注册
        
        参数：
            username (str): 用户名
            password (str): 密码
        
        返回值：
            User: 注册成功的用户对象
        
        异常：
            ValueError: 用户名已存在
        """
        # 检查用户名是否已存在
        existing_user = self.db.query(User).filter(User.username == username).first()
        if existing_user:
            raise ValueError("用户名已存在")
        
        # 创建新用户
        hashed_password = hash_password(password)
        new_user = User(username=username, password_hash=hashed_password)
        
        # 保存到数据库
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)
        
        return new_user
```

### 5.2 JavaScript示例

```javascript
/*
 * 模块名称：api_service
 * 模块功能：API请求封装和处理
 */

/**
 * 通用API请求函数
 * @param {string} url - 请求URL
 * @param {object} options - Fetch选项
 * @returns {Promise<any>} - 返回JSON数据
 * @throws {Error} - 请求失败时抛出错误
 */
async function request(url, options = {}) {
    // 构建完整URL
    const fullUrl = `${API_BASE_URL}${url}`;
    
    try {
        // 发送请求
        const response = await fetch(fullUrl, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`API请求失败：${response.statusText}`);
        }
        
        // 返回JSON数据
        return await response.json();
    } catch (error) {
        console.error('API请求错误：', error);
        throw error;
    }
}
```

## 6. 检查和维护

- 定期检查注释的完整性和准确性
- 在代码审查过程中，检查注释是否符合规范
- 对新增代码，确保注释与代码同步编写
- 对修改的代码，及时更新相关注释

## 7. 附则

本规范自发布之日起施行，所有项目成员必须严格遵守。

如有特殊情况需要调整注释规范，需经项目负责人批准。