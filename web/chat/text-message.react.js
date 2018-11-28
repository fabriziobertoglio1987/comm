// @flow

import {
  type ChatMessageInfoItem,
  chatMessageItemPropType,
} from 'lib/selectors/chat-selectors';
import { messageTypes } from 'lib/types/message-types';
import { type ThreadInfo, threadInfoPropType } from 'lib/types/thread-types';

import * as React from 'react';
import invariant from 'invariant';
import classNames from 'classnames';
import Linkify from 'react-linkify';
import PropTypes from 'prop-types';
import CircleIcon from 'react-feather/dist/icons/circle';
import CheckCircleIcon from 'react-feather/dist/icons/check-circle';
import XCircleIcon from 'react-feather/dist/icons/x-circle';

import { colorIsDark } from 'lib/shared/thread-utils';
import { onlyEmojiRegex } from 'lib/shared/emojis';
import { stringForUser } from 'lib/shared/user-utils';
import { messageKey } from 'lib/shared/message-utils';

import css from './chat-message-list.css';
import FailedSend from './failed-send.react';

type Props = {|
  item: ChatMessageInfoItem,
  threadInfo: ThreadInfo,
  toggleFocus: (messageKey: string) => void,
|};
class TextMessage extends React.PureComponent<Props> {

  static propTypes = {
    item: chatMessageItemPropType.isRequired,
    threadInfo: threadInfoPropType.isRequired,
    toggleFocus: PropTypes.func.isRequired,
  };

  constructor(props: Props) {
    super(props);
    invariant(
      props.item.messageInfo.type === messageTypes.TEXT,
      "TextMessage should only be used for messageTypes.TEXT",
    );
  }

  componentWillReceiveProps(nextProps: Props) {
    invariant(
      nextProps.item.messageInfo.type === messageTypes.TEXT,
      "TextMessage should only be used for messageTypes.TEXT",
    );
  }

  render() {
    invariant(
      this.props.item.messageInfo.type === messageTypes.TEXT,
      "TextMessage should only be used for messageTypes.TEXT",
    );
    const { text, id, creator } = this.props.item.messageInfo;
    const threadColor = this.props.threadInfo.color;

    const { isViewer } = creator;
    const onlyEmoji = onlyEmojiRegex.test(text);
    const messageClassName = classNames({
      [css.textMessage]: true,
      [css.normalTextMessage]: !onlyEmoji,
      [css.emojiOnlyTextMessage]: onlyEmoji,
    });
    const contentClassName = classNames({
      [css.content]: true,
      [css.rightChatBubble]: isViewer,
      [css.leftChatBubble]: !isViewer,
    });
    let darkColor = false;
    const messageStyle = {};
    if (isViewer) {
      darkColor = colorIsDark(threadColor);
      messageStyle.backgroundColor = `#${threadColor}`;
      messageStyle.color = darkColor ? 'white' : 'black';
    } else {
      messageStyle.backgroundColor = "#DDDDDDBB";
      messageStyle.color = 'black';
    }
    let authorName = null;
    if (!isViewer && this.props.item.startsCluster) {
      authorName = (
        <span className={css.authorName}>
          {stringForUser(creator)}
        </span>
      );
    }
    messageStyle.borderTopRightRadius =
      isViewer && !this.props.item.startsCluster ? 0 : 8;
    messageStyle.borderBottomRightRadius =
      isViewer && !this.props.item.endsCluster ? 0 : 8;
    messageStyle.borderTopLeftRadius =
      !isViewer && !this.props.item.startsCluster ? 0 : 8;
    messageStyle.borderBottomLeftRadius =
      !isViewer && !this.props.item.endsCluster ? 0 : 8;

    let deliveryIcon = null;
    let failedSendInfo = null;
    if (isViewer) {
      let deliveryIconSpan;
      if (id !== null && id !== undefined) {
        deliveryIconSpan = <CheckCircleIcon />;
      } else {
        const sendFailed = this.props.item.localMessageInfo
          ? this.props.item.localMessageInfo.sendFailed
          : null;
        if (sendFailed) {
          deliveryIconSpan = <XCircleIcon />;
          failedSendInfo = (
            <FailedSend
              item={this.props.item}
              threadInfo={this.props.threadInfo}
            />
          );
        } else {
          deliveryIconSpan = <CircleIcon />;
        }
      }
      deliveryIcon = (
        <div
          className={css.iconContainer}
          style={{ color: `#${threadColor}` }}
        >
          {deliveryIconSpan}
        </div>
      );
    }

    return (
      <React.Fragment>
        {failedSendInfo}
        <div className={contentClassName}>
          <div
            onClick={this.onClick}
            className={messageClassName}
            style={messageStyle}
          >
            <Linkify>
              {text}
            </Linkify>
          </div>
          {deliveryIcon}
        </div>
        {authorName}
      </React.Fragment>
    );
  }

  onClick = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    this.props.toggleFocus(messageKey(this.props.item.messageInfo));
  }

}

export default TextMessage;
