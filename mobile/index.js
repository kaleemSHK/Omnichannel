import 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.config.json';

// Required for data-only / notification payloads when the app is backgrounded.
messaging().setBackgroundMessageHandler(async () => {
  // FCM displays the notification from the server payload; SIP reconnect on tap.
});

AppRegistry.registerComponent(appName, () => App);
