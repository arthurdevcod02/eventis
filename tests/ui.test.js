import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFCFA, esc, timeAgoFR, REQUEST_STATUS } from '../assets/js/core/ui.js';

test('formatFCFA', () => {
  assert.equal(formatFCFA(250000), '250 000 FCFA');
  assert.equal(formatFCFA(60), '60 FCFA');
});

test('esc neutralise le HTML', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(esc('"guillemets" & ampersand'), '&quot;guillemets&quot; &amp; ampersand');
});

test('timeAgoFR', () => {
  const threeDays = new Date(Date.now() - 3 * 86400000).toISOString();
  assert.equal(timeAgoFR(threeDays), 'il y a 3 j');
  assert.equal(timeAgoFR(new Date().toISOString()), 'à l’instant');
});

test('REQUEST_STATUS couvre les 5 statuts en français', () => {
  assert.deepEqual(Object.keys(REQUEST_STATUS).sort(),
    ['accepted', 'closed', 'declined', 'in_progress', 'sent']);
  assert.equal(REQUEST_STATUS.sent.label, 'Envoyée');
});
