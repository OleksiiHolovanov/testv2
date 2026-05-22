(function () {
  'use strict';

  const CFG = window.GT_CONFIG || {};
  const US_STATES = [
    ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
    ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'],
    ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
    ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
    ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
    ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
    ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
    ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
    ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
    ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
    ['DC', 'District of Columbia']
  ];

  function qs(selector, root = document) { return root.querySelector(selector); }
  function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function text(el, value) { if (el) el.textContent = value; }
  function sitePath(path) {
    const parts = location.pathname.split('/').filter(Boolean);
    const isNested = parts.length > 0 && !/index\.html$/i.test(parts[parts.length - 1] || '');
    return (isNested ? '../' : '') + path;
  }

  function setBrandContent() {
    qsa('[data-brand]').forEach((el) => text(el, CFG.brand || 'GoldTrail Social'));
    qsa('[data-main-offer]').forEach((el) => text(el, CFG.mainOffer || 'Begin the trail with 30 Coins for just $10'));
    qsa('[data-form-offer]').forEach((el) => text(el, CFG.formOffer || 'Join the journey & claim 200,000 GC + 2 SC'));
    qsa('[data-support-email]').forEach((el) => {
      text(el, CFG.supportEmail || 'support@example.com');
      if (el.tagName === 'A') el.href = `mailto:${CFG.supportEmail}`;
    });
    qsa('[data-year]').forEach((el) => text(el, new Date().getFullYear()));
  }

  function populateStates() {
    qsa('select[data-us-states]').forEach((select) => {
      if (select.options.length > 1) return;
      US_STATES.forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      });
    });
  }

  function showStatus(el, message, type) {
    if (!el) return;
    el.className = `status-box show ${type || ''}`.trim();
    el.textContent = message;
  }

  function clearErrors(root = document) {
    qsa('.input.error, select.error', root).forEach((el) => el.classList.remove('error'));
    qsa('[data-error-for]', root).forEach((el) => { el.textContent = ''; });
  }

  function setError(name, message, root = document) {
    const field = qs(`[name="${name}"]`, root);
    const err = qs(`[data-error-for="${name}"]`, root);
    if (field) field.classList.add('error');
    if (err) err.textContent = message;
  }

  function emailValid(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()); }
  function onlyDigits(value) { return String(value || '').replace(/\D+/g, ''); }
  function cleanText(value, maxLength = 160) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .trim()
      .slice(0, maxLength);
  }
  function cleanEmail(value) { return cleanText(value, 254).toLowerCase(); }
  function normalizeZip(value) { return onlyDigits(value).slice(0, 9); }
  function normalizePhone(value) { return onlyDigits(value).slice(0, 10); }
  function ageFromDob(month, day, year) {
    const m = Number(month), d = Number(day), y = Number(year);
    if (!m || !d || !y) return NaN;
    const dob = new Date(y, m - 1, d);
    if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d) return NaN;
    const now = new Date();
    let age = now.getFullYear() - y;
    const mdiff = now.getMonth() - (m - 1);
    if (mdiff < 0 || (mdiff === 0 && now.getDate() < d)) age -= 1;
    return age;
  }

  function formDataObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function bytesToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function randomHex(byteLength = 16) {
    const bytes = new Uint8Array(byteLength);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function sha256(value) {
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return btoa(unescape(encodeURIComponent(value)));
    const data = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return bytesToHex(hash);
  }

  async function passwordHash(email, password, salt) {
    const normalizedEmail = cleanEmail(email);
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return sha256(`${salt}:${normalizedEmail}:${password}`);
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: new TextEncoder().encode(`${salt}:${normalizedEmail}`),
      iterations: 120000,
      hash: 'SHA-256'
    }, key, 256);
    return bytesToHex(bits);
  }

  function setSession(account) {
    const safeAccount = {
      email: cleanEmail(account && account.email),
      firstName: cleanText(account && account.firstName, 80) || 'Player',
      lastName: cleanText(account && account.lastName, 80),
      state: cleanText(account && account.state, 3),
      city: cleanText(account && account.city, 80),
      balances: {
        goldCoins: Number(account && account.balances && account.balances.goldCoins) || 30,
        sweepsCoins: Number(account && account.balances && account.balances.sweepsCoins) || 2
      },
      offerClaimed: account && account.offerClaimed !== false,
      signedInAt: new Date().toISOString()
    };
    sessionStorage.setItem('gt_session', JSON.stringify(safeAccount));
    return safeAccount;
  }

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem('gt_session') || 'null'); }
    catch (_) { return null; }
  }

  function clearSession() {
    sessionStorage.removeItem('gt_session');
    localStorage.removeItem('gt_session');
    localStorage.removeItem('gt_account');
  }

  function submitAccountRequest(payload, timeoutMs = 22000) {
    return new Promise((resolve, reject) => {
      if (!CFG.googleScriptUrl || !/\/exec\s*$/.test(CFG.googleScriptUrl)) {
        reject(new Error('Account service is temporarily unavailable. Please try again later.'));
        return;
      }

      const requestId = `gt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fullPayload = {
        ...payload,
        requestId,
        brand: CFG.brand,
        version: CFG.version,
        source: CFG.source,
        timestamp_client: new Date().toISOString(),
        form_key: CFG.formPublicKey || ''
      };

      let done = false;
      let script;
      const callbackName = `__gtAccountCallback_${requestId.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      const timer = window.setTimeout(() => {
        cleanup(new Error('Account service did not respond. Check the Apps Script deployment and try again.'));
      }, timeoutMs);

      function cleanup(error, data) {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        if (script && script.parentNode) script.parentNode.removeChild(script);
        if (error) reject(error);
        else resolve(data);
      }

      window[callbackName] = function (data) {
        if (!data || data.type !== 'goldtrail-sheet-result') {
          cleanup(new Error('Account service returned an invalid response.'));
          return;
        }
        if (data.requestId !== requestId) return;
        if (data.success) cleanup(null, data);
        else cleanup(new Error(data.message || 'Your request could not be completed. Please try again.'));
      };

      try {
        const url = new URL(CFG.googleScriptUrl);
        url.searchParams.set('payload', JSON.stringify(fullPayload));
        url.searchParams.set('callback', callbackName);
        url.searchParams.set('_', String(Date.now()));

        script = document.createElement('script');
        script.src = url.toString();
        script.async = true;
        script.onerror = function () {
          cleanup(new Error('Account service could not be reached. Please try again later.'));
        };
        document.head.appendChild(script);
      } catch (error) {
        cleanup(error);
      }
    });
  }

  function safeJsonParse(value) {
    try { return JSON.parse(value); }
    catch (_) { return null; }
  }

  function syncAuthNav() {
    const session = readSession();
    qsa('.nav-actions').forEach((nav) => {
      if (!session || !session.email) return;
      nav.textContent = '';
      const accountLink = document.createElement('a');
      accountLink.className = 'btn btn-secondary btn-small';
      accountLink.href = sitePath('account/');
      accountLink.textContent = 'Account';
      const logout = document.createElement('button');
      logout.className = 'btn btn-ghost btn-small';
      logout.type = 'button';
      logout.textContent = 'Log Out';
      logout.addEventListener('click', () => {
        clearSession();
        window.location.href = sitePath('');
      });
      nav.append(accountLink, logout);
    });
  }

  function initSignup() {
    const form = qs('#signupForm');
    if (!form) return;
    const status = qs('#signupStatus');
    const steps = qsa('[data-step]');
    const dots = qsa('[data-progress-dot]');
    let currentStep = 1;
    let working = false;
    const formStartedAt = Date.now();

    function showStep(step) {
      currentStep = step;
      steps.forEach((panel) => { panel.hidden = Number(panel.dataset.step) !== step; });
      dots.forEach((dot) => {
        const index = Number(dot.dataset.progressDot);
        dot.classList.toggle('active', index === step);
        dot.classList.toggle('done', index < step);
      });
      clearErrors(form);
      if (status) status.className = 'status-box';
    }

    function validateStep(step) {
      clearErrors(form);
      const data = formDataObject(form);
      let ok = true;
      if (step === 1) {
        if (!emailValid(data.email)) { setError('email', 'Enter a valid email address.', form); ok = false; }
        if (!data.password || data.password.length < 8) { setError('password', 'Password must contain at least 8 characters.', form); ok = false; }
        if (!data.termsAccepted) { setError('termsAccepted', 'You must accept Terms & Conditions.', form); ok = false; }
        if (!data.privacyAccepted) { setError('privacyAccepted', 'You must accept the Privacy Policy.', form); ok = false; }
      }
      if (step === 2) {
        if (!data.firstName || data.firstName.trim().length < 2) { setError('firstName', 'Enter your first name.', form); ok = false; }
        if (!data.lastName || data.lastName.trim().length < 2) { setError('lastName', 'Enter your last name.', form); ok = false; }
        const age = ageFromDob(data.birthMonth, data.birthDay, data.birthYear);
        if (!Number.isFinite(age)) { setError('birthYear', 'Enter a valid date of birth.', form); ok = false; }
        else if (age < 18) { setError('birthYear', 'You must be at least 18 years old.', form); ok = false; }
      }
      if (step === 3) {
        if (!data.city || data.city.trim().length < 2) { setError('city', 'Enter your city.', form); ok = false; }
        const zip = normalizeZip(data.postalCode);
        if (zip.length < 5) { setError('postalCode', 'Enter a valid ZIP code.', form); ok = false; }
        if (!data.state) { setError('state', 'Select your state.', form); ok = false; }
        if (!data.address || data.address.trim().length < 4) { setError('address', 'Enter your street address.', form); ok = false; }
        const phone = normalizePhone(data.phone);
        if (phone.length !== 10) { setError('phone', 'Enter a 10-digit US phone number.', form); ok = false; }
      }
      return ok;
    }

    qsa('[data-next-step]', form).forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = Number(btn.dataset.nextStep);
        if (validateStep(currentStep)) showStep(next);
      });
    });

    qsa('[data-prev-step]', form).forEach((btn) => {
      btn.addEventListener('click', () => showStep(Number(btn.dataset.prevStep)));
    });

    const eyeBtn = qs('[data-toggle-password]', form);
    if (eyeBtn) {
      eyeBtn.addEventListener('click', () => {
        const input = qs('input[name="password"]', form);
        input.type = input.type === 'password' ? 'text' : 'password';
        eyeBtn.textContent = input.type === 'password' ? '👁' : '✕';
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (working || !validateStep(3)) return;
      const botCheck = formDataObject(form);
      if (botCheck.website) return;
      if (Date.now() - formStartedAt < 2500) {
        showStatus(status, 'Please review the form before submitting.', 'error');
        return;
      }
      working = true;
      const submitBtn = qs('[type="submit"]', form);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'SAVING...'; }
      showStatus(status, 'Creating your GoldTrail Social account...', '');

      const data = formDataObject(form);
      const email = cleanEmail(data.email);
      const passwordSalt = randomHex(16);
      const passwordHashValue = await passwordHash(email, data.password, passwordSalt);
      const payload = {
        event_type: 'registration',
        email,
        password_provided: true,
        password_hash: passwordHashValue,
        password_salt: passwordSalt,
        auth_method: 'pbkdf2-sha256-120k',
        firstName: cleanText(data.firstName, 80),
        lastName: cleanText(data.lastName, 80),
        birthMonth: cleanText(data.birthMonth, 2),
        birthDay: cleanText(data.birthDay, 2),
        birthYear: cleanText(data.birthYear, 4),
        city: cleanText(data.city, 80),
        postalCode: normalizeZip(data.postalCode),
        state: cleanText(data.state, 3),
        address: cleanText(data.address, 160),
        phone: `+1${normalizePhone(data.phone)}`,
        termsAccepted: true,
        privacyAccepted: true,
        offer: cleanText(CFG.mainOffer, 120)
      };

      try {
        const result = await submitAccountRequest(payload);
        setSession(result.account || payload);
        syncAuthNav();
        form.reset();
        qsa('[data-auth-area]').forEach((el) => { el.style.display = 'none'; });
        qs('#offerScreen')?.classList.add('show');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        showStatus(status, error.message || 'Your account could not be created. Please try again.', 'error');
      } finally {
        working = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'CLAIM REWARD'; }
      }
    });

    showStep(1);
  }

  function initLogin() {
    const form = qs('#loginForm');
    if (!form) return;
    const status = qs('#loginStatus');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(form);
      const data = formDataObject(form);
      const email = cleanEmail(data.email);
      if (!emailValid(email)) { setError('email', 'Enter a valid email address.', form); return; }
      if (!data.password) { setError('password', 'Enter your password.', form); return; }
      const submitBtn = qs('[type="submit"]', form);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'CHECKING...'; }
      showStatus(status, 'Checking your account...', '');
      try {
        const lookup = await submitAccountRequest({ event_type: 'login_lookup', email });
        if (!lookup.password_salt) throw new Error('Account was not found. Create an account first.');
        const hash = await passwordHash(email, data.password, lookup.password_salt);
        const result = await submitAccountRequest({ event_type: 'login_check', email, password_hash: hash, auth_method: lookup.auth_method || 'pbkdf2-sha256-120k' });
        setSession(result.account || { email });
        syncAuthNav();
        showStatus(status, 'Signed in. Opening your account...', 'success');
        setTimeout(() => { window.location.href = '../account/'; }, 450);
      } catch (error) {
        showStatus(status, error.message || 'Login failed. Check your email and password.', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'LOGIN'; }
      }
    });
  }

  function initAccount() {
    const root = qs('[data-account-page]');
    if (!root) return;
    const session = readSession();
    if (!session || !session.email) {
      root.textContent = '';
      const card = document.createElement('div');
      card.className = 'dashboard-card dashboard-card--full';
      const title = document.createElement('h2');
      title.textContent = 'Sign in required';
      const copy = document.createElement('p');
      copy.className = 'section-lead';
      copy.textContent = 'Create an account or sign in to view your GoldTrail Social dashboard.';
      const actions = document.createElement('div');
      actions.className = 'dashboard-actions';
      const loginLink = document.createElement('a');
      loginLink.className = 'btn btn-secondary';
      loginLink.href = '../login/';
      loginLink.textContent = 'Login';
      const createLink = document.createElement('a');
      createLink.className = 'btn btn-primary';
      createLink.href = '../signup/';
      createLink.textContent = 'Create Account';
      actions.append(loginLink, createLink);
      card.append(title, copy, actions);
      root.appendChild(card);
      return;
    }
    text(qs('[data-account-name]'), `${session.firstName || 'Player'} ${session.lastName || ''}`.trim());
    text(qs('[data-account-email]'), session.email);
    text(qs('[data-gold-balance]'), `${session.balances?.goldCoins || 30} GC`);
    text(qs('[data-sweeps-balance]'), `${session.balances?.sweepsCoins || 2} SC`);
    const logout = qs('[data-logout]');
    if (logout) logout.addEventListener('click', () => { clearSession(); location.href = '../'; });
  }

  function initCheckout() {
    const form = qs('#checkoutForm');
    if (!form) return;
    const status = qs('#checkoutStatus');
    const session = readSession();
    const emailInput = qs('input[name="email"]', form);
    if (emailInput && session?.email) emailInput.value = session.email;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(form);
      const data = formDataObject(form);
      if (!emailValid(data.email)) { setError('email', 'Enter a valid email address.', form); return; }
      const submitBtn = qs('[type="submit"]', form);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'SAVING...'; }
      showStatus(status, 'Confirming your starter package...', '');
      try {
        await submitAccountRequest({
          event_type: 'purchase_intent',
          email: cleanEmail(data.email),
          packageName: cleanText(CFG.packageName, 80),
          packagePrice: cleanText(CFG.packagePrice, 20),
          packageCoins: cleanText(CFG.packageCoins, 80),
          user_signed_in: Boolean(session && session.email === cleanEmail(data.email))
        });
        showStatus(status, 'Your starter package request was received. You can return to your account to review your virtual coin balance.', 'success');
      } catch (error) {
        showStatus(status, error.message || 'Your starter package request could not be completed. Please try again.', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'CONFIRM STARTER PACKAGE'; }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setBrandContent();
    populateStates();
    syncAuthNav();
    initSignup();
    initLogin();
    initAccount();
    initCheckout();
  });
})();
