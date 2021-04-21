// @flow

import invariant from 'invariant';
import * as React from 'react';
import { Text, TouchableWithoutFeedback, View } from 'react-native';

import { threadInfoSelector } from 'lib/selectors/thread-selectors';
import {
  splitRobotext,
  parseRobotextEntity,
  robotextToRawString,
} from 'lib/shared/message-utils';

import Markdown from '../markdown/markdown.react';
import { inlineMarkdownRules } from '../markdown/rules.react';
import type { AppNavigationProp } from '../navigation/app-navigator.react';
import { MessageListRouteName } from '../navigation/route-names';
import { useSelector } from '../redux/redux-utils';
import { useOverlayStyles } from '../themes/colors';
import type { ChatNavigationProp } from './chat.react';
import type { ChatRobotextMessageInfoItemWithHeight } from './robotext-message.react';

function dummyNodeForRobotextMessageHeightMeasurement(robotext: string) {
  return (
    <View style={unboundStyles.robotextContainer}>
      <Text style={unboundStyles.dummyRobotext}>
        {robotextToRawString(robotext)}
      </Text>
    </View>
  );
}

type InnerRobotextMessageProps = {|
  +item: ChatRobotextMessageInfoItemWithHeight,
  +navigation:
    | ChatNavigationProp<'MessageList'>
    | AppNavigationProp<'RobotextMessageTooltipModal'>,
  +onPress: () => void,
  +onLongPress?: () => void,
|};
function InnerRobotextMessage(props: InnerRobotextMessageProps) {
  const { item, navigation, onLongPress, onPress } = props;
  const activeTheme = useSelector(state => state.globalThemeInfo.activeTheme);
  const styles = useOverlayStyles(unboundStyles);
  const { robotext } = item;
  const robotextParts = splitRobotext(robotext);
  const textParts = [];
  let keyIndex = 0;

  for (const splitPart of robotextParts) {
    if (splitPart === '') {
      continue;
    }
    if (splitPart.charAt(0) !== '<') {
      const darkColor = activeTheme === 'dark';
      const key = `text${keyIndex++}`;
      textParts.push(
        <Markdown
          style={styles.robotext}
          key={key}
          rules={inlineMarkdownRules(darkColor)}
        >
          {decodeURI(splitPart)}
        </Markdown>,
      );
      continue;
    }

    const { rawText, entityType, id } = parseRobotextEntity(splitPart);

    if (entityType === 't' && id !== item.messageInfo.threadID) {
      textParts.push(
        <ThreadEntity
          key={id}
          id={id}
          name={rawText}
          navigation={navigation}
        />,
      );
    } else if (entityType === 'c') {
      textParts.push(<ColorEntity key={id} color={rawText} />);
    } else {
      textParts.push(rawText);
    }
  }

  const viewStyle = [styles.robotextContainer];
  if (!__DEV__) {
    // We don't force view height in dev mode because we
    // want to measure it in Message to see if it's correct
    viewStyle.push({ height: item.contentHeight });
  }

  return (
    <TouchableWithoutFeedback onPress={onPress} onLongPress={onLongPress}>
      <View style={viewStyle}>
        <Text style={styles.robotext}>{textParts}</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

type ThreadEntityProps = {|
  +id: string,
  +name: string,
  +navigation:
    | ChatNavigationProp<'MessageList'>
    | AppNavigationProp<'RobotextMessageTooltipModal'>,
|};
function ThreadEntity(props: ThreadEntityProps) {
  const threadID = props.id;
  const threadInfo = useSelector(state => threadInfoSelector(state)[threadID]);

  const styles = useOverlayStyles(unboundStyles);

  const { navigate } = props.navigation;
  const onPressThread = React.useCallback(() => {
    invariant(threadInfo, 'onPressThread should have threadInfo');
    navigate({
      name: MessageListRouteName,
      params: { threadInfo },
      key: `${MessageListRouteName}${threadInfo.id}`,
    });
  }, [threadInfo, navigate]);

  if (!threadInfo) {
    return <Text>{props.name}</Text>;
  }
  return (
    <Text style={styles.link} onPress={onPressThread}>
      {props.name}
    </Text>
  );
}

function ColorEntity(props: {| +color: string |}) {
  const colorStyle = { color: props.color };
  return <Text style={colorStyle}>{props.color}</Text>;
}

const unboundStyles = {
  link: {
    color: 'link',
  },
  robotextContainer: {
    paddingTop: 6,
    paddingBottom: 11,
    paddingHorizontal: 24,
  },
  robotext: {
    color: 'listForegroundSecondaryLabel',
    fontFamily: 'Arial',
    fontSize: 15,
    textAlign: 'center',
  },
  dummyRobotext: {
    fontFamily: 'Arial',
    fontSize: 15,
    textAlign: 'center',
  },
};

export { dummyNodeForRobotextMessageHeightMeasurement, InnerRobotextMessage };
