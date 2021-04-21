// @flow

import invariant from 'invariant';
import * as React from 'react';
import { View, StyleSheet } from 'react-native';

import { colorIsDark } from 'lib/shared/thread-utils';

import GestureTouchableOpacity from '../components/gesture-touchable-opacity.react';
import { KeyboardContext } from '../keyboard/keyboard-state';
import Markdown from '../markdown/markdown.react';
import { useSelector } from '../redux/redux-utils';
import { useColors, colors } from '../themes/colors';
import { composedMessageMaxWidthSelector } from './composed-message-width';
import { MessageListContext } from './message-list-types';
import {
  allCorners,
  filterCorners,
  getRoundedContainerStyle,
} from './rounded-corners';
import type { ChatTextMessageInfoItemWithHeight } from './text-message.react';

function useTextMessageMarkdownRules(useDarkStyle: boolean) {
  const messageListContext = React.useContext(MessageListContext);
  invariant(messageListContext, 'DummyTextNode should have MessageListContext');
  return messageListContext.getTextMessageMarkdownRules(useDarkStyle);
}

function dummyNodeForTextMessageHeightMeasurement(text: string) {
  return <DummyTextNode>{text}</DummyTextNode>;
}

type DummyTextNodeProps = {|
  ...React.ElementConfig<typeof View>,
  +children: string,
|};
function DummyTextNode(props: DummyTextNodeProps) {
  const { children, style, ...rest } = props;
  const maxWidth = useSelector(state => composedMessageMaxWidthSelector(state));
  const viewStyle = [props.style, styles.dummyMessage, { maxWidth }];
  const rules = useTextMessageMarkdownRules(false);
  return (
    <View {...rest} style={viewStyle}>
      <Markdown style={styles.text} rules={rules}>
        {children}
      </Markdown>
    </View>
  );
}

type Props = {|
  +item: ChatTextMessageInfoItemWithHeight,
  +onPress: () => void,
  +messageRef?: (message: ?React.ElementRef<typeof View>) => void,
|};
function InnerTextMessage(props: Props) {
  const { item } = props;
  const { text, creator } = item.messageInfo;
  const { isViewer } = creator;

  const activeTheme = useSelector(state => state.globalThemeInfo.activeTheme);
  const boundColors = useColors();

  const messageStyle = {};
  const textStyle = {};
  let darkColor;
  if (isViewer) {
    const threadColor = item.threadInfo.color;
    messageStyle.backgroundColor = `#${threadColor}`;
    darkColor = colorIsDark(threadColor);
  } else {
    messageStyle.backgroundColor = boundColors.listChatBubble;
    darkColor = activeTheme === 'dark';
  }
  textStyle.color = darkColor
    ? colors.dark.listForegroundLabel
    : colors.light.listForegroundLabel;

  const cornerStyle = getRoundedContainerStyle(filterCorners(allCorners, item));

  if (!__DEV__) {
    // We don't force view height in dev mode because we
    // want to measure it in Message to see if it's correct
    messageStyle.height = item.contentHeight;
  }

  const keyboardState = React.useContext(KeyboardContext);
  const keyboardShowing = keyboardState?.keyboardShowing;

  const rules = useTextMessageMarkdownRules(darkColor);

  const message = (
    <GestureTouchableOpacity
      onPress={props.onPress}
      onLongPress={props.onPress}
      activeOpacity={0.6}
      disabled={keyboardShowing}
      style={[styles.message, messageStyle, cornerStyle]}
    >
      <Markdown style={[styles.text, textStyle]} rules={rules}>
        {text}
      </Markdown>
    </GestureTouchableOpacity>
  );

  // We need to set onLayout in order to allow .measure() to be on the ref
  const onLayout = React.useCallback(() => {}, []);

  const { messageRef } = props;
  if (!messageRef) {
    return message;
  }

  return (
    <View onLayout={onLayout} ref={messageRef}>
      {message}
    </View>
  );
}

const styles = StyleSheet.create({
  dummyMessage: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  message: {
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontFamily: 'Arial',
    fontSize: 18,
  },
});

export { InnerTextMessage, dummyNodeForTextMessageHeightMeasurement };
