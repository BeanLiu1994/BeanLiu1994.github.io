# Wallpaper Generator

AI-powered wallpaper generator deployed at `dki.beanee.eu.org/wallpaper/`.

## Deploy

```bash
# 1. Copy project to server
scp -r wallpaper_gen/ ubuntu@dki.beanee.eu.org:/tmp/wallpaper_gen
ssh ubuntu@dki.beanee.eu.org "sudo cp -r /tmp/wallpaper_gen /opt/ && sudo chown -R ubuntu:ubuntu /opt/wallpaper_gen"

# 2. Create .env with credentials (NEVER commit these)
ssh ubuntu@dki.beanee.eu.org "cat > /opt/wallpaper_gen/.env << 'EOF'
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://dki.ollama.beanee.eu.org/v1
LLM_MODEL=auto
SERVER_PORT=8002
EOF"

# 3. Set up Python venv and install deps
ssh ubuntu@dki.beanee.eu.org "
  cd /opt/wallpaper_gen
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
"

# 4. Deploy systemd service
scp server/wallpaper_gen/wallpaper-gen.service ubuntu@dki.beanee.eu.org:/tmp/
ssh ubuntu@dki.beanee.eu.org "
  sudo cp /tmp/wallpaper-gen.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now wallpaper-gen
  sudo systemctl status wallpaper-gen
"

# 5. Update nginx (add wallpaper location to dki.beanee.eu.org config)
# Add the /wallpaper/ location block directly in the server block of
# /etc/nginx/sites-enabled/dki.beanee.eu.org, before the static location /
ssh ubuntu@dki.beanee.eu.org "
  sudo nginx -t && sudo systemctl reload nginx
"

# 6. Verify
curl https://dki.beanee.eu.org/wallpaper/
```

## Usage

```bash
# 列出所有主题预设
curl https://dki.beanee.eu.org/wallpaper/api/presets

# 生成壁纸（GET，参数全在URL）
curl -o wallpaper.png \
  "https://dki.beanee.eu.org/wallpaper/api/generate?resolution=1920x1080&watermark=true&seed=42"

# 生成壁纸（POST，JSON body）
curl -X POST https://dki.beanee.eu.org/wallpaper/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "1920x1080",
    "watermark": true,
    "seed": 42
  }' \
  -o wallpaper.png

# 可选参数
#   resolution  - 图片尺寸, 默认 1920x1080
#   theme       - 主题预设 (见 /api/presets), 不传则随机
#   watermark   - 是否加水印, 默认 true
#   watermark_text - 自定义水印文字
#   model       - Pollinations 图片模型, 默认 flux
#   custom_prompt - 自定义提示词, 跳过 LLM
#   seed        - 随机种子, 不传则随机
```

API 文档: https://dki.beanee.eu.org/wallpaper/docs

## Notes

- All credentials are in `/opt/wallpaper_gen/.env` — never committed to git.
- The `.env` file is loaded via `EnvironmentFile=` in the systemd unit.
- API key (`LLM_API_KEY`) is for the Ollama-compatible endpoint at `dki.ollama.beanee.eu.org`.
- Image generation uses Pollinations.ai (external, no key needed).
