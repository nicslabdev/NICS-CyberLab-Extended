#!/usr/bin/env bash
set -euo pipefail

VICTIM_IP="${1:?Uso: $0 <VICTIM_IP> <SSH_USER>}"
SSH_USER="${2:?Uso: $0 <VICTIM_IP> <SSH_USER>}"
SSH_KEY="$HOME/.ssh/my_key"

ssh_exec() {
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=no \
        -o ConnectTimeout=5 \
        -o BatchMode=yes \
        "$SSH_USER@$VICTIM_IP" "$1"
}

echo "===================================================="
echo " [INFO] Generando eventos de seguridad en $VICTIM_IP"
echo " [INFO] Usuario SSH: $SSH_USER"
echo "===================================================="

echo "[1/3] Modificando archivos críticos..."
ssh_exec "sudo touch /etc/shadow_backup && sudo chmod 777 /etc/shadow_backup"
echo " [OK] Evento de integridad generado en /etc"

echo "[2/3] Generando intentos de acceso fallidos..."
ssh_exec "for i in {1..3}; do ssh -o ConnectTimeout=1 no-existe@localhost 2>/dev/null || true; done"
echo " [OK] Eventos de autenticación generados"

echo "[3/3] Ejecutando peticiones sospechosas..."
ssh_exec "curl -s -A 'SQLMAP' http://google.com > /dev/null || true"
ssh_exec "curl -s http://testmyids.com > /dev/null || true"
echo " [OK] Tráfico de red (User-Agent malicioso) generado"

echo "===================================================="
echo " [SUCCESS] Eventos enviados. Revisa tu monitor remoto."
echo "===================================================="