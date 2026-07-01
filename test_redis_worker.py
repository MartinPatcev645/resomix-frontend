import asyncio
import redis.asyncio as aioredis

async def main():
    print("Connecting to local Redis at redis://localhost:6379/0...")
    client = aioredis.Redis.from_url("redis://localhost:6379/0", decode_responses=True)
    
    try:
        await client.ping()
        print("Redis Ping Successful!")
    except Exception as e:
        print(f"FAILED TO PING REDIS: {e}")
        return

    try:
        await client.config_set("notify-keyspace-events", "Ex")
        config = await client.config_get("notify-keyspace-events")
        print(f"Redis config notify-keyspace-events = {config}")
    except Exception as e:
        print(f"Warning: Could not set notify-keyspace-events: {e}")

    pubsub = client.pubsub()
    await pubsub.psubscribe("__keyevent@0__:expired")
    print("Subscribed to '__keyevent@0__:expired'. Starting listener loop...")

    async def listener():
        async for message in pubsub.listen():
            print(f"PUBSUB MESSAGE: {message}")

    listen_task = asyncio.create_task(listener())
    
    # We will set a temporary key that expires very fast
    print("Setting a test key 'session:user:999' with a TTL of 3 seconds...")
    await client.setex("session:user:999", 3, "active")
    
    print("Waiting 5 seconds to see if expiration is caught...")
    await asyncio.sleep(5)
    
    listen_task.cancel()
    await pubsub.close()
    await client.close()
    print("Done testing.")

asyncio.run(main())
