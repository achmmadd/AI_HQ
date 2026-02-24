cd ~/AI_HQ
./scripts/create_env_if_missing.sh.                                                                  
nano .env         pkill -f telegram_bridge 2>/dev/null
pkill -f heartbeat.py 2>/dev/null
sleep 2
./launch_factory.sh.     ./scripts/grote_controle_alles.sh.       cp 
~/AI_HQ/scripts/omega-holding.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user start omega-holding.service
systemctl --user enable omega-holding.service
