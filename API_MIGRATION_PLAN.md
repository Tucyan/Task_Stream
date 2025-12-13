# API Migration Plan

| Old Definition | Functionality | Standardized Definition |
| :--- | :--- | :--- |
| **Tasks** | | |
| `GET /urgent_tasks?user_id={id}` | Get urgent tasks for a user | `GET /api/v1/tasks/urgent?user_id={id}` |
| `GET /tasks/range?start_date={start}&end_date={end}&user_id={id}` | Get tasks in date range | `GET /api/v1/tasks?start_date={start}&end_date={end}&user_id={id}` |
| `GET /tasks?user_id={id}` | Get all tasks for a user | `GET /api/v1/tasks?user_id={id}` |
| `POST /tasks` | Create a new task | `POST /api/v1/tasks` |
| `GET /tasks/{task_id}` | Get task by ID | `GET /api/v1/tasks/{task_id}` |
| `DELETE /tasks/{task_id}` | Delete task by ID | `DELETE /api/v1/tasks/{task_id}` |
| `PUT /tasks/{task_id}` | Update task by ID | `PUT /api/v1/tasks/{task_id}` |
| **Long Term Tasks** | | |
| `GET /long_term_tasks?user_id={id}` | Get all long term tasks | `GET /api/v1/long-term-tasks?user_id={id}` |
| `POST /long_term_tasks` | Create long term task | `POST /api/v1/long-term-tasks` |
| `DELETE /long_term_tasks/{task_id}` | Delete long term task | `DELETE /api/v1/long-term-tasks/{task_id}` |
| `GET /long_term_tasks/uncompleted?user_id={id}` | Get uncompleted long term tasks | `GET /api/v1/long-term-tasks/uncompleted?user_id={id}` |
| `GET /long_term_tasks/{task_id}` | Get long term task by ID | `GET /api/v1/long-term-tasks/{task_id}` |
| `PUT /long_term_tasks/{task_id}` | Update long term task | `PUT /api/v1/long-term-tasks/{task_id}` |
| **Journals** | | |
| `GET /journals/dates?year={y}&month={m}&user_id={id}` | Get dates with journals | `GET /api/v1/journals/dates?year={y}&month={m}&user_id={id}` |
| `GET /journals/status?year={y}&month={m}&user_id={id}` | Get journal status list | `GET /api/v1/journals/status?year={y}&month={m}&user_id={id}` |
| `GET /journals/{date}?user_id={id}` | Get journal by date | `GET /api/v1/journals/{date}?user_id={id}` |
| `PUT /journals/{date}?content={c}&user_id={id}` | Update journal (Old) | *Deprecated* |
| `PUT /journals/{date}/content` | Update journal content (New) | `PUT /api/v1/journals/{date}` |
| **Heatmap** | | |
| `GET /heatmap?year={y}&month={m}&user_id={id}` | Get heatmap data | `GET /api/v1/stats/heatmap?year={y}&month={m}&user_id={id}` |
| **Settings** | | |
| `GET /settings/{user_id}` | Get user settings | `GET /api/v1/settings/{user_id}` |
| `POST /settings` | Create user settings | `POST /api/v1/settings` |
| `PUT /settings/{user_id}` | Update user settings | `PUT /api/v1/settings/{user_id}` |
| **Memos** | | |
| `GET /memos/{user_id}` | Get user memo | `GET /api/v1/memos/{user_id}` |
| `PUT /memos/{user_id}` | Update user memo | `PUT /api/v1/memos/{user_id}` |
| **Auth** | | |
| `POST /api/register` | Register user | `POST /api/v1/auth/register` |
| `POST /api/login` | Login user | `POST /api/v1/auth/login` |
| `PUT /api/update-password` | Update password | `PUT /api/v1/auth/password` |
| `PUT /api/update-nickname` | Update nickname | `PUT /api/v1/auth/nickname` |
