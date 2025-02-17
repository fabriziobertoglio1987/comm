// @flow

import * as React from 'react';

import type { ThreadInfo } from 'lib/types/thread-types';
import { type UserInfo } from 'lib/types/user-types';

import type { MarkdownRules } from '../markdown/rules.react';
import { useTextMessageRulesFunc } from '../markdown/rules.react';

export type MessageListParams = {|
  +threadInfo: ThreadInfo,
  +pendingPersonalThreadUserInfo?: UserInfo,
  +searching?: boolean,
|};

export type MessageListContextType = {|
  +getTextMessageMarkdownRules: (useDarkStyle: boolean) => MarkdownRules,
|};

const MessageListContext = React.createContext<?MessageListContextType>();

function useMessageListContext(threadID: string) {
  const getTextMessageMarkdownRules = useTextMessageRulesFunc(threadID);
  return React.useMemo(
    () => ({
      getTextMessageMarkdownRules,
    }),
    [getTextMessageMarkdownRules],
  );
}

export { MessageListContext, useMessageListContext };
