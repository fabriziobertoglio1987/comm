// @flow

import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationProp,
} from '@react-navigation/material-top-tabs';
import {
  createNavigatorFactory,
  useNavigationBuilder,
  type StackNavigationState,
  type StackOptions,
  type StackNavigationEventMap,
  type StackNavigatorProps,
  type ExtraStackNavigatorProps,
  type StackHeaderProps as CoreStackHeaderProps,
} from '@react-navigation/native';
import { StackView, type StackHeaderProps } from '@react-navigation/stack';
import invariant from 'invariant';
import * as React from 'react';
import { Platform, View } from 'react-native';

import { threadIsPending } from 'lib/shared/thread-utils';
import { firstLine } from 'lib/utils/string-utils';

import KeyboardAvoidingView from '../components/keyboard-avoiding-view.react';
import { InputStateContext } from '../input/input-state';
import HeaderBackButton from '../navigation/header-back-button.react';
import {
  ComposeThreadRouteName,
  DeleteThreadRouteName,
  ThreadSettingsRouteName,
  MessageListRouteName,
  ChatThreadListRouteName,
  HomeChatThreadListRouteName,
  BackgroundChatThreadListRouteName,
  type ScreenParamList,
  type ChatParamList,
  type ChatTopTabsParamList,
} from '../navigation/route-names';
import { useStyles } from '../themes/colors';
import BackgroundChatThreadList from './background-chat-thread-list.react';
import ChatHeader from './chat-header.react';
import ChatRouter, { type ChatRouterNavigationProp } from './chat-router';
import ComposeThreadButton from './compose-thread-button.react';
import ComposeThread from './compose-thread.react';
import HomeChatThreadList from './home-chat-thread-list.react';
import MessageListContainer from './message-list-container.react';
import MessageListHeaderTitle from './message-list-header-title.react';
import MessageStorePruner from './message-store-pruner.react';
import DeleteThread from './settings/delete-thread.react';
import ThreadSettings from './settings/thread-settings.react';
import ThreadScreenPruner from './thread-screen-pruner.react';
import ThreadSettingsButton from './thread-settings-button.react';

const unboundStyles = {
  keyboardAvoidingView: {
    flex: 1,
  },
  view: {
    flex: 1,
    backgroundColor: 'listBackground',
  },
  threadListHeaderStyle: {
    elevation: 0,
    shadowOffset: { width: 0, height: 0 },
    borderBottomWidth: 0,
  },
};

export type ChatTopTabsNavigationProp<
  RouteName: $Keys<ChatTopTabsParamList> = $Keys<ChatTopTabsParamList>,
> = MaterialTopTabNavigationProp<ScreenParamList, RouteName>;

const homeChatThreadListOptions = {
  title: 'Home',
};
const backgroundChatThreadListOptions = {
  title: 'Background',
};

const ChatThreadsTopTab = createMaterialTopTabNavigator();
const ChatThreadsComponent = () => {
  return (
    <ChatThreadsTopTab.Navigator>
      <ChatThreadsTopTab.Screen
        name={HomeChatThreadListRouteName}
        component={HomeChatThreadList}
        options={homeChatThreadListOptions}
      />
      <ChatThreadsTopTab.Screen
        name={BackgroundChatThreadListRouteName}
        component={BackgroundChatThreadList}
        options={backgroundChatThreadListOptions}
      />
    </ChatThreadsTopTab.Navigator>
  );
};

type ChatNavigatorProps = StackNavigatorProps<ChatRouterNavigationProp<>>;
function ChatNavigator({
  initialRouteName,
  children,
  screenOptions,
  ...rest
}: ChatNavigatorProps) {
  const { state, descriptors, navigation } = useNavigationBuilder(ChatRouter, {
    initialRouteName,
    children,
    screenOptions,
  });

  // Clear ComposeThread screens after each message is sent. If a user goes to
  // ComposeThread to create a new thread, but finds an existing one and uses it
  // instead, we can assume the intent behind opening ComposeThread is resolved
  const inputState = React.useContext(InputStateContext);
  invariant(inputState, 'InputState should be set in ChatNavigator');
  const clearComposeScreensAfterMessageSend = React.useCallback(() => {
    navigation.clearScreens([ComposeThreadRouteName]);
  }, [navigation]);
  React.useEffect(() => {
    inputState.registerSendCallback(clearComposeScreensAfterMessageSend);
    return () => {
      inputState.unregisterSendCallback(clearComposeScreensAfterMessageSend);
    };
  }, [inputState, clearComposeScreensAfterMessageSend]);

  return (
    <StackView
      {...rest}
      state={state}
      descriptors={descriptors}
      navigation={navigation}
      detachInactiveScreens={Platform.OS !== 'ios'}
    />
  );
}
const createChatNavigator = createNavigatorFactory<
  StackNavigationState,
  StackOptions,
  StackNavigationEventMap,
  ChatRouterNavigationProp<>,
  ExtraStackNavigatorProps,
>(ChatNavigator);

const header = (props: CoreStackHeaderProps) => {
  // Flow has trouble reconciling identical types between different libdefs,
  // and flow-typed has no way for one libdef to depend on another
  const castProps: StackHeaderProps = (props: any);
  return <ChatHeader {...castProps} />;
};
const headerBackButton = props => <HeaderBackButton {...props} />;
const screenOptions = {
  header,
  headerLeft: headerBackButton,
  gestureEnabled: Platform.OS === 'ios',
  animationEnabled:
    Platform.OS !== 'web' &&
    Platform.OS !== 'windows' &&
    Platform.OS !== 'macos',
};

const chatThreadListOptions = ({ navigation }) => ({
  headerTitle: 'Threads',
  headerRight:
    Platform.OS === 'ios'
      ? () => <ComposeThreadButton navigate={navigation.navigate} />
      : undefined,
  headerBackTitle: 'Back',
  headerStyle: unboundStyles.threadListHeaderStyle,
});
const messageListOptions = ({ navigation, route }) => ({
  // This is a render prop, not a component
  // eslint-disable-next-line react/display-name
  headerTitle: () => (
    <MessageListHeaderTitle
      threadInfo={route.params.threadInfo}
      searching={route.params.searching}
      navigate={navigation.navigate}
    />
  ),
  headerTitleContainerStyle: {
    marginHorizontal: Platform.select({ ios: 80, default: 0 }),
    flex: 1,
  },
  headerRight:
    Platform.OS === 'android' && !threadIsPending(route.params.threadInfo.id)
      ? // This is a render prop, not a component
        // eslint-disable-next-line react/display-name
        () => (
          <ThreadSettingsButton
            threadInfo={route.params.threadInfo}
            navigate={navigation.navigate}
          />
        )
      : undefined,
  headerBackTitle: 'Back',
});
const composeThreadOptions = {
  headerTitle: 'Compose thread',
  headerBackTitle: 'Back',
};
const threadSettingsOptions = ({ route }) => ({
  headerTitle: firstLine(route.params.threadInfo.uiName),
  headerBackTitle: 'Back',
});
const deleteThreadOptions = {
  headerTitle: 'Delete thread',
  headerBackTitle: 'Back',
};

export type ChatNavigationProp<
  RouteName: $Keys<ChatParamList> = $Keys<ChatParamList>,
> = ChatRouterNavigationProp<ScreenParamList, RouteName>;

const Chat = createChatNavigator<
  ScreenParamList,
  ChatParamList,
  ChatNavigationProp<>,
>();
export default function ChatComponent() {
  const styles = useStyles(unboundStyles);
  const behavior = Platform.select({
    android: 'height',
    default: 'padding',
  });
  return (
    <View style={styles.view}>
      <KeyboardAvoidingView
        behavior={behavior}
        style={styles.keyboardAvoidingView}
      >
        <Chat.Navigator screenOptions={screenOptions}>
          <Chat.Screen
            name={ChatThreadListRouteName}
            component={ChatThreadsComponent}
            options={chatThreadListOptions}
          />
          <Chat.Screen
            name={MessageListRouteName}
            component={MessageListContainer}
            options={messageListOptions}
          />
          <Chat.Screen
            name={ComposeThreadRouteName}
            component={ComposeThread}
            options={composeThreadOptions}
          />
          <Chat.Screen
            name={ThreadSettingsRouteName}
            component={ThreadSettings}
            options={threadSettingsOptions}
          />
          <Chat.Screen
            name={DeleteThreadRouteName}
            component={DeleteThread}
            options={deleteThreadOptions}
          />
        </Chat.Navigator>
        <MessageStorePruner />
        <ThreadScreenPruner />
      </KeyboardAvoidingView>
    </View>
  );
}
