// @flow

import { type ParserRules } from 'simple-markdown';

import type { PlatformDetails } from '../../types/device-types';
import type { Media } from '../../types/media-types';
import type {
  MessageInfo,
  RawComposableMessageInfo,
  RawMessageInfo,
  RawRobotextMessageInfo,
  RobotextMessageInfo,
} from '../../types/message-types';
import type { RawUnsupportedMessageInfo } from '../../types/messages/unsupported';
import type { NotifTexts } from '../../types/notif-types';
import type { ThreadInfo, ThreadType } from '../../types/thread-types';
import type { RelativeUserInfo } from '../../types/user-types';
import type { GetMessageTitleViewerContext } from '../message-utils';

export type MessageTitleParam<Info> = {|
  +messageInfo: Info,
  +threadInfo: ThreadInfo,
  +markdownRules: ParserRules,
  +viewerContext?: GetMessageTitleViewerContext,
|};

export type RawMessageInfoFromRowParams = {|
  +localID: ?string,
  +media?: $ReadOnlyArray<Media>,
  +derivedMessages: $ReadOnlyMap<
    string,
    RawComposableMessageInfo | RawRobotextMessageInfo,
  >,
|};

export type CreateMessageInfoParams = {|
  +threadInfos: {| [id: string]: ThreadInfo |},
  +createMessageInfoFromRaw: (rawInfo: RawMessageInfo) => ?MessageInfo,
  +createRelativeUserInfos: (
    userIDs: $ReadOnlyArray<string>,
  ) => RelativeUserInfo[],
|};

export type RobotextParams = {|
  +encodedThreadEntity: (threadID: string, text: string) => string,
  +robotextForUsers: (users: RelativeUserInfo[]) => string,
  +robotextForUser: (user: RelativeUserInfo) => string,
  +threadInfo: ThreadInfo,
|};

export type NotificationTextsParams = {|
  +notifThreadName: (threadInfo: ThreadInfo) => string,
  +notifTextForSubthreadCreation: (
    creator: RelativeUserInfo,
    threadType: ThreadType,
    parentThreadInfo: ThreadInfo,
    childThreadName: ?string,
    childThreadUIName: string,
  ) => NotifTexts,
  +strippedRobotextForMessageInfo: (
    messageInfo: RobotextMessageInfo,
    threadInfo: ThreadInfo,
  ) => string,
  +notificationTexts: (
    messageInfos: $ReadOnlyArray<MessageInfo>,
    threadInfo: ThreadInfo,
  ) => NotifTexts,
|};

export type MessageSpec<Data, RawInfo, Info> = {|
  +messageContent?: (data: Data) => string,
  +messageTitle: (param: MessageTitleParam<Info>) => string,
  +rawMessageInfoFromRow?: (
    row: Object,
    params: RawMessageInfoFromRowParams,
  ) => ?RawInfo,
  +createMessageInfo: (
    rawMessageInfo: RawInfo,
    creator: RelativeUserInfo,
    params: CreateMessageInfoParams,
  ) => ?Info,
  +rawMessageInfoFromMessageData?: (messageData: Data, id: ?string) => RawInfo,
  +robotext?: (
    messageInfo: Info,
    creator: string,
    params: RobotextParams,
  ) => string,
  +shimUnsupportedMessageInfo?: (
    rawMessageInfo: RawInfo,
    platformDetails: ?PlatformDetails,
  ) => RawInfo | RawUnsupportedMessageInfo,
  +unshimMessageInfo?: (
    unwrapped: RawInfo,
    messageInfo: RawMessageInfo,
  ) => ?RawMessageInfo,
  +notificationTexts?: (
    messageInfos: $ReadOnlyArray<MessageInfo>,
    threadInfo: ThreadInfo,
    params: NotificationTextsParams,
  ) => NotifTexts,
  +notificationCollapseKey?: (rawMessageInfo: RawInfo) => string,
  +generatesNotifs: boolean,
  +userIDs?: (rawMessageInfo: RawInfo) => $ReadOnlyArray<string>,
  +startsThread?: boolean,
  +threadIDs?: (rawMessageInfo: RawInfo) => $ReadOnlyArray<string>,
  +includedInRepliesCount?: boolean,
|};
