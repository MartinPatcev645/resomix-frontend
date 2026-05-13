
import asyncio
import httpx

async def check_login():
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        try:
            response = await client.post(
                "/auth/login", 
                json={"email_or_username": "listener@resomix.com", "password": "password123"}
            )
            print(f"Status: {response.status_code}")
            print(f"Body: {response.text}")
            if response.status_code == 200:
                data = response.json()
                print("Login successful")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_login())
