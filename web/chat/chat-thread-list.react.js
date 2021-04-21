// @flow

import * as React from 'react';

import type { ThreadInfo } from 'lib/types/thread-types';

import { useSelector } from '../redux/redux-utils';
import { webChatListData } from '../selectors/chat-selectors';
import ChatThreadListItem from './chat-thread-list-item.react';

type Props = {|
  +filterThreads: (threadItem: ThreadInfo) => boolean,
  +setModal: (modal: ?React.Node) => void,
  +emptyItem?: React.ComponentType<{||}>,
  +forceIncludeActiveThread: boolean,
|};
function ChatThreadList(props: Props) {
  const {
    filterThreads,
    setModal,
    emptyItem,
    forceIncludeActiveThread,
  } = props;
  const activeChatThreadID = useSelector(
    state => state.navInfo.activeChatThreadID,
  );
  const chatListData = useSelector(webChatListData);
  const listData: React.Node[] = React.useMemo(() => {
    const threads = chatListData
      .filter(
        item =>
          filterThreads(item.threadInfo) ||
          (item.threadInfo.id === activeChatThreadID &&
            forceIncludeActiveThread),
      )
      .map(item => (
        <ChatThreadListItem
          item={item}
          key={item.threadInfo.id}
          setModal={setModal}
        />
      ));
    if (threads.length === 0 && emptyItem) {
      const EmptyItem = emptyItem;
      threads.push(<EmptyItem key="emptyItem" />);
    }
    return threads;
  }, [
    activeChatThreadID,
    chatListData,
    emptyItem,
    filterThreads,
    forceIncludeActiveThread,
    setModal,
  ]);
  return <div>{listData}</div>;
}

export default ChatThreadList;
