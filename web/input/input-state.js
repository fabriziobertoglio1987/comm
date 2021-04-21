// @flow

import * as React from 'react';

import {
  type MediaType,
  type Dimensions,
  type MediaMissionStep,
} from 'lib/types/media-types';
import type { RawTextMessageInfo } from 'lib/types/messages/text';

export type PendingMultimediaUpload = {|
  localID: string,
  // Pending uploads are assigned a serverID once they are complete
  serverID: ?string,
  // Pending uploads are assigned a messageID once they are sent
  messageID: ?string,
  // This is set to truthy if the upload fails for whatever reason
  failed: ?string,
  file: File,
  mediaType: MediaType,
  dimensions: ?Dimensions,
  uri: string,
  loop: boolean,
  // URLs created with createObjectURL aren't considered "real". The distinction
  // is required because those "fake" URLs must be disposed properly
  uriIsReal: boolean,
  progressPercent: number,
  // This is set once the network request begins and used if the upload is
  // cancelled
  abort: ?() => void,
  steps: MediaMissionStep[],
  selectTime: number,
|};

// This type represents the input state for a particular thread
export type InputState = {|
  pendingUploads: $ReadOnlyArray<PendingMultimediaUpload>,
  assignedUploads: {
    [messageID: string]: $ReadOnlyArray<PendingMultimediaUpload>,
  },
  draft: string,
  appendFiles: (files: $ReadOnlyArray<File>) => Promise<boolean>,
  cancelPendingUpload: (localUploadID: string) => void,
  sendTextMessage: (messageInfo: RawTextMessageInfo) => void,
  createMultimediaMessage: (localID: number) => void,
  setDraft: (draft: string) => void,
  messageHasUploadFailure: (localMessageID: string) => boolean,
  retryMultimediaMessage: (localMessageID: string) => void,
  addReply: (text: string) => void,
  addReplyListener: ((message: string) => void) => void,
  removeReplyListener: ((message: string) => void) => void,
|};

const InputStateContext: React.Context<?InputState> = React.createContext<?InputState>(null);

export { InputStateContext };
