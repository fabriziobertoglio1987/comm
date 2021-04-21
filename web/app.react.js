// @flow

import { config as faConfig } from '@fortawesome/fontawesome-svg-core';
import { faCalendar, faComments } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import invariant from 'invariant';
import _isEqual from 'lodash/fp/isEqual';
import * as React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useDispatch } from 'react-redux';

import {
  fetchEntriesActionTypes,
  updateCalendarQueryActionTypes,
} from 'lib/actions/entry-actions';
import {
  createLoadingStatusSelector,
  combineLoadingStatuses,
} from 'lib/selectors/loading-selectors';
import {
  mostRecentReadThreadSelector,
  unreadCount,
} from 'lib/selectors/thread-selectors';
import { isLoggedIn } from 'lib/selectors/user-selectors';
import type { LoadingStatus } from 'lib/types/loading-types';
import type { Dispatch } from 'lib/types/redux-types';
import {
  verifyField,
  type ServerVerificationResult,
} from 'lib/types/verify-types';
import { registerConfig } from 'lib/utils/config';

import AccountBar from './account-bar.react';
import Calendar from './calendar/calendar.react';
import Chat from './chat/chat.react';
import InputStateContainer from './input/input-state-container.react';
import LoadingIndicator from './loading-indicator.react';
import ResetPasswordModal from './modals/account/reset-password-modal.react';
import VerificationModal from './modals/account/verification-modal.react';
import FocusHandler from './redux/focus-handler.react';
import { useSelector } from './redux/redux-utils';
import VisibilityHandler from './redux/visibility-handler.react';
import history from './router-history';
import Splash from './splash/splash.react';
import css from './style.css';
import getTitle from './title/getTitle';
import { type NavInfo, updateNavInfoActionType } from './types/nav-types';
import { canonicalURLFromReduxState, navInfoFromURL } from './url-utils';

// We want Webpack's css-loader and style-loader to handle the Fontawesome CSS,
// so we disable the autoAddCss logic and import the CSS file. Otherwise every
// icon flashes huge for a second before the CSS is loaded.
import '@fortawesome/fontawesome-svg-core/styles.css';
faConfig.autoAddCss = false;

registerConfig({
  // We can't securely cache credentials on web, so we have no way to recover
  // from a cookie invalidation
  resolveInvalidatedCookie: null,
  // We use httponly cookies on web to protect against XSS attacks, so we have
  // no access to the cookies from JavaScript
  setCookieOnRequest: false,
  setSessionIDOnRequest: true,
  // Never reset the calendar range
  calendarRangeInactivityLimit: null,
  platformDetails: { platform: 'web' },
});

type BaseProps = {|
  +location: {
    +pathname: string,
    ...
  },
|};
type Props = {|
  ...BaseProps,
  // Redux state
  +navInfo: NavInfo,
  +serverVerificationResult: ?ServerVerificationResult,
  +entriesLoadingStatus: LoadingStatus,
  +loggedIn: boolean,
  +mostRecentReadThread: ?string,
  +activeThreadCurrentlyUnread: boolean,
  +viewerID: ?string,
  +unreadCount: number,
  // Redux dispatch functions
  +dispatch: Dispatch,
|};
type State = {|
  +currentModal: ?React.Node,
|};
class App extends React.PureComponent<Props, State> {
  state: State = {
    currentModal: null,
  };

  componentDidMount() {
    const { navInfo, serverVerificationResult } = this.props;
    if (navInfo.verify && serverVerificationResult) {
      if (serverVerificationResult.field === verifyField.RESET_PASSWORD) {
        this.showResetPasswordModal();
      } else {
        this.setModal(
          <VerificationModal onClose={this.clearVerificationModal} />,
        );
      }
    }

    const newURL = canonicalURLFromReduxState(
      navInfo,
      this.props.location.pathname,
      this.props.loggedIn,
    );
    if (this.props.location.pathname !== newURL) {
      history.replace(newURL);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (!_isEqual(this.props.navInfo)(prevProps.navInfo)) {
      const { navInfo, serverVerificationResult } = this.props;
      if (
        navInfo.verify &&
        !prevProps.navInfo.verify &&
        serverVerificationResult
      ) {
        if (serverVerificationResult.field === verifyField.RESET_PASSWORD) {
          this.showResetPasswordModal();
        } else {
          this.setModal(
            <VerificationModal onClose={this.clearVerificationModal} />,
          );
        }
      } else if (!navInfo.verify && prevProps.navInfo.verify) {
        this.clearModal();
      }

      const newURL = canonicalURLFromReduxState(
        navInfo,
        this.props.location.pathname,
        this.props.loggedIn,
      );
      if (newURL !== this.props.location.pathname) {
        history.push(newURL);
      }
    } else if (this.props.location.pathname !== prevProps.location.pathname) {
      const newNavInfo = navInfoFromURL(this.props.location.pathname, {
        navInfo: this.props.navInfo,
      });
      if (!_isEqual(newNavInfo)(this.props.navInfo)) {
        this.props.dispatch({
          type: updateNavInfoActionType,
          payload: newNavInfo,
        });
      }
    } else if (this.props.loggedIn !== prevProps.loggedIn) {
      const newURL = canonicalURLFromReduxState(
        this.props.navInfo,
        this.props.location.pathname,
        this.props.loggedIn,
      );
      if (newURL !== this.props.location.pathname) {
        history.replace(newURL);
      }
    }
  }

  showResetPasswordModal() {
    const newURL = canonicalURLFromReduxState(
      {
        ...this.props.navInfo,
        verify: null,
      },
      this.props.location.pathname,
      this.props.loggedIn,
    );
    const onClose = () => history.push(newURL);
    const onSuccess = () => history.replace(newURL);
    this.setModal(
      <ResetPasswordModal onClose={onClose} onSuccess={onSuccess} />,
    );
  }

  render() {
    let content;
    if (this.props.loggedIn) {
      content = this.renderMainContent();
    } else {
      content = (
        <Splash
          setModal={this.setModal}
          currentModal={this.state.currentModal}
        />
      );
    }
    return (
      <DndProvider backend={HTML5Backend}>
        <FocusHandler />
        <VisibilityHandler />
        {content}
        {this.state.currentModal}
      </DndProvider>
    );
  }

  renderMainContent() {
    const calendarNavClasses = classNames({
      [css['current-tab']]: this.props.navInfo.tab === 'calendar',
    });
    const chatNavClasses = classNames({
      [css['current-tab']]: this.props.navInfo.tab === 'chat',
    });

    let mainContent;
    if (this.props.navInfo.tab === 'calendar') {
      mainContent = (
        <Calendar setModal={this.setModal} url={this.props.location.pathname} />
      );
    } else if (this.props.navInfo.tab === 'chat') {
      mainContent = <Chat setModal={this.setModal} />;
    }

    const { viewerID, unreadCount: curUnreadCount } = this.props;
    invariant(viewerID, 'should be set');
    let chatBadge = null;
    if (curUnreadCount > 0) {
      chatBadge = <div className={css.chatBadge}>{curUnreadCount}</div>;
    }

    return (
      <React.Fragment>
        <header className={css['header']}>
          <div className={css['main-header']}>
            <h1>SquadCal</h1>
            <ul className={css['nav-bar']}>
              <li className={calendarNavClasses}>
                <div>
                  <a onClick={this.onClickCalendar}>
                    <FontAwesomeIcon
                      icon={faCalendar}
                      className={css['nav-bar-icon']}
                    />
                    Calendar
                  </a>
                </div>
              </li>
              <li className={chatNavClasses}>
                <div>
                  <a onClick={this.onClickChat}>
                    <FontAwesomeIcon
                      icon={faComments}
                      className={css['nav-bar-icon']}
                    />
                    Chat
                    {chatBadge}
                  </a>
                </div>
              </li>
            </ul>
            <div className={css['upper-right']}>
              <LoadingIndicator
                status={this.props.entriesLoadingStatus}
                size="medium"
                loadingClassName={css['page-loading']}
                errorClassName={css['page-error']}
              />
              <AccountBar setModal={this.setModal} />
            </div>
          </div>
        </header>
        <InputStateContainer setModal={this.setModal}>
          <div className={css['main-content-container']}>
            <div className={css['main-content']}>{mainContent}</div>
          </div>
        </InputStateContainer>
      </React.Fragment>
    );
  }

  setModal = (modal: ?React.Node) => {
    this.setState({ currentModal: modal });
  };

  clearModal() {
    this.setModal(null);
  }

  clearVerificationModal = () => {
    const navInfo = { ...this.props.navInfo, verify: null };
    const newURL = canonicalURLFromReduxState(
      navInfo,
      this.props.location.pathname,
      this.props.loggedIn,
    );
    if (newURL !== this.props.location.pathname) {
      history.push(newURL);
    }
  };

  onClickCalendar = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.dispatch({
      type: updateNavInfoActionType,
      payload: { tab: 'calendar' },
    });
  };

  onClickChat = (event: SyntheticEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    this.props.dispatch({
      type: updateNavInfoActionType,
      payload: {
        tab: 'chat',
        activeChatThreadID: this.props.activeThreadCurrentlyUnread
          ? this.props.mostRecentReadThread
          : this.props.navInfo.activeChatThreadID,
      },
    });
  };
}

const fetchEntriesLoadingStatusSelector = createLoadingStatusSelector(
  fetchEntriesActionTypes,
);
const updateCalendarQueryLoadingStatusSelector = createLoadingStatusSelector(
  updateCalendarQueryActionTypes,
);

export default React.memo<BaseProps>(function ConnectedApp(props: BaseProps) {
  const activeChatThreadID = useSelector(
    state => state.navInfo.activeChatThreadID,
  );
  const navInfo = useSelector(state => state.navInfo);
  const serverVerificationResult = useSelector(
    state => state.serverVerificationResult,
  );

  const fetchEntriesLoadingStatus = useSelector(
    fetchEntriesLoadingStatusSelector,
  );
  const updateCalendarQueryLoadingStatus = useSelector(
    updateCalendarQueryLoadingStatusSelector,
  );
  const entriesLoadingStatus = combineLoadingStatuses(
    fetchEntriesLoadingStatus,
    updateCalendarQueryLoadingStatus,
  );

  const loggedIn = useSelector(isLoggedIn);
  const mostRecentReadThread = useSelector(mostRecentReadThreadSelector);
  const activeThreadCurrentlyUnread = useSelector(
    state =>
      !activeChatThreadID ||
      !!state.threadStore.threadInfos[activeChatThreadID]?.currentUser.unread,
  );

  const viewerID = useSelector(
    state => state.currentUserInfo && state.currentUserInfo.id,
  );
  const boundUnreadCount = useSelector(unreadCount);

  React.useEffect(() => {
    document.title = getTitle(boundUnreadCount);
  }, [boundUnreadCount]);

  const dispatch = useDispatch();

  return (
    <App
      {...props}
      navInfo={navInfo}
      serverVerificationResult={serverVerificationResult}
      entriesLoadingStatus={entriesLoadingStatus}
      loggedIn={loggedIn}
      mostRecentReadThread={mostRecentReadThread}
      activeThreadCurrentlyUnread={activeThreadCurrentlyUnread}
      viewerID={viewerID}
      unreadCount={boundUnreadCount}
      dispatch={dispatch}
    />
  );
});
