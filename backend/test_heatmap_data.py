from app.core.database import SessionLocal
from app.models import models
import datetime

def create_test_user_and_tasks():
    db = SessionLocal()
    # 检查用户是否已存在
    user = db.query(models.User).filter(models.User.username == "heatmaptest").first()
    if not user:
        # 创建测试用户
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        user = models.User(
            username="heatmaptest",
            passwordHash="heatmaptest",
            created_at=now,
            name="热力图测试用户"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"创建测试用户: {user.id}")
    else:
        print(f"测试用户已存在: {user.id}")

    # 插入一组任务，分布在2025年6月的不同日期
    task_dates = [
        "2025-06-01", "2025-06-01", "2025-06-02", "2025-06-03", "2025-06-03",
        "2025-06-03", "2025-06-05", "2025-06-10", "2025-06-10", "2025-06-15",
        "2025-06-20", "2025-06-20", "2025-06-20", "2025-06-20", "2025-06-25",
        "2025-06-30", "2025-06-30", "2025-06-30", "2025-06-30", "2025-06-30",
        "2025-06-30", "2025-06-30"
    ]
    for idx, date in enumerate(task_dates):
        task = models.Task(
            user_id=user.id,
            title=f"测试任务{idx+1}",
            description="热力图测试任务",
            status=3,  # 已完成
            due_date=date,
            assigned_date=date,
            created_at=date + " 08:00:00",
            updated_at=date + " 09:00:00"
        )
        db.add(task)
    db.commit()
    print(f"已插入{len(task_dates)}条测试任务")

if __name__ == "__main__":
    create_test_user_and_tasks()