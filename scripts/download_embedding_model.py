import os
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Optional Hugging Face access token from environment (not hardcoded)
token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN", "")
model_url = "https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/resolve/main/model.safetensors"
out_dir = Path("d:/Projects/Traject/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
out_file = out_dir / "model.safetensors"

out_dir.mkdir(parents=True, exist_ok=True)

print(f"Resolving direct CDN link for {model_url}...")
headers = {"Authorization": f"Bearer {token}"} if token else {}
req = urllib.request.Request(model_url, headers=headers)
with urllib.request.urlopen(req) as resp:
    final_url = resp.geturl()
    total_bytes = int(resp.headers.get("Content-Length", 0))

print(f"Total file size: {total_bytes} bytes ({total_bytes / (1024 * 1024):.1f} MB)")

CHUNK_SIZE = 4 * 1024 * 1024  # 4 MB chunks
num_chunks = (total_bytes + CHUNK_SIZE - 1) // CHUNK_SIZE

# Pre-allocate file
with open(out_file, "wb") as f:
    f.seek(total_bytes - 1)
    f.write(b"\0")

downloaded_bytes = 0
start_time = time.perf_counter()


def download_chunk(idx: int) -> int:
    c_start = idx * CHUNK_SIZE
    c_end = min(c_start + CHUNK_SIZE - 1, total_bytes - 1)
    length = c_end - c_start + 1

    r = urllib.request.Request(final_url, headers={"Range": f"bytes={c_start}-{c_end}"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(r, timeout=30) as resp:
                data = resp.read()
                if len(data) != length:
                    raise IOError(f"Incomplete read: got {len(data)}, expected {length}")
                with open(out_file, "r+b") as f:
                    f.seek(c_start)
                    f.write(data)
                return length
        except Exception as e:
            time.sleep(1 + attempt)
            if attempt == 4:
                raise e


print(f"Starting parallel download with 16 workers ({num_chunks} chunks of 4MB)...")
with ThreadPoolExecutor(max_workers=16) as executor:
    futures = {executor.submit(download_chunk, i): i for i in range(num_chunks)}
    completed = 0
    for future in as_completed(futures):
        chunk_len = future.result()
        downloaded_bytes += chunk_len
        completed += 1
        elapsed = time.perf_counter() - start_time
        speed_mb = (downloaded_bytes / (1024 * 1024)) / elapsed if elapsed > 0 else 0.0
        pct = (downloaded_bytes / total_bytes) * 100
        print(f"\rProgress: {completed}/{num_chunks} chunks ({pct:.1f}%) | Speed: {speed_mb:.2f} MB/s | Elapsed: {elapsed:.0f}s", end="", flush=True)

print(f"\nDownload completed successfully in {time.perf_counter() - start_time:.1f}s!")
