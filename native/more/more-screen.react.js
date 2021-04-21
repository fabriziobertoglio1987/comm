// @flow

import invariant from 'invariant';
import * as React from 'react';
import {
  View,
  Text,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import {
  logOutActionTypes,
  logOut,
  resendVerificationEmailActionTypes,
  resendVerificationEmail,
} from 'lib/actions/user-actions';
import { preRequestUserStateSelector } from 'lib/selectors/account-selectors';
import { createLoadingStatusSelector } from 'lib/selectors/loading-selectors';
import type { LogOutResult } from 'lib/types/account-types';
import { type PreRequestUserState } from 'lib/types/session-types';
import { type CurrentUserInfo } from 'lib/types/user-types';
import {
  type DispatchActionPromise,
  useDispatchActionPromise,
  useServerCall,
} from 'lib/utils/action-utils';

import {
  getNativeSharedWebCredentials,
  deleteNativeCredentialsFor,
} from '../account/native-credentials';
import Button from '../components/button.react';
import EditSettingButton from '../components/edit-setting-button.react';
import { SingleLine } from '../components/single-line.react';
import type { NavigationRoute } from '../navigation/route-names';
import {
  EditEmailRouteName,
  EditPasswordRouteName,
  DeleteAccountRouteName,
  BuildInfoRouteName,
  DevToolsRouteName,
  AppearancePreferencesRouteName,
  FriendListRouteName,
  BlockListRouteName,
} from '../navigation/route-names';
import { useSelector } from '../redux/redux-utils';
import { type Colors, useColors, useStyles } from '../themes/colors';
import type { MoreNavigationProp } from './more.react';

type BaseProps = {|
  +navigation: MoreNavigationProp<'MoreScreen'>,
  +route: NavigationRoute<'MoreScreen'>,
|};
type Props = {|
  ...BaseProps,
  +currentUserInfo: ?CurrentUserInfo,
  +preRequestUserState: PreRequestUserState,
  +resendVerificationLoading: boolean,
  +logOutLoading: boolean,
  +colors: Colors,
  +styles: typeof unboundStyles,
  +dispatchActionPromise: DispatchActionPromise,
  +logOut: (preRequestUserState: PreRequestUserState) => Promise<LogOutResult>,
  +resendVerificationEmail: () => Promise<void>,
|};
class MoreScreen extends React.PureComponent<Props> {
  get username() {
    return this.props.currentUserInfo && !this.props.currentUserInfo.anonymous
      ? this.props.currentUserInfo.username
      : undefined;
  }

  get email() {
    return this.props.currentUserInfo && !this.props.currentUserInfo.anonymous
      ? this.props.currentUserInfo.email
      : undefined;
  }

  get emailVerified() {
    return this.props.currentUserInfo && !this.props.currentUserInfo.anonymous
      ? this.props.currentUserInfo.emailVerified
      : undefined;
  }

  get loggedOutOrLoggingOut() {
    return (
      !this.props.currentUserInfo ||
      this.props.currentUserInfo.anonymous ||
      this.props.logOutLoading
    );
  }

  render() {
    const { emailVerified } = this;
    let emailVerifiedNode = null;
    if (emailVerified === true) {
      emailVerifiedNode = (
        <Text
          style={[
            this.props.styles.verification,
            this.props.styles.verificationText,
            this.props.styles.emailVerified,
          ]}
        >
          Verified
        </Text>
      );
    } else if (emailVerified === false) {
      let resendVerificationEmailSpinner;
      if (this.props.resendVerificationLoading) {
        resendVerificationEmailSpinner = (
          <ActivityIndicator
            size="small"
            style={this.props.styles.resendVerificationEmailSpinner}
            color={this.props.colors.panelForegroundSecondaryLabel}
          />
        );
      }
      emailVerifiedNode = (
        <View style={this.props.styles.verificationSection}>
          <Text
            style={[
              this.props.styles.verificationText,
              this.props.styles.emailNotVerified,
            ]}
          >
            Not verified
          </Text>
          <Text style={this.props.styles.verificationText}>{' - '}</Text>
          <Button
            onPress={this.onPressResendVerificationEmail}
            style={this.props.styles.resendVerificationEmailButton}
          >
            {resendVerificationEmailSpinner}
            <Text
              style={[
                this.props.styles.verificationText,
                this.props.styles.resendVerificationEmailText,
              ]}
            >
              resend verification email
            </Text>
          </Button>
        </View>
      );
    }

    const {
      panelIosHighlightUnderlay: underlay,
      link: linkColor,
    } = this.props.colors;
    return (
      <View style={this.props.styles.container}>
        <ScrollView
          contentContainerStyle={this.props.styles.scrollViewContentContainer}
          style={this.props.styles.scrollView}
        >
          <View style={this.props.styles.section}>
            <View style={this.props.styles.row}>
              <Text style={this.props.styles.loggedInLabel}>
                {'Logged in as '}
              </Text>
              <SingleLine
                style={[this.props.styles.label, this.props.styles.username]}
              >
                {this.username}
              </SingleLine>
              <Button
                onPress={this.onPressLogOut}
                disabled={this.loggedOutOrLoggingOut}
              >
                <Text style={this.props.styles.logOutText}>Log out</Text>
              </Button>
            </View>
          </View>
          <Text style={this.props.styles.header}>ACCOUNT</Text>
          <View style={this.props.styles.section}>
            <View style={this.props.styles.row}>
              <Text style={this.props.styles.label}>Email</Text>
              <View style={this.props.styles.content}>
                <SingleLine style={this.props.styles.value}>
                  {this.email}
                </SingleLine>
                {emailVerifiedNode}
              </View>
              <EditSettingButton
                onPress={this.onPressEditEmail}
                canChangeSettings={true}
                style={this.props.styles.editEmailButton}
              />
            </View>
            <View style={this.props.styles.row}>
              <Text style={this.props.styles.label}>Password</Text>
              <Text
                style={[this.props.styles.content, this.props.styles.value]}
                numberOfLines={1}
              >
                ••••••••••••••••
              </Text>
              <EditSettingButton
                onPress={this.onPressEditPassword}
                canChangeSettings={true}
                style={this.props.styles.editPasswordButton}
              />
            </View>
          </View>
          <View style={this.props.styles.slightlyPaddedSection}>
            <Button
              onPress={this.onPressFriendList}
              style={this.props.styles.submenuButton}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.submenuText}>Friend list</Text>
              <Icon name="ios-arrow-forward" size={20} color={linkColor} />
            </Button>
            <Button
              onPress={this.onPressBlockList}
              style={this.props.styles.submenuButton}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.submenuText}>Block list</Text>
              <Icon name="ios-arrow-forward" size={20} color={linkColor} />
            </Button>
          </View>
          <Text style={this.props.styles.header}>PREFERENCES</Text>
          <View style={this.props.styles.slightlyPaddedSection}>
            <Button
              onPress={this.onPressAppearance}
              style={this.props.styles.submenuButton}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.submenuText}>Appearance</Text>
              <Icon name="ios-arrow-forward" size={20} color={linkColor} />
            </Button>
          </View>
          <View style={this.props.styles.slightlyPaddedSection}>
            <Button
              onPress={this.onPressBuildInfo}
              style={this.props.styles.submenuButton}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.submenuText}>Build info</Text>
              <Icon name="ios-arrow-forward" size={20} color={linkColor} />
            </Button>
            <Button
              onPress={this.onPressDevTools}
              style={this.props.styles.submenuButton}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.submenuText}>Developer tools</Text>
              <Icon name="ios-arrow-forward" size={20} color={linkColor} />
            </Button>
          </View>
          <View style={this.props.styles.unpaddedSection}>
            <Button
              onPress={this.onPressDeleteAccount}
              style={this.props.styles.deleteAccountButton}
              iosFormat="highlight"
              iosHighlightUnderlayColor={underlay}
            >
              <Text style={this.props.styles.deleteAccountText}>
                Delete account...
              </Text>
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  onPressLogOut = () => {
    if (this.loggedOutOrLoggingOut) {
      return;
    }
    const alertTitle =
      Platform.OS === 'ios' ? 'Keep Login Info in Keychain' : 'Keep Login Info';
    const sharedWebCredentials = getNativeSharedWebCredentials();
    const alertDescription = sharedWebCredentials
      ? 'We will automatically fill out log-in forms with your credentials ' +
        'in the app and keep them available on squadcal.org in Safari.'
      : 'We will automatically fill out log-in forms with your credentials ' +
        'in the app.';
    Alert.alert(
      alertTitle,
      alertDescription,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Keep', onPress: this.logOutButKeepNativeCredentialsWrapper },
        {
          text: 'Remove',
          onPress: this.logOutAndDeleteNativeCredentialsWrapper,
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  logOutButKeepNativeCredentialsWrapper = () => {
    if (this.loggedOutOrLoggingOut) {
      return;
    }
    this.props.dispatchActionPromise(logOutActionTypes, this.logOut());
  };

  logOutAndDeleteNativeCredentialsWrapper = () => {
    if (this.loggedOutOrLoggingOut) {
      return;
    }
    this.props.dispatchActionPromise(
      logOutActionTypes,
      this.logOutAndDeleteNativeCredentials(),
    );
  };

  logOut() {
    return this.props.logOut(this.props.preRequestUserState);
  }

  async logOutAndDeleteNativeCredentials() {
    const { username } = this;
    invariant(username, "can't log out if not logged in");
    await deleteNativeCredentialsFor(username);
    return await this.logOut();
  }

  onPressResendVerificationEmail = () => {
    this.props.dispatchActionPromise(
      resendVerificationEmailActionTypes,
      this.resendVerificationEmailAction(),
    );
  };

  async resendVerificationEmailAction() {
    await this.props.resendVerificationEmail();
    Alert.alert(
      'Verify email',
      "We've sent you an email to verify your email address. Just click on " +
        'the link in the email to complete the verification process.',
      undefined,
      { cancelable: true },
    );
  }

  navigateIfActive(name) {
    this.props.navigation.navigate({ name });
  }

  onPressEditEmail = () => {
    this.navigateIfActive(EditEmailRouteName);
  };

  onPressEditPassword = () => {
    this.navigateIfActive(EditPasswordRouteName);
  };

  onPressDeleteAccount = () => {
    this.navigateIfActive(DeleteAccountRouteName);
  };

  onPressBuildInfo = () => {
    this.navigateIfActive(BuildInfoRouteName);
  };

  onPressDevTools = () => {
    this.navigateIfActive(DevToolsRouteName);
  };

  onPressAppearance = () => {
    this.navigateIfActive(AppearancePreferencesRouteName);
  };

  onPressFriendList = () => {
    this.navigateIfActive(FriendListRouteName);
  };

  onPressBlockList = () => {
    this.navigateIfActive(BlockListRouteName);
  };
}

const unboundStyles = {
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  deleteAccountButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  deleteAccountText: {
    color: 'redText',
    flex: 1,
    fontSize: 16,
  },
  editEmailButton: {
    paddingTop: Platform.OS === 'android' ? 9 : 7,
  },
  editPasswordButton: {
    paddingTop: Platform.OS === 'android' ? 3 : 2,
  },
  emailNotVerified: {
    color: 'redText',
  },
  emailVerified: {
    color: 'greenText',
  },
  header: {
    color: 'panelBackgroundLabel',
    fontSize: 12,
    fontWeight: '400',
    paddingBottom: 3,
    paddingHorizontal: 24,
  },
  label: {
    color: 'panelForegroundTertiaryLabel',
    fontSize: 16,
    paddingRight: 12,
  },
  loggedInLabel: {
    color: 'panelForegroundTertiaryLabel',
    fontSize: 16,
  },
  logOutText: {
    color: 'link',
    fontSize: 16,
    paddingLeft: 6,
  },
  resendVerificationEmailButton: {
    flexDirection: 'row',
    paddingRight: 1,
  },
  resendVerificationEmailSpinner: {
    marginTop: Platform.OS === 'ios' ? -4 : 0,
    paddingHorizontal: 4,
  },
  resendVerificationEmailText: {
    color: 'link',
    fontStyle: 'italic',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrollView: {
    backgroundColor: 'panelBackground',
  },
  scrollViewContentContainer: {
    paddingTop: 24,
  },
  section: {
    backgroundColor: 'panelForeground',
    borderBottomWidth: 1,
    borderColor: 'panelForegroundBorder',
    borderTopWidth: 1,
    marginBottom: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  slightlyPaddedSection: {
    backgroundColor: 'panelForeground',
    borderBottomWidth: 1,
    borderColor: 'panelForegroundBorder',
    borderTopWidth: 1,
    marginBottom: 24,
    paddingVertical: 2,
  },
  submenuButton: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  submenuText: {
    color: 'panelForegroundLabel',
    flex: 1,
    fontSize: 16,
  },
  unpaddedSection: {
    backgroundColor: 'panelForeground',
    borderBottomWidth: 1,
    borderColor: 'panelForegroundBorder',
    borderTopWidth: 1,
    marginBottom: 24,
  },
  username: {
    color: 'panelForegroundLabel',
    flex: 1,
  },
  value: {
    color: 'panelForegroundLabel',
    fontSize: 16,
    textAlign: 'right',
  },
  verification: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    height: 20,
  },
  verificationSection: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    height: 20,
  },
  verificationText: {
    color: 'panelForegroundLabel',
    fontSize: 13,
    fontStyle: 'italic',
  },
};

const logOutLoadingStatusSelector = createLoadingStatusSelector(
  logOutActionTypes,
);
const resendVerificationLoadingStatusSelector = createLoadingStatusSelector(
  resendVerificationEmailActionTypes,
);

export default React.memo<BaseProps>(function ConnectedMoreScreen(
  props: BaseProps,
) {
  const currentUserInfo = useSelector(state => state.currentUserInfo);
  const preRequestUserState = useSelector(preRequestUserStateSelector);
  const resendVerificationLoading =
    useSelector(resendVerificationLoadingStatusSelector) === 'loading';
  const logOutLoading = useSelector(logOutLoadingStatusSelector) === 'loading';
  const colors = useColors();
  const styles = useStyles(unboundStyles);
  const callLogOut = useServerCall(logOut);
  const callResendVerificationEmail = useServerCall(resendVerificationEmail);
  const dispatchActionPromise = useDispatchActionPromise();

  return (
    <MoreScreen
      {...props}
      currentUserInfo={currentUserInfo}
      preRequestUserState={preRequestUserState}
      resendVerificationLoading={resendVerificationLoading}
      logOutLoading={logOutLoading}
      colors={colors}
      styles={styles}
      logOut={callLogOut}
      resendVerificationEmail={callResendVerificationEmail}
      dispatchActionPromise={dispatchActionPromise}
    />
  );
});
