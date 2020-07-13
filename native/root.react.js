// @flow

import type { PossiblyStaleNavigationState } from '@react-navigation/native';

import * as React from 'react';
import { Provider, useSelector } from 'react-redux';
import { Platform, UIManager, View, StyleSheet } from 'react-native';
import Orientation from 'react-native-orientation-locker';
import { PersistGate } from 'redux-persist/integration/react';
import AsyncStorage from '@react-native-community/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import invariant from 'invariant';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { useReduxDevToolsExtension } from '@react-navigation/devtools';

import { actionLogger } from 'lib/utils/action-logger';

import RootNavigator from './navigation/root-navigator.react';
import { store } from './redux/redux-setup';
import ConnectedStatusBar from './connected-status-bar.react';
import ErrorBoundary from './error-boundary.react';
import DisconnectedBarVisibilityHandler from './navigation/disconnected-bar-visibility-handler.react';
import { DimensionsUpdater } from './redux/dimensions-updater.react';
import ConnectivityUpdater from './redux/connectivity-updater.react';
import ThemeHandler from './themes/theme-handler.react';
import OrientationHandler from './navigation/orientation-handler.react';
import Socket from './socket.react';
import { getPersistor } from './redux/persist';
import { NavContext } from './navigation/navigation-context';
import { setGlobalNavContext } from './navigation/icky-global';
import { RootContext } from './root-context';
import NavigationHandler from './navigation/navigation-handler.react';
import { defaultNavigationState } from './navigation/default-state';
import InputStateContainer from './input/input-state-container.react';
import './themes/fonts';
import LifecycleHandler from './lifecycle/lifecycle-handler.react';
import { DarkTheme, LightTheme } from './themes/navigation';
import { validNavState } from './navigation/navigation-utils';
import { navStateAsyncStorageKey } from './navigation/persistance';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental &&
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const navInitAction = Object.freeze({ type: 'NAV/@@INIT' });
const navUnknownAction = Object.freeze({ type: 'NAV/@@UNKNOWN' });

function Root() {
  const navStateRef = React.useRef();
  const navDispatchRef = React.useRef();
  const navStateInitializedRef = React.useRef(false);

  const [navContext, setNavContext] = React.useState(null);
  const updateNavContext = React.useCallback(() => {
    if (
      !navStateRef.current ||
      !navDispatchRef.current ||
      !navStateInitializedRef.current
    ) {
      return;
    }
    const updatedNavContext = {
      state: navStateRef.current,
      dispatch: navDispatchRef.current,
    };
    setNavContext(updatedNavContext);
    setGlobalNavContext(updatedNavContext);
  }, []);

  const [initialState, setInitialState] = React.useState(
    __DEV__ ? undefined : defaultNavigationState,
  );

  React.useEffect(() => {
    Orientation.lockToPortrait();
    (async () => {
      let loadedState = initialState;
      if (__DEV__) {
        try {
          const navStateString = await AsyncStorage.getItem(
            navStateAsyncStorageKey,
          );
          if (navStateString) {
            const savedState = JSON.parse(navStateString);
            if (validNavState(savedState)) {
              loadedState = savedState;
            }
          }
        } catch {}
      }
      if (!loadedState) {
        loadedState = defaultNavigationState;
      }
      if (loadedState !== initialState) {
        setInitialState(loadedState);
      }
      navStateRef.current = loadedState;
      updateNavContext();
      actionLogger.addOtherAction('navState', navInitAction, null, loadedState);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateNavContext]);

  const setNavStateInitialized = React.useCallback(() => {
    navStateInitializedRef.current = true;
    updateNavContext();
  }, [updateNavContext]);

  const [rootContext, setRootContext] = React.useState(() => ({
    setNavStateInitialized,
  }));

  const detectUnsupervisedBackgroundRef = React.useCallback(
    (detectUnsupervisedBackground: ?(alreadyClosed: boolean) => boolean) => {
      setRootContext(prevRootContext => ({
        ...prevRootContext,
        detectUnsupervisedBackground,
      }));
    },
    [],
  );

  const frozen = useSelector(state => state.frozen);
  const queuedActionsRef = React.useRef([]);
  const onNavigationStateChange = React.useCallback(
    (state: ?PossiblyStaleNavigationState) => {
      invariant(state, 'nav state should be non-null');
      const prevState = navStateRef.current;
      navStateRef.current = state;
      updateNavContext();

      const queuedActions = queuedActionsRef.current;
      queuedActionsRef.current = [];
      if (queuedActions.length === 0) {
        queuedActions.push(navUnknownAction);
      }
      for (let action of queuedActions) {
        actionLogger.addOtherAction('navState', action, prevState, state);
      }

      if (!__DEV__ || frozen) {
        return;
      }

      (async () => {
        try {
          await AsyncStorage.setItem(
            navStateAsyncStorageKey,
            JSON.stringify(state),
          );
        } catch (e) {
          console.log('AsyncStorage threw while trying to persist navState', e);
        }
      })();
    },
    [updateNavContext, frozen],
  );

  const navContainerRef = React.useRef();
  const containerRef = React.useCallback(
    (navContainer: ?React.ElementRef<typeof NavigationContainer>) => {
      navContainerRef.current = navContainer;
      if (navContainer && !navDispatchRef.current) {
        navDispatchRef.current = navContainer.dispatch;
        updateNavContext();
      }
    },
    [updateNavContext],
  );
  useReduxDevToolsExtension(navContainerRef);

  const navContainer = navContainerRef.current;
  React.useEffect(() => {
    if (!navContainer) {
      return;
    }
    return navContainer.addListener('__unsafe_action__', event => {
      const { action, noop } = event.data;
      const navState = navStateRef.current;
      if (noop) {
        actionLogger.addOtherAction('navState', action, navState, navState);
        return;
      }
      queuedActionsRef.current.push({
        ...action,
        type: `NAV/${action.type}`,
      });
    });
  }, [navContainer]);

  const activeTheme = useSelector(state => state.globalThemeInfo.activeTheme);
  const theme = (() => {
    if (activeTheme === 'light') {
      return LightTheme;
    } else if (activeTheme === 'dark') {
      return DarkTheme;
    }
    return undefined;
  })();

  const gated: React.Node = (
    <>
      <LifecycleHandler />
      <Socket
        detectUnsupervisedBackgroundRef={detectUnsupervisedBackgroundRef}
      />
      <DisconnectedBarVisibilityHandler />
      <DimensionsUpdater />
      <ConnectivityUpdater />
      <ThemeHandler />
      <OrientationHandler />
    </>
  );
  let navigation;
  if (initialState) {
    navigation = (
      <NavigationContainer
        initialState={initialState}
        onStateChange={onNavigationStateChange}
        theme={theme}
        ref={containerRef}
      >
        <RootNavigator />
      </NavigationContainer>
    );
  }
  return (
    <View style={styles.app}>
      <NavContext.Provider value={navContext}>
        <RootContext.Provider value={rootContext}>
          <InputStateContainer>
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
              <ConnectedStatusBar />
              <PersistGate persistor={getPersistor()}>{gated}</PersistGate>
              {navigation}
              <NavigationHandler />
            </SafeAreaProvider>
          </InputStateContainer>
        </RootContext.Provider>
      </NavContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
});

const AppRoot = () => (
  <Provider store={store}>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </Provider>
);
export default AppRoot;
