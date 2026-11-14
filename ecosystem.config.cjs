module.exports = {
  apps: [
    {
      name: 'siakad-backend',
      script: './server',
      cwd: './backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        APP_ENV: 'production',
        APP_PORT: '8080'
      }
    },
    {
      name: 'siakad-frontend',
      script: 'node',
      args: 'build/index.js',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
