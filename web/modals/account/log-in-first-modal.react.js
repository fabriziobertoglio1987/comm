// @flow

import * as React from 'react';

import css from '../../style.css';
import Modal from '../modal.react';
import LogInModal from './log-in-modal.react';
import RegisterModal from './register-modal.react';

type Props = {|
  +inOrderTo: string,
  +setModal: (modal: ?React.Node) => void,
|};
class LogInFirstModal extends React.PureComponent<Props> {
  render(): React.Node {
    return (
      <Modal name="Log in or register" onClose={this.clearModal}>
        <div className={css['modal-body']}>
          <p>
            {`In order to ${this.props.inOrderTo}, you'll first need to `}
            <a
              href="#"
              className={css['show-login-modal']}
              onClick={this.onClickLogIn}
            >
              log in
            </a>
            {' or '}
            <a
              href="#"
              className={css['show-register-modal']}
              onClick={this.onClickRegister}
            >
              register
            </a>
            {' a new account.'}
          </p>
        </div>
      </Modal>
    );
  }

  clearModal: () => void = () => {
    this.props.setModal(null);
  };

  onClickLogIn: (event: SyntheticEvent<HTMLAnchorElement>) => void = event => {
    event.preventDefault();
    this.props.setModal(<LogInModal setModal={this.props.setModal} />);
  };

  onClickRegister: (event: SyntheticEvent<HTMLAnchorElement>) => void = event => {
    event.preventDefault();
    this.props.setModal(<RegisterModal setModal={this.props.setModal} />);
  };
}

export default LogInFirstModal;
