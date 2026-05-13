export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./specs/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'wry',
      'tauri:options': {
        application:
          process.env.TAURI_APP_BINARY ??
          '../src-tauri/target/release/myhealth',
      },
    },
  ],
  hostname: 'localhost',
  port: 4444,
  path: '/',
  logLevel: 'warn',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60_000,
  },
}
