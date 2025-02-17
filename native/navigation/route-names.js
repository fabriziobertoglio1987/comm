// @flow

import type { LeafRoute } from '@react-navigation/native';

import type { VerificationModalParams } from '../account/verification-modal.react';
import type { ThreadPickerModalParams } from '../calendar/thread-picker-modal.react';
import type { ComposeThreadParams } from '../chat/compose-thread.react';
import type { ImagePasteModalParams } from '../chat/image-paste-modal.react';
import type { MessageListParams } from '../chat/message-list-types';
import type { MultimediaTooltipModalParams } from '../chat/multimedia-tooltip-modal.react';
import type { RobotextMessageTooltipModalParams } from '../chat/robotext-message-tooltip-modal.react';
import type { AddUsersModalParams } from '../chat/settings/add-users-modal.react';
import type { ColorPickerModalParams } from '../chat/settings/color-picker-modal.react';
import type { ComposeSubthreadModalParams } from '../chat/settings/compose-subthread-modal.react';
import type { DeleteThreadParams } from '../chat/settings/delete-thread.react';
import type { ThreadSettingsMemberTooltipModalParams } from '../chat/settings/thread-settings-member-tooltip-modal.react';
import type { ThreadSettingsParams } from '../chat/settings/thread-settings.react';
import type { SidebarListModalParams } from '../chat/sidebar-list-modal.react';
import type { TextMessageTooltipModalParams } from '../chat/text-message-tooltip-modal.react';
import type { CameraModalParams } from '../media/camera-modal.react';
import type { ImageModalParams } from '../media/image-modal.react';
import type { VideoPlaybackModalParams } from '../media/video-playback-modal.react';
import type { CustomServerModalParams } from '../profile/custom-server-modal.react';
import type { RelationshipListItemTooltipModalParams } from '../profile/relationship-list-item-tooltip-modal.react';
import type { ActionResultModalParams } from './action-result-modal.react';

export const AppRouteName = 'App';
export const TabNavigatorRouteName = 'TabNavigator';
export const ComposeThreadRouteName = 'ComposeThread';
export const DeleteThreadRouteName = 'DeleteThread';
export const ThreadSettingsRouteName = 'ThreadSettings';
export const MessageListRouteName = 'MessageList';
export const VerificationModalRouteName = 'VerificationModal';
export const LoggedOutModalRouteName = 'LoggedOutModal';
export const ProfileRouteName = 'Profile';
export const AppsRouteName = 'Apps';
export const ProfileScreenRouteName = 'ProfileScreen';
export const RelationshipListItemTooltipModalRouteName =
  'RelationshipListItemTooltipModal';
export const ChatRouteName = 'Chat';
export const ChatThreadListRouteName = 'ChatThreadList';
export const HomeChatThreadListRouteName = 'HomeChatThreadList';
export const BackgroundChatThreadListRouteName = 'BackgroundChatThreadList';
export const CalendarRouteName = 'Calendar';
export const BuildInfoRouteName = 'BuildInfo';
export const DeleteAccountRouteName = 'DeleteAccount';
export const DevToolsRouteName = 'DevTools';
export const EditEmailRouteName = 'EditEmail';
export const EditPasswordRouteName = 'EditPassword';
export const AppearancePreferencesRouteName = 'AppearancePreferences';
export const ThreadPickerModalRouteName = 'ThreadPickerModal';
export const AddUsersModalRouteName = 'AddUsersModal';
export const CustomServerModalRouteName = 'CustomServerModal';
export const ColorPickerModalRouteName = 'ColorPickerModal';
export const ComposeSubthreadModalRouteName = 'ComposeSubthreadModal';
export const ImageModalRouteName = 'ImageModal';
export const MultimediaTooltipModalRouteName = 'MultimediaTooltipModal';
export const ActionResultModalRouteName = 'ActionResultModal';
export const TextMessageTooltipModalRouteName = 'TextMessageTooltipModal';
export const ThreadSettingsMemberTooltipModalRouteName =
  'ThreadSettingsMemberTooltipModal';
export const CameraModalRouteName = 'CameraModal';
export const VideoPlaybackModalRouteName = 'VideoPlaybackModal';
export const FriendListRouteName = 'FriendList';
export const BlockListRouteName = 'BlockList';
export const SidebarListModalRouteName = 'SidebarListModal';
export const ImagePasteModalRouteName = 'ImagePasteModal';
export const RobotextMessageTooltipModalRouteName =
  'RobotextMessageTooltipModal';

export type RootParamList = {|
  +LoggedOutModal: void,
  +VerificationModal: VerificationModalParams,
  +App: void,
  +ThreadPickerModal: ThreadPickerModalParams,
  +AddUsersModal: AddUsersModalParams,
  +CustomServerModal: CustomServerModalParams,
  +ColorPickerModal: ColorPickerModalParams,
  +ComposeSubthreadModal: ComposeSubthreadModalParams,
  +SidebarListModal: SidebarListModalParams,
  +ImagePasteModal: ImagePasteModalParams,
|};

export type TooltipModalParamList = {|
  +MultimediaTooltipModal: MultimediaTooltipModalParams,
  +TextMessageTooltipModal: TextMessageTooltipModalParams,
  +ThreadSettingsMemberTooltipModal: ThreadSettingsMemberTooltipModalParams,
  +RelationshipListItemTooltipModal: RelationshipListItemTooltipModalParams,
  +RobotextMessageTooltipModal: RobotextMessageTooltipModalParams,
|};

export type OverlayParamList = {|
  +TabNavigator: void,
  +ImageModal: ImageModalParams,
  +ActionResultModal: ActionResultModalParams,
  +CameraModal: CameraModalParams,
  +VideoPlaybackModal: VideoPlaybackModalParams,
  ...TooltipModalParamList,
|};

export type TabParamList = {|
  +Calendar: void,
  +Chat: void,
  +Profile: void,
  +Apps: void,
|};

export type ChatParamList = {|
  +ChatThreadList: void,
  +MessageList: MessageListParams,
  +ComposeThread: ComposeThreadParams,
  +ThreadSettings: ThreadSettingsParams,
  +DeleteThread: DeleteThreadParams,
|};

export type ChatTopTabsParamList = {|
  +HomeChatThreadList: void,
  +BackgroundChatThreadList: void,
|};

export type ProfileParamList = {|
  +ProfileScreen: void,
  +EditEmail: void,
  +EditPassword: void,
  +DeleteAccount: void,
  +BuildInfo: void,
  +DevTools: void,
  +AppearancePreferences: void,
  +FriendList: void,
  +BlockList: void,
|};

export type ScreenParamList = {|
  ...RootParamList,
  ...OverlayParamList,
  ...TabParamList,
  ...ChatParamList,
  ...ChatTopTabsParamList,
  ...ProfileParamList,
|};

export type NavigationRoute<RouteName: string = $Keys<ScreenParamList>> = {|
  ...LeafRoute<RouteName>,
  +params: $ElementType<ScreenParamList, RouteName>,
|};

export const accountModals = [
  LoggedOutModalRouteName,
  VerificationModalRouteName,
];

export const scrollBlockingModals = [
  ImageModalRouteName,
  MultimediaTooltipModalRouteName,
  TextMessageTooltipModalRouteName,
  ThreadSettingsMemberTooltipModalRouteName,
  RelationshipListItemTooltipModalRouteName,
  RobotextMessageTooltipModalRouteName,
  VideoPlaybackModalRouteName,
];

export const chatRootModals = [
  AddUsersModalRouteName,
  ColorPickerModalRouteName,
  ComposeSubthreadModalRouteName,
];

export const threadRoutes = [
  MessageListRouteName,
  ThreadSettingsRouteName,
  DeleteThreadRouteName,
  ComposeThreadRouteName,
];
