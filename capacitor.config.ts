import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;
const isHttpsUrl = serverUrl && serverUrl.startsWith('https://');

const config: CapacitorConfig = {
  appId: 'com.kaamsetu.app',
  appName: 'KaamSetu',
  webDir: 'public',
  server: {
    androidScheme: 'https',
    cleartext: true,
    ...(isHttpsUrl ? { url: serverUrl } : {})
  }
};

export default config;
