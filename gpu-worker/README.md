# Self-hosted GPU worker (no video-generation API)

This service runs the open-weight Wan2.1 T2V-1.3B model locally. It does not call fal.ai or another hosted video-generation API. The Telegram bot can call this worker over a private network using `GPU_WORKER_URL` and `GPU_WORKER_TOKEN`.

## Reality check: zero budget

The model weights and code are free, but GPU compute is not magically free. For a genuinely zero-money setup, run this on a computer you already own with a compatible NVIDIA GPU and roughly 8 GB VRAM or more. Official Wan2.1 documentation reports about 8.19 GB VRAM for T2V-1.3B and approximately four minutes for a 5-second 480P video on an RTX 4090; slower GPUs may take much longer. Railway is not a free GPU host and should continue to host only the Telegram bot/database.

## Model setup

1. Install NVIDIA drivers and Docker with NVIDIA Container Toolkit on the GPU machine.
2. Download the model weights from the official Hugging Face repository: `Wan-AI/Wan2.1-T2V-1.3B` into a persistent directory mounted as `/models/Wan2.1-T2V-1.3B`.
3. Build this directory: `docker build -t stars-video-worker ./gpu-worker`.
4. Run with persistent storage and a long random token:

```sh
docker run --gpus all --restart unless-stopped \
  -p 127.0.0.1:7860:7860 \
  -v "$PWD/models:/models" -v "$PWD/videos:/data/videos" \
  -e MODEL_DIR=/models/Wan2.1-T2V-1.3B \
  -e GPU_WORKER_TOKEN='replace-with-a-long-random-secret' \
  stars-video-worker
```

Do not expose port 7860 to the public internet without HTTPS and a secure private tunnel. The token is required for all job and video endpoints. `/health` intentionally reveals only whether configuration paths exist.

## Endpoints

- `GET /health`
- `POST /jobs` JSON `{ "prompt": "a fox walks through a snowy forest", "duration": 5 }`, header `X-GPU-Worker-Token`
- `GET /jobs/{id}` to poll status (`queued`, `processing`, `completed`, `failed`)
- `GET /jobs/{id}/video` to download MP4

## Important limitations of this first worker

- This is a single-process prototype; task state is in memory and is lost if the worker restarts. Keep the GPU machine running until a job completes.
- It serializes actual GPU inference with a lock.
- The initial endpoint supports text-to-video. Photo animation and robust multi-worker queueing are follow-up tasks.
- The exact `generate.py` CLI and output path should be smoke-tested against the installed Wan2.1 revision and model weights before production. Do not advertise the worker as live until a test clip completes.
- Check Wan2.1 license and model terms before commercial use.
