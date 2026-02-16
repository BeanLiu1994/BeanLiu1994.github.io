#!/bin/bash
echo "Starting HTTP server at http://localhost:8080"
echo "DigitalOcean Manager: http://localhost:8080/tool/vps/digitalocean.html"
echo ""
python3 -m http.server 8080
