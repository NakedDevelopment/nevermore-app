import { DAILY_PUSH_COUNT } from '../constants/dailyPushMessages';

export type LocalDeliveryTime = {
  hour: number;
  minute: number;
};

export function getLocalDeliveryTimeFromDate(date: Date): LocalDeliveryTime {
  return { hour: date.getHours(), minute: date.getMinutes() };
}

function getDay1Trigger(optedInAt: Date, delivery: LocalDeliveryTime): Date {
  const trigger = new Date(optedInAt);
  trigger.setHours(delivery.hour, delivery.minute, 0, 0);
  if (trigger.getTime() <= optedInAt.getTime()) {
    trigger.setDate(trigger.getDate() + 1);
  }
  return trigger;
}

/** Next calendar fire time for day index (1-based); day 1 is the next occurrence of local time (today if still ahead, else tomorrow). */
export function getTriggerDateForMessageDay(
  optedInAt: Date,
  messageDay: number,
  delivery: LocalDeliveryTime
): Date {
  if (messageDay < 1 || messageDay > DAILY_PUSH_COUNT) {
    throw new RangeError(`messageDay must be 1..${DAILY_PUSH_COUNT}`);
  }

  const day1 = getDay1Trigger(optedInAt, delivery);
  const trigger = new Date(day1);
  trigger.setDate(day1.getDate() + (messageDay - 1));
  return trigger;
}

/** Based on wall clock, which message day should fire next (41 = sequence complete). */
export function getNextMessageDayFromClock(
  optedInAt: Date,
  delivery: LocalDeliveryTime,
  now: Date = new Date()
): number {
  for (let day = 1; day <= DAILY_PUSH_COUNT; day++) {
    const fire = getTriggerDateForMessageDay(optedInAt, day, delivery);
    if (fire.getTime() > now.getTime()) {
      return day;
    }
  }
  return DAILY_PUSH_COUNT + 1;
}

export function getRemainingMessageDays(nextMessageDay: number): number[] {
  if (nextMessageDay < 1) return [];
  if (nextMessageDay > DAILY_PUSH_COUNT) return [];
  return Array.from({ length: DAILY_PUSH_COUNT - nextMessageDay + 1 }, (_, i) => nextMessageDay + i);
}