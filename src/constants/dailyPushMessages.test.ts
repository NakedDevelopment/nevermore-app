import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_PUSH_COUNT, DAILY_PUSH_MESSAGES } from './dailyPushMessages';

const BANNED = /\b(alcohol|addiction|relapse|recovery)\b/i;

describe('dailyPushMessages', () => {
  it('defines exactly 40 sequential messages', () => {
    assert.equal(DAILY_PUSH_MESSAGES.length, 40);
    assert.equal(DAILY_PUSH_COUNT, 40);
    DAILY_PUSH_MESSAGES.forEach((msg, index) => {
      assert.equal(msg.day, index + 1);
      assert.ok(msg.title.length > 0);
      assert.ok(msg.body.length > 0);
    });
  });

  it('avoids explicit alcohol/addiction/recovery language in copy', () => {
    for (const msg of DAILY_PUSH_MESSAGES) {
      assert.equal(BANNED.test(msg.title), false, `title day ${msg.day}`);
      assert.equal(BANNED.test(msg.body), false, `body day ${msg.day}`);
    }
  });
});