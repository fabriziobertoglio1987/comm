// @flow

import invariant from 'invariant';
import React from 'react';
import {
  Alert,
  StyleSheet,
  Keyboard,
  View,
  Text,
  Platform,
} from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/FontAwesome';

import {
  resetPasswordActionTypes,
  resetPassword,
} from 'lib/actions/user-actions';
import { createLoadingStatusSelector } from 'lib/selectors/loading-selectors';
import type {
  UpdatePasswordInfo,
  LogInExtraInfo,
  LogInResult,
  LogInStartingPayload,
} from 'lib/types/account-types';
import type { LoadingStatus } from 'lib/types/loading-types';
import {
  useServerCall,
  useDispatchActionPromise,
  type DispatchActionPromise,
} from 'lib/utils/action-utils';

import { NavContext } from '../navigation/navigation-context';
import { useSelector } from '../redux/redux-utils';
import { nativeLogInExtraInfoSelector } from '../selectors/account-selectors';
import { TextInput } from './modal-components.react';
import { PanelButton, Panel } from './panel-components.react';

type BaseProps = {|
  +verifyCode: string,
  +username: string,
  +onSuccess: () => Promise<void>,
  +setActiveAlert: (activeAlert: boolean) => void,
  +opacityValue: Animated.Value,
|};
type Props = {|
  ...BaseProps,
  // Redux state
  +loadingStatus: LoadingStatus,
  +logInExtraInfo: () => LogInExtraInfo,
  // Redux dispatch functions
  +dispatchActionPromise: DispatchActionPromise,
  // async functions that hit server APIs
  +resetPassword: (info: UpdatePasswordInfo) => Promise<LogInResult>,
|};
type State = {|
  +passwordInputText: string,
  +confirmPasswordInputText: string,
|};
class ResetPasswordPanel extends React.PureComponent<Props, State> {
  state: State = {
    passwordInputText: '',
    confirmPasswordInputText: '',
  };
  passwordInput: ?TextInput;
  confirmPasswordInput: ?TextInput;
  passwordBeingAutoFilled = false;

  render() {
    let onPasswordKeyPress;
    if (Platform.OS === 'ios') {
      onPasswordKeyPress = this.onPasswordKeyPress;
    }
    return (
      <Panel opacityValue={this.props.opacityValue} style={styles.container}>
        <View>
          <Icon name="user" size={22} color="#777" style={styles.icon} />
          <View style={styles.usernameContainer}>
            <Text style={styles.usernameText}>{this.props.username}</Text>
          </View>
        </View>
        <View>
          <Icon name="lock" size={22} color="#777" style={styles.icon} />
          <TextInput
            style={styles.input}
            value={this.state.passwordInputText}
            onChangeText={this.onChangePasswordInputText}
            onKeyPress={onPasswordKeyPress}
            placeholder="New password"
            autoFocus={true}
            secureTextEntry={true}
            textContentType="password"
            autoCompleteType="password"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={this.focusConfirmPasswordInput}
            editable={this.props.loadingStatus !== 'loading'}
            ref={this.passwordInputRef}
          />
        </View>
        <View>
          <TextInput
            style={styles.input}
            value={this.state.confirmPasswordInputText}
            onChangeText={this.onChangeConfirmPasswordInputText}
            placeholder="Confirm password"
            secureTextEntry={true}
            textContentType="password"
            autoCompleteType="password"
            returnKeyType="go"
            blurOnSubmit={false}
            onSubmitEditing={this.onSubmit}
            editable={this.props.loadingStatus !== 'loading'}
            ref={this.confirmPasswordInputRef}
          />
        </View>
        <PanelButton
          text="RESET PASSWORD"
          loadingStatus={this.props.loadingStatus}
          onSubmit={this.onSubmit}
        />
      </Panel>
    );
  }

  passwordInputRef = (passwordInput: ?TextInput) => {
    this.passwordInput = passwordInput;
  };

  confirmPasswordInputRef = (confirmPasswordInput: ?TextInput) => {
    this.confirmPasswordInput = confirmPasswordInput;
  };

  focusConfirmPasswordInput = () => {
    invariant(this.confirmPasswordInput, 'ref should be set');
    this.confirmPasswordInput.focus();
  };

  onChangePasswordInputText = (text: string) => {
    const stateUpdate = {};
    stateUpdate.passwordInputText = text;
    if (this.passwordBeingAutoFilled) {
      this.passwordBeingAutoFilled = false;
      stateUpdate.confirmPasswordInputText = text;
    }
    this.setState(stateUpdate);
  };

  onPasswordKeyPress = (
    event: $ReadOnly<{ nativeEvent: $ReadOnly<{ key: string }> }>,
  ) => {
    const { key } = event.nativeEvent;
    if (
      key.length > 1 &&
      key !== 'Backspace' &&
      key !== 'Enter' &&
      this.state.confirmPasswordInputText.length === 0
    ) {
      this.passwordBeingAutoFilled = true;
    }
  };

  onChangeConfirmPasswordInputText = (text: string) => {
    this.setState({ confirmPasswordInputText: text });
  };

  onSubmit = () => {
    this.props.setActiveAlert(true);
    if (this.state.passwordInputText === '') {
      Alert.alert(
        'Empty password',
        'Password cannot be empty',
        [{ text: 'OK', onPress: this.onPasswordAlertAcknowledged }],
        { cancelable: false },
      );
      return;
    } else if (
      this.state.passwordInputText !== this.state.confirmPasswordInputText
    ) {
      Alert.alert(
        "Passwords don't match",
        'Password fields must contain the same password',
        [{ text: 'OK', onPress: this.onPasswordAlertAcknowledged }],
        { cancelable: false },
      );
      return;
    }
    Keyboard.dismiss();
    const extraInfo = this.props.logInExtraInfo();
    this.props.dispatchActionPromise(
      resetPasswordActionTypes,
      this.resetPasswordAction(extraInfo),
      undefined,
      ({ calendarQuery: extraInfo.calendarQuery }: LogInStartingPayload),
    );
  };

  onPasswordAlertAcknowledged = () => {
    this.props.setActiveAlert(false);
    this.setState(
      {
        passwordInputText: '',
        confirmPasswordInputText: '',
      },
      () => {
        invariant(this.passwordInput, 'ref should exist');
        this.passwordInput.focus();
      },
    );
  };

  async resetPasswordAction(extraInfo: LogInExtraInfo) {
    try {
      const result = await this.props.resetPassword({
        ...extraInfo,
        code: this.props.verifyCode,
        password: this.state.passwordInputText,
      });
      this.props.setActiveAlert(false);
      await this.props.onSuccess();
      return result;
    } catch (e) {
      if (e.message === 'client_version_unsupported') {
        const app = Platform.select({
          ios: 'Testflight',
          android: 'Play Store',
        });
        Alert.alert(
          'App out of date',
          "Your app version is pretty old, and the server doesn't know how " +
            `to speak to it anymore. Please use the ${app} app to update!`,
          [{ text: 'OK', onPress: this.onAppOutOfDateAlertAcknowledged }],
          { cancelable: false },
        );
      } else {
        Alert.alert(
          'Unknown error',
          'Uhh... try again?',
          [{ text: 'OK', onPress: this.onPasswordAlertAcknowledged }],
          { cancelable: false },
        );
        throw e;
      }
    }
  }

  onAppOutOfDateAlertAcknowledged = () => {
    this.props.setActiveAlert(false);
  };
}

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
  },
  icon: {
    bottom: 8,
    left: 4,
    position: 'absolute',
  },
  input: {
    paddingLeft: 35,
  },
  usernameContainer: {
    borderBottomColor: '#BBBBBB',
    borderBottomWidth: 1,
    paddingLeft: 35,
  },
  usernameText: {
    color: '#444',
    fontSize: 20,
    height: 40,
    paddingTop: 8,
  },
});

const loadingStatusSelector = createLoadingStatusSelector(
  resetPasswordActionTypes,
);

export default React.memo<BaseProps>(function ConnectedResetPasswordPanel(
  props: BaseProps,
) {
  const loadingStatus = useSelector(loadingStatusSelector);

  const navContext = React.useContext(NavContext);
  const logInExtraInfo = useSelector(state =>
    nativeLogInExtraInfoSelector({
      redux: state,
      navContext,
    }),
  );

  const dispatchActionPromise = useDispatchActionPromise();
  const callResetPassword = useServerCall(resetPassword);

  return (
    <ResetPasswordPanel
      {...props}
      loadingStatus={loadingStatus}
      logInExtraInfo={logInExtraInfo}
      dispatchActionPromise={dispatchActionPromise}
      resetPassword={callResetPassword}
    />
  );
});
