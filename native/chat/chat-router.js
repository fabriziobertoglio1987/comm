// @flow

import type {
  StackNavigationProp,
  ParamListBase,
  StackAction,
  Route,
  Router,
  StackRouterOptions,
  StackNavigationState,
  RouterConfigOptions,
  GenericNavigationAction,
} from '@react-navigation/native';
import { StackRouter, CommonActions } from '@react-navigation/native';

import type { ThreadInfo } from 'lib/types/thread-types';

import {
  clearScreensActionType,
  replaceWithThreadActionType,
  clearThreadsActionType,
  pushNewThreadActionType,
} from '../navigation/action-types';
import {
  removeScreensFromStack,
  getThreadIDFromRoute,
} from '../navigation/navigation-utils';
import {
  ChatThreadListRouteName,
  MessageListRouteName,
  ComposeThreadRouteName,
} from '../navigation/route-names';

type ClearScreensAction = {|
  +type: 'CLEAR_SCREENS',
  +payload: {|
    +routeNames: $ReadOnlyArray<string>,
  |},
|};
type ReplaceWithThreadAction = {|
  +type: 'REPLACE_WITH_THREAD',
  +payload: {|
    +threadInfo: ThreadInfo,
  |},
|};
type ClearThreadsAction = {|
  +type: 'CLEAR_THREADS',
  +payload: {|
    +threadIDs: $ReadOnlyArray<string>,
  |},
|};
type PushNewThreadAction = {|
  +type: 'PUSH_NEW_THREAD',
  +payload: {|
    +threadInfo: ThreadInfo,
  |},
|};
export type ChatRouterNavigationAction =
  | StackAction
  | ClearScreensAction
  | ReplaceWithThreadAction
  | ClearThreadsAction
  | PushNewThreadAction;

export type ChatRouterNavigationProp<
  ParamList: ParamListBase = ParamListBase,
  RouteName: string = string,
> = {|
  ...StackNavigationProp<ParamList, RouteName>,
  +clearScreens: (routeNames: $ReadOnlyArray<string>) => void,
  +replaceWithThread: (threadInfo: ThreadInfo) => void,
  +clearThreads: (threadIDs: $ReadOnlyArray<string>) => void,
  +pushNewThread: (threadInfo: ThreadInfo) => void,
|};

function ChatRouter(
  routerOptions: StackRouterOptions,
): Router<StackNavigationState, ChatRouterNavigationAction> {
  const {
    getStateForAction: baseGetStateForAction,
    actionCreators: baseActionCreators,
    shouldActionChangeFocus: baseShouldActionChangeFocus,
    ...rest
  } = StackRouter(routerOptions);
  return {
    ...rest,
    getStateForAction: (
      lastState: StackNavigationState,
      action: ChatRouterNavigationAction,
      options: RouterConfigOptions,
    ) => {
      if (action.type === clearScreensActionType) {
        const { routeNames } = action.payload;
        if (!lastState) {
          return lastState;
        }
        return removeScreensFromStack(lastState, (route: Route<>) =>
          routeNames.includes(route.name) ? 'remove' : 'keep',
        );
      } else if (action.type === replaceWithThreadActionType) {
        const { threadInfo } = action.payload;
        if (!lastState) {
          return lastState;
        }
        const clearedState = removeScreensFromStack(
          lastState,
          (route: Route<>) =>
            route.name === ChatThreadListRouteName ? 'keep' : 'remove',
        );
        const navigateAction = CommonActions.navigate({
          name: MessageListRouteName,
          key: `${MessageListRouteName}${threadInfo.id}`,
          params: { threadInfo },
        });
        return baseGetStateForAction(clearedState, navigateAction, options);
      } else if (action.type === clearThreadsActionType) {
        const threadIDs = new Set(action.payload.threadIDs);
        if (!lastState) {
          return lastState;
        }
        return removeScreensFromStack(lastState, (route: Route<>) =>
          threadIDs.has(getThreadIDFromRoute(route)) ? 'remove' : 'keep',
        );
      } else if (action.type === pushNewThreadActionType) {
        const { threadInfo } = action.payload;
        if (!lastState) {
          return lastState;
        }
        const clearedState = removeScreensFromStack(
          lastState,
          (route: Route<>) =>
            route.name === ComposeThreadRouteName ? 'remove' : 'break',
        );
        const navigateAction = CommonActions.navigate({
          name: MessageListRouteName,
          key: `${MessageListRouteName}${threadInfo.id}`,
          params: { threadInfo },
        });
        return baseGetStateForAction(clearedState, navigateAction, options);
      } else {
        return baseGetStateForAction(lastState, action, options);
      }
    },
    actionCreators: {
      ...baseActionCreators,
      clearScreens: (routeNames: $ReadOnlyArray<string>) => ({
        type: clearScreensActionType,
        payload: {
          routeNames,
        },
      }),
      replaceWithThread: (threadInfo: ThreadInfo) =>
        ({
          type: replaceWithThreadActionType,
          payload: { threadInfo },
        }: ReplaceWithThreadAction),
      clearThreads: (threadIDs: $ReadOnlyArray<string>) => ({
        type: clearThreadsActionType,
        payload: { threadIDs },
      }),
      pushNewThread: (threadInfo: ThreadInfo) =>
        ({
          type: pushNewThreadActionType,
          payload: { threadInfo },
        }: PushNewThreadAction),
    },
    shouldActionChangeFocus: (action: GenericNavigationAction) => {
      if (action.type === replaceWithThreadActionType) {
        return true;
      } else if (action.type === pushNewThreadActionType) {
        return true;
      } else {
        return baseShouldActionChangeFocus(action);
      }
    },
  };
}

export default ChatRouter;
