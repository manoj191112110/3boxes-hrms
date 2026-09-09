// PM2 Ecosystem Configuration for 3Boxes HRMS
// Place this file at /home/3boxeshrms/ecosystem.config.js on the VPS

module.exports = {
  apps: [
    {
      name: '3boxes-hrms',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/home/3boxeshrms/app',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      error_file: '/home/3boxeshrms/logs/error.log',
      out_file: '/home/3boxeshrms/logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 30000,
    },
  ],
};
