// @flow

import * as React from 'react';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import {
  type ClientSocketMessageWithoutID,
  type SocketListener,
  type ServerSocketMessage,
  serverSocketMessageTypes,
  clientSocketMessageTypes,
} from '../types/socket-types';
import { processUpdatesActionType } from '../types/update-types';
import { useSelector } from '../utils/redux-utils';

type Props = {|
  +sendMessage: (message: ClientSocketMessageWithoutID) => number,
  +addListener: (listener: SocketListener) => void,
  +removeListener: (listener: SocketListener) => void,
|};
export default function UpdateHandler(props: Props): React.Node {
  const { addListener, removeListener, sendMessage } = props;

  const dispatch = useDispatch();
  const connectionStatus = useSelector(state => state.connection.status);
  const onMessage = React.useCallback(
    (message: ServerSocketMessage) => {
      if (message.type !== serverSocketMessageTypes.UPDATES) {
        return;
      }
      dispatch({
        type: processUpdatesActionType,
        payload: message.payload,
      });
      if (connectionStatus !== 'connected') {
        return;
      }
      sendMessage({
        type: clientSocketMessageTypes.ACK_UPDATES,
        payload: {
          currentAsOf: message.payload.updatesResult.currentAsOf,
        },
      });
    },
    [connectionStatus, dispatch, sendMessage],
  );
  useEffect(() => {
    addListener(onMessage);
    return () => {
      removeListener(onMessage);
    };
  }, [addListener, removeListener, onMessage]);

  return null;
}
