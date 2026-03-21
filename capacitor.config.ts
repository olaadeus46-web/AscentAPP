import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.rotaaomilhao.app',
  appName: 'Rota ao Milhão',
  webDir: 'mobile-web',
  bundledWebRuntime: false,
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
          allowNavigation: ['*'],
        },
      }
    : {}),
  ios: {
    contentInset: 'always',
  },
};

export default config;
