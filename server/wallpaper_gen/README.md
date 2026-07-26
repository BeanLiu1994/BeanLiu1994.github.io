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

## Notes

- All credentials are in `/opt/wallpaper_gen/.env` — never committed to git.
- The `.env` file is loaded via `EnvironmentFile=` in the systemd unit.
- API key (`LLM_API_KEY`) is for the Ollama-compatible endpoint at `dki.ollama.beanee.eu.org`.
- Image generation uses Pollinations.ai (external, no key needed).
