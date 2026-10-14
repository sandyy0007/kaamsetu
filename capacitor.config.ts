import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kaamsetu.app',
  appName: 'KaamSetu',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    cleartext: false
  }
};

export default config;
