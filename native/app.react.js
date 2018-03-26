// @flow

import type {
  NavigationState,
  NavigationAction,
  NavigationScreenProp,
} from 'react-navigation';
import type { Dispatch } from 'lib/types/redux-types';
import type { AppState } from './redux-setup';
import type { Action } from './navigation-setup';
import type { PingResult, PingStartingPayload } from 'lib/types/ping-types';
import type {
  DispatchActionPayload,
  DispatchActionPromise,
} from 'lib/utils/action-utils';
import type { CalendarQuery } from 'lib/types/entry-types';
import type {
  ActivityUpdate,
  UpdateActivityResult,
} from 'lib/types/activity-types';
import type { RawThreadInfo } from 'lib/types/thread-types';
import { rawThreadInfoPropType } from 'lib/types/thread-types';
import type { DeviceType } from 'lib/types/device-types';
import {
  type NotifPermissionAlertInfo,
  notifPermissionAlertInfoPropType,
  recordNotifPermissionAlertActionType,
} from './push/alerts';

import React from 'react';
import { Provider } from 'react-redux';
import {
  AppRegistry,
  Platform,
  UIManager,
  AppState as NativeAppState,
  Linking,
  View,
  StyleSheet,
  Alert,
  DeviceInfo,
} from 'react-native';
import { addNavigationHelpers } from 'react-navigation';
import { createReduxBoundAddListener } from 'react-navigation-redux-helpers';
import invariant from 'invariant';
import PropTypes from 'prop-types';
import NotificationsIOS from 'react-native-notifications';
import InAppNotification from 'react-native-in-app-notification';
import FCM, { FCMEvent } from 'react-native-fcm';
import SplashScreen from 'react-native-splash-screen';

import { registerConfig } from 'lib/utils/config';
import { connect } from 'lib/utils/redux-utils';
import { pingActionTypes, ping } from 'lib/actions/ping-actions';
import { sessionInactivityLimit } from 'lib/selectors/session-selectors';
import { newSessionIDActionType } from 'lib/reducers/session-reducer';
import {
  updateActivityActionTypes,
  updateActivity,
} from 'lib/actions/ping-actions';
import {
  setDeviceTokenActionTypes,
  setDeviceToken,
} from 'lib/actions/device-actions';
import { unreadCount } from 'lib/selectors/thread-selectors';
import { notificationPressActionType } from 'lib/shared/notif-utils';
import { pingFrequency } from 'lib/shared/ping-utils';

import {
  handleURLActionType,
  RootNavigator,
  AppRouteName,
} from './navigation-setup';
import { store } from './redux-setup';
import { resolveInvalidatedCookie } from './account/native-credentials';
import { pingNativeStartingPayload } from './selectors/ping-selectors';
import ConnectedStatusBar from './connected-status-bar.react';
import {
  activeThreadSelector,
  createIsForegroundSelector,
} from './selectors/nav-selectors';
import {
  requestIOSPushPermissions,
  iosPushPermissionResponseReceived,
} from './push/ios';
import {
  requestAndroidPushPermissions,
  recordAndroidNotificationActionType,
  clearAndroidNotificationActionType,
} from './push/android';
import NotificationBody from './push/notification-body.react';
import ErrorBoundary from './error-boundary.react';

registerConfig({
  resolveInvalidatedCookie,
  getNewCookie: async (response: Object) => {
    if (response.cookieChange && response.cookieChange.cookie) {
      return response.cookieChange.cookie;
    }
    return null;
  },
  setCookieOnRequest: true,
  calendarRangeInactivityLimit: sessionInactivityLimit,
});

const reactNavigationAddListener = createReduxBoundAddListener("root");
const msInDay = 24 * 60 * 60 * 1000;

type NativeDispatch = Dispatch & ((action: NavigationAction) => boolean);

type Props = {
  // Redux state
  cookie: ?string,
  navigationState: NavigationState,
  pingStartingPayload: () => PingStartingPayload,
  currentAsOf: number,
  activeThread: ?string,
  appLoggedIn: bool,
  activeThreadLatestMessage: ?string,
  deviceToken: ?string,
  unreadCount: number,
  rawThreadInfos: {[id: string]: RawThreadInfo},
  notifPermissionAlertInfo: NotifPermissionAlertInfo,
  // Redux dispatch functions
  dispatch: NativeDispatch,
  dispatchActionPayload: DispatchActionPayload,
  dispatchActionPromise: DispatchActionPromise,
  // async functions that hit server APIs
  ping: (
    calendarQuery: CalendarQuery,
    lastPing: number,
  ) => Promise<PingResult>,
  updateActivity: (
    activityUpdates: $ReadOnlyArray<ActivityUpdate>,
  ) => Promise<UpdateActivityResult>,
  setDeviceToken: (
    deviceToken: string,
    deviceType: DeviceType,
  ) => Promise<string>,
};
class AppWithNavigationState extends React.PureComponent<Props> {

  static propTypes = {
    cookie: PropTypes.string,
    navigationState: PropTypes.object.isRequired,
    pingStartingPayload: PropTypes.func.isRequired,
    currentAsOf: PropTypes.number.isRequired,
    activeThread: PropTypes.string,
    appLoggedIn: PropTypes.bool.isRequired,
    activeThreadLatestMessage: PropTypes.string,
    deviceToken: PropTypes.string,
    unreadCount: PropTypes.number.isRequired,
    rawThreadInfos: PropTypes.objectOf(rawThreadInfoPropType).isRequired,
    notifPermissionAlertInfo: notifPermissionAlertInfoPropType.isRequired,
    dispatch: PropTypes.func.isRequired,
    dispatchActionPayload: PropTypes.func.isRequired,
    dispatchActionPromise: PropTypes.func.isRequired,
    ping: PropTypes.func.isRequired,
    updateActivity: PropTypes.func.isRequired,
    setDeviceToken: PropTypes.func.isRequired,
  };
  currentState: ?string = NativeAppState.currentState;
  activePingSubscription: ?number = null;
  inAppNotification: ?InAppNotification = null;
  androidNotifListener: ?Object = null;
  androidRefreshTokenListener: ?Object = null;
  initialAndroidNotifHandled = false;
  openThreadOnceReceived: Set<string> = new Set();

  componentDidMount() {
    if (Platform.OS === "android") {
      setTimeout(SplashScreen.hide, 350);
    } else {
      SplashScreen.hide();
    }
    NativeAppState.addEventListener('change', this.handleAppStateChange);
    this.handleInitialURL();
    Linking.addEventListener('url', this.handleURLChange);
    this.activePingSubscription = setInterval(this.ping, pingFrequency);
    AppWithNavigationState.updateFocusedThreads(
      this.props,
      this.props.activeThread,
      null,
      null,
    );
    if (Platform.OS === "ios") {
      NotificationsIOS.addEventListener(
        "remoteNotificationsRegistered",
        this.registerPushPermissions,
      );
      NotificationsIOS.addEventListener(
        "remoteNotificationsRegistrationFailed",
        this.failedToRegisterPushPermissions,
      );
      NotificationsIOS.addEventListener(
        "notificationReceivedForeground",
        this.iosForegroundNotificationReceived,
      );
      NotificationsIOS.addEventListener(
        "notificationOpened",
        this.iosNotificationOpened,
      );
    } else if (Platform.OS === "android") {
      this.androidNotifListener = FCM.on(
        FCMEvent.Notification,
        this.androidNotificationReceived,
      );
      this.androidRefreshTokenListener = FCM.on(
        FCMEvent.RefreshToken,
        this.registerPushPermissionsAndHandleInitialNotif,
      );
    }
    AppWithNavigationState.updateBadgeCount(this.props.unreadCount);
  }

  static updateBadgeCount(unreadCount: number) {
    if (Platform.OS === "ios") {
      NotificationsIOS.setBadgesCount(unreadCount);
    } else if (Platform.OS === "android") {
      FCM.setBadgeNumber(unreadCount);
    }
  }

  static clearNotifsOfThread(props: Props) {
    const activeThread = props.activeThread;
    invariant(activeThread, "activeThread should be set");
    if (Platform.OS === "ios") {
      NotificationsIOS.getDeliveredNotifications(
        (notifications) =>
          AppWithNavigationState.clearDeliveredIOSNotificationsForThread(
            activeThread,
            notifications,
          ),
      );
    } else if (Platform.OS === "android") {
      props.dispatchActionPayload(
        clearAndroidNotificationActionType,
        { threadID: activeThread },
      );
    }
  }

  static clearDeliveredIOSNotificationsForThread(
    threadID: string,
    notifications: Object[],
  ) {
    const identifiersToClear = [];
    for (let notification of notifications) {
      if (notification["thread-id"] === threadID) {
        identifiersToClear.push(notification.identifier);
      }
    }
    if (identifiersToClear) {
      NotificationsIOS.removeDeliveredNotifications(identifiersToClear);
    }
  }

  async handleInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) {
      this.dispatchActionForURL(url);
    }
  }

  componentWillUnmount() {
    NativeAppState.removeEventListener('change', this.handleAppStateChange);
    Linking.removeEventListener('url', this.handleURLChange);
    if (this.activePingSubscription) {
      clearInterval(this.activePingSubscription);
      this.activePingSubscription = null;
    }
    this.closingApp();
    if (Platform.OS === "ios") {
      NotificationsIOS.removeEventListener(
        "remoteNotificationsRegistered",
        this.registerPushPermissions,
      );
      NotificationsIOS.removeEventListener(
        "remoteNotificationsRegistrationFailed",
        this.failedToRegisterPushPermissions,
      );
      NotificationsIOS.removeEventListener(
        "notificationReceivedForeground",
        this.iosForegroundNotificationReceived,
      );
      NotificationsIOS.removeEventListener(
        "notificationOpened",
        this.iosNotificationOpened,
      );
    } else if (Platform.OS === "android") {
      if (this.androidNotifListener) {
        this.androidNotifListener.remove();
        this.androidNotifListener = null;
      }
      if (this.androidRefreshTokenListener) {
        this.androidRefreshTokenListener.remove();
        this.androidRefreshTokenListener = null;
      }
    }
  }

  handleURLChange = (event: { url: string }) => {
    this.dispatchActionForURL(event.url);
  }

  dispatchActionForURL(url: string) {
    if (!url.startsWith("http")) {
      return;
    }
    this.props.dispatchActionPayload(handleURLActionType, url);
  }

  handleAppStateChange = (nextAppState: ?string) => {
    const lastState = this.currentState;
    this.currentState = nextAppState;
    if (
      lastState &&
      lastState.match(/inactive|background/) &&
      this.currentState === "active" &&
      !this.activePingSubscription
    ) {
      this.activePingSubscription = setInterval(this.ping, pingFrequency);
      AppWithNavigationState.updateFocusedThreads(
        this.props,
        this.props.activeThread,
        null,
        null,
      );
      if (this.props.appLoggedIn) {
        this.ensurePushNotifsEnabled();
      }
      if (this.props.activeThread) {
        AppWithNavigationState.clearNotifsOfThread(this.props);
      }
      AppWithNavigationState.updateBadgeCount(this.props.unreadCount);
    } else if (
      lastState === "active" &&
      this.currentState &&
      this.currentState.match(/inactive|background/) &&
      this.activePingSubscription
    ) {
      clearInterval(this.activePingSubscription);
      this.activePingSubscription = null;
      this.closingApp();
    }
  }

  pingNow() {
    if (this.activePingSubscription) {
      // If the ping callback is active now, this restarts it so it runs
      // immediately
      clearInterval(this.activePingSubscription);
      this.activePingSubscription = setInterval(this.ping, pingFrequency);
    } else {
      // Otherwise, we just do a one-off ping
      this.ping();
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    const justLoggedIn = nextProps.appLoggedIn && !this.props.appLoggedIn;
    if (
      justLoggedIn ||
      nextProps.activeThread !== this.props.activeThread
    ) {
      AppWithNavigationState.updateFocusedThreads(
        nextProps,
        nextProps.activeThread,
        this.props.activeThread,
        this.props.activeThreadLatestMessage,
      );
    }
    if (justLoggedIn) {
      this.ensurePushNotifsEnabled();
    }
    const nextActiveThread = nextProps.activeThread;
    if (nextActiveThread && nextActiveThread !== this.props.activeThread) {
      AppWithNavigationState.clearNotifsOfThread(nextProps);
    }
    if (nextProps.unreadCount !== this.props.unreadCount) {
      AppWithNavigationState.updateBadgeCount(nextProps.unreadCount);
    }
    for (let threadID of this.openThreadOnceReceived) {
      const rawThreadInfo = nextProps.rawThreadInfos[threadID];
      if (rawThreadInfo) {
        this.navigateToThread(rawThreadInfo, false);
        this.openThreadOnceReceived.clear();
        break;
      }
    }
  }

  async ensurePushNotifsEnabled() {
    if (Platform.OS === "ios") {
      const missingDeviceToken = this.props.deviceToken === null
        || this.props.deviceToken === undefined;
      await requestIOSPushPermissions(missingDeviceToken);
    } else if (Platform.OS === "android") {
      await this.ensureAndroidPushNotifsEnabled();
    }
  }

  async ensureAndroidPushNotifsEnabled() {
    const missingDeviceToken = this.props.deviceToken === null
      || this.props.deviceToken === undefined;
    let token = await this.getAndroidFCMToken();
    if (token) {
      await this.registerPushPermissionsAndHandleInitialNotif(token);
      return;
    }
    try {
      await FCM.deleteInstanceId();
    } catch (e) {
      this.failedToRegisterPushPermissions(e);
      return null;
    }
    token = await this.getAndroidFCMToken();
    if (token) {
      await this.registerPushPermissionsAndHandleInitialNotif(token);
    } else if (missingDeviceToken) {
      this.failedToRegisterPushPermissions();
    }
  }

  async getAndroidFCMToken() {
    try {
      return await requestAndroidPushPermissions();
    } catch (e) {
      this.failedToRegisterPushPermissions(e);
      return null;
    }
  }

  registerPushPermissionsAndHandleInitialNotif = async (
    deviceToken: string,
  ) => {
    this.registerPushPermissions(deviceToken);
    await this.handleInitialAndroidNotification();
  }

  async handleInitialAndroidNotification() {
    if (this.initialAndroidNotifHandled) {
      return;
    }
    this.initialAndroidNotifHandled = true;
    const initialNotif = await FCM.getInitialNotification();
    if (initialNotif) {
      await this.androidNotificationReceived(initialNotif);
    }
  }

  registerPushPermissions = (deviceToken: string) => {
    const deviceType = Platform.OS;
    if (deviceType !== "android" && deviceType !== "ios") {
      return;
    }
    if (deviceType === "ios") {
      iosPushPermissionResponseReceived();
    }
    this.props.dispatchActionPromise(
      setDeviceTokenActionTypes,
      this.props.setDeviceToken(deviceToken, deviceType),
    );
  }

  failedToRegisterPushPermissions = (error) => {
    if (!this.props.appLoggedIn) {
      return;
    }
    const deviceType = Platform.OS;
    if (deviceType === "ios") {
      iosPushPermissionResponseReceived();
      if (__DEV__) {
        // iOS simulator can't handle notifs
        return;
      }
    }

    const alertInfo = this.props.notifPermissionAlertInfo;
    if (
      (alertInfo.totalAlerts > 3 &&
        alertInfo.lastAlertTime > (Date.now() - msInDay)) ||
      (alertInfo.totalAlerts > 6 &&
        alertInfo.lastAlertTime > (Date.now() - msInDay * 3)) ||
      (alertInfo.totalAlerts > 9 &&
        alertInfo.lastAlertTime > (Date.now() - msInDay * 7))
    ) {
      return;
    }
    this.props.dispatchActionPayload(
      recordNotifPermissionAlertActionType,
      { time: Date.now() },
    );

    if (deviceType === "ios") {
      Alert.alert(
        "Need notif permissions",
        "SquadCal needs notification permissions to keep you in the loop! " +
          "Please enable in Settings App -> Notifications -> SquadCal.",
        [ { text: 'OK' } ],
      );
    } else if (deviceType === "android") {
      Alert.alert(
        "Unable to initialize notifs!",
        "Please check your network connection, make sure Google Play " +
          "services are installed and enabled, and confirm that your Google " +
          "Play credentials are valid in the Google Play Store.",
      );
    }
  }

  navigateToThread(rawThreadInfo: RawThreadInfo, clearChatRoutes: bool) {
    this.props.dispatchActionPayload(
      notificationPressActionType,
      {
        rawThreadInfo,
        clearChatRoutes,
      },
    );
  }

  onPressNotificationForThread(threadID: string, clearChatRoutes: bool) {
    const rawThreadInfo = this.props.rawThreadInfos[threadID];
    if (rawThreadInfo) {
      this.navigateToThread(rawThreadInfo, clearChatRoutes);
    } else {
      this.openThreadOnceReceived.add(threadID);
    }
  }

  iosForegroundNotificationReceived = (notification) => {
    if (
      notification.getData() &&
      notification.getData().managedAps &&
      notification.getData().managedAps.action === "CLEAR"
    ) {
      notification.finish(NotificationsIOS.FetchResult.NoData);
      return;
    }
    const threadID = notification.getData().threadID;
    if (!threadID) {
      console.log("Notification with missing threadID received!");
      notification.finish(NotificationsIOS.FetchResult.NoData);
      return;
    }
    this.pingNow();
    invariant(this.inAppNotification, "should be set");
    this.inAppNotification.show({
      message: notification.getMessage(),
      onPress: () => this.onPressNotificationForThread(threadID, false),
    });
    notification.finish(NotificationsIOS.FetchResult.NewData);
  }

  iosNotificationOpened = (notification) => {
    const threadID = notification.getData().threadID;
    if (!threadID) {
      console.log("Notification with missing threadID received!");
      notification.finish(NotificationsIOS.FetchResult.NoData);
      return;
    }
    this.pingNow();
    this.onPressNotificationForThread(threadID, true),
    notification.finish(NotificationsIOS.FetchResult.NewData);
  }

  androidNotificationReceived = async (notification) => {
    if (notification.badgeCount) {
      AppWithNavigationState.updateBadgeCount(
        parseInt(notification.badgeCount),
      );
    }
    if (
      notification.notifBody &&
      this.currentState === "active"
    ) {
      const threadID = notification.threadID;
      if (!threadID) {
        console.log("Notification with missing threadID received!");
        return;
      }
      this.pingNow();
      invariant(this.inAppNotification, "should be set");
      this.inAppNotification.show({
        message: notification.notifBody,
        onPress: () => this.onPressNotificationForThread(threadID, false),
      });
    } else if (notification.notifBody) {
      this.pingNow();
      FCM.presentLocalNotification({
        id: notification.notifID,
        body: notification.notifBody,
        priority: "high",
        sound: "default",
        threadID: notification.threadID,
        icon: "notif_icon",
      });
      this.props.dispatchActionPayload(
        recordAndroidNotificationActionType,
        {
          threadID: notification.threadID,
          notifID: notification.notifID,
        },
      );
    }
    if (notification.body) {
      this.onPressNotificationForThread(notification.threadID, true);
    }
    if (notification.rescind) {
      FCM.removeDeliveredNotification(notification.notifID);
    }
  }

  ping = () => {
    const startingPayload = this.props.pingStartingPayload();
    if (
      startingPayload.loggedIn ||
      (this.props.cookie && this.props.cookie.startsWith("user="))
    ) {
      this.props.dispatchActionPromise(
        pingActionTypes,
        this.pingAction(startingPayload),
        undefined,
        startingPayload,
      );
    } else if (startingPayload.newSessionID) {
      // Normally, the PING_STARTED will handle setting a new sessionID if the
      // user hasn't interacted in a bit. Since we don't run pings when logged
      // out, we use another action for it.
      this.props.dispatchActionPayload(
        newSessionIDActionType,
        startingPayload.newSessionID,
      );
    }
  }

  async pingAction(startingPayload: PingStartingPayload) {
    const pingResult = await this.props.ping(
      startingPayload.calendarQuery,
      this.props.currentAsOf,
    );
    return {
      ...pingResult,
      loggedIn: startingPayload.loggedIn,
    };
  }

  static updateFocusedThreads(
    props: Props,
    activeThread: ?string,
    oldActiveThread: ?string,
    oldActiveThreadLatestMessage: ?string,
  ) {
    if (!props.appLoggedIn) {
      return;
    }
    const updates = [];
    if (activeThread) {
      updates.push({
        focus: true,
        threadID: activeThread,
      });
    }
    if (oldActiveThread && oldActiveThread !== activeThread) {
      updates.push({
        focus: false,
        threadID: oldActiveThread,
        latestMessage: oldActiveThreadLatestMessage,
      });
    }
    if (updates.length === 0) {
      return;
    }
    props.dispatchActionPromise(
      updateActivityActionTypes,
      props.updateActivity(updates),
    );
  }

  closingApp() {
    if (!this.props.appLoggedIn || !this.props.activeThread) {
      return;
    }
    const updates = [{
      focus: false,
      threadID: this.props.activeThread,
      latestMessage: this.props.activeThreadLatestMessage,
    }];
    this.props.dispatchActionPromise(
      updateActivityActionTypes,
      this.props.updateActivity(updates),
    );
  }

  render() {
    const navigation: NavigationScreenProp<any> = addNavigationHelpers({
      dispatch: this.props.dispatch,
      state: this.props.navigationState,
      addListener: reactNavigationAddListener,
    });
    const inAppNotificationHeight = DeviceInfo.isIPhoneX_deprecated ? 104 : 80;
    return (
      <View style={styles.app}>
        <RootNavigator navigation={navigation} />
        <ConnectedStatusBar />
        <InAppNotification
          height={inAppNotificationHeight}
          notificationBodyComponent={NotificationBody}
          ref={this.inAppNotificationRef}
        />
      </View>
    );
  }

  inAppNotificationRef = (inAppNotification: InAppNotification) => {
    this.inAppNotification = inAppNotification;
  }

}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
});

const isForegroundSelector = createIsForegroundSelector(AppRouteName);
const ConnectedAppWithNavigationState = connect(
  (state: AppState) => {
    const activeThread = activeThreadSelector(state);
    return {
      navigationState: state.navInfo.navigationState,
      pingStartingPayload: pingNativeStartingPayload(state),
      currentAsOf: state.currentAsOf,
      activeThread,
      appLoggedIn: isForegroundSelector(state),
      activeThreadLatestMessage:
        activeThread && state.messageStore.threads[activeThread]
          ? state.messageStore.threads[activeThread].messageIDs[0]
          : null,
      deviceToken: state.deviceToken,
      unreadCount: unreadCount(state),
      rawThreadInfos: state.threadInfos,
      notifPermissionAlertInfo: state.notifPermissionAlertInfo,
    };
  },
  { ping, updateActivity, setDeviceToken },
)(AppWithNavigationState);

const App = (props: {}) =>
  <Provider store={store}>
    <ErrorBoundary>
      <ConnectedAppWithNavigationState />
    </ErrorBoundary>
  </Provider>;
AppRegistry.registerComponent('SquadCal', () => App);
