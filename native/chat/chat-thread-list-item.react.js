// @flow

import * as React from 'react';
import { Text, View } from 'react-native';

import type { ChatThreadItem } from 'lib/selectors/chat-selectors';
import type { ThreadInfo } from 'lib/types/thread-types';
import type { UserInfo } from 'lib/types/user-types';
import { shortAbsoluteDate } from 'lib/utils/date-utils';

import Button from '../components/button.react';
import ColorSplotch from '../components/color-splotch.react';
import { SingleLine } from '../components/single-line.react';
import { useColors, useStyles } from '../themes/colors';
import ChatThreadListSeeMoreSidebars from './chat-thread-list-see-more-sidebars.react';
import ChatThreadListSidebar from './chat-thread-list-sidebar.react';
import MessagePreview from './message-preview.react';
import SwipeableThread from './swipeable-thread.react';

type Props = {|
  +data: ChatThreadItem,
  +onPressItem: (
    data: ThreadInfo,
    pendingPersonalThreadUserInfo?: UserInfo,
  ) => void,
  +onPressSeeMoreSidebars: (threadInfo: ThreadInfo) => void,
  +onSwipeableWillOpen: (threadInfo: ThreadInfo) => void,
  +currentlyOpenedSwipeableId: string,
|};
function ChatThreadListItem({
  data,
  onPressItem,
  onPressSeeMoreSidebars,
  onSwipeableWillOpen,
  currentlyOpenedSwipeableId,
}: Props) {
  const styles = useStyles(unboundStyles);
  const colors = useColors();

  const lastMessage = React.useMemo(() => {
    const mostRecentMessageInfo = data.mostRecentMessageInfo;
    if (!mostRecentMessageInfo) {
      return (
        <Text style={styles.noMessages} numberOfLines={1}>
          No messages
        </Text>
      );
    }
    return (
      <MessagePreview
        messageInfo={mostRecentMessageInfo}
        threadInfo={data.threadInfo}
      />
    );
  }, [data.mostRecentMessageInfo, data.threadInfo, styles]);

  const sidebars = data.sidebars.map(sidebarItem => {
    if (sidebarItem.type === 'sidebar') {
      const { type, ...sidebarInfo } = sidebarItem;
      return (
        <ChatThreadListSidebar
          sidebarInfo={sidebarInfo}
          onPressItem={onPressItem}
          onSwipeableWillOpen={onSwipeableWillOpen}
          currentlyOpenedSwipeableId={currentlyOpenedSwipeableId}
          key={sidebarItem.threadInfo.id}
        />
      );
    } else {
      return (
        <ChatThreadListSeeMoreSidebars
          threadInfo={data.threadInfo}
          unread={sidebarItem.unread}
          showingSidebarsInline={sidebarItem.showingSidebarsInline}
          onPress={onPressSeeMoreSidebars}
          key="seeMore"
        />
      );
    }
  });

  const onPress = React.useCallback(() => {
    onPressItem(data.threadInfo, data.pendingPersonalThreadUserInfo);
  }, [onPressItem, data.threadInfo, data.pendingPersonalThreadUserInfo]);

  const lastActivity = shortAbsoluteDate(data.lastUpdatedTime);
  const unreadStyle = data.threadInfo.currentUser.unread ? styles.unread : null;

  return (
    <>
      <SwipeableThread
        threadInfo={data.threadInfo}
        mostRecentNonLocalMessage={data.mostRecentNonLocalMessage}
        onSwipeableWillOpen={onSwipeableWillOpen}
        currentlyOpenedSwipeableId={currentlyOpenedSwipeableId}
        iconSize={24}
      >
        <Button
          onPress={onPress}
          iosFormat="highlight"
          iosHighlightUnderlayColor={colors.listIosHighlightUnderlay}
          iosActiveOpacity={0.85}
          style={styles.container}
        >
          <View style={styles.row}>
            <SingleLine style={[styles.threadName, unreadStyle]}>
              {data.threadInfo.uiName}
            </SingleLine>
            <View style={styles.colorSplotch}>
              <ColorSplotch color={data.threadInfo.color} size="small" />
            </View>
          </View>
          <View style={styles.row}>
            {lastMessage}
            <Text style={[styles.lastActivity, unreadStyle]}>
              {lastActivity}
            </Text>
          </View>
        </Button>
      </SwipeableThread>
      {sidebars}
    </>
  );
}

const unboundStyles = {
  colorSplotch: {
    marginLeft: 10,
    marginTop: 2,
  },
  container: {
    height: 60,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 5,
    backgroundColor: 'listBackground',
  },
  lastActivity: {
    color: 'listForegroundTertiaryLabel',
    fontSize: 16,
    marginLeft: 10,
  },
  noMessages: {
    color: 'listForegroundTertiaryLabel',
    flex: 1,
    fontSize: 16,
    fontStyle: 'italic',
    paddingLeft: 10,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  threadName: {
    color: 'listForegroundSecondaryLabel',
    flex: 1,
    fontSize: 20,
    paddingLeft: 10,
  },
  unread: {
    color: 'listForegroundLabel',
    fontWeight: 'bold',
  },
};

export default ChatThreadListItem;
