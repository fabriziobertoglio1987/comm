// @flow

import * as React from 'react';
import { AppRegistry, Platform, Alert, Vibration, LogBox } from 'react-native';
import type { RemoteMessage, NotificationOpen } from 'react-native-firebase';
import {
  Notification as InAppNotification,
  TapticFeedback,
} from 'react-native-in-app-message';
import NotificationsIOS from 'react-native-notifications';
import { useDispatch } from 'react-redux';

import {
  setDeviceTokenActionTypes,
  setDeviceToken,
} from 'lib/actions/device-actions';
import {
  unreadCount,
  threadInfoSelector,
} from 'lib/selectors/thread-selectors';
import { isLoggedIn } from 'lib/selectors/user-selectors';
import { mergePrefixIntoBody } from 'lib/shared/notif-utils';
import type { Dispatch } from 'lib/types/redux-types';
import { type ConnectionInfo } from 'lib/types/socket-types';
import { type ThreadInfo } from 'lib/types/thread-types';
import {
  useServerCall,
  useDispatchActionPromise,
  type DispatchActionPromise,
} from 'lib/utils/action-utils';

import {
  addLifecycleListener,
  getCurrentLifecycleState,
} from '../lifecycle/lifecycle';
import { replaceWithThreadActionType } from '../navigation/action-types';
import { activeMessageListSelector } from '../navigation/nav-selectors';
import { NavContext } from '../navigation/navigation-context';
import type { RootNavigationProp } from '../navigation/root-navigator.react';
import { MessageListRouteName } from '../navigation/route-names';
import {
  recordNotifPermissionAlertActionType,
  clearAndroidNotificationsActionType,
} from '../redux/action-types';
import { useSelector } from '../redux/redux-utils';
import { RootContext, type RootContextType } from '../root-context';
import { type GlobalTheme } from '../types/themes';
import { type NotifPermissionAlertInfo } from './alerts';
import {
  androidNotificationChannelID,
  handleAndroidMessage,
  androidBackgroundMessageTask,
} from './android';
import { getFirebase } from './firebase';
import InAppNotif from './in-app-notif.react';
import {
  requestIOSPushPermissions,
  iosPushPermissionResponseReceived,
} from './ios';
import { saveMessageInfos } from './utils';

LogBox.ignoreLogs([
  // react-native-firebase
  'Require cycle: ../node_modules/react-native-firebase',
  // react-native-in-app-message
  'ForceTouchGestureHandler is not available',
]);

const msInDay = 24 * 60 * 60 * 1000;
const supportsTapticFeedback =
  Platform.OS === 'ios' && parseInt(Platform.Version, 10) >= 10;

type BaseProps = {|
  +navigation: RootNavigationProp<'App'>,
|};
type Props = {|
  ...BaseProps,
  // Navigation state
  +activeThread: ?string,
  // Redux state
  +unreadCount: number,
  +deviceToken: ?string,
  +threadInfos: { [id: string]: ThreadInfo },
  +notifPermissionAlertInfo: NotifPermissionAlertInfo,
  +connection: ConnectionInfo,
  +updatesCurrentAsOf: number,
  +activeTheme: ?GlobalTheme,
  +loggedIn: boolean,
  // Redux dispatch functions
  +dispatch: Dispatch,
  +dispatchActionPromise: DispatchActionPromise,
  // async functions that hit server APIs
  +setDeviceToken: (deviceToken: string) => Promise<string>,
  // withRootContext
  +rootContext: ?RootContextType,
|};
type State = {|
  +inAppNotifProps: ?{|
    +customComponent: React.Node,
    +blurType: ?('xlight' | 'dark'),
    +onPress: () => void,
  |},
|};
class PushHandler extends React.PureComponent<Props, State> {
  state: State = {
    inAppNotifProps: null,
  };
  currentState: ?string = getCurrentLifecycleState();
  appStarted = 0;
  androidTokenListener: ?() => void = null;
  androidMessageListener: ?() => void = null;
  androidNotifOpenListener: ?() => void = null;
  initialAndroidNotifHandled = false;
  openThreadOnceReceived: Set<string> = new Set();
  lifecycleSubscription: ?{ +remove: () => void };

  componentDidMount() {
    this.appStarted = Date.now();
    this.lifecycleSubscription = addLifecycleListener(
      this.handleAppStateChange,
    );
    this.onForeground();
    if (Platform.OS === 'ios') {
      NotificationsIOS.addEventListener(
        'remoteNotificationsRegistered',
        this.registerPushPermissions,
      );
      NotificationsIOS.addEventListener(
        'remoteNotificationsRegistrationFailed',
        this.failedToRegisterPushPermissions,
      );
      NotificationsIOS.addEventListener(
        'notificationReceivedForeground',
        this.iosForegroundNotificationReceived,
      );
      NotificationsIOS.addEventListener(
        'notificationOpened',
        this.iosNotificationOpened,
      );
    } else if (Platform.OS === 'android') {
      const firebase = getFirebase();
      const channel = new firebase.notifications.Android.Channel(
        androidNotificationChannelID,
        'Default',
        firebase.notifications.Android.Importance.Max,
      ).setDescription('SquadCal notifications channel');
      firebase.notifications().android.createChannel(channel);
      this.androidTokenListener = firebase
        .messaging()
        .onTokenRefresh(this.handleAndroidDeviceToken);
      this.androidMessageListener = firebase
        .messaging()
        .onMessage(this.androidMessageReceived);
      this.androidNotifOpenListener = firebase
        .notifications()
        .onNotificationOpened(this.androidNotificationOpened);
    }
  }

  componentWillUnmount() {
    if (this.lifecycleSubscription) {
      this.lifecycleSubscription.remove();
    }
    if (Platform.OS === 'ios') {
      NotificationsIOS.removeEventListener(
        'remoteNotificationsRegistered',
        this.registerPushPermissions,
      );
      NotificationsIOS.removeEventListener(
        'remoteNotificationsRegistrationFailed',
        this.failedToRegisterPushPermissions,
      );
      NotificationsIOS.removeEventListener(
        'notificationReceivedForeground',
        this.iosForegroundNotificationReceived,
      );
      NotificationsIOS.removeEventListener(
        'notificationOpened',
        this.iosNotificationOpened,
      );
    } else if (Platform.OS === 'android') {
      if (this.androidTokenListener) {
        this.androidTokenListener();
        this.androidTokenListener = null;
      }
      if (this.androidMessageListener) {
        this.androidMessageListener();
        this.androidMessageListener = null;
      }
      if (this.androidNotifOpenListener) {
        this.androidNotifOpenListener();
        this.androidNotifOpenListener = null;
      }
    }
  }

  handleAppStateChange = (nextState: ?string) => {
    if (!nextState || nextState === 'unknown') {
      return;
    }
    const lastState = this.currentState;
    this.currentState = nextState;
    if (lastState === 'background' && nextState === 'active') {
      this.onForeground();
      this.clearNotifsOfThread();
    }
  };

  onForeground() {
    if (this.props.loggedIn) {
      this.ensurePushNotifsEnabled();
    } else if (this.props.deviceToken) {
      // We do this in case there was a crash, so we can clear deviceToken from
      // any other cookies it might be set for
      this.setDeviceToken(this.props.deviceToken);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.activeThread !== prevProps.activeThread) {
      this.clearNotifsOfThread();
    }

    if (
      this.props.connection.status === 'connected' &&
      (prevProps.connection.status !== 'connected' ||
        this.props.unreadCount !== prevProps.unreadCount)
    ) {
      this.updateBadgeCount();
    }

    for (const threadID of this.openThreadOnceReceived) {
      const threadInfo = this.props.threadInfos[threadID];
      if (threadInfo) {
        this.navigateToThread(threadInfo, false);
        this.openThreadOnceReceived.clear();
        break;
      }
    }

    if (
      (this.props.loggedIn && !prevProps.loggedIn) ||
      (!this.props.deviceToken && prevProps.deviceToken)
    ) {
      this.ensurePushNotifsEnabled();
    }

    if (!this.props.loggedIn && prevProps.loggedIn) {
      this.clearAllNotifs();
    }

    if (
      this.state.inAppNotifProps &&
      this.state.inAppNotifProps !== prevState.inAppNotifProps
    ) {
      if (supportsTapticFeedback) {
        TapticFeedback.impact();
      } else {
        Vibration.vibrate(400);
      }
      InAppNotification.show();
    }
  }

  updateBadgeCount() {
    const curUnreadCount = this.props.unreadCount;
    if (Platform.OS === 'ios') {
      NotificationsIOS.setBadgesCount(curUnreadCount);
    } else if (Platform.OS === 'android') {
      getFirebase().notifications().setBadge(curUnreadCount);
    }
  }

  clearAllNotifs() {
    if (Platform.OS === 'ios') {
      NotificationsIOS.removeAllDeliveredNotifications();
    } else if (Platform.OS === 'android') {
      getFirebase().notifications().removeAllDeliveredNotifications();
    }
  }

  clearNotifsOfThread() {
    const { activeThread } = this.props;
    if (!activeThread) {
      return;
    }
    if (Platform.OS === 'ios') {
      NotificationsIOS.getDeliveredNotifications(notifications =>
        PushHandler.clearDeliveredIOSNotificationsForThread(
          activeThread,
          notifications,
        ),
      );
    } else if (Platform.OS === 'android') {
      this.props.dispatch({
        type: clearAndroidNotificationsActionType,
        payload: { threadID: activeThread },
      });
    }
  }

  static clearDeliveredIOSNotificationsForThread(
    threadID: string,
    notifications: Object[],
  ) {
    const identifiersToClear = [];
    for (const notification of notifications) {
      if (notification['thread-id'] === threadID) {
        identifiersToClear.push(notification.identifier);
      }
    }
    if (identifiersToClear) {
      NotificationsIOS.removeDeliveredNotifications(identifiersToClear);
    }
  }

  async ensurePushNotifsEnabled() {
    if (!this.props.loggedIn) {
      return;
    }
    if (Platform.OS === 'ios') {
      const missingDeviceToken =
        this.props.deviceToken === null || this.props.deviceToken === undefined;
      await requestIOSPushPermissions(missingDeviceToken);
    } else if (Platform.OS === 'android') {
      await this.ensureAndroidPushNotifsEnabled();
    }
  }

  async ensureAndroidPushNotifsEnabled() {
    const firebase = getFirebase();
    const hasPermission = await firebase.messaging().hasPermission();
    if (!hasPermission) {
      try {
        await firebase.messaging().requestPermission();
      } catch {
        this.failedToRegisterPushPermissions();
        return;
      }
    }

    const fcmToken = await firebase.messaging().getToken();
    if (fcmToken) {
      await this.handleAndroidDeviceToken(fcmToken);
    } else {
      this.failedToRegisterPushPermissions();
    }
  }

  handleAndroidDeviceToken = async (deviceToken: string) => {
    this.registerPushPermissions(deviceToken);
    await this.handleInitialAndroidNotification();
  };

  async handleInitialAndroidNotification() {
    if (this.initialAndroidNotifHandled) {
      return;
    }
    this.initialAndroidNotifHandled = true;
    const initialNotif = await getFirebase()
      .notifications()
      .getInitialNotification();
    if (initialNotif) {
      await this.androidNotificationOpened(initialNotif);
    }
  }

  registerPushPermissions = (deviceToken: string) => {
    const deviceType = Platform.OS;
    if (deviceType !== 'android' && deviceType !== 'ios') {
      return;
    }
    if (deviceType === 'ios') {
      iosPushPermissionResponseReceived();
    }
    if (deviceToken !== this.props.deviceToken) {
      this.setDeviceToken(deviceToken);
    }
  };

  setDeviceToken(deviceToken: string) {
    this.props.dispatchActionPromise(
      setDeviceTokenActionTypes,
      this.props.setDeviceToken(deviceToken),
      undefined,
      deviceToken,
    );
  }

  failedToRegisterPushPermissions = () => {
    if (!this.props.loggedIn) {
      return;
    }
    const deviceType = Platform.OS;
    if (deviceType === 'ios') {
      iosPushPermissionResponseReceived();
      if (__DEV__) {
        // iOS simulator can't handle notifs
        return;
      }
    }

    const alertInfo = this.props.notifPermissionAlertInfo;
    if (
      (alertInfo.totalAlerts > 3 &&
        alertInfo.lastAlertTime > Date.now() - msInDay) ||
      (alertInfo.totalAlerts > 6 &&
        alertInfo.lastAlertTime > Date.now() - msInDay * 3) ||
      (alertInfo.totalAlerts > 9 &&
        alertInfo.lastAlertTime > Date.now() - msInDay * 7)
    ) {
      return;
    }
    this.props.dispatch({
      type: recordNotifPermissionAlertActionType,
      payload: { time: Date.now() },
    });

    if (deviceType === 'ios') {
      Alert.alert(
        'Need notif permissions',
        'SquadCal needs notification permissions to keep you in the loop! ' +
          'Please enable in Settings App -> Notifications -> SquadCal.',
        [{ text: 'OK' }],
      );
    } else if (deviceType === 'android') {
      Alert.alert(
        'Unable to initialize notifs!',
        'Please check your network connection, make sure Google Play ' +
          'services are installed and enabled, and confirm that your Google ' +
          'Play credentials are valid in the Google Play Store.',
        undefined,
        { cancelable: true },
      );
    }
  };

  navigateToThread(threadInfo: ThreadInfo, clearChatRoutes: boolean) {
    if (clearChatRoutes) {
      this.props.navigation.dispatch({
        type: replaceWithThreadActionType,
        payload: { threadInfo },
      });
    } else {
      this.props.navigation.navigate({
        name: MessageListRouteName,
        key: `${MessageListRouteName}${threadInfo.id}`,
        params: { threadInfo },
      });
    }
  }

  onPressNotificationForThread(threadID: string, clearChatRoutes: boolean) {
    const threadInfo = this.props.threadInfos[threadID];
    if (threadInfo) {
      this.navigateToThread(threadInfo, clearChatRoutes);
    } else {
      this.openThreadOnceReceived.add(threadID);
    }
  }

  saveMessageInfos(messageInfosString: string) {
    saveMessageInfos(messageInfosString, this.props.updatesCurrentAsOf);
  }

  iosForegroundNotificationReceived = notification => {
    if (
      notification.getData() &&
      notification.getData().managedAps &&
      notification.getData().managedAps.action === 'CLEAR'
    ) {
      notification.finish(NotificationsIOS.FetchResult.NoData);
      return;
    }
    if (Date.now() < this.appStarted + 1500) {
      // On iOS, when the app is opened from a notif press, for some reason this
      // callback gets triggered before iosNotificationOpened. In fact this
      // callback shouldn't be triggered at all. To avoid weirdness we are
      // ignoring any foreground notification received within the first second
      // of the app being started, since they are most likely to be erroneous.
      notification.finish(NotificationsIOS.FetchResult.NoData);
      return;
    }
    const threadID = notification.getData().threadID;
    if (!threadID) {
      console.log('Notification with missing threadID received!');
      notification.finish(NotificationsIOS.FetchResult.NoData);
      return;
    }
    const messageInfos = notification.getData().messageInfos;
    if (messageInfos) {
      this.saveMessageInfos(messageInfos);
    }
    let title = null;
    let body = notification.getMessage();
    if (notification.getData().title) {
      ({ title, body } = mergePrefixIntoBody(notification.getData()));
    }
    this.showInAppNotification(threadID, body, title);
    notification.finish(NotificationsIOS.FetchResult.NewData);
  };

  onPushNotifBootsApp() {
    if (
      this.props.rootContext &&
      this.props.rootContext.detectUnsupervisedBackground
    ) {
      this.props.rootContext.detectUnsupervisedBackground(false);
    }
  }

  iosNotificationOpened = notification => {
    this.onPushNotifBootsApp();
    const threadID = notification.getData().threadID;
    if (!threadID) {
      console.log('Notification with missing threadID received!');
      notification.finish(NotificationsIOS.FetchResult.NoData);
      return;
    }
    const messageInfos = notification.getData().messageInfos;
    if (messageInfos) {
      this.saveMessageInfos(messageInfos);
    }
    this.onPressNotificationForThread(threadID, true);
    notification.finish(NotificationsIOS.FetchResult.NewData);
  };

  showInAppNotification(threadID: string, message: string, title?: ?string) {
    if (threadID === this.props.activeThread) {
      return;
    }
    this.setState({
      inAppNotifProps: {
        customComponent: (
          <InAppNotif
            title={title}
            message={message}
            activeTheme={this.props.activeTheme}
          />
        ),
        blurType: this.props.activeTheme === 'dark' ? 'xlight' : 'dark',
        onPress: () => {
          InAppNotification.hide();
          this.onPressNotificationForThread(threadID, false);
        },
      },
    });
  }

  androidNotificationOpened = async (notificationOpen: NotificationOpen) => {
    this.onPushNotifBootsApp();
    const { threadID } = notificationOpen.notification.data;
    this.onPressNotificationForThread(threadID, true);
  };

  androidMessageReceived = async (message: RemoteMessage) => {
    this.onPushNotifBootsApp();
    handleAndroidMessage(
      message,
      this.props.updatesCurrentAsOf,
      this.handleAndroidNotificationIfActive,
    );
  };

  handleAndroidNotificationIfActive = (
    threadID: string,
    texts: {| body: string, title: ?string |},
  ) => {
    if (this.currentState !== 'active') {
      return false;
    }
    this.showInAppNotification(threadID, texts.body, texts.title);
    return true;
  };

  render() {
    return (
      <InAppNotification
        {...this.state.inAppNotifProps}
        hideStatusBar={false}
      />
    );
  }
}

AppRegistry.registerHeadlessTask(
  'RNFirebaseBackgroundMessage',
  () => androidBackgroundMessageTask,
);

export default React.memo<BaseProps>(function ConnectedPushHandler(
  props: BaseProps,
) {
  const navContext = React.useContext(NavContext);
  const activeThread = activeMessageListSelector(navContext);
  const boundUnreadCount = useSelector(unreadCount);
  const deviceToken = useSelector(state => state.deviceToken);
  const threadInfos = useSelector(threadInfoSelector);
  const notifPermissionAlertInfo = useSelector(
    state => state.notifPermissionAlertInfo,
  );
  const connection = useSelector(state => state.connection);
  const updatesCurrentAsOf = useSelector(state => state.updatesCurrentAsOf);
  const activeTheme = useSelector(state => state.globalThemeInfo.activeTheme);
  const loggedIn = useSelector(isLoggedIn);
  const dispatch = useDispatch();
  const dispatchActionPromise = useDispatchActionPromise();
  const boundSetDeviceToken = useServerCall(setDeviceToken);
  const rootContext = React.useContext(RootContext);
  return (
    <PushHandler
      {...props}
      activeThread={activeThread}
      unreadCount={boundUnreadCount}
      deviceToken={deviceToken}
      threadInfos={threadInfos}
      notifPermissionAlertInfo={notifPermissionAlertInfo}
      connection={connection}
      updatesCurrentAsOf={updatesCurrentAsOf}
      activeTheme={activeTheme}
      loggedIn={loggedIn}
      dispatch={dispatch}
      dispatchActionPromise={dispatchActionPromise}
      setDeviceToken={boundSetDeviceToken}
      rootContext={rootContext}
    />
  );
});
