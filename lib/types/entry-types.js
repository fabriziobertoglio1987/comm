// @flow

import {
  fifteenDaysEarlier,
  fifteenDaysLater,
  thisMonthDates,
} from '../utils/date-utils';
import type { Platform } from './device-types';
import { type CalendarFilter, defaultCalendarFilters } from './filter-types';
import type { RawMessageInfo } from './message-types';
import type { ClientEntryInconsistencyReportCreationRequest } from './report-types';
import type { CreateUpdatesResponse } from './update-types';
import type { AccountUserInfo } from './user-types';

export type RawEntryInfo = {|
  id?: string, // null if local copy without ID yet
  localID?: string, // for optimistic creations
  threadID: string,
  text: string,
  year: number,
  month: number, // 1-indexed
  day: number, // 1-indexed
  creationTime: number, // millisecond timestamp
  creatorID: string,
  deleted: boolean,
|};

export type EntryInfo = {|
  id?: string, // null if local copy without ID yet
  localID?: string, // for optimistic creations
  threadID: string,
  text: string,
  year: number,
  month: number, // 1-indexed
  day: number, // 1-indexed
  creationTime: number, // millisecond timestamp
  creator: ?string,
  deleted: boolean,
|};

export type EntryStore = {|
  +entryInfos: { [id: string]: RawEntryInfo },
  +daysToEntries: { [day: string]: string[] },
  +lastUserInteractionCalendar: number,
  +inconsistencyReports: $ReadOnlyArray<ClientEntryInconsistencyReportCreationRequest>,
|};

export type CalendarQuery = {|
  +startDate: string,
  +endDate: string,
  +filters: $ReadOnlyArray<CalendarFilter>,
|};

export const defaultCalendarQuery = (
  platform: ?Platform,
  timeZone?: ?string,
): CalendarQuery => {
  if (platform === 'web') {
    return {
      ...thisMonthDates(timeZone),
      filters: defaultCalendarFilters,
    };
  } else {
    return {
      startDate: fifteenDaysEarlier(timeZone).valueOf(),
      endDate: fifteenDaysLater(timeZone).valueOf(),
      filters: defaultCalendarFilters,
    };
  }
};

export type SaveEntryInfo = {|
  +entryID: string,
  +text: string,
  +prevText: string,
  +timestamp: number,
  +calendarQuery: CalendarQuery,
|};

export type SaveEntryRequest = {|
  +entryID: string,
  +text: string,
  +prevText: string,
  +timestamp: number,
  +calendarQuery?: CalendarQuery,
|};

export type SaveEntryResponse = {|
  +entryID: string,
  +newMessageInfos: $ReadOnlyArray<RawMessageInfo>,
  +updatesResult: CreateUpdatesResponse,
|};

export type SaveEntryPayload = {|
  ...SaveEntryResponse,
  +threadID: string,
|};

export type CreateEntryInfo = {|
  +text: string,
  +timestamp: number,
  +date: string,
  +threadID: string,
  +localID: string,
  +calendarQuery: CalendarQuery,
|};

export type CreateEntryRequest = {|
  +text: string,
  +timestamp: number,
  +date: string,
  +threadID: string,
  +localID?: string,
  +calendarQuery?: CalendarQuery,
|};

export type CreateEntryPayload = {|
  ...SaveEntryPayload,
  +localID: string,
|};

export type DeleteEntryInfo = {|
  +entryID: string,
  +prevText: string,
  +calendarQuery: CalendarQuery,
|};

export type DeleteEntryRequest = {|
  +entryID: string,
  +prevText: string,
  +timestamp: number,
  +calendarQuery?: CalendarQuery,
|};

export type RestoreEntryInfo = {|
  +entryID: string,
  +calendarQuery: CalendarQuery,
|};

export type RestoreEntryRequest = {|
  +entryID: string,
  +timestamp: number,
  +calendarQuery?: CalendarQuery,
|};

export type DeleteEntryResponse = {|
  +newMessageInfos: $ReadOnlyArray<RawMessageInfo>,
  +threadID: string,
  +updatesResult: CreateUpdatesResponse,
|};

export type RestoreEntryResponse = {|
  +newMessageInfos: $ReadOnlyArray<RawMessageInfo>,
  +updatesResult: CreateUpdatesResponse,
|};
export type RestoreEntryPayload = {|
  ...RestoreEntryResponse,
  +threadID: string,
|};

export type FetchEntryInfosBase = {|
  +rawEntryInfos: $ReadOnlyArray<RawEntryInfo>,
|};
export type FetchEntryInfosResponse = {|
  ...FetchEntryInfosBase,
  +userInfos: { [id: string]: AccountUserInfo },
|};
export type FetchEntryInfosResult = FetchEntryInfosBase;

export type DeltaEntryInfosResponse = {|
  +rawEntryInfos: $ReadOnlyArray<RawEntryInfo>,
  +deletedEntryIDs: $ReadOnlyArray<string>,
|};
export type DeltaEntryInfosResult = {|
  +rawEntryInfos: $ReadOnlyArray<RawEntryInfo>,
  +deletedEntryIDs: $ReadOnlyArray<string>,
  +userInfos: $ReadOnlyArray<AccountUserInfo>,
|};

export type CalendarResult = {|
  +rawEntryInfos: $ReadOnlyArray<RawEntryInfo>,
  +calendarQuery: CalendarQuery,
|};

export type CalendarQueryUpdateStartingPayload = {|
  +calendarQuery?: CalendarQuery,
|};
export type CalendarQueryUpdateResult = {|
  +rawEntryInfos: $ReadOnlyArray<RawEntryInfo>,
  +deletedEntryIDs: $ReadOnlyArray<string>,
  +calendarQuery: CalendarQuery,
  +calendarQueryAlreadyUpdated: boolean,
|};
