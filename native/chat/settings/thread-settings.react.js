// @flow

import invariant from 'invariant';
import * as React from 'react';
import { View, FlatList, Platform } from 'react-native';
import { createSelector } from 'reselect';

import {
  changeThreadSettingsActionTypes,
  leaveThreadActionTypes,
  removeUsersFromThreadActionTypes,
  changeThreadMemberRolesActionTypes,
} from 'lib/actions/thread-actions';
import { createLoadingStatusSelector } from 'lib/selectors/loading-selectors';
import {
  threadInfoSelector,
  childThreadInfos,
} from 'lib/selectors/thread-selectors';
import { relativeMemberInfoSelectorForMembersOfThread } from 'lib/selectors/user-selectors';
import { getAvailableRelationshipButtons } from 'lib/shared/relationship-utils';
import {
  threadHasPermission,
  viewerIsMember,
  threadInChatList,
  getSingleOtherUser,
} from 'lib/shared/thread-utils';
import threadWatcher from 'lib/shared/thread-watcher';
import type { RelationshipButton } from 'lib/types/relationship-types';
import {
  type ThreadInfo,
  type RelativeMemberInfo,
  threadPermissions,
  threadTypes,
} from 'lib/types/thread-types';
import type { UserInfos } from 'lib/types/user-types';

import {
  type KeyboardState,
  KeyboardContext,
} from '../../keyboard/keyboard-state';
import type { TabNavigationProp } from '../../navigation/app-navigator.react';
import {
  OverlayContext,
  type OverlayContextType,
} from '../../navigation/overlay-context';
import type { NavigationRoute } from '../../navigation/route-names';
import {
  AddUsersModalRouteName,
  ComposeSubthreadModalRouteName,
} from '../../navigation/route-names';
import type { AppState } from '../../redux/redux-setup';
import { useSelector } from '../../redux/redux-utils';
import {
  useStyles,
  type IndicatorStyle,
  useIndicatorStyle,
} from '../../themes/colors';
import type { VerticalBounds } from '../../types/layout-types';
import type { ViewStyle } from '../../types/styles';
import type { ChatNavigationProp } from '../chat.react';
import type { CategoryType } from './thread-settings-category.react';
import {
  ThreadSettingsCategoryHeader,
  ThreadSettingsCategoryFooter,
} from './thread-settings-category.react';
import ThreadSettingsChildThread from './thread-settings-child-thread.react';
import ThreadSettingsColor from './thread-settings-color.react';
import ThreadSettingsDeleteThread from './thread-settings-delete-thread.react';
import ThreadSettingsDescription from './thread-settings-description.react';
import ThreadSettingsEditRelationship from './thread-settings-edit-relationship.react';
import ThreadSettingsHomeNotifs from './thread-settings-home-notifs.react';
import ThreadSettingsLeaveThread from './thread-settings-leave-thread.react';
import {
  ThreadSettingsSeeMore,
  ThreadSettingsAddMember,
  ThreadSettingsAddSubthread,
} from './thread-settings-list-action.react';
import ThreadSettingsMember from './thread-settings-member.react';
import ThreadSettingsName from './thread-settings-name.react';
import ThreadSettingsParent from './thread-settings-parent.react';
import ThreadSettingsPromoteSidebar from './thread-settings-promote-sidebar.react';
import ThreadSettingsPushNotifs from './thread-settings-push-notifs.react';
import ThreadSettingsVisibility from './thread-settings-visibility.react';

const itemPageLength = 5;

export type ThreadSettingsParams = {|
  +threadInfo: ThreadInfo,
|};

export type ThreadSettingsNavigate = $PropertyType<
  ChatNavigationProp<'ThreadSettings'>,
  'navigate',
>;

type ChatSettingsItem =
  | {|
      +itemType: 'header',
      +key: string,
      +title: string,
      +categoryType: CategoryType,
    |}
  | {|
      +itemType: 'footer',
      +key: string,
      +categoryType: CategoryType,
    |}
  | {|
      +itemType: 'name',
      +key: string,
      +threadInfo: ThreadInfo,
      +nameEditValue: ?string,
      +canChangeSettings: boolean,
    |}
  | {|
      +itemType: 'color',
      +key: string,
      +threadInfo: ThreadInfo,
      +colorEditValue: string,
      +canChangeSettings: boolean,
      +navigate: ThreadSettingsNavigate,
      +threadSettingsRouteKey: string,
    |}
  | {|
      +itemType: 'description',
      +key: string,
      +threadInfo: ThreadInfo,
      +descriptionEditValue: ?string,
      +descriptionTextHeight: ?number,
      +canChangeSettings: boolean,
    |}
  | {|
      +itemType: 'parent',
      +key: string,
      +threadInfo: ThreadInfo,
      +parentThreadInfo: ?ThreadInfo,
      +navigate: ThreadSettingsNavigate,
    |}
  | {|
      +itemType: 'visibility',
      +key: string,
      +threadInfo: ThreadInfo,
    |}
  | {|
      +itemType: 'pushNotifs',
      +key: string,
      +threadInfo: ThreadInfo,
    |}
  | {|
      +itemType: 'homeNotifs',
      +key: string,
      +threadInfo: ThreadInfo,
    |}
  | {|
      +itemType: 'seeMore',
      +key: string,
      +onPress: () => void,
    |}
  | {|
      +itemType: 'childThread',
      +key: string,
      +threadInfo: ThreadInfo,
      +navigate: ThreadSettingsNavigate,
      +firstListItem: boolean,
      +lastListItem: boolean,
    |}
  | {|
      +itemType: 'addSubthread',
      +key: string,
    |}
  | {|
      +itemType: 'member',
      +key: string,
      +memberInfo: RelativeMemberInfo,
      +threadInfo: ThreadInfo,
      +canEdit: boolean,
      +navigate: ThreadSettingsNavigate,
      +firstListItem: boolean,
      +lastListItem: boolean,
      +verticalBounds: ?VerticalBounds,
      +threadSettingsRouteKey: string,
    |}
  | {|
      +itemType: 'addMember',
      +key: string,
    |}
  | {|
      +itemType: 'promoteSidebar' | 'leaveThread' | 'deleteThread',
      +key: string,
      +threadInfo: ThreadInfo,
      +navigate: ThreadSettingsNavigate,
      +buttonStyle: ViewStyle,
    |}
  | {|
      +itemType: 'editRelationship',
      +key: string,
      +threadInfo: ThreadInfo,
      +navigate: ThreadSettingsNavigate,
      +buttonStyle: ViewStyle,
      +relationshipButton: RelationshipButton,
    |};

type BaseProps = {|
  +navigation: ChatNavigationProp<'ThreadSettings'>,
  +route: NavigationRoute<'ThreadSettings'>,
|};
type Props = {|
  ...BaseProps,
  // Redux state
  +userInfos: UserInfos,
  +viewerID: ?string,
  +threadInfo: ?ThreadInfo,
  +parentThreadInfo: ?ThreadInfo,
  +threadMembers: $ReadOnlyArray<RelativeMemberInfo>,
  +childThreadInfos: ?$ReadOnlyArray<ThreadInfo>,
  +somethingIsSaving: boolean,
  +styles: typeof unboundStyles,
  +indicatorStyle: IndicatorStyle,
  // withOverlayContext
  +overlayContext: ?OverlayContextType,
  // withKeyboardState
  +keyboardState: ?KeyboardState,
|};
type State = {|
  +numMembersShowing: number,
  +numSubthreadsShowing: number,
  +numSidebarsShowing: number,
  +nameEditValue: ?string,
  +descriptionEditValue: ?string,
  +descriptionTextHeight: ?number,
  +colorEditValue: string,
  +verticalBounds: ?VerticalBounds,
|};
type PropsAndState = {| ...Props, ...State |};
class ThreadSettings extends React.PureComponent<Props, State> {
  flatListContainer: ?React.ElementRef<typeof View>;

  constructor(props: Props) {
    super(props);
    const threadInfo = props.threadInfo;
    invariant(threadInfo, 'ThreadInfo should exist when ThreadSettings opened');
    this.state = {
      numMembersShowing: itemPageLength,
      numSubthreadsShowing: itemPageLength,
      numSidebarsShowing: itemPageLength,
      nameEditValue: null,
      descriptionEditValue: null,
      descriptionTextHeight: null,
      colorEditValue: threadInfo.color,
      verticalBounds: null,
    };
  }

  static getThreadInfo(props: {
    threadInfo: ?ThreadInfo,
    route: NavigationRoute<'ThreadSettings'>,
    ...
  }): ThreadInfo {
    const { threadInfo } = props;
    if (threadInfo) {
      return threadInfo;
    }
    return props.route.params.threadInfo;
  }

  static scrollDisabled(props: Props) {
    const { overlayContext } = props;
    invariant(overlayContext, 'ThreadSettings should have OverlayContext');
    return overlayContext.scrollBlockingModalStatus !== 'closed';
  }

  componentDidMount() {
    const threadInfo = ThreadSettings.getThreadInfo(this.props);
    if (!threadInChatList(threadInfo)) {
      threadWatcher.watchID(threadInfo.id);
    }
    const tabNavigation: ?TabNavigationProp<
      'Chat',
    > = this.props.navigation.dangerouslyGetParent();
    invariant(tabNavigation, 'ChatNavigator should be within TabNavigator');
    tabNavigation.addListener('tabPress', this.onTabPress);
  }

  componentWillUnmount() {
    const threadInfo = ThreadSettings.getThreadInfo(this.props);
    if (!threadInChatList(threadInfo)) {
      threadWatcher.removeID(threadInfo.id);
    }
    const tabNavigation: ?TabNavigationProp<
      'Chat',
    > = this.props.navigation.dangerouslyGetParent();
    invariant(tabNavigation, 'ChatNavigator should be within TabNavigator');
    tabNavigation.removeListener('tabPress', this.onTabPress);
  }

  onTabPress = () => {
    if (this.props.navigation.isFocused() && !this.props.somethingIsSaving) {
      this.props.navigation.popToTop();
    }
  };

  componentDidUpdate(prevProps: Props) {
    const oldReduxThreadInfo = prevProps.threadInfo;
    const newReduxThreadInfo = this.props.threadInfo;
    if (newReduxThreadInfo && newReduxThreadInfo !== oldReduxThreadInfo) {
      this.props.navigation.setParams({ threadInfo: newReduxThreadInfo });
    }

    const oldNavThreadInfo = ThreadSettings.getThreadInfo(prevProps);
    const newNavThreadInfo = ThreadSettings.getThreadInfo(this.props);
    if (oldNavThreadInfo.id !== newNavThreadInfo.id) {
      if (!threadInChatList(oldNavThreadInfo)) {
        threadWatcher.removeID(oldNavThreadInfo.id);
      }
      if (!threadInChatList(newNavThreadInfo)) {
        threadWatcher.watchID(newNavThreadInfo.id);
      }
    }
    if (
      newNavThreadInfo.color !== oldNavThreadInfo.color &&
      this.state.colorEditValue === oldNavThreadInfo.color
    ) {
      this.setState({ colorEditValue: newNavThreadInfo.color });
    }

    const scrollIsDisabled = ThreadSettings.scrollDisabled(this.props);
    const scrollWasDisabled = ThreadSettings.scrollDisabled(prevProps);
    if (!scrollWasDisabled && scrollIsDisabled) {
      this.props.navigation.setOptions({ gestureEnabled: false });
    } else if (scrollWasDisabled && !scrollIsDisabled) {
      this.props.navigation.setOptions({ gestureEnabled: true });
    }
  }

  threadBasicsListDataSelector = createSelector(
    (propsAndState: PropsAndState) =>
      ThreadSettings.getThreadInfo(propsAndState),
    (propsAndState: PropsAndState) => propsAndState.parentThreadInfo,
    (propsAndState: PropsAndState) => propsAndState.nameEditValue,
    (propsAndState: PropsAndState) => propsAndState.colorEditValue,
    (propsAndState: PropsAndState) => propsAndState.descriptionEditValue,
    (propsAndState: PropsAndState) => propsAndState.descriptionTextHeight,
    (propsAndState: PropsAndState) => !propsAndState.somethingIsSaving,
    (propsAndState: PropsAndState) => propsAndState.navigation.navigate,
    (propsAndState: PropsAndState) => propsAndState.route.key,
    (
      threadInfo: ThreadInfo,
      parentThreadInfo: ?ThreadInfo,
      nameEditValue: ?string,
      colorEditValue: string,
      descriptionEditValue: ?string,
      descriptionTextHeight: ?number,
      canStartEditing: boolean,
      navigate: ThreadSettingsNavigate,
      routeKey: string,
    ) => {
      const canEditThread = threadHasPermission(
        threadInfo,
        threadPermissions.EDIT_THREAD,
      );
      const canChangeSettings = canEditThread && canStartEditing;

      const listData: ChatSettingsItem[] = [];
      listData.push({
        itemType: 'header',
        key: 'basicsHeader',
        title: 'Basics',
        categoryType: 'full',
      });
      listData.push({
        itemType: 'name',
        key: 'name',
        threadInfo,
        nameEditValue,
        canChangeSettings,
      });
      listData.push({
        itemType: 'color',
        key: 'color',
        threadInfo,
        colorEditValue,
        canChangeSettings,
        navigate,
        threadSettingsRouteKey: routeKey,
      });
      listData.push({
        itemType: 'footer',
        key: 'basicsFooter',
        categoryType: 'full',
      });

      if (
        (descriptionEditValue !== null && descriptionEditValue !== undefined) ||
        threadInfo.description ||
        canEditThread
      ) {
        listData.push({
          itemType: 'description',
          key: 'description',
          threadInfo,
          descriptionEditValue,
          descriptionTextHeight,
          canChangeSettings,
        });
      }

      const isMember = viewerIsMember(threadInfo);
      if (isMember) {
        listData.push({
          itemType: 'header',
          key: 'subscriptionHeader',
          title: 'Subscription',
          categoryType: 'full',
        });
        listData.push({
          itemType: 'pushNotifs',
          key: 'pushNotifs',
          threadInfo,
        });
        listData.push({
          itemType: 'homeNotifs',
          key: 'homeNotifs',
          threadInfo,
        });
        listData.push({
          itemType: 'footer',
          key: 'subscriptionFooter',
          categoryType: 'full',
        });
      }

      listData.push({
        itemType: 'header',
        key: 'privacyHeader',
        title: 'Privacy',
        categoryType: 'full',
      });
      listData.push({
        itemType: 'parent',
        key: 'parent',
        threadInfo,
        parentThreadInfo,
        navigate,
      });
      listData.push({
        itemType: 'visibility',
        key: 'visibility',
        threadInfo,
      });
      listData.push({
        itemType: 'footer',
        key: 'privacyFooter',
        categoryType: 'full',
      });
      return listData;
    },
  );

  subthreadsListDataSelector = createSelector(
    (propsAndState: PropsAndState) =>
      ThreadSettings.getThreadInfo(propsAndState),
    (propsAndState: PropsAndState) => propsAndState.navigation.navigate,
    (propsAndState: PropsAndState) => propsAndState.childThreadInfos,
    (propsAndState: PropsAndState) => propsAndState.numSubthreadsShowing,
    (
      threadInfo: ThreadInfo,
      navigate: ThreadSettingsNavigate,
      childThreads: ?$ReadOnlyArray<ThreadInfo>,
      numSubthreadsShowing: number,
    ) => {
      const listData: ChatSettingsItem[] = [];

      const subthreads =
        childThreads?.filter(
          childThreadInfo => childThreadInfo.type !== threadTypes.SIDEBAR,
        ) ?? [];
      const canCreateSubthreads = threadHasPermission(
        threadInfo,
        threadPermissions.CREATE_SUBTHREADS,
      );
      if (subthreads.length === 0 && !canCreateSubthreads) {
        return listData;
      }

      listData.push({
        itemType: 'header',
        key: 'subthreadHeader',
        title: 'Subthreads',
        categoryType: 'unpadded',
      });

      if (canCreateSubthreads) {
        listData.push({
          itemType: 'addSubthread',
          key: 'addSubthread',
        });
      }

      const numItems = Math.min(numSubthreadsShowing, subthreads.length);
      for (let i = 0; i < numItems; i++) {
        const subthreadInfo = subthreads[i];
        listData.push({
          itemType: 'childThread',
          key: `childThread${subthreadInfo.id}`,
          threadInfo: subthreadInfo,
          navigate,
          firstListItem: i === 0 && !canCreateSubthreads,
          lastListItem: i === numItems - 1 && numItems === subthreads.length,
        });
      }

      if (numItems < subthreads.length) {
        listData.push({
          itemType: 'seeMore',
          key: 'seeMoreSubthreads',
          onPress: this.onPressSeeMoreSubthreads,
        });
      }

      listData.push({
        itemType: 'footer',
        key: 'subthreadFooter',
        categoryType: 'unpadded',
      });

      return listData;
    },
  );

  sidebarsListDataSelector = createSelector(
    (propsAndState: PropsAndState) => propsAndState.navigation.navigate,
    (propsAndState: PropsAndState) => propsAndState.childThreadInfos,
    (propsAndState: PropsAndState) => propsAndState.numSidebarsShowing,
    (
      navigate: ThreadSettingsNavigate,
      childThreads: ?$ReadOnlyArray<ThreadInfo>,
      numSidebarsShowing: number,
    ) => {
      const listData: ChatSettingsItem[] = [];

      const sidebars =
        childThreads?.filter(
          childThreadInfo => childThreadInfo.type === threadTypes.SIDEBAR,
        ) ?? [];
      if (sidebars.length === 0) {
        return listData;
      }

      listData.push({
        itemType: 'header',
        key: 'sidebarHeader',
        title: 'Sidebars',
        categoryType: 'unpadded',
      });

      const numItems = Math.min(numSidebarsShowing, sidebars.length);
      for (let i = 0; i < numItems; i++) {
        const sidebarInfo = sidebars[i];
        listData.push({
          itemType: 'childThread',
          key: `childThread${sidebarInfo.id}`,
          threadInfo: sidebarInfo,
          navigate,
          firstListItem: i === 0,
          lastListItem: i === numItems - 1 && numItems === sidebars.length,
        });
      }

      if (numItems < sidebars.length) {
        listData.push({
          itemType: 'seeMore',
          key: 'seeMoreSidebars',
          onPress: this.onPressSeeMoreSidebars,
        });
      }

      listData.push({
        itemType: 'footer',
        key: 'sidebarFooter',
        categoryType: 'unpadded',
      });

      return listData;
    },
  );

  threadMembersListDataSelector = createSelector(
    (propsAndState: PropsAndState) =>
      ThreadSettings.getThreadInfo(propsAndState),
    (propsAndState: PropsAndState) => !propsAndState.somethingIsSaving,
    (propsAndState: PropsAndState) => propsAndState.navigation.navigate,
    (propsAndState: PropsAndState) => propsAndState.route.key,
    (propsAndState: PropsAndState) => propsAndState.threadMembers,
    (propsAndState: PropsAndState) => propsAndState.numMembersShowing,
    (propsAndState: PropsAndState) => propsAndState.verticalBounds,
    (
      threadInfo: ThreadInfo,
      canStartEditing: boolean,
      navigate: ThreadSettingsNavigate,
      routeKey: string,
      threadMembers: $ReadOnlyArray<RelativeMemberInfo>,
      numMembersShowing: number,
      verticalBounds: ?VerticalBounds,
    ) => {
      const listData: ChatSettingsItem[] = [];

      const canAddMembers = threadHasPermission(
        threadInfo,
        threadPermissions.ADD_MEMBERS,
      );
      if (threadMembers.length === 0 && !canAddMembers) {
        return listData;
      }

      listData.push({
        itemType: 'header',
        key: 'memberHeader',
        title: 'Members',
        categoryType: 'unpadded',
      });

      if (canAddMembers) {
        listData.push({
          itemType: 'addMember',
          key: 'addMember',
        });
      }

      const numItems = Math.min(numMembersShowing, threadMembers.length);
      for (let i = 0; i < numItems; i++) {
        const memberInfo = threadMembers[i];
        listData.push({
          itemType: 'member',
          key: `member${memberInfo.id}`,
          memberInfo,
          threadInfo,
          canEdit: canStartEditing,
          navigate,
          firstListItem: i === 0 && !canAddMembers,
          lastListItem: i === numItems - 1 && numItems === threadMembers.length,
          verticalBounds,
          threadSettingsRouteKey: routeKey,
        });
      }

      if (numItems < threadMembers.length) {
        listData.push({
          itemType: 'seeMore',
          key: 'seeMoreMembers',
          onPress: this.onPressSeeMoreMembers,
        });
      }

      listData.push({
        itemType: 'footer',
        key: 'memberFooter',
        categoryType: 'unpadded',
      });

      return listData;
    },
  );

  actionsListDataSelector = createSelector(
    (propsAndState: PropsAndState) =>
      ThreadSettings.getThreadInfo(propsAndState),
    (propsAndState: PropsAndState) => propsAndState.parentThreadInfo,
    (propsAndState: PropsAndState) => propsAndState.navigation.navigate,
    (propsAndState: PropsAndState) => propsAndState.styles,
    (propsAndState: PropsAndState) => propsAndState.userInfos,
    (propsAndState: PropsAndState) => propsAndState.viewerID,
    (
      threadInfo: ThreadInfo,
      parentThreadInfo: ?ThreadInfo,
      navigate: ThreadSettingsNavigate,
      styles: typeof unboundStyles,
      userInfos: UserInfos,
      viewerID: ?string,
    ) => {
      const buttons = [];

      const canChangeThreadType = threadHasPermission(
        threadInfo,
        threadPermissions.EDIT_PERMISSIONS,
      );
      const canCreateSubthreadsInParent = threadHasPermission(
        parentThreadInfo,
        threadPermissions.CREATE_SUBTHREADS,
      );
      const canPromoteSidebar =
        threadInfo.type === threadTypes.SIDEBAR &&
        canChangeThreadType &&
        canCreateSubthreadsInParent;
      if (canPromoteSidebar) {
        buttons.push({
          itemType: 'promoteSidebar',
          key: 'promoteSidebar',
          threadInfo,
          navigate,
        });
      }

      const canLeaveThread = threadHasPermission(
        threadInfo,
        threadPermissions.LEAVE_THREAD,
      );

      if (viewerIsMember(threadInfo) && canLeaveThread) {
        buttons.push({
          itemType: 'leaveThread',
          key: 'leaveThread',
          threadInfo,
          navigate,
        });
      }

      const canDeleteThread = threadHasPermission(
        threadInfo,
        threadPermissions.DELETE_THREAD,
      );
      if (canDeleteThread) {
        buttons.push({
          itemType: 'deleteThread',
          key: 'deleteThread',
          threadInfo,
          navigate,
        });
      }

      const threadIsPersonal = threadInfo.type === threadTypes.PERSONAL;
      if (threadIsPersonal && viewerID) {
        const otherMemberID = getSingleOtherUser(threadInfo, viewerID);
        if (otherMemberID) {
          const otherUserInfo = userInfos[otherMemberID];
          const availableRelationshipActions = getAvailableRelationshipButtons(
            otherUserInfo,
          );

          for (const action of availableRelationshipActions) {
            buttons.push({
              itemType: 'editRelationship',
              key: action,
              threadInfo,
              navigate,
              relationshipButton: action,
            });
          }
        }
      }

      const listData: ChatSettingsItem[] = [];
      if (buttons.length === 0) {
        return listData;
      }

      listData.push({
        itemType: 'header',
        key: 'actionsHeader',
        title: 'Actions',
        categoryType: 'unpadded',
      });
      for (let i = 0; i < buttons.length; i++) {
        // Necessary for Flow...
        if (buttons[i].itemType === 'editRelationship') {
          listData.push({
            ...buttons[i],
            buttonStyle: [
              i === 0 ? null : styles.nonTopButton,
              i === buttons.length - 1 ? styles.lastButton : null,
            ],
          });
        } else {
          listData.push({
            ...buttons[i],
            buttonStyle: [
              i === 0 ? null : styles.nonTopButton,
              i === buttons.length - 1 ? styles.lastButton : null,
            ],
          });
        }
      }
      listData.push({
        itemType: 'footer',
        key: 'actionsFooter',
        categoryType: 'unpadded',
      });

      return listData;
    },
  );

  listDataSelector = createSelector(
    this.threadBasicsListDataSelector,
    this.subthreadsListDataSelector,
    this.sidebarsListDataSelector,
    this.threadMembersListDataSelector,
    this.actionsListDataSelector,
    (
      threadBasicsListData: ChatSettingsItem[],
      subthreadsListData: ChatSettingsItem[],
      sidebarsListData: ChatSettingsItem[],
      threadMembersListData: ChatSettingsItem[],
      actionsListData: ChatSettingsItem[],
    ) => [
      ...threadBasicsListData,
      ...subthreadsListData,
      ...sidebarsListData,
      ...threadMembersListData,
      ...actionsListData,
    ],
  );

  get listData() {
    return this.listDataSelector({ ...this.props, ...this.state });
  }

  render() {
    return (
      <View
        style={this.props.styles.container}
        ref={this.flatListContainerRef}
        onLayout={this.onFlatListContainerLayout}
      >
        <FlatList
          data={this.listData}
          contentContainerStyle={this.props.styles.flatList}
          renderItem={this.renderItem}
          scrollEnabled={!ThreadSettings.scrollDisabled(this.props)}
          indicatorStyle={this.props.indicatorStyle}
        />
      </View>
    );
  }

  flatListContainerRef = (
    flatListContainer: ?React.ElementRef<typeof View>,
  ) => {
    this.flatListContainer = flatListContainer;
  };

  onFlatListContainerLayout = () => {
    const { flatListContainer } = this;
    if (!flatListContainer) {
      return;
    }

    const { keyboardState } = this.props;
    if (!keyboardState || keyboardState.keyboardShowing) {
      return;
    }

    flatListContainer.measure((x, y, width, height, pageX, pageY) => {
      if (
        height === null ||
        height === undefined ||
        pageY === null ||
        pageY === undefined
      ) {
        return;
      }
      this.setState({ verticalBounds: { height, y: pageY } });
    });
  };

  renderItem = (row: { item: ChatSettingsItem }) => {
    const item = row.item;
    if (item.itemType === 'header') {
      return (
        <ThreadSettingsCategoryHeader
          type={item.categoryType}
          title={item.title}
        />
      );
    } else if (item.itemType === 'footer') {
      return <ThreadSettingsCategoryFooter type={item.categoryType} />;
    } else if (item.itemType === 'name') {
      return (
        <ThreadSettingsName
          threadInfo={item.threadInfo}
          nameEditValue={item.nameEditValue}
          setNameEditValue={this.setNameEditValue}
          canChangeSettings={item.canChangeSettings}
        />
      );
    } else if (item.itemType === 'color') {
      return (
        <ThreadSettingsColor
          threadInfo={item.threadInfo}
          colorEditValue={item.colorEditValue}
          setColorEditValue={this.setColorEditValue}
          canChangeSettings={item.canChangeSettings}
          navigate={item.navigate}
          threadSettingsRouteKey={item.threadSettingsRouteKey}
        />
      );
    } else if (item.itemType === 'description') {
      return (
        <ThreadSettingsDescription
          threadInfo={item.threadInfo}
          descriptionEditValue={item.descriptionEditValue}
          setDescriptionEditValue={this.setDescriptionEditValue}
          descriptionTextHeight={item.descriptionTextHeight}
          setDescriptionTextHeight={this.setDescriptionTextHeight}
          canChangeSettings={item.canChangeSettings}
        />
      );
    } else if (item.itemType === 'parent') {
      return (
        <ThreadSettingsParent
          threadInfo={item.threadInfo}
          parentThreadInfo={item.parentThreadInfo}
          navigate={item.navigate}
        />
      );
    } else if (item.itemType === 'visibility') {
      return <ThreadSettingsVisibility threadInfo={item.threadInfo} />;
    } else if (item.itemType === 'pushNotifs') {
      return <ThreadSettingsPushNotifs threadInfo={item.threadInfo} />;
    } else if (item.itemType === 'homeNotifs') {
      return <ThreadSettingsHomeNotifs threadInfo={item.threadInfo} />;
    } else if (item.itemType === 'seeMore') {
      return <ThreadSettingsSeeMore onPress={item.onPress} />;
    } else if (item.itemType === 'childThread') {
      return (
        <ThreadSettingsChildThread
          threadInfo={item.threadInfo}
          navigate={item.navigate}
          firstListItem={item.firstListItem}
          lastListItem={item.lastListItem}
        />
      );
    } else if (item.itemType === 'addSubthread') {
      return (
        <ThreadSettingsAddSubthread onPress={this.onPressComposeSubthread} />
      );
    } else if (item.itemType === 'member') {
      return (
        <ThreadSettingsMember
          memberInfo={item.memberInfo}
          threadInfo={item.threadInfo}
          canEdit={item.canEdit}
          navigate={item.navigate}
          firstListItem={item.firstListItem}
          lastListItem={item.lastListItem}
          verticalBounds={item.verticalBounds}
          threadSettingsRouteKey={item.threadSettingsRouteKey}
        />
      );
    } else if (item.itemType === 'addMember') {
      return <ThreadSettingsAddMember onPress={this.onPressAddMember} />;
    } else if (item.itemType === 'leaveThread') {
      return (
        <ThreadSettingsLeaveThread
          threadInfo={item.threadInfo}
          buttonStyle={item.buttonStyle}
        />
      );
    } else if (item.itemType === 'deleteThread') {
      return (
        <ThreadSettingsDeleteThread
          threadInfo={item.threadInfo}
          navigate={item.navigate}
          buttonStyle={item.buttonStyle}
        />
      );
    } else if (item.itemType === 'promoteSidebar') {
      return (
        <ThreadSettingsPromoteSidebar
          threadInfo={item.threadInfo}
          buttonStyle={item.buttonStyle}
        />
      );
    } else if (item.itemType === 'editRelationship') {
      return (
        <ThreadSettingsEditRelationship
          threadInfo={item.threadInfo}
          relationshipButton={item.relationshipButton}
          buttonStyle={item.buttonStyle}
        />
      );
    } else {
      invariant(false, `unexpected ThreadSettings item type ${item.itemType}`);
    }
  };

  setNameEditValue = (value: ?string, callback?: () => void) => {
    this.setState({ nameEditValue: value }, callback);
  };

  setColorEditValue = (color: string) => {
    this.setState({ colorEditValue: color });
  };

  setDescriptionEditValue = (value: ?string, callback?: () => void) => {
    this.setState({ descriptionEditValue: value }, callback);
  };

  setDescriptionTextHeight = (height: number) => {
    this.setState({ descriptionTextHeight: height });
  };

  onPressComposeSubthread = () => {
    const threadInfo = ThreadSettings.getThreadInfo(this.props);
    this.props.navigation.navigate(ComposeSubthreadModalRouteName, {
      presentedFrom: this.props.route.key,
      threadInfo,
    });
  };

  onPressAddMember = () => {
    const threadInfo = ThreadSettings.getThreadInfo(this.props);
    this.props.navigation.navigate(AddUsersModalRouteName, {
      presentedFrom: this.props.route.key,
      threadInfo,
    });
  };

  onPressSeeMoreMembers = () => {
    this.setState(prevState => ({
      numMembersShowing: prevState.numMembersShowing + itemPageLength,
    }));
  };

  onPressSeeMoreSubthreads = () => {
    this.setState(prevState => ({
      numSubthreadsShowing: prevState.numSubthreadsShowing + itemPageLength,
    }));
  };

  onPressSeeMoreSidebars = () => {
    this.setState(prevState => ({
      numSidebarsShowing: prevState.numSidebarsShowing + itemPageLength,
    }));
  };
}

const unboundStyles = {
  container: {
    backgroundColor: 'panelBackground',
    flex: 1,
  },
  flatList: {
    paddingVertical: 16,
  },
  nonTopButton: {
    borderColor: 'panelForegroundBorder',
    borderTopWidth: 1,
  },
  lastButton: {
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
  },
};

const editNameLoadingStatusSelector = createLoadingStatusSelector(
  changeThreadSettingsActionTypes,
  `${changeThreadSettingsActionTypes.started}:name`,
);
const editColorLoadingStatusSelector = createLoadingStatusSelector(
  changeThreadSettingsActionTypes,
  `${changeThreadSettingsActionTypes.started}:color`,
);
const editDescriptionLoadingStatusSelector = createLoadingStatusSelector(
  changeThreadSettingsActionTypes,
  `${changeThreadSettingsActionTypes.started}:description`,
);
const leaveThreadLoadingStatusSelector = createLoadingStatusSelector(
  leaveThreadActionTypes,
);

const somethingIsSaving = (
  state: AppState,
  threadMembers: $ReadOnlyArray<RelativeMemberInfo>,
) => {
  if (
    editNameLoadingStatusSelector(state) === 'loading' ||
    editColorLoadingStatusSelector(state) === 'loading' ||
    editDescriptionLoadingStatusSelector(state) === 'loading' ||
    leaveThreadLoadingStatusSelector(state) === 'loading'
  ) {
    return true;
  }
  for (const threadMember of threadMembers) {
    const removeUserLoadingStatus = createLoadingStatusSelector(
      removeUsersFromThreadActionTypes,
      `${removeUsersFromThreadActionTypes.started}:${threadMember.id}`,
    )(state);
    if (removeUserLoadingStatus === 'loading') {
      return true;
    }
    const changeRoleLoadingStatus = createLoadingStatusSelector(
      changeThreadMemberRolesActionTypes,
      `${changeThreadMemberRolesActionTypes.started}:${threadMember.id}`,
    )(state);
    if (changeRoleLoadingStatus === 'loading') {
      return true;
    }
  }
  return false;
};

export default React.memo<BaseProps>(function ConnectedThreadSettings(
  props: BaseProps,
) {
  const userInfos = useSelector(state => state.userStore.userInfos);
  const viewerID = useSelector(
    state => state.currentUserInfo && state.currentUserInfo.id,
  );
  const threadID = props.route.params.threadInfo.id;
  const threadInfo: ?ThreadInfo = useSelector(
    state => threadInfoSelector(state)[threadID],
  );
  const parentThreadID = threadInfo
    ? threadInfo.parentThreadID
    : props.route.params.threadInfo.parentThreadID;
  const parentThreadInfo: ?ThreadInfo = useSelector(state =>
    parentThreadID ? threadInfoSelector(state)[parentThreadID] : null,
  );
  const threadMembers = useSelector(
    relativeMemberInfoSelectorForMembersOfThread(threadID),
  );
  const boundChildThreadInfos = useSelector(
    state => childThreadInfos(state)[threadID],
  );
  const boundSomethingIsSaving = useSelector(state =>
    somethingIsSaving(state, threadMembers),
  );
  const styles = useStyles(unboundStyles);
  const indicatorStyle = useIndicatorStyle();
  const overlayContext = React.useContext(OverlayContext);
  const keyboardState = React.useContext(KeyboardContext);
  return (
    <ThreadSettings
      {...props}
      userInfos={userInfos}
      viewerID={viewerID}
      threadInfo={threadInfo}
      parentThreadInfo={parentThreadInfo}
      threadMembers={threadMembers}
      childThreadInfos={boundChildThreadInfos}
      somethingIsSaving={boundSomethingIsSaving}
      styles={styles}
      indicatorStyle={indicatorStyle}
      overlayContext={overlayContext}
      keyboardState={keyboardState}
    />
  );
});
