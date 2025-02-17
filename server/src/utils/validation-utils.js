// @flow

import t from 'tcomb';

import {
  validEmailRegex,
  oldValidUsernameRegex,
} from 'lib/shared/account-utils';
import { ServerError } from 'lib/utils/errors';

import { verifyClientSupported } from '../session/version';
import type { Viewer } from '../session/viewer';

function tBool(value: boolean) {
  return t.irreducible('literal bool', (x) => x === value);
}

function tString(value: string) {
  return t.irreducible('literal string', (x) => x === value);
}

function tShape(spec: { [key: string]: * }) {
  return t.interface(spec, { strict: true });
}

function tRegex(regex: RegExp) {
  return t.refinement(t.String, (val) => regex.test(val));
}

function tNumEnum(nums: $ReadOnlyArray<number>) {
  return t.refinement(t.Number, (input: number) => {
    for (const num of nums) {
      if (input === num) {
        return true;
      }
    }
    return false;
  });
}

const tDate = tRegex(/^[0-9]{4}-[0-1][0-9]-[0-3][0-9]$/);
const tColor = tRegex(/^[a-fA-F0-9]{6}$/); // we don't include # char
const tPlatform = t.enums.of(['ios', 'android', 'web']);
const tDeviceType = t.enums.of(['ios', 'android']);
const tPlatformDetails = tShape({
  platform: tPlatform,
  codeVersion: t.maybe(t.Number),
  stateVersion: t.maybe(t.Number),
});
const tPassword = t.refinement(t.String, (password: string) => password);
const tCookie = tRegex(/^(user|anonymous)=[0-9]+:[0-9a-f]+$/);
const tEmail = tRegex(validEmailRegex);
const tOldValidUsername = tRegex(oldValidUsernameRegex);

async function validateInput(viewer: Viewer, inputValidator: *, input: *) {
  if (!viewer.isSocket) {
    await checkClientSupported(viewer, inputValidator, input);
  }
  checkInputValidator(inputValidator, input);
}

function checkInputValidator(inputValidator: *, input: *) {
  if (!inputValidator || inputValidator.is(input)) {
    return;
  }
  const error = new ServerError('invalid_parameters');
  error.sanitizedInput = input ? sanitizeInput(inputValidator, input) : null;
  throw error;
}

async function checkClientSupported(
  viewer: Viewer,
  inputValidator: *,
  input: *,
) {
  let platformDetails;
  if (inputValidator) {
    platformDetails = findFirstInputMatchingValidator(
      inputValidator,
      tPlatformDetails,
      input,
    );
  }
  if (!platformDetails && inputValidator) {
    const platform = findFirstInputMatchingValidator(
      inputValidator,
      tPlatform,
      input,
    );
    if (platform) {
      platformDetails = { platform };
    }
  }
  if (!platformDetails) {
    ({ platformDetails } = viewer);
  }
  await verifyClientSupported(viewer, platformDetails);
}

const redactedString = '********';
const redactedTypes = [tPassword, tCookie];
function sanitizeInput(inputValidator: *, input: *) {
  if (!inputValidator) {
    return input;
  }
  if (redactedTypes.includes(inputValidator) && typeof input === 'string') {
    return redactedString;
  }
  if (
    inputValidator.meta.kind === 'maybe' &&
    redactedTypes.includes(inputValidator.meta.type) &&
    typeof input === 'string'
  ) {
    return redactedString;
  }
  if (
    inputValidator.meta.kind !== 'interface' ||
    typeof input !== 'object' ||
    !input
  ) {
    return input;
  }
  const result = {};
  for (const key in input) {
    const value = input[key];
    const validator = inputValidator.meta.props[key];
    result[key] = sanitizeInput(validator, value);
  }
  return result;
}

function findFirstInputMatchingValidator(
  wholeInputValidator: *,
  inputValidatorToMatch: *,
  input: *,
): any {
  if (!wholeInputValidator || input === null || input === undefined) {
    return null;
  }
  if (
    wholeInputValidator === inputValidatorToMatch &&
    wholeInputValidator.is(input)
  ) {
    return input;
  }
  if (wholeInputValidator.meta.kind === 'maybe') {
    return findFirstInputMatchingValidator(
      wholeInputValidator.meta.type,
      inputValidatorToMatch,
      input,
    );
  }
  if (
    wholeInputValidator.meta.kind === 'interface' &&
    typeof input === 'object'
  ) {
    for (const key in input) {
      const value = input[key];
      const validator = wholeInputValidator.meta.props[key];
      const innerResult = findFirstInputMatchingValidator(
        validator,
        inputValidatorToMatch,
        value,
      );
      if (innerResult) {
        return innerResult;
      }
    }
  }
  if (wholeInputValidator.meta.kind === 'union') {
    for (const validator of wholeInputValidator.meta.types) {
      if (validator.is(input)) {
        return findFirstInputMatchingValidator(
          validator,
          inputValidatorToMatch,
          input,
        );
      }
    }
  }
  if (wholeInputValidator.meta.kind === 'list' && Array.isArray(input)) {
    const validator = wholeInputValidator.meta.type;
    for (const value of input) {
      const innerResult = findFirstInputMatchingValidator(
        validator,
        inputValidatorToMatch,
        value,
      );
      if (innerResult) {
        return innerResult;
      }
    }
  }
  return null;
}

export {
  tBool,
  tString,
  tShape,
  tRegex,
  tNumEnum,
  tDate,
  tColor,
  tPlatform,
  tDeviceType,
  tPlatformDetails,
  tPassword,
  tCookie,
  tEmail,
  tOldValidUsername,
  validateInput,
  checkInputValidator,
  checkClientSupported,
};
