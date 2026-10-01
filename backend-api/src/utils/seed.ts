import 'dotenv/config';
import { connectDB } from '../config/database';
import Admin from '../models/Admin';
import { bootstrapAdmins } from '../services/adminBootstrap';
import Country from '../models/Country';
import VisaType from '../models/VisaType';

const countries = [
  { name: 'Canada',         flag: 'ca', description: 'Experience the vast landscapes and multicultural cities of Canada.' },
  { name: 'United States',  flag: 'us', description: 'Explore the land of opportunity from coast to coast.' },
  { name: 'United Kingdom', flag: 'gb', description: 'Discover historic Britain from London to the Scottish Highlands.' },
  { name: 'Australia',      flag: 'au', description: 'Adventure awaits across the sunburnt country Down Under.' },
  { name: 'Germany',        flag: 'de', description: 'Experience innovation, culture, and history in the heart of Europe.' },
  { name: 'France',         flag: 'fr', description: 'Fall in love with art, cuisine, and the Eiffel Tower.' },
  { name: 'Japan',          flag: 'jp', description: 'Blend tradition and modernity in the Land of the Rising Sun.' },
  { name: 'UAE',            flag: 'ae', description: 'Experience luxury and ambition in the desert oasis.' },
];

const passportField = (order: number) => ({
  label: 'Passport Number', fieldName: 'passportNumber', type: 'text' as const,
  required: true, options: [], placeholder: 'e.g. A1234567', order,
});
const dobField = (order: number) => ({
  label: 'Date of Birth', fieldName: 'dateOfBirth', type: 'date' as const,
  required: true, options: [], placeholder: '', order,
});
const nationalityField = (order: number) => ({
  label: 'Nationality', fieldName: 'nationality', type: 'text' as const,
  required: true, options: [], placeholder: 'e.g. Indian', order,
});
const occupationField = (order: number) => ({
  label: 'Occupation', fieldName: 'occupation', type: 'text' as const,
  required: true, options: [], placeholder: 'e.g. Software Engineer', order,
});

const passportDoc   = { name: 'Passport Copy',   description: 'Clear scan of all passport pages (bio-data page mandatory)', required: true };
const photoDoc      = { name: 'Photograph',       description: 'Recent passport-size photo, white background (3.5×4.5 cm)', required: true };
const bankDoc       = { name: 'Bank Statement',   description: 'Last 6 months bank statement showing sufficient funds',      required: true };
const itrDoc        = { name: 'Income Tax Return', description: 'Latest ITR or proof of income',                             required: true };
const coverLetterDoc = { name: 'Cover Letter',    description: 'Personal cover letter stating purpose of travel',            required: false };

async function seed() {
  await connectDB();
  console.log('✔ Connected to MongoDB');

  // ── Clear existing data ────────────────────────────────────────────────────
  console.log('  Clearing old data…');
  await Promise.all([
    VisaType.deleteMany({}),
    Country.deleteMany({}),
    Admin.deleteMany({}),
  ]);
  console.log('✔ Old data cleared');

  // ── Admin ──────────────────────────────────────────────────────────────────
  // Same path as server start-up: super admin from SUPER_ADMIN_USERNAME / _PASSWORD.
  await bootstrapAdmins();
  console.log('✔ Admin ready');

  // ── Countries ──────────────────────────────────────────────────────────────
  await Country.insertMany(countries);
  console.log('✔ Countries seeded (8)');

  // ── Resolve country IDs ───────────────────────────────────────────────────
  const [canada, usa, uk, australia, germany, france, japan, uae] = await Promise.all(
    ['Canada', 'United States', 'United Kingdom', 'Australia', 'Germany', 'France', 'Japan', 'UAE']
      .map((n) => Country.findOne({ name: n }))
  );

  // ── Visa Types ─────────────────────────────────────────────────────────────
  const visaTypes = [

    // ── CANADA ─────────────────────────────────────────────────────────────
    {
      country: canada!._id,
      name: 'Tourist Visa (TRV)',
      description: 'Tourism',
      price: 150,
      processingDays: 15,
      validity: '6 months',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Purpose of Visit',  fieldName: 'purposeOfVisit', type: 'textarea' as const, required: true,  options: [], placeholder: 'Describe your travel plans…', order: 5 },
        { label: 'Intended Stay (days)', fieldName: 'intendedStay', type: 'number' as const, required: true, options: [], placeholder: 'e.g. 21', order: 6 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Travel Itinerary',  description: 'Hotel bookings / flight tickets',           required: false },
        { name: 'Proof of Ties',     description: 'Evidence of ties to home country (property, family)', required: false },
      ],
    },
    {
      country: canada!._id,
      name: 'Student Visa (Study Permit)',
      description: 'Education',
      price: 180,
      processingDays: 25,
      validity: 'Duration of study + 90 days',
      formFields: [
        passportField(1), dobField(2), nationalityField(3),
        { label: 'Institution Name',  fieldName: 'institutionName', type: 'text' as const, required: true, options: [], placeholder: 'Name of Canadian school / college', order: 4 },
        { label: 'Program Name',      fieldName: 'programName',     type: 'text' as const, required: true, options: [], placeholder: 'e.g. Master of Business Administration', order: 5 },
        { label: 'Program Start Date', fieldName: 'programStartDate', type: 'date' as const, required: true, options: [], placeholder: '', order: 6 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Letter of Acceptance', description: 'Official acceptance letter from Canadian institution', required: true },
        { name: 'Academic Transcripts', description: 'Previous academic records / transcripts',             required: true },
        itrDoc,
      ],
    },
    {
      country: canada!._id,
      name: 'Work Permit',
      description: 'Employment',
      price: 230,
      processingDays: 30,
      validity: '1–2 years (job-offer dependent)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Employer Name',    fieldName: 'employerName',    type: 'text' as const,     required: true, options: [], placeholder: 'Canadian employer name', order: 5 },
        { label: 'Job Title',        fieldName: 'jobTitle',        type: 'text' as const,     required: true, options: [], placeholder: 'e.g. Senior Developer',   order: 6 },
        { label: 'LMIA Number',      fieldName: 'lmiaNumber',      type: 'text' as const,     required: false, options: [], placeholder: 'If applicable',          order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc,
        { name: 'Job Offer Letter',   description: 'Signed offer letter from Canadian employer',            required: true  },
        { name: 'LMIA Document',      description: 'Labour Market Impact Assessment (if required)',          required: false },
        { name: 'Educational Credentials', description: 'Degree / diploma relevant to job role',            required: true  },
        bankDoc,
      ],
    },

    // ── UNITED STATES ──────────────────────────────────────────────────────
    {
      country: usa!._id,
      name: 'Tourist Visa (B-2)',
      description: 'Tourism',
      price: 185,
      processingDays: 20,
      validity: 'Up to 10 years (6 months per entry)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Purpose of Visit',  fieldName: 'purposeOfVisit',  type: 'textarea' as const, required: true,  options: [], placeholder: 'Tourism, visiting family, medical treatment…', order: 5 },
        { label: 'US Contacts',       fieldName: 'usContacts',      type: 'text' as const,     required: false, options: [], placeholder: 'Name & address of US contact (if any)',        order: 6 },
        { label: 'Previous US Visits', fieldName: 'prevUsVisits',   type: 'radio' as const,    required: true,  options: ['Yes', 'No'], placeholder: '', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc, itrDoc,
        { name: 'DS-160 Confirmation', description: 'Printed DS-160 confirmation page',                     required: true  },
        { name: 'Travel Itinerary',    description: 'Planned itinerary or hotel/flight bookings',            required: false },
      ],
    },
    {
      country: usa!._id,
      name: 'Student Visa (F-1)',
      description: 'Education',
      price: 200,
      processingDays: 30,
      validity: 'Duration of status (D/S)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3),
        { label: 'University Name',    fieldName: 'universityName',    type: 'text' as const, required: true, options: [], placeholder: 'Name of US institution', order: 4 },
        { label: 'Course Name',        fieldName: 'courseName',        type: 'text' as const, required: true, options: [], placeholder: 'e.g. Master of Computer Science', order: 5 },
        { label: 'Course Start Date',  fieldName: 'courseStartDate',   type: 'date' as const, required: true, options: [], placeholder: '', order: 6 },
        { label: 'SEVIS ID',           fieldName: 'sevisId',           type: 'text' as const, required: true, options: [], placeholder: 'N000XXXXXXX', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'I-20 Form',              description: 'Form I-20 issued by your US university',       required: true },
        { name: 'SEVIS Fee Receipt',      description: 'Proof of SEVIS I-901 fee payment',             required: true },
        { name: 'Academic Transcripts',   description: 'All previous academic transcripts',            required: true },
        { name: 'English Proficiency',    description: 'TOEFL / IELTS / GRE score card',              required: false },
      ],
    },
    {
      country: usa!._id,
      name: 'Business Visa (B-1)',
      description: 'Business',
      price: 185,
      processingDays: 20,
      validity: 'Up to 10 years (180 days per entry)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Employer Name',     fieldName: 'employerName',    type: 'text' as const,     required: true, options: [], placeholder: 'Your company name',        order: 5 },
        { label: 'US Host Company',   fieldName: 'usHostCompany',   type: 'text' as const,     required: true, options: [], placeholder: 'Name of US company',        order: 6 },
        { label: 'Business Purpose',  fieldName: 'businessPurpose', type: 'textarea' as const, required: true, options: [], placeholder: 'Conference, meetings, training…', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'DS-160 Confirmation',     description: 'Printed DS-160 confirmation page',               required: true  },
        { name: 'Invitation Letter',       description: 'Letter from US host company',                    required: true  },
        { name: 'Company Registration',    description: 'Home-country company registration',              required: true  },
      ],
    },

    // ── UNITED KINGDOM ─────────────────────────────────────────────────────
    {
      country: uk!._id,
      name: 'Standard Visitor Visa',
      description: 'Tourism',
      price: 160,
      processingDays: 15,
      validity: '6 months (single/multiple entry)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Purpose of Visit',  fieldName: 'purposeOfVisit',  type: 'select' as const, required: true,  options: ['Tourism', 'Visiting family/friends', 'Business', 'Medical'], placeholder: '', order: 5 },
        { label: 'Accommodation',     fieldName: 'accommodation',   type: 'text' as const,   required: true,  options: [], placeholder: 'Hotel name or host address in UK', order: 6 },
        { label: 'Funds Available (GBP)', fieldName: 'fundsAvailable', type: 'number' as const, required: true, options: [], placeholder: 'e.g. 2000', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc, itrDoc, coverLetterDoc,
        { name: 'Proof of Accommodation', description: 'Hotel booking or sponsor letter',                 required: true  },
      ],
    },
    {
      country: uk!._id,
      name: 'Business Visa',
      description: 'Business',
      price: 180,
      processingDays: 10,
      validity: '6 months',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Employer Name',    fieldName: 'employerName',    type: 'text' as const,     required: true, options: [], placeholder: 'Your company name',         order: 5 },
        { label: 'Business Purpose', fieldName: 'businessPurpose', type: 'textarea' as const, required: true, options: [], placeholder: 'Describe your business in the UK', order: 6 },
        { label: 'Duration of Stay', fieldName: 'durationOfStay',  type: 'select' as const,   required: true, options: ['Less than 1 week', '1–2 weeks', '2–4 weeks', '1–3 months'], placeholder: '', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Business Invitation Letter', description: 'Invitation from UK host company',              required: true  },
        { name: 'Company Registration',       description: 'Your home-country company registration docs',  required: true  },
        { name: 'Bank Statement (Business)',  description: 'Last 6 months business bank statement',        required: true  },
      ],
    },
    {
      country: uk!._id,
      name: 'Student Visa (Tier 4)',
      description: 'Education',
      price: 490,
      processingDays: 20,
      validity: 'Course duration + 4 months',
      formFields: [
        passportField(1), dobField(2), nationalityField(3),
        { label: 'University / College', fieldName: 'institutionName', type: 'text' as const, required: true, options: [], placeholder: 'UK institution name', order: 4 },
        { label: 'CAS Number',           fieldName: 'casNumber',       type: 'text' as const, required: true, options: [], placeholder: 'Confirmation of Acceptance for Studies', order: 5 },
        { label: 'Course Start Date',    fieldName: 'courseStartDate', type: 'date' as const, required: true, options: [], placeholder: '', order: 6 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'CAS Letter',            description: 'Confirmation of Acceptance for Studies letter',     required: true },
        { name: 'Academic Transcripts',  description: 'Previous academic records',                        required: true },
        { name: 'English Proficiency',   description: 'IELTS / TOEFL score sheet (min B2)',               required: true },
      ],
    },

    // ── AUSTRALIA ──────────────────────────────────────────────────────────
    {
      country: australia!._id,
      name: 'Tourist Visa (subclass 600)',
      description: 'Tourism',
      price: 145,
      processingDays: 20,
      validity: '12 months (3 months per stay)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Purpose of Visit',  fieldName: 'purposeOfVisit', type: 'select' as const, required: true, options: ['Tourism', 'Visiting family/friends', 'Business visitor'], placeholder: '', order: 5 },
        { label: 'Intended Stay (days)', fieldName: 'intendedStay', type: 'number' as const, required: true, options: [], placeholder: 'e.g. 30', order: 6 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc, itrDoc,
        { name: 'Travel Itinerary',     description: 'Flight bookings and accommodation details',          required: false },
        { name: 'Proof of Ties',        description: 'Evidence of ties to home country',                  required: false },
      ],
    },
    {
      country: australia!._id,
      name: 'Student Visa (subclass 500)',
      description: 'Education',
      price: 630,
      processingDays: 28,
      validity: 'Duration of enrolment',
      formFields: [
        passportField(1), dobField(2), nationalityField(3),
        { label: 'Institution Name',  fieldName: 'institutionName',  type: 'text' as const, required: true, options: [], placeholder: 'Australian university / TAFE', order: 4 },
        { label: 'CoE Number',        fieldName: 'coeNumber',        type: 'text' as const, required: true, options: [], placeholder: 'Confirmation of Enrolment number', order: 5 },
        { label: 'Course Start Date', fieldName: 'courseStartDate',  type: 'date' as const, required: true, options: [], placeholder: '', order: 6 },
        { label: 'OSHC Provider',     fieldName: 'oshcProvider',     type: 'text' as const, required: true, options: [], placeholder: 'Overseas Student Health Cover provider', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'CoE Letter',            description: 'Confirmation of Enrolment from Australian institution', required: true },
        { name: 'OSHC Policy',           description: 'Overseas Student Health Cover insurance policy',        required: true },
        { name: 'Academic Transcripts',  description: 'Previous academic records / transcripts',              required: true },
        { name: 'English Proficiency',   description: 'IELTS (min 6.0) or equivalent',                       required: true },
      ],
    },

    // ── GERMANY ────────────────────────────────────────────────────────────
    {
      country: germany!._id,
      name: 'Schengen Tourist Visa',
      description: 'Tourism',
      price: 80,
      processingDays: 15,
      validity: '90 days within 180-day period',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Entry Type',       fieldName: 'entryType',       type: 'radio' as const,    required: true, options: ['Single Entry', 'Double Entry', 'Multiple Entry'], placeholder: '', order: 5 },
        { label: 'Accommodation',    fieldName: 'accommodation',   type: 'text' as const,     required: true, options: [], placeholder: 'Hotel name or host address', order: 6 },
        { label: 'Travel Purpose',   fieldName: 'travelPurpose',   type: 'textarea' as const, required: true, options: [], placeholder: 'Tourism, visiting family, cultural events…', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Travel Insurance',      description: 'Min €30,000 coverage valid for Schengen zone',         required: true  },
        { name: 'Flight Reservation',    description: 'Round-trip flight bookings',                           required: true  },
        { name: 'Hotel Booking',         description: 'Accommodation confirmation for entire stay',           required: true  },
        itrDoc, coverLetterDoc,
      ],
    },
    {
      country: germany!._id,
      name: 'Job Seeker Visa',
      description: 'Employment',
      price: 75,
      processingDays: 25,
      validity: '6 months',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Highest Qualification', fieldName: 'qualification',  type: 'text' as const, required: true,  options: [], placeholder: 'e.g. B.Tech Computer Science', order: 5 },
        { label: 'Years of Experience',   fieldName: 'experience',     type: 'number' as const, required: true, options: [], placeholder: 'e.g. 5', order: 6 },
        { label: 'German Language Level', fieldName: 'germanLevel',    type: 'select' as const, required: true, options: ['None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'], placeholder: '', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Degree / Diploma',         description: 'University degree recognised in Germany (APS if required)', required: true  },
        { name: 'CV / Resume',              description: 'Up-to-date curriculum vitae in German/English',             required: true  },
        { name: 'Language Certificate',     description: 'German or English language certificate',                   required: false },
        { name: 'Proof of Accommodation',   description: 'Booked accommodation in Germany',                         required: true  },
      ],
    },

    // ── FRANCE ─────────────────────────────────────────────────────────────
    {
      country: france!._id,
      name: 'Schengen Short-Stay Visa',
      description: 'Tourism',
      price: 80,
      processingDays: 15,
      validity: '90 days within 180-day period',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Entry Type',     fieldName: 'entryType',     type: 'radio' as const,    required: true,  options: ['Single Entry', 'Multiple Entry'], placeholder: '', order: 5 },
        { label: 'Travel Purpose', fieldName: 'travelPurpose', type: 'select' as const,   required: true,  options: ['Tourism', 'Family visit', 'Cultural event', 'Business'], placeholder: '', order: 6 },
        { label: 'Accommodation',  fieldName: 'accommodation', type: 'text' as const,     required: true,  options: [], placeholder: 'Hotel or host address in France', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Travel Insurance',   description: 'Min €30,000 coverage valid for Schengen area',          required: true  },
        { name: 'Flight Reservation', description: 'Confirmed round-trip flight bookings',                  required: true  },
        { name: 'Hotel Booking',      description: 'Accommodation confirmation for entire stay',            required: true  },
        itrDoc, coverLetterDoc,
      ],
    },
    {
      country: france!._id,
      name: 'Long-Stay Visa (D Visa)',
      description: 'Long-term stay',
      price: 99,
      processingDays: 20,
      validity: '1 year',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Purpose of Long Stay',  fieldName: 'purposeLongStay', type: 'select' as const, required: true, options: ['Work', 'Study', 'Family reunification', 'Retirement', 'Other'], placeholder: '', order: 5 },
        { label: 'Accommodation France',  fieldName: 'accommodationFr', type: 'text' as const,   required: true, options: [], placeholder: 'Full address in France', order: 6 },
        { label: 'French Language Level', fieldName: 'frenchLevel',     type: 'select' as const,  required: false, options: ['None', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'], placeholder: '', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc, itrDoc,
        { name: 'Proof of Accommodation', description: 'Lease contract or host declaration (Attestation d\'hébergement)', required: true },
        { name: 'Health Insurance',       description: 'Comprehensive health insurance valid in France',                  required: true },
        { name: 'Supporting Documents',   description: 'Admission letter / work contract / family certificate as applicable', required: true },
      ],
    },

    // ── JAPAN ──────────────────────────────────────────────────────────────
    {
      country: japan!._id,
      name: 'Tourist Visa',
      description: 'Tourism',
      price: 30,
      processingDays: 10,
      validity: '15 days / 30 days / 90 days (single or double entry)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Purpose of Visit',  fieldName: 'purposeOfVisit',  type: 'textarea' as const, required: true,  options: [], placeholder: 'Tourism, sightseeing, visiting friends…', order: 5 },
        { label: 'Intended Stay (days)', fieldName: 'intendedStay', type: 'number' as const,   required: true,  options: [], placeholder: 'e.g. 14', order: 6 },
        { label: 'Accommodation Japan', fieldName: 'accommodation', type: 'text' as const,     required: true,  options: [], placeholder: 'Hotel name or host address in Japan', order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Itinerary / Flight Booking', description: 'Detailed day-by-day itinerary and confirmed flights', required: true  },
        { name: 'Hotel Booking',              description: 'Accommodation confirmation for entire stay',          required: true  },
        itrDoc, coverLetterDoc,
      ],
    },
    {
      country: japan!._id,
      name: 'Work Visa (Engineer / Specialist)',
      description: 'Employment',
      price: 20,
      processingDays: 30,
      validity: '1–5 years (renewable)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Japanese Employer',  fieldName: 'japaneseEmployer',  type: 'text' as const, required: true, options: [], placeholder: 'Name of Japanese company', order: 5 },
        { label: 'Job Title',          fieldName: 'jobTitle',          type: 'text' as const, required: true, options: [], placeholder: 'e.g. Software Engineer',    order: 6 },
        { label: 'Annual Salary (JPY)', fieldName: 'annualSalary',     type: 'number' as const, required: true, options: [], placeholder: 'e.g. 4000000',           order: 7 },
        { label: 'Certificate of Eligibility No.', fieldName: 'coeNumber', type: 'text' as const, required: false, options: [], placeholder: 'If already obtained', order: 8 },
      ],
      documentRequirements: [
        passportDoc, photoDoc,
        { name: 'Certificate of Eligibility', description: 'CoE issued by Japanese immigration (if available)', required: false },
        { name: 'Employment Contract',        description: 'Signed contract from Japanese employer',            required: true  },
        { name: 'Degree Certificate',         description: 'University degree relevant to the job',            required: true  },
        { name: 'Residence Tax Certificate',  description: 'Employer\'s tax certificate (if available)',       required: false },
      ],
    },

    // ── UAE ────────────────────────────────────────────────────────────────
    {
      country: uae!._id,
      name: 'Tourist Visa (30 days)',
      description: 'Tourism',
      price: 90,
      processingDays: 3,
      validity: '30 days (extendable once)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Purpose of Visit',  fieldName: 'purposeOfVisit',  type: 'radio' as const,  required: true, options: ['Tourism', 'Visiting family', 'Transit'], placeholder: '', order: 5 },
        { label: 'UAE Hotel / Address', fieldName: 'uaeAddress',    type: 'text' as const,   required: true, options: [], placeholder: 'Hotel name or UAE sponsor address', order: 6 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Flight Booking',    description: 'Confirmed return flight tickets',                         required: true  },
        { name: 'Hotel Booking',     description: 'Accommodation confirmation in UAE',                       required: true  },
      ],
    },
    {
      country: uae!._id,
      name: 'Tourist Visa (90 days)',
      description: 'Tourism',
      price: 175,
      processingDays: 3,
      validity: '90 days (extendable)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'Purpose of Visit', fieldName: 'purposeOfVisit', type: 'radio' as const, required: true, options: ['Tourism', 'Visiting family', 'Business visit'], placeholder: '', order: 5 },
        { label: 'UAE Address',      fieldName: 'uaeAddress',     type: 'text' as const,  required: true, options: [], placeholder: 'Hotel or host address in UAE', order: 6 },
      ],
      documentRequirements: [
        passportDoc, photoDoc, bankDoc,
        { name: 'Flight Booking', description: 'Confirmed return flight tickets',            required: true },
        { name: 'Hotel Booking',  description: 'Accommodation confirmation',                required: true },
      ],
    },
    {
      country: uae!._id,
      name: 'Employment Visa',
      description: 'Employment',
      price: 550,
      processingDays: 7,
      validity: '2 years (renewable)',
      formFields: [
        passportField(1), dobField(2), nationalityField(3), occupationField(4),
        { label: 'UAE Employer',       fieldName: 'uaeEmployer',  type: 'text' as const, required: true, options: [], placeholder: 'Name of UAE company',              order: 5 },
        { label: 'Job Title',          fieldName: 'jobTitle',     type: 'text' as const, required: true, options: [], placeholder: 'Designation as per offer letter', order: 6 },
        { label: 'Monthly Salary (AED)', fieldName: 'salary',    type: 'number' as const, required: true, options: [], placeholder: 'e.g. 8000',                      order: 7 },
      ],
      documentRequirements: [
        passportDoc, photoDoc,
        { name: 'Offer Letter',          description: 'Signed offer letter from UAE employer',               required: true },
        { name: 'Educational Certificates', description: 'Attested degree / diploma',                       required: true },
        { name: 'Medical Certificate',   description: 'Medical fitness certificate from approved centre',   required: true },
        { name: 'Police Clearance',      description: 'Good conduct certificate from home country',         required: true },
      ],
    },
  ];

  await VisaType.insertMany(visaTypes);
  console.log(`✔ Visa types seeded (${visaTypes.length})`);

  console.log('\n✅ Seed completed successfully!');
  console.log(`   Admin : ${process.env.SUPER_ADMIN_USERNAME || '(set SUPER_ADMIN_USERNAME)'}`);
  console.log('   Login : username + password');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
