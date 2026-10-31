
FROM node:22-bookworm-slim

# Install Python and native dependencies required by Piper
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    libgomp1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy backend source and Prisma schema
COPY . .

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# Install Piper in an isolated Python environment
RUN python3 -m venv /opt/piper-venv \
    && /opt/piper-venv/bin/pip install --no-cache-dir piper-tts

# Download the English voice model
RUN mkdir -p /opt/piper-voices \
    && /opt/piper-venv/bin/python -m piper.download_voices \
       en_US-lessac-medium \
       --data-dir /opt/piper-voices

# Configure Piper and application storage
ENV PIPER_EXE=/opt/piper-venv/bin/piper
ENV PIPER_MODEL=/opt/piper-voices/en_US-lessac-medium.onnx
ENV AUDIO_DIR=/app/audio
ENV UPLOAD_DIR=/app/uploads
ENV NODE_ENV=production

RUN mkdir -p /app/audio /app/uploads

EXPOSE 5000

CMD ["npm", "start"]
