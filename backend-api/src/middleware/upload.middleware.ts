import multer from 'multer';

const unsupported = (message: string) => Object.assign(new Error(message), { code: 'UNSUPPORTED_FILE' });

const storage = multer.memoryStorage();

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(unsupported('Only JPEG, PNG, and PDF files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const WORD_TYPES = ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
export const isWordFile = (mimetype: string) => WORD_TYPES.includes(mimetype);

// Application documents: images, PDF and Word.
export const uploadApplicationDoc = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', ...WORD_TYPES].includes(file.mimetype)) cb(null, true);
    else cb(unsupported('Only JPG, PNG, PDF and Word files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Visa downloads are forms and checklists, so Word and Excel files are allowed too.
const DOWNLOAD_TYPES = [
  'image/jpeg', 'image/png', 'image/jpg', 'application/pdf',
  ...WORD_TYPES,
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const uploadDownload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (DOWNLOAD_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(unsupported('Only PDF, Word, Excel, JPEG and PNG files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});
