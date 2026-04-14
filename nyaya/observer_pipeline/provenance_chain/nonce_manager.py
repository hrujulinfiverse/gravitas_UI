import uuid
import time
import threading
from typing import Set
import os

class NonceManager:
    def __init__(self, ttl_seconds: int = 600):  # 10 minutes default
        self.ttl_seconds = int(os.getenv('NONCE_TTL_SECONDS', ttl_seconds))
        self.used_nonces: Set[str] = set()
        self.lock = threading.Lock()
        self.cleanup_thread = threading.Thread(target=self._cleanup_expired_nonces, daemon=True)
        self.cleanup_thread.start()

    def generate_nonce(self) -> str:
        """Generate a new unique nonce."""
        nonce = str(uuid.uuid4())
        with self.lock:
            self.used_nonces.add(f"{nonce}:{time.time()}")
        return nonce

    def validate_nonce(self, nonce: str) -> bool:
        """Validate a nonce - must be unused and within TTL."""
        current_time = time.time()

        with self.lock:
            nonce_key = None
            for stored in self.used_nonces:
                if stored.startswith(f"{nonce}:"):
                    nonce_key = stored
                    break

            if nonce_key is None:
                return False  # Nonce not found (never generated)

            # Check if already used
            if nonce_key.endswith(":used"):
                return False

            # Check TTL
            timestamp_str = nonce_key.split(":")[1]
            if not timestamp_str.isdigit():
                return False

            timestamp = float(timestamp_str)
            if current_time - timestamp > self.ttl_seconds:
                self.used_nonces.discard(nonce_key)  # Remove expired
                return False

            # Mark as used
            self.used_nonces.discard(nonce_key)
            self.used_nonces.add(f"{nonce}:{timestamp}:used")
            return True

    def _cleanup_expired_nonces(self):
        """Background thread to clean up expired nonces."""
        while True:
            time.sleep(60)  # Clean up every minute
            current_time = time.time()

            with self.lock:
                expired = set()
                for stored in self.used_nonces:
                    parts = stored.split(":")
                    if len(parts) >= 2 and parts[1].isdigit():
                        timestamp = float(parts[1])
                        if current_time - timestamp > self.ttl_seconds:
                            expired.add(stored)

                self.used_nonces -= expired

# Global instance
nonce_manager = NonceManager()