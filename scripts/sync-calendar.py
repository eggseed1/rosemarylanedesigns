"""Publish only display fields from the public Google calendar; no credentials needed."""
from datetime import date, datetime, time, timedelta, timezone
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo
import json
import sys
import time as clock

import icalendar
import recurring_ical_events

TZ = ZoneInfo('America/New_York')
FEED = 'https://calendar.google.com/calendar/ical/lovemsg69%40gmail.com/public/basic.ics'
PREVIOUS = 'https://rosemarylanedesigns.com/data/calendar.json'
SOURCE = 'rosemary-lane-google-calendar-v1'
OUTPUT = Path('data/calendar.json')
MAX_BYTES = 8_000_000


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        if tag in ('br', 'p', 'div', 'li') and not self.skip:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style') and self.skip:
            self.skip -= 1
        if tag in ('p', 'div', 'li') and not self.skip:
            self.parts.append('\n')

    def handle_data(self, value):
        if not self.skip:
            self.parts.append(value)


def plain(value, limit=6000):
    parser = PlainText()
    parser.feed(str(value or ''))
    return '\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())[:limit]


def month_start(today, offset):
    index = today.year * 12 + today.month - 1 + offset
    return date(index // 12, index % 12 + 1, 1)


def aware(value):
    if not isinstance(value, datetime):
        return datetime.combine(value, time.min, TZ)
    return (value if value.tzinfo else value.replace(tzinfo=TZ)).astimezone(TZ)


def build_calendar(raw, now=None):
    now = now or datetime.now(TZ)
    first, last = month_start(now.date(), -1), month_start(now.date(), 13)
    if not raw.lstrip().startswith(b'BEGIN:VCALENDAR') or b'END:VCALENDAR' not in raw:
        raise ValueError('The public feed did not return a complete iCalendar file')
    calendar = icalendar.Calendar.from_ical(raw)
    events = []
    seen = set()
    for event in recurring_ical_events.of(calendar).between(aware(first), aware(last)):
        if str(event.get('STATUS', '')).upper() == 'CANCELLED':
            continue
        if str(event.get('CLASS', '')).upper() in ('PRIVATE', 'CONFIDENTIAL'):
            continue
        start = event.decoded('DTSTART')
        all_day = not isinstance(start, datetime)
        end = event.decoded('DTEND', None)
        if end is None:
            end = start + event.decoded('DURATION', timedelta(days=1) if all_day else timedelta(0))
        start_dt, end_dt = aware(start), aware(end)
        if end_dt < start_dt:
            raise ValueError('An event ends before its start')
        if end_dt <= aware(first) or start_dt >= aware(last):
            continue
        end_day = (end_dt - timedelta(microseconds=1)).date() if end_dt > start_dt else start_dt.date()
        identifier = sha256((str(event.get('UID', '')) + start_dt.isoformat()).encode()).hexdigest()[:24]
        if identifier in seen:
            continue
        seen.add(identifier)
        events.append({
            'id': identifier,
            'title': plain(event.get('SUMMARY', ''), 300) or 'Rosemary Lane event',
            'description': plain(event.get('DESCRIPTION', '')),
            'location': plain(event.get('LOCATION', ''), 1000),
            'allDay': all_day,
            'start': start.isoformat() if all_day else start_dt.isoformat(),
            'end': end.isoformat() if all_day else end_dt.isoformat(),
            'startDate': start_dt.date().isoformat(),
            'lastDate': end_day.isoformat(),
        })
    events.sort(key=lambda e: (e['startDate'], not e['allDay'], e['start'], e['title']))
    return {'schemaVersion': 1, 'source': SOURCE, 'timeZone': str(TZ), 'status': 'ok',
            'updatedAt': now.astimezone(timezone.utc).isoformat(),
            'rangeStart': first.isoformat(), 'rangeEnd': last.isoformat(), 'events': events}


def download(url):
    request = Request(url, headers={'User-Agent': 'RosemaryLaneCalendar/1.0', 'Accept': 'text/calendar, application/json'})
    with urlopen(request, timeout=30) as response:
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError('Calendar response is too large')
    return data


def run():
    error = None
    data = None
    for attempt in range(3):
        try:
            data = build_calendar(download(FEED))
            break
        except Exception as exc:
            error = exc
            if isinstance(exc, HTTPError) and exc.code in (401, 403, 404):
                break
            if attempt < 2:
                clock.sleep(2 * (attempt + 1))
    if data is None:
        # Revoked/publicly unavailable feeds must not keep old events on the site.
        revoked = isinstance(error, HTTPError) and error.code in (401, 403, 404)
        data = build_calendar(b'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n')
        data['status'] = 'unavailable'
        data['updatedAt'] = None
        if not revoked:
            try:
                previous = json.loads(download(PREVIOUS))
                age = datetime.now(timezone.utc) - datetime.fromisoformat(previous['updatedAt'])
                if (previous.get('source') == SOURCE and previous.get('schemaVersion') == 1
                        and isinstance(previous.get('events'), list) and timedelta(0) <= age <= timedelta(days=7)):
                    data = previous
                    data['status'] = 'stale'
            except Exception:
                pass
        print(f'::warning::Calendar sync failed ({type(error).__name__}); display status: {data["status"]}. Check public sharing if this persists.')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(OUTPUT)
    print(f'Calendar: {len(data["events"])} public occurrences; status={data["status"]}; time zone={TZ}')
    return data


if __name__ == '__main__':
    run()
