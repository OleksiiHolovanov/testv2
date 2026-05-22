const SPREADSHEET_ID = '1PBXHR02Yx05XkBjFI0llBZJiwy7UnFv3GOZfN_KNax4';
const SHEET_NAME = 'Leads';
const PUBLIC_FORM_KEY = 'goldtrail-social-v1-public-2026-05';
const MAX_PAYLOAD_LENGTH = 18000;

const HEADERS = [
  'Timestamp',
  'Event Type',
  'Brand',
  'Source',
  'Version',
  'Email',
  'Password Provided',
  'First Name',
  'Last Name',
  'Birth Month',
  'Birth Day',
  'Birth Year',
  'City',
  'Postal Code',
  'State',
  'Address',
  'Phone',
  'Terms Accepted',
  'Privacy Accepted',
  'Offer',
  'Package Name',
  'Package Price',
  'Package Coins',
  'User Signed In',
  'Client Timestamp',
  'Password Hash',
  'Password Salt',
  'Auth Method',
  'Login Status'
];

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};

  if (params.payload) {
    const result = handlePayload_(params.payload);
    if (params.transport === 'iframe') return iframeResponse_(result);
    return jsonpResponse_(result, params.callback);
  }

  return jsonResponse_({
    type: 'goldtrail-sheet-result',
    requestId: '',
    success: true,
    message: 'GoldTrail Social service is active.'
  });
}

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  const rawPayload = params.payload
    ? params.payload
    : e && e.postData && e.postData.contents
      ? e.postData.contents
      : '{}';

  const result = handlePayload_(rawPayload);
  if (params.transport === 'iframe') return iframeResponse_(result);
  return jsonResponse_(result);
}

function handlePayload_(rawPayload) {
  let requestId = '';
  let lock = null;

  try {
    if (!rawPayload || String(rawPayload).length > MAX_PAYLOAD_LENGTH) {
      throw publicError_('Request rejected.');
    }

    const data = JSON.parse(rawPayload || '{}');
    requestId = safeCell_(data.requestId, 80);
    validatePayload_(data);

    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateSheet_(spreadsheet);
    ensureHeaders_(sheet);

    const eventType = safeCell_(data.event_type, 40);

    if (eventType === 'login_lookup') {
      const account = findLatestAccount_(sheet, safeEmail_(data.email));
      if (!account) throw publicError_('Account was not found. Create an account first.');
      return {
        type: 'goldtrail-sheet-result',
        requestId: requestId,
        success: true,
        message: 'Account is ready.',
        password_salt: account.passwordSalt,
        auth_method: account.authMethod || 'pbkdf2-sha256-120k'
      };
    }

    if (eventType === 'login_check') {
      rateLimit_(data);
      const account = findLatestAccount_(sheet, safeEmail_(data.email));
      if (!account) throw publicError_('Account was not found. Create an account first.');
      if (account.passwordHash !== safeCell_(data.password_hash, 200)) {
        appendRow_(sheet, data, 'failed');
        throw publicError_('Login failed. Check your email and password.');
      }
      appendRow_(sheet, data, 'success');
      return {
        type: 'goldtrail-sheet-result',
        requestId: requestId,
        success: true,
        message: 'Login confirmed.',
        account: publicAccount_(account)
      };
    }

    rateLimit_(data);
    appendRow_(sheet, data, eventType === 'registration' ? 'created' : '');

    const response = {
      type: 'goldtrail-sheet-result',
      requestId: requestId,
      success: true,
      message: 'Saved'
    };

    if (eventType === 'registration') {
      response.account = publicAccount_({
        email: safeEmail_(data.email),
        firstName: safeCell_(data.firstName, 80),
        lastName: safeCell_(data.lastName, 80),
        city: safeCell_(data.city, 80),
        state: safeCell_(data.state, 3),
        passwordHash: safeCell_(data.password_hash, 200),
        passwordSalt: safeCell_(data.password_salt, 80),
        authMethod: safeCell_(data.auth_method, 80)
      });
    }

    return response;
  } catch (error) {
    Logger.log(error && error.stack ? error.stack : String(error));
    return {
      type: 'goldtrail-sheet-result',
      requestId: requestId,
      success: false,
      message: error && error.publicMessage ? error.publicMessage : 'Request could not be saved. Please check the form and try again.'
    };
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

function validatePayload_(data) {
  if (data.form_key !== PUBLIC_FORM_KEY) throw publicError_('Request rejected.');

  const eventType = safeCell_(data.event_type, 40);
  if (['registration', 'purchase_intent', 'debug_test', 'login_lookup', 'login_check'].indexOf(eventType) === -1) {
    throw publicError_('Request rejected.');
  }

  const email = safeEmail_(data.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw publicError_('Enter a valid email address.');

  if (eventType === 'registration') {
    if (!data.termsAccepted || !data.privacyAccepted) throw publicError_('Required consent is missing.');
    if (!safeCell_(data.firstName, 80) || !safeCell_(data.lastName, 80)) throw publicError_('Required name fields are missing.');
    if (!isAdult_(data.birthMonth, data.birthDay, data.birthYear)) throw publicError_('You must be at least 18 years old.');
    if (!safeCell_(data.city, 80) || !safeCell_(data.state, 3) || !safeCell_(data.address, 160)) throw publicError_('Required address fields are missing.');
    if (safeDigits_(data.postalCode, 9).length < 5) throw publicError_('Enter a valid ZIP code.');
    if (safeDigits_(data.phone, 20).replace(/^1/, '').length < 10) throw publicError_('Enter a valid US phone number.');
    if (!isValidPasswordHash_(data.password_hash) || !isValidSalt_(data.password_salt)) throw publicError_('Password hash is missing.');
  }

  if (eventType === 'login_check') {
    if (!isValidPasswordHash_(data.password_hash)) throw publicError_('Login failed. Check your email and password.');
  }
}

function appendRow_(sheet, data, loginStatus) {
  sheet.appendRow([
    new Date(),
    safeCell_(data.event_type, 40),
    safeCell_(data.brand, 80),
    safeCell_(data.source, 80),
    safeCell_(data.version, 80),
    safeEmail_(data.email),
    data.password_provided ? 'yes' : 'no',
    safeCell_(data.firstName, 80),
    safeCell_(data.lastName, 80),
    safeDigits_(data.birthMonth, 2),
    safeDigits_(data.birthDay, 2),
    safeDigits_(data.birthYear, 4),
    safeCell_(data.city, 80),
    safeDigits_(data.postalCode, 9),
    safeCell_(data.state, 3),
    safeCell_(data.address, 160),
    safePhone_(data.phone),
    data.termsAccepted ? 'yes' : 'no',
    data.privacyAccepted ? 'yes' : 'no',
    safeCell_(data.offer, 120),
    safeCell_(data.packageName, 80),
    safeCell_(data.packagePrice, 20),
    safeCell_(data.packageCoins, 80),
    data.user_signed_in || loginStatus === 'success' ? 'yes' : 'no',
    safeCell_(data.timestamp_client, 40),
    safeCell_(data.password_hash, 200),
    safeCell_(data.password_salt, 80),
    safeCell_(data.auth_method, 80),
    safeCell_(loginStatus, 40)
  ]);
}

function findLatestAccount_(sheet, email) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = values[0].map(String);
  const index = {};
  headers.forEach(function (name, i) { index[name] = i; });

  const emailCol = index['Email'];
  const eventCol = index['Event Type'];
  const hashCol = index['Password Hash'];
  const saltCol = index['Password Salt'];
  if (emailCol === undefined || eventCol === undefined || hashCol === undefined || saltCol === undefined) return null;

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const row = values[rowIndex];
    if (safeEmail_(row[emailCol]) !== email) continue;
    if (String(row[eventCol] || '') !== 'registration') continue;
    if (!row[hashCol] || !row[saltCol]) continue;
    return {
      email: safeEmail_(row[emailCol]),
      firstName: valueFromRow_(row, index, 'First Name'),
      lastName: valueFromRow_(row, index, 'Last Name'),
      city: valueFromRow_(row, index, 'City'),
      state: valueFromRow_(row, index, 'State'),
      passwordHash: String(row[hashCol] || ''),
      passwordSalt: String(row[saltCol] || ''),
      authMethod: valueFromRow_(row, index, 'Auth Method') || 'pbkdf2-sha256-120k'
    };
  }
  return null;
}

function publicAccount_(account) {
  return {
    email: safeEmail_(account.email),
    firstName: safeCell_(account.firstName, 80) || 'Player',
    lastName: safeCell_(account.lastName, 80),
    city: safeCell_(account.city, 80),
    state: safeCell_(account.state, 3),
    balances: { goldCoins: 30, sweepsCoins: 2 },
    offerClaimed: true
  };
}

function valueFromRow_(row, index, header) {
  return index[header] === undefined ? '' : String(row[index[header]] || '');
}

function rateLimit_(data) {
  const eventType = safeCell_(data.event_type, 40);
  if (eventType === 'debug_test' || eventType === 'login_lookup') return;
  const email = safeEmail_(data.email);
  const phone = safeDigits_(data.phone, 20);
  const source = eventType + '|' + email + '|' + phone;
  const digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source)).slice(0, 36);
  const key = 'gt_rate_' + digest;
  const cache = CacheService.getScriptCache();
  if (cache.get(key)) throw publicError_('Please wait before sending another request.');
  cache.put(key, '1', 20);
}

function isAdult_(month, day, year) {
  const m = Number(safeDigits_(month, 2));
  const d = Number(safeDigits_(day, 2));
  const y = Number(safeDigits_(year, 4));
  if (!m || !d || !y || y < 1900) return false;
  const dob = new Date(y, m - 1, d);
  if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d) return false;
  const now = new Date();
  let age = now.getFullYear() - y;
  const mdiff = now.getMonth() - (m - 1);
  if (mdiff < 0 || (mdiff === 0 && now.getDate() < d)) age -= 1;
  return age >= 18;
}

function getOrCreateSheet_(spreadsheet) {
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders_(sheet) {
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
}

function isValidPasswordHash_(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ''));
}

function isValidSalt_(value) {
  return /^[a-f0-9]{16,80}$/i.test(String(value || ''));
}

function safeCell_(value, maxLength) {
  if (value === null || value === undefined) return '';
  let output = String(value)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, maxLength || 160);

  // Prevent formula injection in exported data.
  if (/^[=+\-@]/.test(output)) output = "'" + output;
  return output;
}

function safeEmail_(value) {
  return safeCell_(String(value || '').toLowerCase(), 254);
}

function safeDigits_(value, maxLength) {
  return String(value || '').replace(/\D+/g, '').slice(0, maxLength || 20);
}

function safePhone_(value) {
  const digits = safeDigits_(value, 20);
  if (!digits) return '';
  return digits.charAt(0) === '1' ? '+' + digits : '+1' + digits.slice(0, 10);
}

function safeCallbackName_(name) {
  const value = String(name || '').trim();
  const isValid = /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(value);
  return isValid ? value : '';
}

function jsonpResponse_(payload, callback) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const callbackName = safeCallbackName_(callback);
  const output = callbackName ? callbackName + '(' + json + ');' : json;

  return ContentService
    .createTextOutput(output)
    .setMimeType(callbackName ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function iframeResponse_(payload) {
  const json = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/-->/g, '--\\>');

  const html = '<!doctype html><html><body>' +
    '<script>' +
    '(function(){' +
    'var payload=' + json + ';' +
    'if(window.parent){window.parent.postMessage(payload,"*");}' +
    '})();' +
    '</script>' +
    '</body></html>';

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload).replace(/</g, '\\u003c'))
    .setMimeType(ContentService.MimeType.JSON);
}

function publicError_(message) {
  const error = new Error(message);
  error.publicMessage = message;
  return error;
}
