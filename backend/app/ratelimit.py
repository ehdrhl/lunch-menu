"""로그인 무차별 대입 방지: IP당 1분에 틀린 로그인이 20번을 넘으면 막는다."""
import time
from collections.abc import Callable


class FailedLoginLimiter:
    def __init__(self, limit: int = 20, window: float = 60.0, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window = window
        self._clock = clock
        self._fails: dict[str, list[float]] = {}  # ip -> 실패 시각들

    def _prune(self, ip: str, now: float) -> list[float]:
        times = [t for t in self._fails.get(ip, []) if now - t < self.window]
        if times:
            self._fails[ip] = times
        else:
            self._fails.pop(ip, None)
        return times

    def blocked(self, ip: str) -> bool:
        return len(self._prune(ip, self._clock())) >= self.limit

    def record(self, ip: str) -> None:
        now = self._clock()
        times = self._prune(ip, now)
        times.append(now)
        self._fails[ip] = times

    def clear(self, ip: str) -> None:
        """로그인에 성공하면 그 IP의 실패 기록을 지운다."""
        self._fails.pop(ip, None)

    def retry_after(self, ip: str) -> int:
        """차단이 풀리기까지 남은 초(가장 오래된 실패가 창 밖으로 나갈 때까지)"""
        times = self._prune(ip, self._clock())
        if len(times) < self.limit:
            return 0
        return max(1, int(self.window - (self._clock() - min(times))) + 1)

    def reset(self) -> None:
        self._fails.clear()


limiter = FailedLoginLimiter()
