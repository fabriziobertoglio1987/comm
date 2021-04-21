// @flow

import invariant from 'invariant';

import { messageTypes } from '../../types/message-types';
import type { MessageInfo } from '../../types/message-types';
import type {
  ChangeSettingsMessageData,
  ChangeSettingsMessageInfo,
  RawChangeSettingsMessageInfo,
} from '../../types/messages/change-settings';
import type { NotifTexts } from '../../types/notif-types';
import { assertThreadType } from '../../types/thread-types';
import type { ThreadInfo } from '../../types/thread-types';
import type { RelativeUserInfo } from '../../types/user-types';
import {
  robotextToRawString,
  robotextForMessageInfo,
  removeCreatorAsViewer,
} from '../message-utils';
import { threadLabel } from '../thread-utils';
import type {
  MessageSpec,
  MessageTitleParam,
  NotificationTextsParams,
  RobotextParams,
} from './message-spec';
import { joinResult } from './utils';

export const changeSettingsMessageSpec: MessageSpec<
  ChangeSettingsMessageData,
  RawChangeSettingsMessageInfo,
  ChangeSettingsMessageInfo,
> = Object.freeze({
  messageContent(data: ChangeSettingsMessageData): string {
    return JSON.stringify({
      [data.field]: data.value,
    });
  },

  messageTitle({
    messageInfo,
    threadInfo,
    viewerContext,
  }: MessageTitleParam<ChangeSettingsMessageInfo>) {
    let validMessageInfo: ChangeSettingsMessageInfo = (messageInfo: ChangeSettingsMessageInfo);
    if (viewerContext === 'global_viewer') {
      validMessageInfo = removeCreatorAsViewer(validMessageInfo);
    }
    return robotextToRawString(
      robotextForMessageInfo(validMessageInfo, threadInfo),
    );
  },

  rawMessageInfoFromRow(row: Object): RawChangeSettingsMessageInfo {
    const content = JSON.parse(row.content);
    const field = Object.keys(content)[0];
    return {
      type: messageTypes.CHANGE_SETTINGS,
      id: row.id.toString(),
      threadID: row.threadID.toString(),
      time: row.time,
      creatorID: row.creatorID.toString(),
      field,
      value: content[field],
    };
  },

  createMessageInfo(
    rawMessageInfo: RawChangeSettingsMessageInfo,
    creator: RelativeUserInfo,
  ): ChangeSettingsMessageInfo {
    return {
      type: messageTypes.CHANGE_SETTINGS,
      id: rawMessageInfo.id,
      threadID: rawMessageInfo.threadID,
      creator,
      time: rawMessageInfo.time,
      field: rawMessageInfo.field,
      value: rawMessageInfo.value,
    };
  },

  rawMessageInfoFromMessageData(
    messageData: ChangeSettingsMessageData,
    id: ?string,
  ): RawChangeSettingsMessageInfo {
    invariant(id, 'RawAddMembersMessageInfo needs id');
    return { ...messageData, id };
  },

  robotext(
    messageInfo: ChangeSettingsMessageInfo,
    creator: string,
    params: RobotextParams,
  ): string {
    let value;
    if (messageInfo.field === 'color') {
      value = `<#${messageInfo.value}|c${messageInfo.threadID}>`;
    } else if (messageInfo.field === 'type') {
      invariant(
        typeof messageInfo.value === 'number',
        'messageInfo.value should be number for thread type change ',
      );
      const newThreadType = assertThreadType(messageInfo.value);
      value = threadLabel(newThreadType);
    } else {
      value = messageInfo.value;
    }
    return (
      `${creator} updated ` +
      `${params.encodedThreadEntity(messageInfo.threadID, 'the thread')}'s ` +
      `${messageInfo.field} to "${value}"`
    );
  },

  notificationTexts(
    messageInfos: $ReadOnlyArray<MessageInfo>,
    threadInfo: ThreadInfo,
    params: NotificationTextsParams,
  ): NotifTexts {
    const mostRecentMessageInfo = messageInfos[0];
    invariant(
      mostRecentMessageInfo.type === messageTypes.CHANGE_SETTINGS,
      'messageInfo should be messageTypes.CHANGE_SETTINGS!',
    );
    const body = params.strippedRobotextForMessageInfo(
      mostRecentMessageInfo,
      threadInfo,
    );
    return {
      merged: body,
      title: threadInfo.uiName,
      body,
    };
  },

  notificationCollapseKey(
    rawMessageInfo: RawChangeSettingsMessageInfo,
  ): string {
    return joinResult(
      rawMessageInfo.type,
      rawMessageInfo.threadID,
      rawMessageInfo.creatorID,
      rawMessageInfo.field,
    );
  },

  generatesNotifs: true,
});
