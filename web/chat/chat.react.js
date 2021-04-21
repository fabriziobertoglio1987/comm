// @flow

import * as React from 'react';

import ChatMessageList from './chat-message-list.react';
import ChatTabs from './chat-tabs.react';

type Props = {|
  +setModal: (modal: ?React.Node) => void,
|};
function Chat(props: Props): React.Node {
  return (
    <>
      <ChatTabs setModal={props.setModal} />
      <ChatMessageList setModal={props.setModal} />
    </>
  );
}

export default Chat;
