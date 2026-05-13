
import asyncio
from sqlalchemy import select
from app.models.user import User
from database.connection import AsyncSessionLocal

async def check_uuid():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == "listener@resomix.com"))
        user = result.scalar_one_or_none()
        if user:
            print(f"Type of user.uuid: {type(user.uuid)}")
            print(f"Value: {user.uuid}")
        else:
            print("User not found")

if __name__ == "__main__":
    asyncio.run(check_uuid())
