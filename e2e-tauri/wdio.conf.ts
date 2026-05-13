export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./specs/**/*.spec.ts'],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'wry',
      'wry:options': {
        binary:
          process.env.TAURI_APP_BINARY ??
          '../src-tauri/target/release/myhealth',
      },
    },
  ],
  hostname: 'localhost',
  port: 4445,
  path: '/',
  logLevel: 'warn',
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60_000,
  },
}
