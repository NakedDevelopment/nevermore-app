import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalDeliveryTimeFromDate,
  getTriggerDateForMessageDay,
  getRemainingMessageDays,
} from './dailyPushSchedule';

describe('dailyPushSchedule', () => {
  it('uses same local hour/minute from opt-in', () => {
    const optedInAt = new Date('2026-06-01T15:42:00');
    assert.deepEqual(getLocalDeliveryTimeFromDate(optedInAt), { hour: 15, minute: 42 });
  });

  it('schedules day 1 later today when delivery time is still ahead', () => {
    const optedInAt = new Date('2026-06-01T09:00:00');
    const delivery = { hour: 18, minute: 0 };
    const trigger = getTriggerDateForMessageDay(optedInAt, 1, delivery);
    assert.equal(trigger.getDate(), 1);
    assert.equal(trigger.getHours(), 18);
  });

  it('schedules day 1 tomorrow when delivery time already passed', () => {
    const optedInAt = new Date('2026-06-01T20:00:00');
    const delivery = { hour: 9, minute: 0 };
    const trigger = getTriggerDateForMessageDay(optedInAt, 1, delivery);
    assert.equal(trigger.getDate(), 2);
    assert.equal(trigger.getHours(), 9);
  });

  it('spaces day 40 forty days after day 1 fire', () => {
    const optedInAt = new Date('2026-06-01T08:00:00');
    const delivery = getLocalDeliveryTimeFromDate(optedInAt);
    const day1 = getTriggerDateForMessageDay(optedInAt, 1, delivery);
    const day40 = getTriggerDateForMessageDay(optedInAt, 40, delivery);
    const diffDays = Math.round((day40.getTime() - day1.getTime()) / (24 * 60 * 60 * 1000));
    assert.equal(diffDays, 39);
  });

  it('lists remaining days in order', () => {
    assert.deepEqual(getRemainingMessageDays(38), [38, 39, 40]);
    assert.deepEqual(getRemainingMessageDays(41), []);
  });
});