module.exports = {
  apps: [
    {
      name: 'huicien-api',
      cwd: '/opt/huicien-v2/backend',
      script: 'server/index.mjs',
      node_args: '--env-file=.env.production',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      listen_timeout: 10000,
      time: true,
      out_file: '/var/log/huicien-v2/pm2-api-out.log',
      error_file: '/var/log/huicien-v2/pm2-api-error.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
      },
    },
  ],
}
