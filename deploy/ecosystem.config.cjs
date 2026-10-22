// PM2 config untuk GCE VM: 2 proses (web Next.js + wrapper OpenCode).
// Wrapper auto-start `opencode serve` via Service.ensure(), jadi tidak perlu proses ke-3.
// Jalankan dari VM: pm2 start ~/deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "reportgov-web",
      cwd: process.env.HOME + "/ReportGov",
      script: "npm",
      args: "run start -- -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
    {
      name: "reportgov-wrapper",
      cwd: process.env.HOME + "/ReportGov",
      script: "node",
      args: "services/opencode-wrapper/server.js",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
    },
  ],
};
