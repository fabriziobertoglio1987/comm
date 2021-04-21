// @flow

import * as React from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import ExitApp from 'react-native-exit-app';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDispatch } from 'react-redux';

import type { Dispatch } from 'lib/types/redux-types';
import { setURLPrefix } from 'lib/utils/url-utils';

import Button from '../components/button.react';
import type { NavigationRoute } from '../navigation/route-names';
import { CustomServerModalRouteName } from '../navigation/route-names';
import { useSelector } from '../redux/redux-utils';
import { useColors, useStyles, type Colors } from '../themes/colors';
import { wipeAndExit } from '../utils/crash-utils';
import { nodeServerOptions } from '../utils/url-utils';
import type { MoreNavigationProp } from './more.react';

const ServerIcon = () => (
  <Icon
    name="md-checkmark"
    size={20}
    color="#008800"
    style={unboundStyles.icon}
  />
);

type BaseProps = {|
  +navigation: MoreNavigationProp<'DevTools'>,
  +route: NavigationRoute<'DevTools'>,
|};
type Props = {|
  ...BaseProps,
  +urlPrefix: string,
  +customServer: ?string,
  +colors: Colors,
  +styles: typeof unboundStyles,
  +dispatch: Dispatch,
|};
class DevTools extends React.PureComponent<Props> {
  render() {
    const { panelIosHighlightUnderlay: underlay } = this.props.colors;

    const serverButtons = [];
    for (const server of nodeServerOptions) {
      const icon = server === this.props.urlPrefix ? <ServerIcon /> : null;
      serverButtons.push(
        <Button
          onPress={() => this.onSelectServer(server)}
          style={this.props.styles.row}
          iosFormat="highlight"
          iosHighlightUnderlayColor={underlay}
          key={`server${server}`}
        >
          <Text style={this.props.styles.serverText}>{server}</Text>
          {icon}
        </Button>,
      );
      serverButtons.push(
        <View style={this.props.styles.hr} key={`hr${server}`} />,
      );
    }
    const customServerLabel = this.props.customServer ? (
      <Text>
        <Text style={this.props.styles.customServerLabel}>{'custom: '}</Text>
        <Text style={this.props.styles.serverText}>
          {this.props.customServer}
        </Text>
      </Text>
    ) : (
      <Text
        style={[
          this.props.styles.customServerLabel,
          this.props.styles.serverContainer,
        ]}
      >
        custom
      </Text>
    );
    const customServerIcon =
      this.props.customServer === this.props.urlPrefix ? <ServerIcon /> : null;
    serverButtons.push(
      <Button
        onPress={this.onSelectCustomServer}
        style={this.props.styles.row}
        iosFormat="highlight"
        iosHighlightUnderlayColor={underlay}
        key="customServer"
      >
        {customServerLabel}
        {customServerIcon}
      </Button>,
    );

    return (
      <View style={this.props.styles.container}>
        <ScrollView
          contentContainerStyle={this.props.styles.scrollViewContentContainer}
          style={this.props.styles.scrollView}
        >
          <View style={this.props.styles.slightlyPaddedSection}>
            <Button
              onPress={this.onPressCrash}
              style={this.props.styles.row}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.redText}>Trigger a crash</Text>
            </Button>
            <View style={this.props.styles.hr} />
            <Button
              onPress={this.onPressKill}
              style={this.props.styles.row}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.redText}>Kill the app</Text>
            </Button>
            <View style={this.props.styles.hr} />
            <Button
              onPress={this.onPressWipe}
              style={this.props.styles.row}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.redText}>
                Wipe state and kill app
              </Text>
            </Button>
          </View>
          <Text style={this.props.styles.header}>SERVER</Text>
          <View style={this.props.styles.slightlyPaddedSection}>
            {serverButtons}
          </View>
        </ScrollView>
      </View>
    );
  }

  onPressCrash = () => {
    throw new Error('User triggered crash through dev menu!');
  };

  onPressKill = () => {
    ExitApp.exitApp();
  };

  onPressWipe = async () => {
    await wipeAndExit();
  };

  onSelectServer = (server: string) => {
    if (server !== this.props.urlPrefix) {
      this.props.dispatch({
        type: setURLPrefix,
        payload: server,
      });
    }
  };

  onSelectCustomServer = () => {
    this.props.navigation.navigate(CustomServerModalRouteName, {
      presentedFrom: this.props.route.key,
    });
  };
}

const unboundStyles = {
  container: {
    flex: 1,
  },
  customServerLabel: {
    color: 'panelForegroundTertiaryLabel',
    fontSize: 16,
  },
  header: {
    color: 'panelBackgroundLabel',
    fontSize: 12,
    fontWeight: '400',
    paddingBottom: 3,
    paddingHorizontal: 24,
  },
  hr: {
    backgroundColor: 'panelForegroundBorder',
    height: 1,
    marginHorizontal: 15,
  },
  icon: {
    lineHeight: Platform.OS === 'ios' ? 18 : 20,
  },
  redText: {
    color: 'redText',
    flex: 1,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  scrollView: {
    backgroundColor: 'panelBackground',
  },
  scrollViewContentContainer: {
    paddingTop: 24,
  },
  serverContainer: {
    flex: 1,
  },
  serverText: {
    color: 'panelForegroundLabel',
    fontSize: 16,
  },
  slightlyPaddedSection: {
    backgroundColor: 'panelForeground',
    borderBottomWidth: 1,
    borderColor: 'panelForegroundBorder',
    borderTopWidth: 1,
    marginBottom: 24,
    paddingVertical: 2,
  },
};

export default React.memo<BaseProps>(function ConnectedDevTools(
  props: BaseProps,
) {
  const urlPrefix = useSelector(state => state.urlPrefix);
  const customServer = useSelector(state => state.customServer);
  const colors = useColors();
  const styles = useStyles(unboundStyles);
  const dispatch = useDispatch();

  return (
    <DevTools
      {...props}
      urlPrefix={urlPrefix}
      customServer={customServer}
      colors={colors}
      styles={styles}
      dispatch={dispatch}
    />
  );
});
