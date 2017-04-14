// @flow

import type { NavigationState } from 'react-navigation';
import { PropTypes as ReactNavigationPropTypes } from 'react-navigation';
import type { Dispatch } from 'lib/types/redux-types';
import type { AppState } from './redux-setup';
import type { Action } from './navigation-setup';
import type { PingResult } from 'lib/actions/ping-actions';
import type { DispatchActionPromise } from 'lib/utils/action-utils';

import React from 'react';
import { Provider, connect } from 'react-redux';
import {
  AppRegistry,
  Platform,
  UIManager,
  AppState as NativeAppState,
} from 'react-native';
import { addNavigationHelpers } from 'react-navigation';
import invariant from 'invariant';

import { registerConfig } from 'lib/utils/config';
import {
  includeDispatchActionProps,
  bindServerCalls,
} from 'lib/utils/action-utils';
import { pingActionType, ping } from 'lib/actions/ping-actions';

import { RootNavigator } from './navigation-setup';
import { store } from './redux-setup';
import {
  resolveInvalidatedCookie,
  getNativeCookie,
} from './account/native-credentials';

let urlPrefix;
if (!__DEV__) {
  urlPrefix = "https://squadcal.org/";
} else if (Platform.OS === "android") {
  // This is a magic IP address that forwards to the emulator's host
  urlPrefix = "http://10.0.2.2/~ashoat/squadcal/";
} else if (Platform.OS === "ios") {
  // Since iOS is simulated and not emulated, we can use localhost
  urlPrefix = "http://localhost/~ashoat/squadcal/";
  // Uncomment below and update IP address if testing on physical device
  //urlPrefix = "http://192.168.1.3/~ashoat/squadcal/";
} else {
  invariant(false, "unsupported platform");
}
registerConfig({
  urlPrefix,
  resolveInvalidatedCookie,
  getNativeCookie,
});

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

class AppWithNavigationState extends React.PureComponent {

  props: {
    // Redux state
    cookie: ?string,
    navigationState: NavigationState,
    loggedIn: bool,
    // Redux dispatch functions
    dispatch: Dispatch<AppState, Action>,
    dispatchActionPromise: DispatchActionPromise,
    // async functions that hit server APIs
    ping: () => Promise<PingResult>,
  };
  static propTypes = {
    cookie: React.PropTypes.string,
    navigationState: ReactNavigationPropTypes.navigationState,
    loggedIn: React.PropTypes.bool.isRequired,
    dispatch: React.PropTypes.func.isRequired,
    dispatchActionPromise: React.PropTypes.func.isRequired,
    ping: React.PropTypes.func.isRequired,
  };
  currentState: ?string = NativeAppState.currentState;

  componentDidMount() {
    NativeAppState.addEventListener('change', this.handleAppStateChange);
  }

  componentWillUnmount() {
    NativeAppState.removeEventListener('change', this.handleAppStateChange);
  }

  handleAppStateChange = (nextAppState: ?string) => {
    if (
      this.currentState &&
      this.currentState.match(/inactive|background/) &&
      nextAppState === "active" &&
      (this.props.loggedIn ||
        (this.props.cookie && this.props.cookie.startsWith("user=")))
    ) {
      this.props.dispatchActionPromise(pingActionType, this.props.ping());
    }
    this.currentState = nextAppState;
  }

  render() {
    const navigation = addNavigationHelpers({
      dispatch: this.props.dispatch,
      state: this.props.navigationState,
    });
    return <RootNavigator navigation={navigation} />;
  }

}

const ConnectedAppWithNavigationState = connect(
  (state: AppState) => ({
    cookie: state.cookie,
    navigationState: state.navInfo.navigationState,
    loggedIn: !!state.userInfo,
  }),
  includeDispatchActionProps({ dispatchActionPromise: true }),
  bindServerCalls({ ping }),
)(AppWithNavigationState);
const App = (props: {}) =>
  <Provider store={store}>
    <ConnectedAppWithNavigationState />
  </Provider>;
AppRegistry.registerComponent('SquadCal', () => App);
