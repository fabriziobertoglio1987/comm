// @flow

import * as React from 'react';
import { Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import type { ThreadInfo } from 'lib/types/thread-types';

import Button from '../components/button.react';
import { useColors, useStyles } from '../themes/colors';

type Props = {|
  +threadInfo: ThreadInfo,
  +unread: boolean,
  +showingSidebarsInline: boolean,
  +onPress: (threadInfo: ThreadInfo) => void,
|};
function ChatThreadListSeeMoreSidebars(props: Props) {
  const { onPress, threadInfo, unread, showingSidebarsInline } = props;
  const onPressButton = React.useCallback(() => onPress(threadInfo), [
    onPress,
    threadInfo,
  ]);

  const colors = useColors();
  const styles = useStyles(unboundStyles);
  const unreadStyle = unread ? styles.unread : null;
  const buttonText = showingSidebarsInline ? 'See more...' : 'See sidebars...';
  return (
    <Button
      iosFormat="highlight"
      iosHighlightUnderlayColor={colors.listIosHighlightUnderlay}
      iosActiveOpacity={0.85}
      style={styles.button}
      onPress={onPressButton}
    >
      <Icon name="ios-more" size={28} style={styles.icon} />
      <Text style={[styles.text, unreadStyle]}>{buttonText}</Text>
    </Button>
  );
}

const unboundStyles = {
  unread: {
    color: 'listForegroundLabel',
    fontWeight: 'bold',
  },
  button: {
    height: 30,
    flexDirection: 'row',
    display: 'flex',
    paddingLeft: 25,
    paddingRight: 10,
    alignItems: 'center',
    backgroundColor: 'listBackground',
  },
  icon: {
    paddingLeft: 5,
    color: 'listForegroundSecondaryLabel',
    width: 35,
  },
  text: {
    color: 'listForegroundSecondaryLabel',
    flex: 1,
    fontSize: 16,
    paddingLeft: 5,
    paddingBottom: 2,
  },
};

export default ChatThreadListSeeMoreSidebars;
