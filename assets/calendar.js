(() => {
  'use strict';
  const root = document.getElementById('popup-calendar');
  if (!root) return;
  const zone = 'America/New_York';
  const googleUrl = 'https://calendar.google.com/calendar/embed?src=lovemsg69%40gmail.com&ctz=America%2FNew_York';
  const elements = Object.fromEntries(['status', 'content', 'month', 'days', 'events', 'agenda-title', 'reset', 'previous', 'next', 'today', 'note'].map(key => [key, root.querySelector(`[data-calendar="${key}"]`)]));
  const formatter = (options) => new Intl.DateTimeFormat('en-US', {timeZone: zone, ...options});
  const dayKey = (value) => {
    const parts = formatter({year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(value);
    const get = type => parts.find(part => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const today = dayKey(new Date());
  // Date-only values are calendar dates, never browser-local midnight timestamps.
  const calendarDate = value => new Date(`${value}T12:00:00Z`);
  const monthDate = value => calendarDate(`${value}-01`);
  const addMonth = (month, offset) => {
    const value = monthDate(month);
    value.setUTCMonth(value.getUTCMonth() + offset);
    return value.toISOString().slice(0, 7);
  };
  const text = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    return node;
  };
  const external = (label, href, className) => {
    const node = text('a', className, label);
    node.href = href;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    return node;
  };
  let data;
  let month = today.slice(0, 7);
  let selected = null;
  const occursOn = (event, day) => event.startDate <= day && event.lastDate >= day;
  const dateLabel = day => formatter({month: 'short', day: 'numeric'}).format(calendarDate(day));
  const fullDay = day => formatter({weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'}).format(calendarDate(day));
  const eventDates = event => event.startDate === event.lastDate ? dateLabel(event.startDate) : `${dateLabel(event.startDate)} – ${dateLabel(event.lastDate)}`;
  const eventTime = event => {
    if (event.allDay) return 'All day';
    const time = formatter({hour: 'numeric', minute: '2-digit'});
    const start = time.format(new Date(event.start));
    if (event.start === event.end) return start;
    const end = time.format(new Date(event.end));
    const endDate = dayKey(new Date(event.end));
    return event.startDate === endDate ? `${start} – ${end}` : `${dateLabel(event.startDate)}, ${start} – ${dateLabel(endDate)}, ${end}`;
  };
  const saveLink = event => {
    const stamp = value => event.allDay ? value.replaceAll('-', '') : new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const params = new URLSearchParams({action: 'TEMPLATE', text: event.title, dates: `${stamp(event.start)}/${stamp(event.end)}`, ctz: zone});
    if (event.description) params.set('details', event.description);
    if (event.location) params.set('location', event.location);
    return `https://calendar.google.com/calendar/render?${params}`;
  };
  function renderAgenda() {
    const next = `${addMonth(month, 1)}-01`;
    const events = data.events.filter(event => selected ? occursOn(event, selected) : event.startDate < next && event.lastDate >= `${month}-01`);
    elements['agenda-title'].textContent = selected ? dateLabel(selected) : 'This month’s gatherings';
    elements.reset.hidden = !selected;
    elements.events.replaceChildren();
    if (!events.length) {
      const empty = text('li', 'rl-calendar__empty', '');
      empty.append(text('strong', '', 'More dates to come.'), text('p', '', 'No events are scheduled for this month yet. Browse the next month or check back soon.'));
      elements.events.append(empty);
      return;
    }
    for (const event of events) {
      const item = document.createElement('li');
      item.className = 'rl-calendar__event';
      item.append(text('p', 'rl-calendar__event-date', eventDates(event)), text('h5', '', event.title), text('p', 'rl-calendar__event-time', eventTime(event)));
      if (event.location) item.append(external(event.location, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`, 'rl-calendar__location'));
      if (event.description) {
        const details = document.createElement('details');
        details.append(text('summary', '', 'Event details'), text('p', 'rl-calendar__description', event.description));
        item.append(details);
      }
      item.append(external('Save event ↗', saveLink(event), 'rl-calendar__save'));
      elements.events.append(item);
    }
  }
  function render() {
    const title = formatter({month: 'long', year: 'numeric'}).format(monthDate(month));
    elements.month.textContent = title;
    elements.previous.disabled = `${month}-01` <= data.rangeStart;
    elements.next.disabled = `${addMonth(month, 1)}-01` >= data.rangeEnd;
    elements.days.setAttribute('aria-label', title);
    elements.days.replaceChildren();
    const first = monthDate(month).getUTCDay();
    const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
    for (let i = 0; i < first; i++) {
      const blank = text('span', 'rl-calendar__day', '');
      blank.setAttribute('aria-hidden', 'true');
      elements.days.append(blank);
    }
    for (let i = 1; i <= count; i++) {
      const day = `${month}-${String(i).padStart(2, '0')}`;
      const countForDay = data.events.filter(event => occursOn(event, day)).length;
      const node = text(countForDay ? 'button' : 'span', 'rl-calendar__day', String(i));
      node.setAttribute('aria-label', `${fullDay(day)}${countForDay ? `, ${countForDay} ${countForDay === 1 ? 'event' : 'events'}` : ''}`);
      if (day === today) node.setAttribute('aria-current', 'date');
      if (countForDay) {
        node.type = 'button';
        node.dataset.day = day;
        node.setAttribute('aria-pressed', String(day === selected));
        node.addEventListener('click', () => {
          selected = selected === day ? null : day;
          render();
          elements.days.querySelector(`[data-day="${day}"]`).focus({preventScroll: true});
        });
      }
      elements.days.append(node);
    }
    renderAgenda();
  }
  function showFallback() {
    elements.content.hidden = true;
    elements.status.replaceChildren(text('p', '', 'Our calendar is temporarily unavailable here. You can also check the latest dates on Google Calendar.'));
    const frame = document.createElement('iframe');
    frame.src = `${googleUrl}&mode=AGENDA&showTitle=0&showPrint=0&showTabs=0`;
    frame.title = 'Rosemary Lane public events on Google Calendar';
    frame.loading = 'lazy';
    frame.className = 'rl-calendar__fallback';
    elements.status.append(frame);
    elements.status.hidden = false;
  }
  async function load() {
    try {
      const response = await fetch('data/calendar.json', {cache: 'no-cache'});
      if (!response.ok) throw new Error('Calendar unavailable');
      data = await response.json();
      if (data.schemaVersion !== 1 || data.status === 'unavailable' || !Array.isArray(data.events)
          || !/^\d{4}-\d{2}-01$/.test(data.rangeStart) || !/^\d{4}-\d{2}-01$/.test(data.rangeEnd)) throw new Error('Calendar unavailable');
      if (today < data.rangeStart || today >= data.rangeEnd) throw new Error('Calendar out of date');
      data.events = data.events.filter(event => event && typeof event.title === 'string' && typeof event.description === 'string'
        && typeof event.location === 'string' && typeof event.allDay === 'boolean'
        && /^\d{4}-\d{2}-\d{2}$/.test(event.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(event.lastDate)
        && Number.isFinite(Date.parse(event.start)) && Number.isFinite(Date.parse(event.end)));
      // Start at the next gathering if the rest of this month has no events.
      const upcoming = data.events.find(event => event.lastDate >= today);
      if (upcoming && !data.events.some(event => event.lastDate >= today && event.startDate < `${addMonth(month, 1)}-01`)) month = upcoming.startDate.slice(0, 7);
      const updated = data.updatedAt ? Date.parse(data.updatedAt) : NaN;
      const stale = data.status === 'stale' || !Number.isFinite(updated) || Date.now() - updated > 6 * 60 * 60 * 1000;
      elements.note.textContent = stale ? 'All times Eastern. Updates are delayed; check Google Calendar for the latest dates.' : 'All times Eastern. Dates are updated from our Google Calendar.';
      elements.previous.addEventListener('click', () => {month = addMonth(month, -1); selected = null; render();});
      elements.next.addEventListener('click', () => {month = addMonth(month, 1); selected = null; render();});
      elements.today.addEventListener('click', () => {month = today.slice(0, 7); selected = null; render();});
      elements.reset.addEventListener('click', () => {selected = null; render();});
      render();
      elements.status.hidden = true;
      elements.content.hidden = false;
    } catch {
      showFallback();
    }
  }
  // Below-the-fold calendar data does not compete with the hero or photographs.
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {observer.disconnect(); load();}
    }, {rootMargin: '350px'});
    observer.observe(root);
  } else load();
})();
