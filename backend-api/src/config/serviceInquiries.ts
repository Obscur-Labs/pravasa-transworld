// Fields each "More Services" request form collects. The user portal mirrors this in
// src/lib/services.ts; keep the keys, options and rules in step.

export const SERVICE_KEYS = ['flight', 'hotel', 'transport', 'insurance', 'forex'] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];

export interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'longtext' | 'choice' | 'number' | 'date';
  required?: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  /** Only asked (and only required) when another field has one of these values. */
  when?: { key: string; in: readonly string[] };
  /** Date that must fall on or after another date field. */
  after?: string;
  /** Choice that must differ from another field. */
  differentFrom?: string;
}

export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'THB', 'SAR', 'Other'] as const;

const REGION = ['Domestic', 'International'] as const;

export const SERVICE_SPECS: Record<ServiceKey, { label: string; fields: FieldSpec[]; summary: (v: Record<string, string>) => string }> = {
  flight: {
    label: 'Flight booking',
    fields: [
      { key: 'tripType', label: 'Trip type', type: 'choice', required: true, options: ['One way', 'Round trip', 'Multi-city'] },
      { key: 'region', label: 'Travel region', type: 'choice', required: true, options: REGION },
      { key: 'from', label: 'From', type: 'text', required: true },
      { key: 'to', label: 'To', type: 'text', required: true },
      { key: 'departDate', label: 'Departure date', type: 'date', required: true },
      { key: 'returnDate', label: 'Return date', type: 'date', required: true, when: { key: 'tripType', in: ['Round trip'] }, after: 'departDate' },
      { key: 'travelClass', label: 'Class', type: 'choice', required: true, options: ['Economy', 'Premium economy', 'Business', 'First'] },
      { key: 'stops', label: 'Stops', type: 'choice', required: true, options: ['Any', 'Non-stop', '1 stop', '2+ stops'] },
      { key: 'adults', label: 'Adults (12+)', type: 'number', required: true, min: 1, max: 9 },
      { key: 'children', label: 'Children (2-12)', type: 'number', min: 0, max: 9 },
      { key: 'infants', label: 'Infants (under 2)', type: 'number', min: 0, max: 9 },
      { key: 'airline', label: 'Preferred airline', type: 'text' },
      { key: 'budget', label: 'Budget per person', type: 'text' },
      { key: 'notes', label: 'Other details', type: 'longtext' },
    ],
    summary: (v) => [`${v.from} → ${v.to}`, v.tripType, v.departDate, travellers(v)].filter(Boolean).join(' · '),
  },
  hotel: {
    label: 'Hotel booking',
    fields: [
      { key: 'region', label: 'Region', type: 'choice', required: true, options: REGION },
      { key: 'destination', label: 'Destination / hotel', type: 'text', required: true },
      { key: 'category', label: 'Hotel category', type: 'choice', required: true, options: ['3 star', '4 star', '5 star', 'Luxury', 'Villa / apartment'] },
      { key: 'checkIn', label: 'Check-in', type: 'date', required: true },
      { key: 'checkOut', label: 'Check-out', type: 'date', required: true, after: 'checkIn' },
      { key: 'rooms', label: 'Rooms', type: 'number', required: true, min: 1, max: 20 },
      { key: 'adults', label: 'Adults', type: 'number', required: true, min: 1, max: 50 },
      { key: 'children', label: 'Children', type: 'number', min: 0, max: 20 },
      { key: 'budget', label: 'Budget per night', type: 'text' },
      { key: 'notes', label: 'Other details', type: 'longtext' },
    ],
    summary: (v) => [v.destination, v.category, v.checkIn && v.checkOut ? `${v.checkIn} to ${v.checkOut}` : '', `${v.rooms} room${v.rooms === '1' ? '' : 's'}`].filter(Boolean).join(' · '),
  },
  transport: {
    label: 'Transport',
    fields: [
      { key: 'tripType', label: 'Trip type', type: 'choice', required: true, options: ['One way', 'Round trip', 'Local rental'] },
      { key: 'vehicle', label: 'Vehicle', type: 'choice', required: true, options: ['Car', 'Tempo traveller', 'Bus', 'Train'] },
      { key: 'from', label: 'Pickup location', type: 'text', required: true },
      { key: 'to', label: 'Drop location', type: 'text', required: true, when: { key: 'tripType', in: ['One way', 'Round trip'] } },
      { key: 'date', label: 'Pickup date', type: 'date', required: true },
      { key: 'returnDate', label: 'Return date', type: 'date', required: true, when: { key: 'tripType', in: ['Round trip'] }, after: 'date' },
      { key: 'travellers', label: 'Travellers', type: 'number', required: true, min: 1, max: 100 },
      { key: 'budget', label: 'Budget', type: 'text' },
      { key: 'notes', label: 'Other details', type: 'longtext' },
    ],
    summary: (v) => [v.vehicle, v.to ? `${v.from} → ${v.to}` : v.from, v.date, `${v.travellers} traveller${v.travellers === '1' ? '' : 's'}`].filter(Boolean).join(' · '),
  },
  insurance: {
    label: 'Travel insurance',
    fields: [
      { key: 'destination', label: 'Destination country / region', type: 'text', required: true },
      { key: 'purpose', label: 'Purpose of travel', type: 'choice', required: true, options: ['Tourism', 'Business', 'Study', 'Visiting family', 'Other'] },
      { key: 'startDate', label: 'Trip starts', type: 'date', required: true },
      { key: 'endDate', label: 'Trip ends', type: 'date', required: true, after: 'startDate' },
      { key: 'travellers', label: 'Travellers', type: 'number', required: true, min: 1, max: 20 },
      { key: 'ages', label: 'Traveller ages', type: 'text', required: true },
      { key: 'notes', label: 'Other details', type: 'longtext' },
    ],
    summary: (v) => [v.destination, v.purpose, v.startDate && v.endDate ? `${v.startDate} to ${v.endDate}` : '', `${v.travellers} traveller${v.travellers === '1' ? '' : 's'}`].filter(Boolean).join(' · '),
  },
  forex: {
    label: 'Currency exchange',
    fields: [
      { key: 'have', label: 'I have', type: 'choice', required: true, options: CURRENCIES },
      { key: 'want', label: 'I want', type: 'choice', required: true, options: CURRENCIES, differentFrom: 'have' },
      { key: 'amount', label: 'Amount', type: 'number', required: true, min: 1, max: 100000000 },
      { key: 'mode', label: 'Delivered as', type: 'choice', required: true, options: ['Cash', 'Forex card', 'Wire transfer'] },
      { key: 'neededBy', label: 'Needed by', type: 'date' },
      { key: 'notes', label: 'Other details', type: 'longtext' },
    ],
    summary: (v) => [`${Number(v.amount).toLocaleString('en-IN')} ${v.have} → ${v.want}`, v.mode, v.neededBy].filter(Boolean).join(' · '),
  },
};

function travellers(v: Record<string, string>) {
  const parts = [
    [v.adults, 'adult'], [v.children, 'child'], [v.infants, 'infant'],
  ].filter(([n]) => n && n !== '0').map(([n, w]) => `${n} ${w === 'child' && n !== '1' ? 'children' : w + (n === '1' ? '' : 's')}`);
  return parts.join(', ');
}
