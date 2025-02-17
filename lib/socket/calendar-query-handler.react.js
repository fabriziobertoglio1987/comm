// @flow

import _isEqual from 'lodash/fp/isEqual';
import * as React from 'react';

import {
  updateCalendarQueryActionTypes,
  updateCalendarQuery,
} from '../actions/entry-actions';
import { timeUntilCalendarRangeExpiration } from '../selectors/nav-selectors';
import { useIsAppForegrounded } from '../shared/lifecycle-utils';
import type {
  CalendarQuery,
  CalendarQueryUpdateResult,
  CalendarQueryUpdateStartingPayload,
} from '../types/entry-types';
import { type LifecycleState } from '../types/lifecycle-state-types';
import { type ConnectionInfo } from '../types/socket-types';
import {
  type DispatchActionPromise,
  useDispatchActionPromise,
  useServerCall,
} from '../utils/action-utils';
import { useSelector } from '../utils/redux-utils';

type BaseProps = {|
  +currentCalendarQuery: () => CalendarQuery,
  +frozen: boolean,
|};
type Props = {|
  ...BaseProps,
  +connection: ConnectionInfo,
  +lastUserInteractionCalendar: number,
  +foreground: LifecycleState,
  +dispatchActionPromise: DispatchActionPromise,
  +updateCalendarQuery: (
    calendarQuery: CalendarQuery,
    reduxAlreadyUpdated?: boolean,
  ) => Promise<CalendarQueryUpdateResult>,
|};
class CalendarQueryHandler extends React.PureComponent<Props> {
  serverCalendarQuery: CalendarQuery;
  expirationTimeoutID: ?TimeoutID;

  constructor(props: Props) {
    super(props);
    this.serverCalendarQuery = this.props.connection.actualizedCalendarQuery;
  }

  componentDidMount() {
    if (this.props.connection.status === 'connected') {
      this.possiblyUpdateCalendarQuery();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { actualizedCalendarQuery } = this.props.connection;
    if (this.props.connection.status !== 'connected') {
      if (!_isEqual(this.serverCalendarQuery)(actualizedCalendarQuery)) {
        this.serverCalendarQuery = actualizedCalendarQuery;
      }
      return;
    }

    if (
      !_isEqual(this.serverCalendarQuery)(actualizedCalendarQuery) &&
      _isEqual(this.props.currentCalendarQuery())(actualizedCalendarQuery)
    ) {
      this.serverCalendarQuery = actualizedCalendarQuery;
    }

    const shouldUpdate =
      (this.isExpired ||
        prevProps.connection.status !== 'connected' ||
        this.props.currentCalendarQuery !== prevProps.currentCalendarQuery) &&
      this.shouldUpdateCalendarQuery;

    if (shouldUpdate) {
      this.updateCalendarQuery();
    }
  }

  render() {
    return null;
  }

  get isExpired() {
    const timeUntilExpiration = timeUntilCalendarRangeExpiration(
      this.props.lastUserInteractionCalendar,
    );
    return (
      timeUntilExpiration !== null &&
      timeUntilExpiration !== undefined &&
      timeUntilExpiration <= 0
    );
  }

  get shouldUpdateCalendarQuery() {
    if (this.props.connection.status !== 'connected' || this.props.frozen) {
      return false;
    }
    const calendarQuery = this.props.currentCalendarQuery();
    return !_isEqual(calendarQuery)(this.serverCalendarQuery);
  }

  updateCalendarQuery() {
    const calendarQuery = this.props.currentCalendarQuery();
    this.serverCalendarQuery = calendarQuery;
    this.props.dispatchActionPromise(
      updateCalendarQueryActionTypes,
      this.props.updateCalendarQuery(calendarQuery, true),
      undefined,
      ({ calendarQuery }: CalendarQueryUpdateStartingPayload),
    );
  }

  possiblyUpdateCalendarQuery = () => {
    if (this.shouldUpdateCalendarQuery) {
      this.updateCalendarQuery();
    }
  };
}

export default React.memo<BaseProps>(function ConnectedCalendarQueryHandler(
  props: BaseProps,
) {
  const connection = useSelector((state) => state.connection);
  const lastUserInteractionCalendar = useSelector(
    (state) => state.entryStore.lastUserInteractionCalendar,
  );
  // We include this so that componentDidUpdate will be called on foreground
  const foreground = useIsAppForegrounded();
  const callUpdateCalendarQuery = useServerCall(updateCalendarQuery);
  const dispatchActionPromise = useDispatchActionPromise();

  return (
    <CalendarQueryHandler
      {...props}
      connection={connection}
      lastUserInteractionCalendar={lastUserInteractionCalendar}
      foreground={foreground}
      updateCalendarQuery={callUpdateCalendarQuery}
      dispatchActionPromise={dispatchActionPromise}
    />
  );
});
