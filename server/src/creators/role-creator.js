// @flow

import {
  type RoleInfo,
  threadPermissions,
  threadPermissionPropagationPrefixes,
  threadPermissionFilterPrefixes,
  type ThreadRolePermissionsBlob,
  type ThreadType,
  threadTypes,
} from 'lib/types/thread-types';

import { dbQuery, SQL } from '../database/database';
import createIDs from './id-creator';

type InitialRoles = {|
  default: RoleInfo,
  creator: RoleInfo,
|};
async function createInitialRolesForNewThread(
  threadID: string,
  threadType: ThreadType,
): Promise<InitialRoles> {
  const rolePermissions = getRolePermissionBlobs(threadType);
  const ids = await createIDs('roles', Object.values(rolePermissions).length);

  const time = Date.now();
  const newRows = [];
  const namesToIDs = {};
  for (const name in rolePermissions) {
    const id = ids.shift();
    namesToIDs[name] = id;
    const permissionsBlob = JSON.stringify(rolePermissions[name]);
    newRows.push([id, threadID, name, permissionsBlob, time]);
  }

  const query = SQL`
    INSERT INTO roles (id, thread, name, permissions, creation_time)
    VALUES ${newRows}
  `;
  await dbQuery(query);

  const defaultRoleInfo = {
    id: namesToIDs.Members,
    name: 'Members',
    permissions: rolePermissions.Members,
    isDefault: true,
  };
  if (!rolePermissions.Admins) {
    return {
      default: defaultRoleInfo,
      creator: defaultRoleInfo,
    };
  }

  const adminRoleInfo = {
    id: namesToIDs.Admins,
    name: 'Admins',
    permissions: rolePermissions.Admins,
    isDefault: false,
  };
  return {
    default: defaultRoleInfo,
    creator: adminRoleInfo,
  };
}

type RolePermissionBlobs = {|
  +Members: ThreadRolePermissionsBlob,
  +Admins?: ThreadRolePermissionsBlob,
|};

const { CHILD, DESCENDANT } = threadPermissionPropagationPrefixes;
const { OPEN, TOP_LEVEL, OPEN_TOP_LEVEL } = threadPermissionFilterPrefixes;
const OPEN_CHILD = CHILD + OPEN;
const OPEN_DESCENDANT = DESCENDANT + OPEN;
const TOP_LEVEL_DESCENDANT = DESCENDANT + TOP_LEVEL;
const OPEN_TOP_LEVEL_DESCENDANT = DESCENDANT + OPEN_TOP_LEVEL;

const voicedPermissions = {
  [threadPermissions.VOICED]: true,
  [threadPermissions.EDIT_ENTRIES]: true,
  [threadPermissions.EDIT_THREAD]: true,
  [threadPermissions.CREATE_SUBTHREADS]: true,
  [threadPermissions.ADD_MEMBERS]: true,
};

function getRolePermissionBlobsForCommunity(
  threadType: ThreadType,
): RolePermissionBlobs {
  const openDescendantKnowOf = OPEN_DESCENDANT + threadPermissions.KNOW_OF;
  const openDescendantVisible = OPEN_DESCENDANT + threadPermissions.VISIBLE;
  const topLevelDescendantMembership =
    TOP_LEVEL_DESCENDANT + threadPermissions.MEMBERSHIP;
  const openTopLevelDescendantJoinThread =
    OPEN_TOP_LEVEL_DESCENDANT + threadPermissions.JOIN_THREAD;
  const openChildMembership = OPEN_CHILD + threadPermissions.MEMBERSHIP;
  const openChildJoinThread = OPEN_CHILD + threadPermissions.JOIN_THREAD;

  const baseMemberPermissions = {
    [threadPermissions.KNOW_OF]: true,
    [threadPermissions.MEMBERSHIP]: true,
    [threadPermissions.VISIBLE]: true,
    [openDescendantKnowOf]: true,
    [openDescendantVisible]: true,
    [topLevelDescendantMembership]: true,
    [openTopLevelDescendantJoinThread]: true,
    [openChildMembership]: true,
    [openChildJoinThread]: true,
    [threadPermissions.CREATE_SIDEBARS]: true,
  };

  let memberPermissions;
  if (threadType === threadTypes.COMMUNITY_ANNOUNCEMENT_ROOT) {
    memberPermissions = {
      ...baseMemberPermissions,
      [threadPermissions.LEAVE_THREAD]: true,
    };
  } else if (threadType === threadTypes.GENESIS) {
    memberPermissions = baseMemberPermissions;
  } else {
    memberPermissions = {
      ...baseMemberPermissions,
      ...voicedPermissions,
      [threadPermissions.LEAVE_THREAD]: true,
    };
  }

  const descendantKnowOf = DESCENDANT + threadPermissions.KNOW_OF;
  const descendantVisible = DESCENDANT + threadPermissions.VISIBLE;
  const topLevelDescendantJoinThread =
    TOP_LEVEL_DESCENDANT + threadPermissions.JOIN_THREAD;
  const childMembership = CHILD + threadPermissions.MEMBERSHIP;
  const childJoinThread = CHILD + threadPermissions.JOIN_THREAD;
  const descendantVoiced = DESCENDANT + threadPermissions.VOICED;
  const descendantEditEntries = DESCENDANT + threadPermissions.EDIT_ENTRIES;
  const descendantEditThread = DESCENDANT + threadPermissions.EDIT_THREAD;
  const topLevelDescendantCreateSubthreads =
    TOP_LEVEL_DESCENDANT + threadPermissions.CREATE_SUBTHREADS;
  const topLevelDescendantCreateSidebars =
    TOP_LEVEL_DESCENDANT + threadPermissions.CREATE_SIDEBARS;
  const descendantAddMembers = DESCENDANT + threadPermissions.ADD_MEMBERS;
  const descendantDeleteThread = DESCENDANT + threadPermissions.DELETE_THREAD;
  const descendantEditPermissions =
    DESCENDANT + threadPermissions.EDIT_PERMISSIONS;
  const descendantRemoveMembers = DESCENDANT + threadPermissions.REMOVE_MEMBERS;
  const descendantChangeRole = DESCENDANT + threadPermissions.CHANGE_ROLE;

  const baseAdminPermissions = {
    [threadPermissions.KNOW_OF]: true,
    [threadPermissions.MEMBERSHIP]: true,
    [threadPermissions.VISIBLE]: true,
    [threadPermissions.VOICED]: true,
    [threadPermissions.EDIT_ENTRIES]: true,
    [threadPermissions.EDIT_THREAD]: true,
    [threadPermissions.CREATE_SUBTHREADS]: true,
    [threadPermissions.CREATE_SIDEBARS]: true,
    [threadPermissions.ADD_MEMBERS]: true,
    [threadPermissions.DELETE_THREAD]: true,
    [threadPermissions.REMOVE_MEMBERS]: true,
    [threadPermissions.CHANGE_ROLE]: true,
    [descendantKnowOf]: true,
    [descendantVisible]: true,
    [topLevelDescendantMembership]: true,
    [topLevelDescendantJoinThread]: true,
    [childMembership]: true,
    [childJoinThread]: true,
    [descendantVoiced]: true,
    [descendantEditEntries]: true,
    [descendantEditThread]: true,
    [topLevelDescendantCreateSubthreads]: true,
    [topLevelDescendantCreateSidebars]: true,
    [descendantAddMembers]: true,
    [descendantDeleteThread]: true,
    [descendantEditPermissions]: true,
    [descendantRemoveMembers]: true,
    [descendantChangeRole]: true,
  };

  let adminPermissions;
  if (threadType === threadTypes.GENESIS) {
    adminPermissions = baseAdminPermissions;
  } else {
    adminPermissions = {
      ...baseAdminPermissions,
      [threadPermissions.LEAVE_THREAD]: true,
    };
  }

  return {
    Members: memberPermissions,
    Admins: adminPermissions,
  };
}

function getRolePermissionBlobs(threadType: ThreadType): RolePermissionBlobs {
  if (threadType === threadTypes.SIDEBAR) {
    const memberPermissions = {
      [threadPermissions.VOICED]: true,
      [threadPermissions.EDIT_THREAD]: true,
      [threadPermissions.ADD_MEMBERS]: true,
      [threadPermissions.EDIT_PERMISSIONS]: true,
      [threadPermissions.REMOVE_MEMBERS]: true,
      [threadPermissions.LEAVE_THREAD]: true,
    };
    return {
      Members: memberPermissions,
    };
  }

  const openDescendantKnowOf = OPEN_DESCENDANT + threadPermissions.KNOW_OF;
  const openDescendantVisible = OPEN_DESCENDANT + threadPermissions.VISIBLE;
  const openChildMembership = OPEN_CHILD + threadPermissions.MEMBERSHIP;
  const openChildJoinThread = OPEN_CHILD + threadPermissions.JOIN_THREAD;

  if (threadType === threadTypes.PRIVATE) {
    const memberPermissions = {
      [threadPermissions.KNOW_OF]: true,
      [threadPermissions.MEMBERSHIP]: true,
      [threadPermissions.VISIBLE]: true,
      [threadPermissions.VOICED]: true,
      [threadPermissions.CREATE_SIDEBARS]: true,
      [threadPermissions.EDIT_ENTRIES]: true,
      [openDescendantKnowOf]: true,
      [openDescendantVisible]: true,
      [openChildMembership]: true,
      [openChildJoinThread]: true,
    };
    return {
      Members: memberPermissions,
    };
  }

  if (threadType === threadTypes.PERSONAL) {
    return {
      Members: {
        [threadPermissions.KNOW_OF]: true,
        [threadPermissions.MEMBERSHIP]: true,
        [threadPermissions.VISIBLE]: true,
        [threadPermissions.VOICED]: true,
        [threadPermissions.EDIT_ENTRIES]: true,
        [threadPermissions.EDIT_THREAD]: true,
        [threadPermissions.CREATE_SIDEBARS]: true,
        [openDescendantKnowOf]: true,
        [openDescendantVisible]: true,
        [openChildMembership]: true,
        [openChildJoinThread]: true,
      },
    };
  }

  const openSubthreadBasePermissions = {
    [threadPermissions.CREATE_SIDEBARS]: true,
    [threadPermissions.LEAVE_THREAD]: true,
    [openChildMembership]: true,
    [openChildJoinThread]: true,
  };

  if (threadType === threadTypes.COMMUNITY_OPEN_SUBTHREAD) {
    const memberPermissions = {
      [threadPermissions.REMOVE_MEMBERS]: true,
      [threadPermissions.EDIT_PERMISSIONS]: true,
      ...openSubthreadBasePermissions,
      ...voicedPermissions,
    };
    return {
      Members: memberPermissions,
    };
  }

  if (threadType === threadTypes.COMMUNITY_OPEN_ANNOUNCEMENT_SUBTHREAD) {
    return {
      Members: openSubthreadBasePermissions,
    };
  }

  const openTopLevelDescendantJoinThread =
    OPEN_TOP_LEVEL_DESCENDANT + threadPermissions.JOIN_THREAD;
  const secretSubthreadBasePermissions = {
    [threadPermissions.KNOW_OF]: true,
    [threadPermissions.VISIBLE]: true,
    [threadPermissions.CREATE_SIDEBARS]: true,
    [threadPermissions.LEAVE_THREAD]: true,
    [openDescendantKnowOf]: true,
    [openDescendantVisible]: true,
    [openTopLevelDescendantJoinThread]: true,
    [openChildMembership]: true,
    [openChildJoinThread]: true,
  };

  if (threadType === threadTypes.COMMUNITY_SECRET_SUBTHREAD) {
    const memberPermissions = {
      [threadPermissions.REMOVE_MEMBERS]: true,
      [threadPermissions.EDIT_PERMISSIONS]: true,
      ...secretSubthreadBasePermissions,
      ...voicedPermissions,
    };
    return {
      Members: memberPermissions,
    };
  }

  if (threadType === threadTypes.COMMUNITY_SECRET_ANNOUNCEMENT_SUBTHREAD) {
    return {
      Members: secretSubthreadBasePermissions,
    };
  }

  return getRolePermissionBlobsForCommunity(threadType);
}

export { createInitialRolesForNewThread, getRolePermissionBlobs };
