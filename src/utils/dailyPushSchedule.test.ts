import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_PUSH_DELIVERY_TIME,
  getLocalDeliveryTimeFromDate,
  getTriggerDateForMessageDay,
  getRemainingMessageDays,
} from './dailyPushSchedule';

describe('dailyPushSchedule', () => {
  it('exposes 18:30 as the fixed daily delivery time', () => {
    assert.deepEqual(DAILY_PUSH_DELIVERY_TIME, { hour: 18, minute: 30 });
  });

  it('uses same local hour/minute from opt-in (legacy helper)', () => {
    const optedInAt = new Date('2026-06-01T15:42:00');
    assert.deepEqual(getLocalDeliveryTimeFromDate(optedInAt), { hour: 15, minute: 42 });
  });

  it('schedules day 1 today at 18:30 when opt-in is before 18:30 local', () => {
    const optedInAt = new Date('2026-06-01T17:00:00');
    const trigger = getTriggerDateForMessageDay(optedInAt, 1, DAILY_PUSH_DELIVERY_TIME);
    assert.equal(trigger.getDate(), 1);
    assert.equal(trigger.getMonth(), 5);
    assert.equal(trigger.getHours(), 18);
    assert.equal(trigger.getMinutes(), 30);
  });

  it('schedules day 1 tomorrow at 18:30 when opt-in is after 18:30 local', () => {
    const optedInAt = new Date('2026-06-01T19:15:00');
    const trigger = getTriggerDateForMessageDay(optedInAt, 1, DAILY_PUSH_DELIVERY_TIME);
    assert.equal(trigger.getDate(), 2);
    assert.equal(trigger.getHours(), 18);
    assert.equal(trigger.getMinutes(), 30);
  });

  it('schedules day 1 tomorrow at 18:30 when opt-in is exactly at 18:30 local', () => {
    const optedInAt = new Date('2026-06-01T18:30:00');
    const trigger = getTriggerDateForMessageDay(optedInAt, 1, DAILY_PUSH_DELIVERY_TIME);
    assert.equal(trigger.getDate(), 2);
    assert.equal(trigger.getHours(), 18);
    assert.equal(trigger.getMinutes(), 30);
  });

  it('spaces day 40 thirty-nine calendar days after day 1 fire', () => {
    const optedInAt = new Date('2026-06-01T08:00:00');
    const day1 = getTriggerDateForMessageDay(optedInAt, 1, DAILY_PUSH_DELIVERY_TIME);
    const day40 = getTriggerDateForMessageDay(optedInAt, 40, DAILY_PUSH_DELIVERY_TIME);
    const diffDays = Math.round((day40.getTime() - day1.getTime()) / (24 * 60 * 60 * 1000));
    assert.equal(diffDays, 39);
  });

  it('lists remaining days in order', () => {
    assert.deepEqual(getRemainingMessageDays(38), [38, 39, 40]);
    assert.deepEqual(getRemainingMessageDays(41), []);
  });
});