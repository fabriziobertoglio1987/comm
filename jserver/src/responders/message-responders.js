// @flow

import type { $Response, $Request } from 'express';
import type { MessageData } from 'lib/types/message-types';

import createMessages from '../creators/message-creator';
import { connect } from '../database';

async function messageCreationResponder(req: $Request, res: $Response) {
  const messageDatas: MessageData[] = req.body;
  const conn = await connect();
  const rawMessageInfos = await createMessages(conn, messageDatas);
  conn.end();
  return { success: true, rawMessageInfos };
}

export {
  messageCreationResponder,
};
