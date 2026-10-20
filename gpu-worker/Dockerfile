FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip git ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
RUN git clone --depth 1 https://github.com/Wan-Video/Wan2.1.git /srv/Wan2.1
RUN pip3 install --upgrade pip && pip3 install -r /srv/Wan2.1/requirements.txt && pip3 install fastapi==0.115.12 'uvicorn[standard]==0.34.0'
COPY worker.py /srv/worker.py
EXPOSE 7860
CMD ["python3", "-m", "uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "7860"]
