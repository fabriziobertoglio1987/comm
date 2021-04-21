// @flow

import * as React from 'react';
import { StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { createPendingThread } from 'lib/shared/thread-utils';
import { threadTypes } from 'lib/types/thread-types';

import Button from '../components/button.react';
import { MessageListRouteName } from '../navigation/route-names';
import { useSelector } from '../redux/redux-utils';
import { type Colors, useColors } from '../themes/colors';
import type { ChatNavigationProp } from './chat.react';

type BaseProps = {|
  +navigate: $PropertyType<ChatNavigationProp<'ChatThreadList'>, 'navigate'>,
|};
type Props = {|
  ...BaseProps,
  +colors: Colors,
  +viewerID: ?string,
|};
class ComposeThreadButton extends React.PureComponent<Props> {
  render() {
    const { link: linkColor } = this.props.colors;
    return (
      <Button onPress={this.onPress} androidBorderlessRipple={true}>
        <Icon
          name="pencil-plus-outline"
          size={26}
          style={styles.composeButton}
          color={linkColor}
        />
      </Button>
    );
  }

  onPress = () => {
    if (this.props.viewerID) {
      this.props.navigate({
        name: MessageListRouteName,
        params: {
          threadInfo: createPendingThread({
            viewerID: this.props.viewerID,
            threadType: threadTypes.CHAT_SECRET,
          }),
          searching: true,
        },
      });
    }
  };
}

const styles = StyleSheet.create({
  composeButton: {
    paddingHorizontal: 10,
  },
});

export default React.memo<BaseProps>(function ConnectedComposeThreadButton(
  props,
) {
  const colors = useColors();
  const viewerID = useSelector(
    state => state.currentUserInfo && state.currentUserInfo.id,
  );

  return <ComposeThreadButton {...props} colors={colors} viewerID={viewerID} />;
});
