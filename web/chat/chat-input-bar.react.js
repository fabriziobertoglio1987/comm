// @flow

import { faFileImage } from '@fortawesome/free-regular-svg-icons';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import invariant from 'invariant';
import _difference from 'lodash/fp/difference';
import * as React from 'react';

import { joinThreadActionTypes, joinThread } from 'lib/actions/thread-actions';
import { createLoadingStatusSelector } from 'lib/selectors/loading-selectors';
import { trimMessage } from 'lib/shared/message-utils';
import {
  threadHasPermission,
  viewerIsMember,
  threadFrozenDueToViewerBlock,
  threadActualMembers,
  useRealThreadCreator,
  threadIsPending,
} from 'lib/shared/thread-utils';
import type { CalendarQuery } from 'lib/types/entry-types';
import type { LoadingStatus } from 'lib/types/loading-types';
import { messageTypes } from 'lib/types/message-types';
import {
  type ThreadInfo,
  threadPermissions,
  type ClientThreadJoinRequest,
  type ThreadJoinPayload,
} from 'lib/types/thread-types';
import { type UserInfos } from 'lib/types/user-types';
import {
  type DispatchActionPromise,
  useServerCall,
  useDispatchActionPromise,
} from 'lib/utils/action-utils';

import {
  type InputState,
  type PendingMultimediaUpload,
} from '../input/input-state';
import LoadingIndicator from '../loading-indicator.react';
import { allowedMimeTypeString } from '../media/file-utils';
import Multimedia from '../media/multimedia.react';
import FailedSendModal from '../modals/chat/failed-send.react';
import { useSelector } from '../redux/redux-utils';
import { nonThreadCalendarQuery } from '../selectors/nav-selectors';
import css from './chat-message-list.css';

type BaseProps = {|
  +threadInfo: ThreadInfo,
  +inputState: InputState,
  +setModal: (modal: ?React.Node) => void,
|};
type Props = {|
  ...BaseProps,
  // Redux state
  +viewerID: ?string,
  +joinThreadLoadingStatus: LoadingStatus,
  +calendarQuery: () => CalendarQuery,
  +nextLocalID: number,
  +isThreadActive: boolean,
  +userInfos: UserInfos,
  // Redux dispatch functions
  +dispatchActionPromise: DispatchActionPromise,
  // async functions that hit server APIs
  +joinThread: (request: ClientThreadJoinRequest) => Promise<ThreadJoinPayload>,
  +getServerThreadID: () => Promise<?string>,
|};
class ChatInputBar extends React.PureComponent<Props> {
  textarea: ?HTMLTextAreaElement;
  multimediaInput: ?HTMLInputElement;

  componentDidMount() {
    this.updateHeight();
    if (this.props.isThreadActive) {
      this.addReplyListener();
    }
  }

  componentWillUnmount() {
    if (this.props.isThreadActive) {
      this.removeReplyListener();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.isThreadActive && !prevProps.isThreadActive) {
      this.addReplyListener();
    } else if (!this.props.isThreadActive && prevProps.isThreadActive) {
      this.removeReplyListener();
    }

    const { inputState } = this.props;
    const prevInputState = prevProps.inputState;
    if (inputState.draft !== prevInputState.draft) {
      this.updateHeight();
    }
    const curUploadIDs = ChatInputBar.unassignedUploadIDs(
      inputState.pendingUploads,
    );
    const prevUploadIDs = ChatInputBar.unassignedUploadIDs(
      prevInputState.pendingUploads,
    );
    if (
      this.multimediaInput &&
      _difference(prevUploadIDs)(curUploadIDs).length > 0
    ) {
      // Whenever a pending upload is removed, we reset the file
      // HTMLInputElement's value field, so that if the same upload occurs again
      // the onChange call doesn't get filtered
      this.multimediaInput.value = '';
    } else if (
      this.textarea &&
      _difference(curUploadIDs)(prevUploadIDs).length > 0
    ) {
      // Whenever a pending upload is added, we focus the textarea
      this.textarea.focus();
      return;
    }

    if (this.props.threadInfo.id !== prevProps.threadInfo.id && this.textarea) {
      this.textarea.focus();
    }
  }

  static unassignedUploadIDs(
    pendingUploads: $ReadOnlyArray<PendingMultimediaUpload>,
  ) {
    return pendingUploads
      .filter(
        (pendingUpload: PendingMultimediaUpload) => !pendingUpload.messageID,
      )
      .map((pendingUpload: PendingMultimediaUpload) => pendingUpload.localID);
  }

  updateHeight() {
    const textarea = this.textarea;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
    }
  }

  addReplyListener() {
    invariant(
      this.props.inputState,
      'inputState should be set in addReplyListener',
    );
    this.props.inputState.addReplyListener(this.focusAndUpdateText);
  }

  removeReplyListener() {
    invariant(
      this.props.inputState,
      'inputState should be set in removeReplyListener',
    );
    this.props.inputState.removeReplyListener(this.focusAndUpdateText);
  }

  render() {
    const isMember = viewerIsMember(this.props.threadInfo);
    const canJoin = threadHasPermission(
      this.props.threadInfo,
      threadPermissions.JOIN_THREAD,
    );
    let joinButton = null;
    if (!isMember && canJoin) {
      let buttonContent;
      if (this.props.joinThreadLoadingStatus === 'loading') {
        buttonContent = (
          <LoadingIndicator
            status={this.props.joinThreadLoadingStatus}
            size="medium"
            color="white"
          />
        );
      } else {
        buttonContent = <span className={css.joinButtonText}>Join Thread</span>;
      }
      joinButton = (
        <div className={css.joinButtonContainer}>
          <a onClick={this.onClickJoin}>{buttonContent}</a>
        </div>
      );
    }

    const { pendingUploads, cancelPendingUpload } = this.props.inputState;
    const multimediaPreviews = pendingUploads.map(pendingUpload => (
      <Multimedia
        uri={pendingUpload.uri}
        pendingUpload={pendingUpload}
        remove={cancelPendingUpload}
        multimediaCSSClass={css.multimedia}
        multimediaImageCSSClass={css.multimediaImage}
        key={pendingUpload.localID}
      />
    ));
    const previews =
      multimediaPreviews.length > 0 ? (
        <div className={css.previews}>{multimediaPreviews}</div>
      ) : null;

    let content;
    if (threadHasPermission(this.props.threadInfo, threadPermissions.VOICED)) {
      const sendIconStyle = { color: `#${this.props.threadInfo.color}` };
      let multimediaInput = null;
      if (!threadIsPending(this.props.threadInfo.id)) {
        multimediaInput = (
          <a className={css.multimediaUpload} onClick={this.onMultimediaClick}>
            <input
              type="file"
              onChange={this.onMultimediaFileChange}
              ref={this.multimediaInputRef}
              accept={allowedMimeTypeString}
              multiple
            />
            <FontAwesomeIcon icon={faFileImage} />
          </a>
        );
      }
      content = (
        <div className={css.inputBarTextInput}>
          <textarea
            rows="1"
            placeholder="Send a message..."
            value={this.props.inputState.draft}
            onChange={this.onChangeMessageText}
            onKeyDown={this.onKeyDown}
            ref={this.textareaRef}
            autoFocus
          />
          {multimediaInput}
          <a className={css.send} onClick={this.onSend}>
            <FontAwesomeIcon
              icon={faChevronRight}
              className={css.sendButton}
              style={sendIconStyle}
            />
            Send
          </a>
        </div>
      );
    } else if (
      threadFrozenDueToViewerBlock(
        this.props.threadInfo,
        this.props.viewerID,
        this.props.userInfos,
      ) &&
      threadActualMembers(this.props.threadInfo.members).length === 2
    ) {
      content = (
        <span className={css.explanation}>
          You can&apos;t send messages to a user that you&apos;ve blocked.
        </span>
      );
    } else if (isMember) {
      content = (
        <span className={css.explanation}>
          You don&apos;t have permission to send messages.
        </span>
      );
    } else {
      const defaultRoleID = Object.keys(this.props.threadInfo.roles).find(
        roleID => this.props.threadInfo.roles[roleID].isDefault,
      );
      invariant(
        defaultRoleID !== undefined,
        'all threads should have a default role',
      );
      const defaultRole = this.props.threadInfo.roles[defaultRoleID];
      const membersAreVoiced = !!defaultRole.permissions[
        threadPermissions.VOICED
      ];
      if (membersAreVoiced && canJoin) {
        content = (
          <span className={css.explanation}>
            Join this thread to send messages.
          </span>
        );
      } else {
        content = (
          <span className={css.explanation}>
            You don&apos;t have permission to send messages.
          </span>
        );
      }
    }

    return (
      <div className={css.inputBar}>
        {joinButton}
        {previews}
        {content}
      </div>
    );
  }

  textareaRef = (textarea: ?HTMLTextAreaElement) => {
    this.textarea = textarea;
    if (textarea) {
      textarea.focus();
    }
  };

  onChangeMessageText = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    this.props.inputState.setDraft(event.currentTarget.value);
  };

  focusAndUpdateText = (text: string) => {
    // We need to call focus() first on Safari, otherwise the cursor
    // ends up at the start instead of the end for some reason
    const { textarea } = this;
    invariant(textarea, 'textarea should be set');
    textarea.focus();

    // We reset the textarea to an empty string at the start so that the cursor
    // always ends up at the end, even if the text doesn't actually change
    textarea.value = '';
    const currentText = this.props.inputState.draft;
    if (!currentText.startsWith(text)) {
      const prependedText = text.concat(currentText);
      this.props.inputState.setDraft(prependedText);
      textarea.value = prependedText;
    } else {
      textarea.value = currentText;
    }

    // The above strategies make sure the cursor is at the end,
    // but we also need to make sure that we're scrolled to the bottom
    textarea.scrollTop = textarea.scrollHeight;
  };

  onKeyDown = (event: SyntheticKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.keyCode === 13 && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  };

  onSend = async (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    await this.send();
  };

  async send() {
    let { nextLocalID } = this.props;

    const text = trimMessage(this.props.inputState.draft);
    if (text) {
      // TODO we should make the send button appear dynamically
      // iff trimmed text is nonempty, just like native
      await this.dispatchTextMessageAction(text, nextLocalID);
      nextLocalID++;
    }

    this.props.inputState.createMultimediaMessage(nextLocalID);
  }

  async dispatchTextMessageAction(text: string, nextLocalID: number) {
    this.props.inputState.setDraft('');

    const localID = `local${nextLocalID}`;
    const creatorID = this.props.viewerID;
    invariant(creatorID, 'should have viewer ID in order to send a message');

    const threadID = await this.props.getServerThreadID();
    if (!threadID) {
      return;
    }

    this.props.inputState.sendTextMessage({
      type: messageTypes.TEXT,
      localID,
      threadID,
      text,
      creatorID,
      time: Date.now(),
    });
  }

  multimediaInputRef = (multimediaInput: ?HTMLInputElement) => {
    this.multimediaInput = multimediaInput;
  };

  onMultimediaClick = () => {
    if (this.multimediaInput) {
      this.multimediaInput.click();
    }
  };

  onMultimediaFileChange = async (
    event: SyntheticInputEvent<HTMLInputElement>,
  ) => {
    const result = await this.props.inputState.appendFiles([
      ...event.target.files,
    ]);
    if (!result && this.multimediaInput) {
      this.multimediaInput.value = '';
    }
  };

  onClickJoin = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.dispatchActionPromise(joinThreadActionTypes, this.joinAction());
  };

  async joinAction() {
    const query = this.props.calendarQuery();
    return await this.props.joinThread({
      threadID: this.props.threadInfo.id,
      calendarQuery: {
        startDate: query.startDate,
        endDate: query.endDate,
        filters: [
          ...query.filters,
          { type: 'threads', threadIDs: [this.props.threadInfo.id] },
        ],
      },
    });
  }
}

const joinThreadLoadingStatusSelector = createLoadingStatusSelector(
  joinThreadActionTypes,
);

const ConnectedChatInputBar: React.AbstractComponent<BaseProps, mixed> = React.memo<BaseProps>(function ConnectedChatInputBar(
  props
) {
  const viewerID = useSelector(
    state => state.currentUserInfo && state.currentUserInfo.id,
  );
  const nextLocalID = useSelector(state => state.nextLocalID);
  const isThreadActive = useSelector(
    state => props.threadInfo.id === state.navInfo.activeChatThreadID,
  );
  const userInfos = useSelector(state => state.userStore.userInfos);
  const joinThreadLoadingStatus = useSelector(joinThreadLoadingStatusSelector);
  const calendarQuery = useSelector(nonThreadCalendarQuery);
  const dispatchActionPromise = useDispatchActionPromise();
  const callJoinThread = useServerCall(joinThread);

  const { setModal } = props;
  const showErrorModal = React.useCallback(
    () => setModal(<FailedSendModal setModal={setModal} />),
    [setModal],
  );
  const sourceMessageID = useSelector(state => state.navInfo.sourceMessageID);
  const getServerThreadID = useRealThreadCreator(
    { threadInfo: props.threadInfo, sourceMessageID },
    showErrorModal,
  );

  return (
    <ChatInputBar
      {...props}
      viewerID={viewerID}
      joinThreadLoadingStatus={joinThreadLoadingStatus}
      calendarQuery={calendarQuery}
      nextLocalID={nextLocalID}
      isThreadActive={isThreadActive}
      userInfos={userInfos}
      dispatchActionPromise={dispatchActionPromise}
      joinThread={callJoinThread}
      getServerThreadID={getServerThreadID}
    />
  );
});

export default ConnectedChatInputBar;
