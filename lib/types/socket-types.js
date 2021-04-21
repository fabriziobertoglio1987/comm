// @flow

import invariant from 'invariant';

import {
  type ActivityUpdate,
  type UpdateActivityResult,
} from './activity-types';
import type { Platform } from './device-types';
import type { APIRequest } from './endpoints';
import {
  type RawEntryInfo,
  type CalendarQuery,
  defaultCalendarQuery,
} from './entry-types';
import type { MessagesResponse, NewMessagesPayload } from './message-types';
import type {
  ServerRequest,
  ClientResponse,
  ClientClientResponse,
} from './request-types';
import type { SessionState, SessionIdentification } from './session-types';
import type { RawThreadInfo } from './thread-types';
import type { UpdatesResult, UpdatesResultWithUserInfos } from './update-types';
import type {
  UserInfo,
  CurrentUserInfo,
  LoggedOutUserInfo,
} from './user-types';

// The types of messages that the client sends across the socket
export const clientSocketMessageTypes = Object.freeze({
  INITIAL: 0,
  RESPONSES: 1,
  //ACTIVITY_UPDATES: 2, (DEPRECATED)
  PING: 3,
  ACK_UPDATES: 4,
  API_REQUEST: 5,
});
export type ClientSocketMessageType = $Values<typeof clientSocketMessageTypes>;
export function assertClientSocketMessageType(
  ourClientSocketMessageType: number,
): ClientSocketMessageType {
  invariant(
    ourClientSocketMessageType === 0 ||
      ourClientSocketMessageType === 1 ||
      ourClientSocketMessageType === 3 ||
      ourClientSocketMessageType === 4 ||
      ourClientSocketMessageType === 5,
    'number is not ClientSocketMessageType enum',
  );
  return ourClientSocketMessageType;
}

export type InitialClientSocketMessage = {|
  +type: 0,
  +id: number,
  +payload: {|
    +sessionIdentification: SessionIdentification,
    +sessionState: SessionState,
    +clientResponses: $ReadOnlyArray<ClientResponse>,
  |},
|};
export type ResponsesClientSocketMessage = {|
  +type: 1,
  +id: number,
  +payload: {|
    +clientResponses: $ReadOnlyArray<ClientResponse>,
  |},
|};
export type PingClientSocketMessage = {|
  +type: 3,
  +id: number,
|};
export type AckUpdatesClientSocketMessage = {|
  +type: 4,
  +id: number,
  +payload: {|
    +currentAsOf: number,
  |},
|};
export type APIRequestClientSocketMessage = {|
  +type: 5,
  +id: number,
  +payload: APIRequest,
|};
export type ClientSocketMessage =
  | InitialClientSocketMessage
  | ResponsesClientSocketMessage
  | PingClientSocketMessage
  | AckUpdatesClientSocketMessage
  | APIRequestClientSocketMessage;

export type ClientInitialClientSocketMessage = {|
  +type: 0,
  +id: number,
  +payload: {|
    +sessionIdentification: SessionIdentification,
    +sessionState: SessionState,
    +clientResponses: $ReadOnlyArray<ClientClientResponse>,
  |},
|};
export type ClientResponsesClientSocketMessage = {|
  +type: 1,
  +id: number,
  +payload: {|
    +clientResponses: $ReadOnlyArray<ClientClientResponse>,
  |},
|};
export type ClientClientSocketMessage =
  | ClientInitialClientSocketMessage
  | ClientResponsesClientSocketMessage
  | PingClientSocketMessage
  | AckUpdatesClientSocketMessage
  | APIRequestClientSocketMessage;
export type ClientSocketMessageWithoutID = $Diff<
  ClientClientSocketMessage,
  { id: number },
>;

// The types of messages that the server sends across the socket
export const serverSocketMessageTypes = Object.freeze({
  STATE_SYNC: 0,
  REQUESTS: 1,
  ERROR: 2,
  AUTH_ERROR: 3,
  ACTIVITY_UPDATE_RESPONSE: 4,
  PONG: 5,
  UPDATES: 6,
  MESSAGES: 7,
  API_RESPONSE: 8,
});
export type ServerSocketMessageType = $Values<typeof serverSocketMessageTypes>;
export function assertServerSocketMessageType(
  ourServerSocketMessageType: number,
): ServerSocketMessageType {
  invariant(
    ourServerSocketMessageType === 0 ||
      ourServerSocketMessageType === 1 ||
      ourServerSocketMessageType === 2 ||
      ourServerSocketMessageType === 3 ||
      ourServerSocketMessageType === 4 ||
      ourServerSocketMessageType === 5 ||
      ourServerSocketMessageType === 6 ||
      ourServerSocketMessageType === 7 ||
      ourServerSocketMessageType === 8,
    'number is not ServerSocketMessageType enum',
  );
  return ourServerSocketMessageType;
}

export const stateSyncPayloadTypes = Object.freeze({
  FULL: 0,
  INCREMENTAL: 1,
});

export type FullStateSync = {|
  +messagesResult: MessagesResponse,
  +threadInfos: { [id: string]: RawThreadInfo },
  +currentUserInfo: CurrentUserInfo,
  +rawEntryInfos: $ReadOnlyArray<RawEntryInfo>,
  +userInfos: $ReadOnlyArray<UserInfo>,
  +updatesCurrentAsOf: number,
|};
export type StateSyncFullActionPayload = {|
  ...FullStateSync,
  +calendarQuery: CalendarQuery,
|};
export const fullStateSyncActionType = 'FULL_STATE_SYNC';
export type StateSyncFullSocketPayload = {|
  ...FullStateSync,
  +type: 0,
  // Included iff client is using sessionIdentifierTypes.BODY_SESSION_ID
  +sessionID?: string,
|};

export type IncrementalStateSync = {|
  +messagesResult: MessagesResponse,
  +updatesResult: UpdatesResult,
  +deltaEntryInfos: $ReadOnlyArray<RawEntryInfo>,
  +deletedEntryIDs: $ReadOnlyArray<string>,
  +userInfos: $ReadOnlyArray<UserInfo>,
|};
export type StateSyncIncrementalActionPayload = {|
  ...IncrementalStateSync,
  +calendarQuery: CalendarQuery,
|};
export const incrementalStateSyncActionType = 'INCREMENTAL_STATE_SYNC';
type StateSyncIncrementalSocketPayload = {|
  +type: 1,
  ...IncrementalStateSync,
|};

export type StateSyncSocketPayload =
  | StateSyncFullSocketPayload
  | StateSyncIncrementalSocketPayload;

export type StateSyncServerSocketMessage = {|
  +type: 0,
  +responseTo: number,
  +payload: StateSyncSocketPayload,
|};
export type RequestsServerSocketMessage = {|
  +type: 1,
  +responseTo?: number,
  +payload: {|
    +serverRequests: $ReadOnlyArray<ServerRequest>,
  |},
|};
export type ErrorServerSocketMessage = {|
  type: 2,
  responseTo?: number,
  message: string,
  payload?: Object,
|};
export type AuthErrorServerSocketMessage = {|
  type: 3,
  responseTo: number,
  message: string,
  // If unspecified, it is because the client is using cookieSources.HEADER,
  // which means the server can't update the cookie from a socket message.
  sessionChange?: {|
    cookie: string,
    currentUserInfo: LoggedOutUserInfo,
  |},
|};
export type ActivityUpdateResponseServerSocketMessage = {|
  +type: 4,
  +responseTo: number,
  +payload: UpdateActivityResult,
|};
export type PongServerSocketMessage = {|
  +type: 5,
  +responseTo: number,
|};
export type UpdatesServerSocketMessage = {|
  +type: 6,
  +payload: UpdatesResultWithUserInfos,
|};
export type MessagesServerSocketMessage = {|
  +type: 7,
  +payload: NewMessagesPayload,
|};
export type APIResponseServerSocketMessage = {|
  +type: 8,
  +responseTo: number,
  +payload: Object,
|};
export type ServerSocketMessage =
  | StateSyncServerSocketMessage
  | RequestsServerSocketMessage
  | ErrorServerSocketMessage
  | AuthErrorServerSocketMessage
  | ActivityUpdateResponseServerSocketMessage
  | PongServerSocketMessage
  | UpdatesServerSocketMessage
  | MessagesServerSocketMessage
  | APIResponseServerSocketMessage;

export type SocketListener = (message: ServerSocketMessage) => void;

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnecting'
  | 'forcedDisconnecting'
  | 'disconnected';
export type ConnectionInfo = {|
  +status: ConnectionStatus,
  +queuedActivityUpdates: $ReadOnlyArray<ActivityUpdate>,
  +actualizedCalendarQuery: CalendarQuery,
  +lateResponses: $ReadOnlyArray<number>,
  +showDisconnectedBar: boolean,
|};
export const defaultConnectionInfo = (platform: Platform, timeZone?: ?string): ConnectionInfo =>
  ({
    status: 'connecting',
    queuedActivityUpdates: [],
    actualizedCalendarQuery: defaultCalendarQuery(platform, timeZone),
    lateResponses: [],
    showDisconnectedBar: false,
  }: ConnectionInfo);
export const updateConnectionStatusActionType = 'UPDATE_CONNECTION_STATUS';
export type UpdateConnectionStatusPayload = {|
  +status: ConnectionStatus,
|};

export const setLateResponseActionType = 'SET_LATE_RESPONSE';
export type SetLateResponsePayload = {|
  +messageID: number,
  +isLate: boolean,
|};

export const updateDisconnectedBarActionType = 'UPDATE_DISCONNECTED_BAR';
export type UpdateDisconnectedBarPayload = {| +visible: boolean |};
