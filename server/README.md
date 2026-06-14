# Server configs

These files document what's deployed on dki.beanee.eu.org (43.165.195.113).
They are NOT served by GitHub Pages — reference only.

## Structure

```
server/
├── pastebin/
│   ├── server.py                  # Python pastebin backend
│   ├── nginx-dki.beanee.eu.org.conf  # nginx site config
│   └── pastebin.service           # systemd unit
└── ...
```

## Deploying

```bash
# Copy server.py to server
scp server/pastebin/server.py ubuntu@dki.beanee.eu.org:/tmp/
ssh ubuntu@dki.beanee.eu.org "sudo cp /tmp/server.py /opt/pastebin/server.py && sudo systemctl restart pastebin"

# Copy nginx config
scp server/pastebin/nginx-dki.beanee.eu.org.conf ubuntu@dki.beanee.eu.org:/tmp/
ssh ubuntu@dki.beanee.eu.org "sudo cp /tmp/nginx-dki.beanee.eu.org.conf /etc/nginx/sites-available/ && sudo nginx -t && sudo systemctl reload nginx"
```
