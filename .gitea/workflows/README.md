Criei o serviço systemd conforme a documentação oficial do Gitea! Agora execute estes comandos:

  # 1. Copiar o arquivo de serviço para o systemd
  sudo cp /tmp/act_runner.service /etc/systemd/system/

  # 2. Recarregar o systemd
  sudo systemctl daemon-reload

  # 3. Habilitar o serviço para iniciar no boot
  sudo systemctl enable act_runner

  # 4. Iniciar o serviço agora
  sudo systemctl start act_runner

  Depois disso, você poderá usar os comandos oficiais:

  # Iniciar o runner
  sudo systemctl start act_runner

  # Parar o runner  
  sudo systemctl stop act_runner

  # Ver status
  sudo systemctl status act_runner

  # Ver logs em tempo real
  sudo journalctl -u act_runner -f

  # Reiniciar
  sudo systemctl restart act_runner

  Execute os comandos acima e me avise quando terminar para eu verificar se está funcionando!