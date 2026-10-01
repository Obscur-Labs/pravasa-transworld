import type { LucideIcon } from 'lucide-react';
import { Plane, Hotel, Bus, ShieldCheck, Banknote } from 'lucide-react';

// "More Services" request forms. Keys, options and rules mirror the backend's
// config/serviceInquiries.ts, which is what actually validates a submission.

export type ServiceKey = 'flight' | 'hotel' | 'transport' | 'insurance' | 'forex';

export interface ServiceField {
  key: string;
  label: string;
  type: 'text' | 'longtext' | 'choice' | 'number' | 'date';
  section: string;
  required?: boolean;
  options?: readonly string[];
  /** Choice fields render as pills unless they have many options. */
  display?: 'pills' | 'select';
  min?: number;
  max?: number;
  defaultValue?: string;
  placeholder?: string;
  /** Grid span on wider screens, out of 6 columns. */
  span?: 2 | 3 | 4 | 6;
  when?: { key: string; in: readonly string[] };
  after?: string;
  differentFrom?: string;
}

export interface ServiceConfig {
  key: ServiceKey;
  slug: string;
  name: string;
  title: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  submitLabel: string;
  consent: string;
  highlights: string[];
  fields: ServiceField[];
}

const REGION = ['Domestic', 'International'] as const;
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'THB', 'SAR', 'Other'] as const;

export const SERVICES: ServiceConfig[] = [
  {
    key: 'flight',
    slug: 'flight-booking',
    name: 'Flight Booking',
    title: 'Book Your Flights',
    tagline: 'Tell us where you are flying. We compare fares across airlines and send you the best options on WhatsApp.',
    description: 'Request domestic and international flight quotes from Pravasa Transworld. One way, round trip or multi-city, for any class.',
    icon: Plane,
    submitLabel: 'Request Flight Quotes',
    consent: 'I agree to the terms and want to receive flight quotes and updates on WhatsApp.',
    highlights: ['Fares compared across airlines', 'Help with multi-city and group bookings', 'Visa and flights handled together'],
    fields: [
      { key: 'tripType', label: 'Trip type', type: 'choice', section: 'Trip', required: true, options: ['One way', 'Round trip', 'Multi-city'], defaultValue: 'Round trip', span: 3 },
      { key: 'region', label: 'Travel region', type: 'choice', section: 'Trip', required: true, options: REGION, defaultValue: 'International', span: 3 },
      { key: 'from', label: 'From', type: 'text', section: 'Trip', required: true, placeholder: 'City or airport', span: 3 },
      { key: 'to', label: 'To', type: 'text', section: 'Trip', required: true, placeholder: 'City or airport', span: 3 },
      { key: 'departDate', label: 'Departure date', type: 'date', section: 'Trip', required: true, span: 3 },
      { key: 'returnDate', label: 'Return date', type: 'date', section: 'Trip', required: true, when: { key: 'tripType', in: ['Round trip'] }, after: 'departDate', span: 3 },
      { key: 'travelClass', label: 'Class', type: 'choice', section: 'Preferences', required: true, options: ['Economy', 'Premium economy', 'Business', 'First'], defaultValue: 'Economy', span: 6 },
      { key: 'stops', label: 'Stops', type: 'choice', section: 'Preferences', required: true, options: ['Any', 'Non-stop', '1 stop', '2+ stops'], defaultValue: 'Any', span: 6 },
      { key: 'airline', label: 'Preferred airline', type: 'text', section: 'Preferences', placeholder: 'Optional', span: 3 },
      { key: 'budget', label: 'Budget per person', type: 'text', section: 'Preferences', placeholder: 'Optional, e.g. ₹40,000', span: 3 },
      { key: 'adults', label: 'Adults (12+)', type: 'number', section: 'Passengers', required: true, min: 1, max: 9, defaultValue: '1', span: 2 },
      { key: 'children', label: 'Children (2-12)', type: 'number', section: 'Passengers', min: 0, max: 9, defaultValue: '0', span: 2 },
      { key: 'infants', label: 'Infants (under 2)', type: 'number', section: 'Passengers', min: 0, max: 9, defaultValue: '0', span: 2 },
      { key: 'notes', label: 'Anything else?', type: 'longtext', section: 'Passengers', placeholder: 'Multi-city legs, flexible dates, baggage or meal needs', span: 6 },
    ],
  },
  {
    key: 'hotel',
    slug: 'hotel-booking',
    name: 'Hotel Booking',
    title: 'Find the Right Stay',
    tagline: 'From business hotels to beach villas. Share your dates and budget and we will send handpicked options.',
    description: 'Request hotel quotes from Pravasa Transworld for domestic and international stays, from 3 star hotels to luxury villas.',
    icon: Hotel,
    submitLabel: 'Request Hotel Quotes',
    consent: 'I agree to the terms and want to receive hotel quotes and updates on WhatsApp.',
    highlights: ['Handpicked hotels for your budget', 'Confirmed bookings for visa files', 'Group and family stays'],
    fields: [
      { key: 'region', label: 'Region', type: 'choice', section: 'Stay', required: true, options: REGION, defaultValue: 'International', span: 6 },
      { key: 'destination', label: 'Destination or hotel', type: 'text', section: 'Stay', required: true, placeholder: 'e.g. Dubai Marina, or a hotel name', span: 6 },
      { key: 'category', label: 'Hotel category', type: 'choice', section: 'Stay', required: true, options: ['3 star', '4 star', '5 star', 'Luxury', 'Villa / apartment'], defaultValue: '4 star', span: 6 },
      { key: 'checkIn', label: 'Check-in', type: 'date', section: 'Stay', required: true, span: 3 },
      { key: 'checkOut', label: 'Check-out', type: 'date', section: 'Stay', required: true, after: 'checkIn', span: 3 },
      { key: 'rooms', label: 'Rooms', type: 'number', section: 'Guests', required: true, min: 1, max: 20, defaultValue: '1', span: 2 },
      { key: 'adults', label: 'Adults', type: 'number', section: 'Guests', required: true, min: 1, max: 50, defaultValue: '2', span: 2 },
      { key: 'children', label: 'Children', type: 'number', section: 'Guests', min: 0, max: 20, defaultValue: '0', span: 2 },
      { key: 'budget', label: 'Budget per night', type: 'text', section: 'Guests', placeholder: 'Optional, e.g. ₹8,000', span: 6 },
      { key: 'notes', label: 'Anything else?', type: 'longtext', section: 'Guests', placeholder: 'Preferred area, breakfast, extra bed, accessibility needs', span: 6 },
    ],
  },
  {
    key: 'transport',
    slug: 'transport',
    name: 'Transport',
    title: 'Cabs, Coaches & Rentals',
    tagline: 'Airport transfers, outstation trips and local rentals. Tell us the route and group size and we arrange the ride.',
    description: 'Request car, tempo traveller, bus or train bookings from Pravasa Transworld for one way, round trip or local rental.',
    icon: Bus,
    submitLabel: 'Request Transport Quotes',
    consent: 'I agree to the terms and want to receive transport quotes and updates on WhatsApp.',
    highlights: ['Airport pickups and drops', 'Tempo travellers and coaches for groups', 'Local rentals by the day'],
    fields: [
      { key: 'tripType', label: 'Trip type', type: 'choice', section: 'Trip', required: true, options: ['One way', 'Round trip', 'Local rental'], defaultValue: 'One way', span: 6 },
      { key: 'vehicle', label: 'Vehicle', type: 'choice', section: 'Trip', required: true, options: ['Car', 'Tempo traveller', 'Bus', 'Train'], defaultValue: 'Car', span: 6 },
      { key: 'from', label: 'Pickup location', type: 'text', section: 'Route', required: true, placeholder: 'Address, area or airport', span: 3 },
      { key: 'to', label: 'Drop location', type: 'text', section: 'Route', required: true, placeholder: 'Address, area or airport', when: { key: 'tripType', in: ['One way', 'Round trip'] }, span: 3 },
      { key: 'date', label: 'Pickup date', type: 'date', section: 'Route', required: true, span: 3 },
      { key: 'returnDate', label: 'Return date', type: 'date', section: 'Route', required: true, when: { key: 'tripType', in: ['Round trip'] }, after: 'date', span: 3 },
      { key: 'travellers', label: 'Travellers', type: 'number', section: 'Route', required: true, min: 1, max: 100, defaultValue: '1', span: 2 },
      { key: 'budget', label: 'Budget', type: 'text', section: 'Route', placeholder: 'Optional', span: 6 },
      { key: 'notes', label: 'Anything else?', type: 'longtext', section: 'Route', placeholder: 'Pickup time, luggage, rental hours or days', span: 6 },
    ],
  },
  {
    key: 'insurance',
    slug: 'travel-insurance',
    name: 'Travel Insurance',
    title: 'Travel Insurance',
    tagline: 'Cover for medical emergencies, trip delays and lost baggage, including policies that meet Schengen visa rules.',
    description: 'Request travel insurance quotes from Pravasa Transworld, including visa-compliant policies for Schengen and other countries.',
    icon: ShieldCheck,
    submitLabel: 'Request Insurance Quotes',
    consent: 'I agree to the terms and want to receive travel insurance quotes and updates on WhatsApp.',
    highlights: ['Visa-compliant policies', 'Plans compared across insurers', 'Cover for families and seniors'],
    fields: [
      { key: 'destination', label: 'Destination country or region', type: 'text', section: 'Trip', required: true, placeholder: 'e.g. Schengen, USA, Worldwide', span: 6 },
      { key: 'purpose', label: 'Purpose of travel', type: 'choice', section: 'Trip', required: true, options: ['Tourism', 'Business', 'Study', 'Visiting family', 'Other'], defaultValue: 'Tourism', span: 6 },
      { key: 'startDate', label: 'Trip starts', type: 'date', section: 'Trip', required: true, span: 3 },
      { key: 'endDate', label: 'Trip ends', type: 'date', section: 'Trip', required: true, after: 'startDate', span: 3 },
      { key: 'travellers', label: 'Travellers', type: 'number', section: 'Travellers', required: true, min: 1, max: 20, defaultValue: '1', span: 2 },
      { key: 'ages', label: 'Traveller ages', type: 'text', section: 'Travellers', required: true, placeholder: 'e.g. 34, 31, 6', span: 4 },
      { key: 'notes', label: 'Anything else?', type: 'longtext', section: 'Travellers', placeholder: 'Pre-existing conditions, cover amount the embassy needs', span: 6 },
    ],
  },
  {
    key: 'forex',
    slug: 'currency-exchange',
    name: 'Currency Exchange',
    title: 'Currency Exchange',
    tagline: 'Competitive rates on cash, forex cards and wire transfers. Tell us what you need and when.',
    description: 'Request forex rates from Pravasa Transworld for cash, forex cards and international wire transfers.',
    icon: Banknote,
    submitLabel: 'Request Forex Rates',
    consent: 'I agree to receive exchange rate updates on WhatsApp and allow Pravasa Transworld to process this forex request.',
    highlights: ['Competitive exchange rates', 'Cash, forex cards and transfers', 'Delivery before you fly'],
    fields: [
      { key: 'have', label: 'I have', type: 'choice', display: 'select', section: 'Exchange', required: true, options: CURRENCIES, defaultValue: 'INR', span: 3 },
      { key: 'want', label: 'I want', type: 'choice', display: 'select', section: 'Exchange', required: true, options: CURRENCIES, defaultValue: 'USD', differentFrom: 'have', span: 3 },
      { key: 'amount', label: 'Amount', type: 'number', section: 'Exchange', required: true, min: 1, max: 100000000, placeholder: 'In the currency you have', span: 3 },
      { key: 'neededBy', label: 'Needed by', type: 'date', section: 'Exchange', span: 3 },
      { key: 'mode', label: 'Delivered as', type: 'choice', section: 'Exchange', required: true, options: ['Cash', 'Forex card', 'Wire transfer'], defaultValue: 'Cash', span: 6 },
      { key: 'notes', label: 'Anything else?', type: 'longtext', section: 'Exchange', placeholder: 'Purpose of travel, denominations, delivery address', span: 6 },
    ],
  },
];

export const serviceBySlug = (slug: string) => SERVICES.find((s) => s.slug === slug);
