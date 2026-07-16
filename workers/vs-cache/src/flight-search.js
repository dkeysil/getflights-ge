const BACKEND_ORIGIN = 'https://ticket.vanillasky.ge';

export function parseSearchForm(html) {
  const form = matchTagById(html, 'form', 'form-select-date');
  if (!form) {
    throw new Error('Could not parse the Vanilla Sky search form.');
  }

  const action = normalizeSearchFormAction(readAttribute(form.openingTag, 'action') || '/en/tickets');
  const formBuildId = readInputValue(form.innerHtml, 'form_build_id');
  const formId = readInputValue(form.innerHtml, 'form_id');

  if (!formBuildId || !formId) {
    throw new Error('Could not parse the Vanilla Sky search form.');
  }

  return { action, formBuildId, formId };
}

export function buildFlightSearchFields(input, searchForm) {
  const passengerCount = input.passengers.adult + input.passengers.child + input.passengers.infant;
  return {
    types: input.tripType === 'round-trip' ? '1' : '0',
    departure: input.fromId,
    date_picker: input.outboundDate,
    arrive: input.toId,
    date_picker_arrive: input.returnDate ?? formatOfficialFallbackDate(new Date()),
    person_count: String(passengerCount),
    'person_types[adult]': String(input.passengers.adult),
    'person_types[child]': String(input.passengers.child),
    'person_types[infant]': String(input.passengers.infant),
    op: '',
    form_build_id: searchForm.formBuildId,
    form_id: searchForm.formId,
  };
}

export async function fetchFlightSearch({ fetchText, input, now = () => new Date() }) {
  await fetchText(`/${input.officialLocale ?? 'en'}/flights-form`);

  const formPath = `/${input.officialLocale ?? 'en'}/tickets`;
  const formHtml = await fetchText(formPath);
  const searchForm = parseSearchForm(formHtml);
  const body = new URLSearchParams(buildFlightSearchFields(input, searchForm));
  const html = await fetchText(searchForm.action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body,
  });

  return {
    resultUrl: searchForm.action,
    html,
    loadedAt: now().toISOString(),
  };
}

function formatOfficialFallbackDate(date) {
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeSearchFormAction(action) {
  const url = new URL(action, BACKEND_ORIGIN);
  if (url.origin !== BACKEND_ORIGIN) {
    throw new Error('Unsafe Vanilla Sky form action.');
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function matchTagById(html, tagName, id) {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  let match = pattern.exec(html);

  while (match) {
    const openingTag = `<${tagName}${match[1]}>`;
    if (readAttribute(openingTag, 'id') === id) {
      return { openingTag, innerHtml: match[2] };
    }
    match = pattern.exec(html);
  }

  return null;
}

function readInputValue(html, name) {
  const pattern = /<input\b[^>]*>/gi;
  let match = pattern.exec(html);

  while (match) {
    if (readAttribute(match[0], 'name') === name) {
      return readAttribute(match[0], 'value');
    }
    match = pattern.exec(html);
  }

  return null;
}

function readAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = pattern.exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}
