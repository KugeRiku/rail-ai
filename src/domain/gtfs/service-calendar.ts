export type ServiceCalendar = {
  serviceId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  startDate: string;
  endDate: string;
};

export type ServiceException = {
  serviceId: string;
  date: string;
  exceptionType: 1 | 2;
};

const WEEKDAYS: Array<keyof Pick<
  ServiceCalendar,
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
>> = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function compactDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function weekdayIndex(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getActiveServiceIds(
  isoDate: string,
  calendars: ServiceCalendar[],
  exceptions: ServiceException[],
): Set<string> {
  const date = compactDate(isoDate);
  const weekday = WEEKDAYS[weekdayIndex(isoDate)];
  const active = new Set(
    calendars
      .filter(
        (calendar) =>
          calendar.startDate <= date &&
          date <= calendar.endDate &&
          calendar[weekday],
      )
      .map((calendar) => calendar.serviceId),
  );

  for (const exception of exceptions) {
    if (exception.date !== date) {
      continue;
    }

    if (exception.exceptionType === 1) {
      active.add(exception.serviceId);
    } else {
      active.delete(exception.serviceId);
    }
  }

  return active;
}
