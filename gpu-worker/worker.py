import os, uuid, threading, subprocess, time
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

APP_DIR = Path('/srv')
WAN_DIR = Path(os.getenv('WAN_DIR', '/srv/Wan2.1'))
MODEL_DIR = Path(os.getenv('MODEL_DIR', '/models/Wan2.1-T2V-1.3B'))
OUTPUT_DIR = Path(os.getenv('OUTPUT_DIR', '/data/videos'))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
API_TOKEN = os.getenv('GPU_WORKER_TOKEN', '')
TASKS = {}
LOCK = threading.Lock()
app = FastAPI(title='Self-hosted video generation worker', version='1.0.0')

class JobInput(BaseModel):
    prompt: str = Field(min_length=8, max_length=1800)
    duration: int = Field(default=5, ge=5, le=10)


def auth(token: Optional[str]):
    if not API_TOKEN:
        raise HTTPException(503, 'GPU_WORKER_TOKEN is not configured')
    if token != API_TOKEN:
        raise HTTPException(401, 'Unauthorized')


def run_job(job_id: str, prompt: str, duration: int):
    out = OUTPUT_DIR / f'{job_id}.mp4'
    # Wan2.1 T2V-1.3B generates a short fixed-length clip; duration is retained as metadata.
    cmd = [
        'python3', str(WAN_DIR / 'generate.py'), '--task', 't2v-1.3B',
        '--size', '832*480', '--ckpt_dir', str(MODEL_DIR),
        '--offload_model', 'True', '--t5_cpu', '--sample_shift', '8',
        '--sample_guide_scale', '6', '--save_file', str(out), '--prompt', prompt
    ]
    try:
        with LOCK:
            TASKS[job_id] = {'status': 'processing', 'created_at': time.time()}
        result = subprocess.run(cmd, cwd=str(WAN_DIR), capture_output=True, text=True, timeout=3600)
        if result.returncode != 0 or not out.exists():
            raise RuntimeError((result.stderr or result.stdout or 'Wan generation failed')[-3000:])
        with LOCK:
            TASKS[job_id] = {'status': 'completed', 'created_at': TASKS[job_id]['created_at'], 'file': str(out)}
    except Exception as exc:
        with LOCK:
            TASKS[job_id] = {'status': 'failed', 'created_at': TASKS.get(job_id, {}).get('created_at', time.time()), 'error': str(exc)[-3000:]}

@app.get('/health')
def health():
    return {'ok': True, 'model_dir_exists': MODEL_DIR.exists(), 'wan_dir_exists': (WAN_DIR / 'generate.py').exists(), 'gpu_worker_token_configured': bool(API_TOKEN)}

@app.post('/jobs', status_code=202)
def create_job(data: JobInput, x_gpu_worker_token: Optional[str] = Header(default=None)):
    auth(x_gpu_worker_token)
    if not (MODEL_DIR / 'diffusion_pytorch_model.safetensors').exists() and not any(MODEL_DIR.glob('*.safetensors')):
        raise HTTPException(503, f'Model weights not found in {MODEL_DIR}; download Wan-AI/Wan2.1-T2V-1.3B first')
    job_id = uuid.uuid4().hex
    with LOCK:
        TASKS[job_id] = {'status': 'queued', 'created_at': time.time()}
    threading.Thread(target=run_job, args=(job_id, data.prompt, data.duration), daemon=True).start()
    return {'id': job_id, 'status': 'queued'}

@app.get('/jobs/{job_id}')
def get_job(job_id: str, x_gpu_worker_token: Optional[str] = Header(default=None)):
    auth(x_gpu_worker_token)
    with LOCK:
        task = TASKS.get(job_id)
    if not task:
        raise HTTPException(404, 'Job not found (worker restarted or unknown id)')
    return {k: v for k, v in task.items() if k != 'file'} | ({'video_path': f'/jobs/{job_id}/video'} if task['status'] == 'completed' else {})

@app.get('/jobs/{job_id}/video')
def get_video(job_id: str, x_gpu_worker_token: Optional[str] = Header(default=None)):
    auth(x_gpu_worker_token)
    with LOCK:
        task = TASKS.get(job_id)
    if not task or task.get('status') != 'completed' or not task.get('file'):
        raise HTTPException(404, 'Video not ready')
    return FileResponse(task['file'], media_type='video/mp4', filename=f'{job_id}.mp4')
