// @flow

import * as React from 'react';
import { TextInput, FlatList, StyleSheet } from 'react-native';

import { sidebarInfoSelector } from 'lib/selectors/thread-selectors';
import SearchIndex from 'lib/shared/search-index';
import { threadSearchText } from 'lib/shared/thread-utils';
import type { ThreadInfo, SidebarInfo } from 'lib/types/thread-types';

import Modal from '../components/modal.react';
import Search from '../components/search.react';
import type { RootNavigationProp } from '../navigation/root-navigator.react';
import type { NavigationRoute } from '../navigation/route-names';
import { MessageListRouteName } from '../navigation/route-names';
import { useSelector } from '../redux/redux-utils';
import { useIndicatorStyle } from '../themes/colors';
import { waitForModalInputFocus } from '../utils/timers';
import SidebarItem from './sidebar-item.react';

export type SidebarListModalParams = {|
  +threadInfo: ThreadInfo,
|};

function keyExtractor(sidebarInfo: SidebarInfo) {
  return sidebarInfo.threadInfo.id;
}
function getItemLayout(data: ?$ReadOnlyArray<SidebarInfo>, index: number) {
  return { length: 24, offset: 24 * index, index };
}

type Props = {|
  +navigation: RootNavigationProp<'SidebarListModal'>,
  +route: NavigationRoute<'SidebarListModal'>,
|};
function SidebarListModal(props: Props) {
  const threadID = props.route.params.threadInfo.id;
  const sidebarInfos = useSelector(
    state => sidebarInfoSelector(state)[threadID] ?? [],
  );

  const [searchState, setSearchState] = React.useState({
    text: '',
    results: new Set<string>(),
  });

  const listData = React.useMemo(() => {
    if (!searchState.text) {
      return sidebarInfos;
    }
    return sidebarInfos.filter(({ threadInfo }) =>
      searchState.results.has(threadInfo.id),
    );
  }, [sidebarInfos, searchState]);

  const userInfos = useSelector(state => state.userStore.userInfos);
  const viewerID = useSelector(
    state => state.currentUserInfo && state.currentUserInfo.id,
  );
  const searchIndex = React.useMemo(() => {
    const index = new SearchIndex();
    for (const sidebarInfo of sidebarInfos) {
      const { threadInfo } = sidebarInfo;
      index.addEntry(
        threadInfo.id,
        threadSearchText(threadInfo, userInfos, viewerID),
      );
    }
    return index;
  }, [sidebarInfos, userInfos, viewerID]);
  React.useEffect(() => {
    setSearchState(curState => ({
      ...curState,
      results: new Set(searchIndex.getSearchResults(curState.text)),
    }));
  }, [searchIndex]);

  const onChangeSearchText = React.useCallback(
    (searchText: string) =>
      setSearchState({
        text: searchText,
        results: new Set(searchIndex.getSearchResults(searchText)),
      }),
    [searchIndex],
  );

  const searchTextInputRef = React.useRef();
  const setSearchTextInputRef = React.useCallback(
    async (textInput: ?React.ElementRef<typeof TextInput>) => {
      searchTextInputRef.current = textInput;
      if (!textInput) {
        return;
      }
      await waitForModalInputFocus();
      if (searchTextInputRef.current) {
        searchTextInputRef.current.focus();
      }
    },
    [],
  );

  const { navigation } = props;
  const { navigate } = navigation;
  const onPressItem = React.useCallback(
    (threadInfo: ThreadInfo) => {
      setSearchState({
        text: '',
        results: new Set(),
      });
      if (searchTextInputRef.current) {
        searchTextInputRef.current.blur();
      }
      navigate({
        name: MessageListRouteName,
        params: { threadInfo },
        key: `${MessageListRouteName}${threadInfo.id}`,
      });
    },
    [navigate],
  );

  const renderItem = React.useCallback(
    (row: { item: SidebarInfo, ... }) => {
      return (
        <SidebarItem
          sidebarInfo={row.item}
          onPressItem={onPressItem}
          style={styles.sidebar}
        />
      );
    },
    [onPressItem],
  );

  const indicatorStyle = useIndicatorStyle();
  return (
    <Modal>
      <Search
        searchText={searchState.text}
        onChangeText={onChangeSearchText}
        containerStyle={styles.search}
        placeholder="Search sidebars"
        ref={setSearchTextInputRef}
      />
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        indicatorStyle={indicatorStyle}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: 8,
  },
  sidebar: {
    paddingLeft: 0,
    paddingRight: 5,
  },
});

export default SidebarListModal;
