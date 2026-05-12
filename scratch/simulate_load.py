import asyncio
import httpx
import time

# Use the key we just issued for Partner 2 (ID: 2, RPS: 5)
API_KEY = "rmx_starter_Do1A-JrOJBVbVGmQBbzprReqfKfTZUxf3mNJX2C-cFk"
BASE_URL = "http://localhost:8001"

async def make_request(client, i):
    start_time = time.time()
    try:
        # Hit a valid endpoint that uses get_current_partner.
        response = await client.get(
            f"{BASE_URL}/search_tracks/",
            params={"query": "test"},
            headers={"Authorization": f"Bearer {API_KEY}"}
        )
        latency = time.time() - start_time
        status = response.status_code
        print(f"Req {i:2d}: Status {status}, Latency: {latency:.3f}s")
        if status == 429:
            print(f"  --> [!] RATE LIMITED! Retry-After: {response.headers.get('Retry-After')}s")
        return status
    except Exception as e:
        print(f"Req {i:2d}: Failed - {e}")
        return None

async def run_simulation():
    async with httpx.AsyncClient() as client:
        # Config: Partner 2 has 5 RPS limit.
        # Burst Capacity = RPS * 2 = 10 tokens.
        # We send 20 requests concurrently.
        print(f"Starting simulation against {BASE_URL}...")
        print(f"Target: /search_tracks/ with Partner 2 API Key (5 RPS)\n")
        
        tasks = [make_request(client, i) for i in range(20)]
        results = await asyncio.gather(*tasks)
        
        allowed = sum(1 for r in results if r == 200)
        limited = results.count(429)
        print(f"\n--- Simulation Summary ---")
        print(f"Allowed (200): {allowed}")
        print(f"Rate Limited (429): {limited}")

if __name__ == "__main__":
    asyncio.run(run_simulation())
