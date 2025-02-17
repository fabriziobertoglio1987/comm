// @flow

import ashoat from 'lib/facts/ashoat';
import bots from 'lib/facts/bots';
import genesis from 'lib/facts/genesis';
import { threadTypes, type ThreadType } from 'lib/types/thread-types';

import { createThread } from '../creators/thread-creator';
import { dbQuery, SQL } from '../database/database';
import { fetchServerThreadInfos } from '../fetchers/thread-fetchers';
import { fetchAllUserIDs } from '../fetchers/user-fetchers';
import { createScriptViewer } from '../session/scripts';
import type { Viewer } from '../session/viewer';
import { updateThread } from '../updaters/thread-updaters';
import { main } from './utils';

const batchSize = 10;
const createThreadOptions = { forceAddMembers: true };
const updateThreadOptions = {
  forceUpdateRoot: true,
  silenceMessages: true,
  ignorePermissions: true,
};
const convertUnadminnedToCommunities = ['311733', '421638'];
const convertToAnnouncementCommunities = ['375310'];
const convertToAnnouncementSubthreads = ['82649'];

async function createGenesisCommunity() {
  const genesisThreadInfos = await fetchServerThreadInfos(
    SQL`t.id = ${genesis.id}`,
  );
  const genesisThreadInfo = genesisThreadInfos.threadInfos[genesis.id];
  if (genesisThreadInfo && genesisThreadInfo.type === threadTypes.GENESIS) {
    return;
  } else if (genesisThreadInfo) {
    return await updateGenesisCommunityType();
  }

  console.log('creating GENESIS community');

  const idInsertQuery = SQL`
    INSERT INTO ids(id, table_name)
    VALUES ${[[genesis.id, 'threads']]}
  `;
  await dbQuery(idInsertQuery);

  const ashoatViewer = createScriptViewer(ashoat.id);
  const allUserIDs = await fetchAllUserIDs();
  const nonAshoatUserIDs = allUserIDs.filter((id) => id !== ashoat.id);

  await createThread(
    ashoatViewer,
    {
      id: genesis.id,
      type: threadTypes.GENESIS,
      name: genesis.name,
      description: genesis.description,
      initialMemberIDs: nonAshoatUserIDs,
    },
    createThreadOptions,
  );
}

async function updateGenesisCommunityType() {
  console.log('updating GENESIS community to GENESIS type');

  const ashoatViewer = createScriptViewer(ashoat.id);
  await updateThread(
    ashoatViewer,
    {
      threadID: genesis.id,
      changes: {
        type: threadTypes.GENESIS,
      },
    },
    updateThreadOptions,
  );
}

async function convertExistingCommunities() {
  const communityQuery = SQL`
    SELECT t.id, t.name
    FROM threads t
    LEFT JOIN roles r ON r.thread = t.id
    LEFT JOIN memberships m ON m.thread = t.id
    WHERE t.type = ${threadTypes.COMMUNITY_SECRET_SUBTHREAD}
      AND t.parent_thread_id IS NULL
    GROUP BY t.id
    HAVING COUNT(DISTINCT r.id) > 1 AND COUNT(DISTINCT m.user) > 2
  `;
  const [convertToCommunity] = await dbQuery(communityQuery);

  const botViewer = createScriptViewer(bots.squadbot.userID);
  await convertThreads(
    botViewer,
    convertToCommunity,
    threadTypes.COMMUNITY_ROOT,
  );
}

async function convertThreads(
  viewer: Viewer,
  threads: Array<{| +id: string, +name: string |}>,
  type: ThreadType,
) {
  while (threads.length > 0) {
    const batch = threads.splice(0, batchSize);
    await Promise.all(
      batch.map(async (thread) => {
        console.log(`converting ${JSON.stringify(thread)} to ${type}`);
        return await updateThread(
          viewer,
          {
            threadID: thread.id,
            changes: { type },
          },
          updateThreadOptions,
        );
      }),
    );
  }
}

async function convertUnadminnedCommunities() {
  const communityQuery = SQL`
    SELECT id, name
    FROM threads
    WHERE id IN (${convertUnadminnedToCommunities}) AND
      type = ${threadTypes.COMMUNITY_SECRET_SUBTHREAD}
  `;
  const [convertToCommunity] = await dbQuery(communityQuery);

  // We use ashoat here to make sure he becomes the admin of these communities
  const ashoatViewer = createScriptViewer(ashoat.id);
  await convertThreads(
    ashoatViewer,
    convertToCommunity,
    threadTypes.COMMUNITY_ROOT,
  );
}

async function convertAnnouncementCommunities() {
  const announcementCommunityQuery = SQL`
    SELECT id, name
    FROM threads
    WHERE id IN (${convertToAnnouncementCommunities}) AND
      type != ${threadTypes.COMMUNITY_ANNOUNCEMENT_ROOT}
  `;
  const [convertToAnnouncementCommunity] = await dbQuery(
    announcementCommunityQuery,
  );

  const botViewer = createScriptViewer(bots.squadbot.userID);
  await convertThreads(
    botViewer,
    convertToAnnouncementCommunity,
    threadTypes.COMMUNITY_ANNOUNCEMENT_ROOT,
  );
}

async function convertAnnouncementSubthreads() {
  const announcementSubthreadQuery = SQL`
    SELECT id, name
    FROM threads
    WHERE id IN (${convertToAnnouncementSubthreads}) AND
      type != ${threadTypes.COMMUNITY_OPEN_ANNOUNCEMENT_SUBTHREAD}
  `;
  const [convertToAnnouncementSubthread] = await dbQuery(
    announcementSubthreadQuery,
  );

  const botViewer = createScriptViewer(bots.squadbot.userID);
  await convertThreads(
    botViewer,
    convertToAnnouncementSubthread,
    threadTypes.COMMUNITY_OPEN_ANNOUNCEMENT_SUBTHREAD,
  );
}

async function moveThreadsToGenesis() {
  const noParentQuery = SQL`
    SELECT id, name
    FROM threads
    WHERE type != ${threadTypes.COMMUNITY_ROOT}
      AND type != ${threadTypes.COMMUNITY_ANNOUNCEMENT_ROOT}
      AND type != ${threadTypes.GENESIS}
      AND parent_thread_id IS NULL
  `;
  const [noParentThreads] = await dbQuery(noParentQuery);

  const botViewer = createScriptViewer(bots.squadbot.userID);
  while (noParentThreads.length > 0) {
    const batch = noParentThreads.splice(0, batchSize);
    await Promise.all(
      batch.map(async (thread) => {
        console.log(`processing ${JSON.stringify(thread)}`);
        return await updateThread(
          botViewer,
          {
            threadID: thread.id,
            changes: {
              parentThreadID: genesis.id,
            },
          },
          updateThreadOptions,
        );
      }),
    );
  }

  const childQuery = SQL`
    SELECT id, name
    FROM threads
    WHERE type != ${threadTypes.COMMUNITY_ROOT}
      AND type != ${threadTypes.COMMUNITY_ANNOUNCEMENT_ROOT}
      AND type != ${threadTypes.GENESIS}
      AND parent_thread_id IS NOT NULL
      AND parent_thread_id != ${genesis.id}
  `;
  const [childThreads] = await dbQuery(childQuery);

  for (const childThread of childThreads) {
    // We go one by one because the changes in a parent thread can affect a
    // child thread. If the child thread update starts at the same time as an
    // update for its parent thread, a race can cause incorrect results for the
    // child thread (in particular for the permissions on the memberships table)
    console.log(`processing ${JSON.stringify(childThread)}`);
    await updateThread(
      botViewer,
      {
        threadID: childThread.id,
        changes: {},
      },
      updateThreadOptions,
    );
  }
}

main([
  createGenesisCommunity,
  convertExistingCommunities,
  convertUnadminnedCommunities,
  convertAnnouncementCommunities,
  convertAnnouncementSubthreads,
  moveThreadsToGenesis,
]);
