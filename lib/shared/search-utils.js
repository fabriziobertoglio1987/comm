// @flow

import { userRelationshipStatus } from '../types/relationship-types';
import {
  type ThreadInfo,
  type ThreadType,
  threadTypes,
} from '../types/thread-types';
import type { AccountUserInfo, UserListItem } from '../types/user-types';
import SearchIndex from './search-index';
import { userIsMember } from './thread-utils';

function getPotentialMemberItems(
  text: string,
  userInfos: { [id: string]: AccountUserInfo },
  searchIndex: SearchIndex,
  excludeUserIDs: $ReadOnlyArray<string>,
  parentThreadInfo: ?ThreadInfo,
  threadType: ?ThreadType,
): UserListItem[] {
  let results = [];
  const appendUserInfo = (userInfo: AccountUserInfo) => {
    if (!excludeUserIDs.includes(userInfo.id)) {
      results.push({
        ...userInfo,
        isMemberOfParentThread: userIsMember(parentThreadInfo, userInfo.id),
      });
    }
  };
  if (text === '') {
    for (const id in userInfos) {
      appendUserInfo(userInfos[id]);
    }
  } else {
    const ids = searchIndex.getSearchResults(text);
    for (const id of ids) {
      appendUserInfo(userInfos[id]);
    }
  }

  if (text === '') {
    results = results.filter((userInfo) =>
      parentThreadInfo
        ? userInfo.isMemberOfParentThread &&
          userInfo.relationshipStatus !==
            userRelationshipStatus.BLOCKED_BY_VIEWER
        : userInfo.relationshipStatus === userRelationshipStatus.FRIEND,
    );
  }

  const nonFriends = [];
  const blockedUsers = [];
  const friendsAndParentMembers = [];

  for (const userResult of results) {
    const relationshipStatus = userResult.relationshipStatus;
    if (
      userResult.isMemberOfParentThread &&
      relationshipStatus !== userRelationshipStatus.BLOCKED_BY_VIEWER
    ) {
      friendsAndParentMembers.unshift(userResult);
    } else if (relationshipStatus === userRelationshipStatus.FRIEND) {
      friendsAndParentMembers.push(userResult);
    } else if (
      relationshipStatus === userRelationshipStatus.BLOCKED_BY_VIEWER
    ) {
      blockedUsers.push(userResult);
    } else {
      nonFriends.push(userResult);
    }
  }

  const sortedResults = friendsAndParentMembers
    .concat(nonFriends)
    .concat(blockedUsers);

  return sortedResults.map(
    ({ isMemberOfParentThread, relationshipStatus, ...result }) => {
      if (
        isMemberOfParentThread &&
        relationshipStatus !== userRelationshipStatus.BLOCKED_BY_VIEWER
      ) {
        return { ...result };
      }
      let notice, alertText, alertTitle;
      const userText = result.username;
      if (!isMemberOfParentThread && threadType === threadTypes.SIDEBAR) {
        notice = 'not in parent thread';
        alertTitle = 'Not in parent thread';
        alertText =
          'You can only add members of the parent thread to a sidebar';
      } else if (
        relationshipStatus === userRelationshipStatus.BLOCKED_BY_VIEWER
      ) {
        notice = "you've blocked this user";
        alertTitle = 'Not a friend';
        alertText =
          `Before you add ${userText} to this thread, ` +
          "you'll need to unblock them and send a friend request. " +
          'You can do this from the Block List and Friend List ' +
          'in the Profile tab.';
      } else if (relationshipStatus !== userRelationshipStatus.FRIEND) {
        notice = 'not friend';
        alertTitle = 'Not a friend';
        alertText =
          `Before you add ${userText} to this thread, ` +
          "you'll need to send them a friend request. " +
          'You can do this from the Friend List in the Profile tab.';
      } else if (parentThreadInfo) {
        notice = 'not in parent thread';
      }
      return { ...result, notice, alertText, alertTitle };
    },
  );
}

export { getPotentialMemberItems };
