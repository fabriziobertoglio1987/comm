// @flow

import invariant from 'invariant';
import _maxBy from 'lodash/fp/maxBy';
import _orderBy from 'lodash/fp/orderBy';
import { type ParserRules } from 'simple-markdown';

import { multimediaMessagePreview } from '../media/media-utils';
import { userIDsToRelativeUserInfos } from '../selectors/user-selectors';
import type { PlatformDetails } from '../types/device-types';
import type { Media } from '../types/media-types';
import {
  type MessageInfo,
  type RawMessageInfo,
  type RobotextMessageInfo,
  type PreviewableMessageInfo,
  type RawMultimediaMessageInfo,
  type MessageData,
  type MessageType,
  type MessageTruncationStatus,
  type MultimediaMessageData,
  type MessageStore,
  type ComposableMessageInfo,
  messageTypes,
  messageTruncationStatus,
  type RawComposableMessageInfo,
} from '../types/message-types';
import type { ImagesMessageData } from '../types/messages/images';
import type { MediaMessageData } from '../types/messages/media';
import { type ThreadInfo } from '../types/thread-types';
import type { RelativeUserInfo, UserInfos } from '../types/user-types';
import { codeBlockRegex } from './markdown';
import { messageSpecs } from './messages/message-specs';
import { stringForUser } from './user-utils';

const localIDPrefix = 'local';

// Prefers localID
function messageKey(messageInfo: MessageInfo | RawMessageInfo): string {
  if (messageInfo.localID) {
    return messageInfo.localID;
  }
  invariant(messageInfo.id, 'localID should exist if ID does not');
  return messageInfo.id;
}

// Prefers serverID
function messageID(messageInfo: MessageInfo | RawMessageInfo): string {
  if (messageInfo.id) {
    return messageInfo.id;
  }
  invariant(messageInfo.localID, 'localID should exist if ID does not');
  return messageInfo.localID;
}

function robotextForUser(user: RelativeUserInfo): string {
  if (user.isViewer) {
    return 'you';
  } else if (user.username) {
    return `<${encodeURI(user.username)}|u${user.id}>`;
  } else {
    return 'anonymous';
  }
}

function robotextForUsers(users: RelativeUserInfo[]): string {
  if (users.length === 1) {
    return robotextForUser(users[0]);
  } else if (users.length === 2) {
    return `${robotextForUser(users[0])} and ${robotextForUser(users[1])}`;
  } else if (users.length === 3) {
    return (
      `${robotextForUser(users[0])}, ${robotextForUser(users[1])}, ` +
      `and ${robotextForUser(users[2])}`
    );
  } else {
    return (
      `${robotextForUser(users[0])}, ${robotextForUser(users[1])}, ` +
      `and ${users.length - 2} others`
    );
  }
}

function encodedThreadEntity(threadID: string, text: string): string {
  return `<${text}|t${threadID}>`;
}

function robotextForMessageInfo(
  messageInfo: RobotextMessageInfo,
  threadInfo: ThreadInfo,
): string {
  const creator = robotextForUser(messageInfo.creator);
  const messageSpec = messageSpecs[messageInfo.type];
  invariant(
    messageSpec.robotext,
    `we're not aware of messageType ${messageInfo.type}`,
  );
  return messageSpec.robotext(messageInfo, creator, {
    encodedThreadEntity,
    robotextForUsers,
    robotextForUser,
    threadInfo,
  });
}

function robotextToRawString(robotext: string): string {
  return decodeURI(robotext.replace(/<([^<>|]+)\|[^<>|]+>/g, '$1'));
}

function createMessageInfo(
  rawMessageInfo: RawMessageInfo,
  viewerID: ?string,
  userInfos: UserInfos,
  threadInfos: { [id: string]: ThreadInfo },
): ?MessageInfo {
  const creatorInfo = userInfos[rawMessageInfo.creatorID];
  if (!creatorInfo) {
    return null;
  }
  const creator = {
    id: rawMessageInfo.creatorID,
    username: creatorInfo.username,
    isViewer: rawMessageInfo.creatorID === viewerID,
  };

  const createRelativeUserInfos = (userIDs: $ReadOnlyArray<string>) =>
    userIDsToRelativeUserInfos(userIDs, viewerID, userInfos);
  const createMessageInfoFromRaw = (rawInfo: RawMessageInfo) =>
    createMessageInfo(rawInfo, viewerID, userInfos, threadInfos);

  const messageSpec = messageSpecs[rawMessageInfo.type];

  return messageSpec.createMessageInfo(rawMessageInfo, creator, {
    threadInfos,
    createMessageInfoFromRaw,
    createRelativeUserInfos,
  });
}

type LengthResult = {|
  +local: number,
  +realized: number,
|};
function findMessageIDMaxLengths(
  messageIDs: $ReadOnlyArray<?string>,
): LengthResult {
  const result = {
    local: 0,
    realized: 0,
  };
  for (const id of messageIDs) {
    if (!id) {
      continue;
    }
    if (id.startsWith(localIDPrefix)) {
      result.local = Math.max(result.local, id.length - localIDPrefix.length);
    } else {
      result.realized = Math.max(result.realized, id.length);
    }
  }
  return result;
}

function extendMessageID(id: ?string, lengths: LengthResult): ?string {
  if (!id) {
    return id;
  }
  if (id.startsWith(localIDPrefix)) {
    const zeroPaddedID = id
      .substr(localIDPrefix.length)
      .padStart(lengths.local, '0');
    return `${localIDPrefix}${zeroPaddedID}`;
  }
  return id.padStart(lengths.realized, '0');
}

function sortMessageInfoList<T: MessageInfo | RawMessageInfo>(
  messageInfos: $ReadOnlyArray<T>,
): T[] {
  const lengths = findMessageIDMaxLengths(
    messageInfos.map((message) => message?.id),
  );
  return _orderBy([
    'time',
    (message: T) => extendMessageID(message?.id, lengths),
  ])(['desc', 'desc'])(messageInfos);
}

const sortMessageIDs = (messages: { [id: string]: RawMessageInfo }) => (
  messageIDs: $ReadOnlyArray<string>,
): string[] => {
  const lengths = findMessageIDMaxLengths(messageIDs);
  return _orderBy([
    (id: string) => messages[id].time,
    (id: string) => extendMessageID(id, lengths),
  ])(['desc', 'desc'])(messageIDs);
};

function rawMessageInfoFromMessageData(
  messageData: MessageData,
  id: string,
): RawMessageInfo {
  const messageSpec = messageSpecs[messageData.type];
  invariant(
    messageSpec.rawMessageInfoFromMessageData,
    `we're not aware of messageType ${messageData.type}`,
  );
  return messageSpec.rawMessageInfoFromMessageData(messageData, id);
}

function mostRecentMessageTimestamp(
  messageInfos: $ReadOnlyArray<RawMessageInfo>,
  previousTimestamp: number,
): number {
  if (messageInfos.length === 0) {
    return previousTimestamp;
  }
  return _maxBy('time')(messageInfos).time;
}

function messageTypeGeneratesNotifs(type: MessageType) {
  return messageSpecs[type].generatesNotifs;
}

function splitRobotext(robotext: string) {
  return robotext.split(/(<[^<>|]+\|[^<>|]+>)/g);
}

const robotextEntityRegex = /<([^<>|]+)\|([^<>|]+)>/;
function parseRobotextEntity(robotextPart: string) {
  const entityParts = robotextPart.match(robotextEntityRegex);
  invariant(entityParts && entityParts[1], 'malformed robotext');
  const rawText = decodeURI(entityParts[1]);
  const entityType = entityParts[2].charAt(0);
  const id = entityParts[2].substr(1);
  return { rawText, entityType, id };
}

function usersInMessageInfos(
  messageInfos: $ReadOnlyArray<MessageInfo | RawMessageInfo>,
): string[] {
  const userIDs = new Set();
  for (const messageInfo of messageInfos) {
    if (messageInfo.creatorID) {
      userIDs.add(messageInfo.creatorID);
    } else if (messageInfo.creator) {
      userIDs.add(messageInfo.creator.id);
    }
  }
  return [...userIDs];
}

function combineTruncationStatuses(
  first: MessageTruncationStatus,
  second: ?MessageTruncationStatus,
): MessageTruncationStatus {
  if (
    first === messageTruncationStatus.EXHAUSTIVE ||
    second === messageTruncationStatus.EXHAUSTIVE
  ) {
    return messageTruncationStatus.EXHAUSTIVE;
  } else if (
    first === messageTruncationStatus.UNCHANGED &&
    second !== null &&
    second !== undefined
  ) {
    return second;
  } else {
    return first;
  }
}

function shimUnsupportedRawMessageInfos(
  rawMessageInfos: $ReadOnlyArray<RawMessageInfo>,
  platformDetails: ?PlatformDetails,
): RawMessageInfo[] {
  if (platformDetails && platformDetails.platform === 'web') {
    return [...rawMessageInfos];
  }
  return rawMessageInfos.map((rawMessageInfo) => {
    const { shimUnsupportedMessageInfo } = messageSpecs[rawMessageInfo.type];
    if (shimUnsupportedMessageInfo) {
      return shimUnsupportedMessageInfo(rawMessageInfo, platformDetails);
    }
    return rawMessageInfo;
  });
}

function messagePreviewText(
  messageInfo: PreviewableMessageInfo,
  threadInfo: ThreadInfo,
): string {
  if (
    messageInfo.type === messageTypes.IMAGES ||
    messageInfo.type === messageTypes.MULTIMEDIA
  ) {
    const creator = stringForUser(messageInfo.creator);
    const preview = multimediaMessagePreview(messageInfo);
    return `${creator} ${preview}`;
  }
  return robotextToRawString(robotextForMessageInfo(messageInfo, threadInfo));
}

type MediaMessageDataCreationInput = $ReadOnly<{
  threadID: string,
  creatorID: string,
  media: $ReadOnlyArray<Media>,
  localID?: ?string,
  time?: ?number,
  ...
}>;
function createMediaMessageData(
  input: MediaMessageDataCreationInput,
): MultimediaMessageData {
  let allMediaArePhotos = true;
  const photoMedia = [];
  for (const singleMedia of input.media) {
    if (singleMedia.type === 'video') {
      allMediaArePhotos = false;
      break;
    } else {
      photoMedia.push(singleMedia);
    }
  }

  const { localID, threadID, creatorID } = input;
  const time = input.time ? input.time : Date.now();
  let messageData;
  if (allMediaArePhotos) {
    messageData = ({
      type: messageTypes.IMAGES,
      threadID,
      creatorID,
      time,
      media: photoMedia,
    }: ImagesMessageData);
  } else {
    messageData = ({
      type: messageTypes.MULTIMEDIA,
      threadID,
      creatorID,
      time,
      media: input.media,
    }: MediaMessageData);
  }
  if (localID) {
    messageData.localID = localID;
  }
  return messageData;
}

type MediaMessageInfoCreationInput = $ReadOnly<{
  ...$Exact<MediaMessageDataCreationInput>,
  id?: ?string,
}>;
function createMediaMessageInfo(
  input: MediaMessageInfoCreationInput,
): RawMultimediaMessageInfo {
  const messageData = createMediaMessageData(input);
  const messageSpec = messageSpecs[messageData.type];
  return messageSpec.rawMessageInfoFromMessageData(messageData, input.id);
}

function stripLocalID(rawMessageInfo: RawComposableMessageInfo) {
  const { localID, ...rest } = rawMessageInfo;
  return rest;
}

function stripLocalIDs(
  input: $ReadOnlyArray<RawMessageInfo>,
): RawMessageInfo[] {
  const output = [];
  for (const rawMessageInfo of input) {
    if (rawMessageInfo.localID) {
      invariant(
        rawMessageInfo.id,
        'serverID should be set if localID is being stripped',
      );
      output.push(stripLocalID(rawMessageInfo));
    } else {
      output.push(rawMessageInfo);
    }
  }
  return output;
}

// Normally we call trim() to remove whitespace at the beginning and end of each
// message. However, our Markdown parser supports a "codeBlock" format where the
// user can indent each line to indicate a code block. If we match the
// corresponding RegEx, we'll only trim whitespace off the end.
function trimMessage(message: string) {
  message = message.replace(/^\n*/, '');
  return codeBlockRegex.exec(message) ? message.trimEnd() : message.trim();
}

function createMessageReply(message: string) {
  // add `>` to each line to include empty lines in the quote
  const quotedMessage = message.replace(/^/gm, '> ');
  return quotedMessage + '\n\n';
}

function getMostRecentNonLocalMessageID(
  threadID: string,
  messageStore: MessageStore,
): ?string {
  const thread = messageStore.threads[threadID];
  return thread?.messageIDs.find((id) => !id.startsWith(localIDPrefix));
}

export type GetMessageTitleViewerContext =
  | 'global_viewer'
  | 'individual_viewer';

function getMessageTitle(
  messageInfo: ComposableMessageInfo | RobotextMessageInfo,
  threadInfo: ThreadInfo,
  markdownRules: ParserRules,
  viewerContext?: GetMessageTitleViewerContext = 'individual_viewer',
): string {
  const { messageTitle } = messageSpecs[messageInfo.type];
  return messageTitle({
    messageInfo,
    threadInfo,
    markdownRules,
    viewerContext,
  });
}

function removeCreatorAsViewer<Info: MessageInfo>(messageInfo: Info): Info {
  return {
    ...messageInfo,
    creator: { ...messageInfo.creator, isViewer: false },
  };
}

export {
  localIDPrefix,
  messageKey,
  messageID,
  robotextForMessageInfo,
  robotextToRawString,
  createMessageInfo,
  sortMessageInfoList,
  sortMessageIDs,
  rawMessageInfoFromMessageData,
  mostRecentMessageTimestamp,
  messageTypeGeneratesNotifs,
  splitRobotext,
  parseRobotextEntity,
  usersInMessageInfos,
  combineTruncationStatuses,
  shimUnsupportedRawMessageInfos,
  messagePreviewText,
  createMediaMessageData,
  createMediaMessageInfo,
  stripLocalIDs,
  trimMessage,
  createMessageReply,
  getMostRecentNonLocalMessageID,
  getMessageTitle,
  removeCreatorAsViewer,
};
