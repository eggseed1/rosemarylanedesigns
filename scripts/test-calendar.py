"""Regression checks for dates that would otherwise show the wrong public schedule."""
from datetime import datetime
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch
from urllib.error import HTTPError
import json

spec = spec_from_file_location('sync_calendar', Path(__file__).with_name('sync-calendar.py'))
sync = module_from_spec(spec)
spec.loader.exec_module(sync)
NOW = datetime(2026, 10, 26, 12, tzinfo=sync.TZ)


def feed(*events):
    return ('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Calendar tests//EN\r\n' + ''.join(
        'BEGIN:VEVENT\r\nDTSTAMP:20261026T120000Z\r\n' + event.strip().replace('\n', '\r\n') + '\r\nEND:VEVENT\r\n'
        for event in events) + 'END:VCALENDAR\r\n').encode()


class CalendarTests(TestCase):
    def events(self, *values):
        return sync.build_calendar(feed(*values), NOW)['events']

    def test_recurrence_across_daylight_saving_time_and_exclusion(self):
        events = self.events('''UID:weekly
DTSTART;TZID=America/New_York:20261025T140000
DTEND;TZID=America/New_York:20261025T160000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=America/New_York:20261108T140000
SUMMARY:Stitching''')
        self.assertEqual([e['startDate'] for e in events], ['2026-10-25', '2026-11-01', '2026-11-15'])
        self.assertTrue(events[0]['start'].endswith('14:00:00-04:00'))
        self.assertTrue(events[1]['start'].endswith('14:00:00-05:00'))

    def test_moved_and_cancelled_instances(self):
        events = self.events('''UID:series
DTSTART;TZID=America/New_York:20261101T140000
DTEND;TZID=America/New_York:20261101T160000
RRULE:FREQ=WEEKLY;COUNT=3
SUMMARY:Regular''', '''UID:series
RECURRENCE-ID;TZID=America/New_York:20261108T140000
DTSTART;TZID=America/New_York:20261109T150000
DTEND;TZID=America/New_York:20261109T170000
SUMMARY:Moved''', '''UID:series
RECURRENCE-ID;TZID=America/New_York:20261115T140000
DTSTART;TZID=America/New_York:20261115T140000
DTEND;TZID=America/New_York:20261115T160000
STATUS:CANCELLED
SUMMARY:Cancelled''')
        self.assertEqual([e['startDate'] for e in events], ['2026-11-01', '2026-11-09'])
        self.assertEqual(events[-1]['title'], 'Moved')

    def test_all_day_exclusive_end_and_timed_midnight(self):
        events = self.events('''UID:all-day
DTSTART;VALUE=DATE:20261107
DTEND;VALUE=DATE:20261110
SUMMARY:Market''', '''UID:midnight
DTSTART:20261108T030000Z
DTEND:20261108T050000Z
SUMMARY:Evening''')
        all_day = next(e for e in events if e['allDay'])
        timed = next(e for e in events if not e['allDay'])
        self.assertEqual((all_day['start'], all_day['end'], all_day['lastDate']), ('2026-11-07', '2026-11-10', '2026-11-09'))
        self.assertEqual((timed['startDate'], timed['lastDate']), ('2026-11-07', '2026-11-07'))

    def test_private_cancelled_and_contact_fields_are_not_published(self):
        public = '''UID:public
DTSTART:20261107T190000Z
DTEND:20261107T210000Z
SUMMARY:Public class
ORGANIZER:mailto:organizer@example.com
ATTENDEE:mailto:guest@example.com
DESCRIPTION:<p>Bring a canvas.</p><script>unwanted</script><p>All welcome.</p>'''
        private = public.replace('UID:public', 'UID:private\nCLASS:PRIVATE')
        cancelled = public.replace('UID:public', 'UID:cancelled\nSTATUS:CANCELLED')
        events = self.events(public, private, cancelled)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['description'], 'Bring a canvas.\nAll welcome.')
        self.assertNotIn('example.com', json.dumps(events))
        self.assertNotIn('public', events[0]['id'])

    def test_empty_calendar_and_invalid_response(self):
        self.assertEqual(self.events(), [])
        with self.assertRaises(ValueError):
            sync.build_calendar(b'<html>Login required</html>', NOW)

    def test_revoked_feed_clears_snapshot(self):
        with TemporaryDirectory() as directory:
            with patch.object(sync, 'OUTPUT', Path(directory) / 'calendar.json'), patch.object(sync, 'download', side_effect=HTTPError(sync.FEED, 403, 'Forbidden', {}, None)) as download:
                result = sync.run()
                self.assertEqual(result['status'], 'unavailable')
                self.assertEqual(result['events'], [])
                self.assertEqual(download.call_count, 1)

    def test_success_after_transient_error(self):
        with TemporaryDirectory() as directory:
            with patch.object(sync, 'OUTPUT', Path(directory) / 'calendar.json'), patch.object(sync, 'download', side_effect=[TimeoutError(), feed()]), patch.object(sync.clock, 'sleep'):
                result = sync.run()
                self.assertEqual(result['status'], 'ok')


if __name__ == '__main__':
    main()
