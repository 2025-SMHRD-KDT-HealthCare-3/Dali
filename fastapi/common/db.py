"""FastAPI 전역 aiomysql 커넥션 풀 관리."""

import os
import aiomysql

_pool = None  # aiomysql.Pool


async def create_pool() -> None:
    global _pool
    _pool = await aiomysql.create_pool(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD", ""),
        db=os.getenv("DB_NAME"),
        autocommit=True,
        charset="utf8mb4",
        minsize=1,
        maxsize=10,
    )


async def close_pool() -> None:
    global _pool
    if _pool:
        _pool.close()
        await _pool.wait_closed()
        _pool = None


def get_pool():
    if _pool is None:
        raise RuntimeError("DB pool이 초기화되지 않았습니다.")
    return _pool
