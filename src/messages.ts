/**
 * Every text the user can see, in one place.
 *
 * Style guide (keep new messages consistent with it):
 * - Persian only; the only Latin text allowed is "PDF" and command names.
 * - Friendly, informal "تو" voice (می‌تونی، بفرست، دوباره امتحان کن).
 * - Bold (**...**) only for section titles; one emoji at the start of a section.
 * - Commands are written like /select 3 so they are easy to copy.
 */
import type { DocumentStatus, DocumentSummary } from "./db/documents.js";

// --- Info commands -----------------------------------------------------------

export const START_TEXT = `سلام! 👋 به دانشجویار خوش اومدی.

🎓 من دستیار هوشمند مطالعه‌ات هستم. جزوه‌هات رو به‌صورت PDF برام بفرست تا بتونی درباره‌شون ازم سؤال بپرسی.

📌 **برای شروع:**
۱. فایل PDF جزوه‌ات رو بفرست.
۲. صبر کن تا پردازش فایل تموم بشه.
۳. سؤالت رو بپرس تا بر اساس جزوه جوابت رو بدم.

برای دیدن همه دستورها، /help رو بفرست.

یادگیری بهتر، قدم‌به‌قدم! 🌱`;

export const HELP_TEXT = `📚 **راهنمای دانشجویار**

من بهت کمک می‌کنم راحت‌تر درس بخونی و جواب سؤال‌هات رو از روی جزوه‌هات پیدا کنی.

**چطور ازم استفاده کنی؟**

📄 **۱. فرستادن جزوه**
یک فایل PDF بفرست. بعد از پردازش، خودکار به‌عنوان سند فعال انتخاب می‌شه. اگه فایل اسکن‌شده باشه، پردازشش چند دقیقه طول می‌کشه.

💬 **۲. پرسیدن سؤال**
سؤالت رو درباره سند فعال بپرس. لازم نیست هر بار فایل رو دوباره انتخاب کنی.

📚 **۳. مدیریت جزوه‌ها**
برای دیدن جزوه‌هات، عوض کردن سند فعال یا حذف یک جزوه، /documents رو بفرست.

🌐 **۴. سؤال‌های عمومی**
اگه سؤالت به جزوه‌هات ربطی نداشته باشه، مثل یک دستیار هوشمند معمولی جوابت رو می‌دم.

**دستورها:**
/start — شروع
/help — نمایش این راهنما
/about — درباره دانشجویار
/documents — دیدن و مدیریت جزوه‌ها
/select 1 — انتخاب سند فعال
/delete 1 — حذف یک جزوه
/cancel — لغو درخواست در حال انجام

💡 **نکته:** هر PDF جدیدی که با موفقیت پردازش بشه، خودکار سند فعال می‌شه.`;

export const ABOUT_TEXT = `🎓 **دانشجویار** | دستیار هوشمند مطالعه

دانشجویار یک دستیار مطالعه در پیام‌رسان بله است که با کمک هوش مصنوعی، مرور و فهمیدن مطالب درسی رو راحت‌تر می‌کنه.

✨ **امکانات فعلی:**
📄 دریافت و پردازش فایل‌های PDF (حتی اسکن‌شده)
💬 جواب دادن به سؤال‌های درسی از روی جزوه‌هات
📚 دیدن و انتخاب جزوه‌ها
🗑️ حذف جزوه‌های ذخیره‌شده
⏹️ لغو درخواست‌های در حال انجام

دانشجویار هنوز در حال توسعه‌ست و مدام بهتر می‌شه.

یادگیری بهتر، قدم‌به‌قدم! 🌱`;

// --- Documents ---------------------------------------------------------------

export const DOCUMENT_STATUS_TEXT: Record<DocumentStatus, string> = {
  pending: "در انتظار پردازش",
  processing: "در حال پردازش",
  completed: "آماده مطالعه",
  failed: "پردازش ناموفق",
};

export const NO_DOCUMENTS_TEXT =
  "هنوز هیچ جزوه‌ای نفرستادی.\n\nبرای شروع، یک فایل PDF برام بفرست. 📄";

export function documentsListText(
  documents: DocumentSummary[],
  selectedDocumentId: number | null,
): string {
  const active = documents.find((document) => document.id === selectedDocumentId);

  const activeText = active
    ? `📌 **سند فعال**\n` +
      `📄 ${active.filename}\n` +
      `شناسه: ${active.id}\n` +
      `وضعیت: ${DOCUMENT_STATUS_TEXT[active.status]}`
    : `📌 **سند فعال**\nهنوز سندی انتخاب نشده.`;

  const list = documents
    .map(
      (document, index) =>
        `${index + 1}. ${document.filename}\n` +
        `   شناسه: ${document.id}\n` +
        `   وضعیت: ${DOCUMENT_STATUS_TEXT[document.status]}`,
    )
    .join("\n\n");

  return (
    `${activeText}\n\n` +
    `📚 **جزوه‌های تو**\n\n` +
    `${list}\n\n` +
    `🔄 **تغییر سند فعال**\n` +
    `برای استفاده از یکی از جزوه‌های قبلی، دستور /select و شناسه‌اش رو بفرست.\n` +
    `مثلاً: /select 3\n\n` +
    `🗑️ **حذف جزوه**\n` +
    `برای حذف یک جزوه، دستور /delete و شناسه‌اش رو بفرست.\n` +
    `مثلاً: /delete 3\n\n` +
    `💡 **نکته:** هر PDF جدیدی که با موفقیت پردازش بشه، خودکار سند فعال می‌شه.`
  );
}

export const SELECT_USAGE_TEXT = "شناسه جزوه رو این‌طوری وارد کن:\n/select 1";

export const SELECT_FAILED_TEXT =
  "این جزوه پیدا نشد، هنوز پردازشش تموم نشده یا مال تو نیست. شناسه‌ها رو از /documents ببین.";

export const selectedText = (documentId: number): string =>
  `✅ جزوه شماره ${documentId} به‌عنوان سند فعال انتخاب شد. حالا می‌تونی سؤالت رو بپرسی.`;

// --- Deleting a document -------------------------------------------------------

export const DELETE_USAGE_TEXT = "شناسه جزوه رو این‌طوری وارد کن:\n/delete 1";

export const DELETE_NOT_FOUND_TEXT =
  "این جزوه پیدا نشد یا مال تو نیست. شناسه‌ها رو از /documents ببین.";

export const deleteConfirmationText = (
  filename: string,
  documentId: number,
): string =>
  `🗑️ **تأیید حذف جزوه**\n\n` +
  `نام فایل: ${filename}\n` +
  `شناسه: ${documentId}\n\n` +
  `مطمئنی می‌خوای این جزوه رو حذف کنی؟\n\n` +
  `برای تأیید: /confirm_delete\n` +
  `برای انصراف: /cancel_delete\n\n` +
  `⚠️ با حذف جزوه، محتوای ذخیره‌شده‌ش هم برای همیشه پاک می‌شه. این درخواست فقط یک دقیقه معتبره.`;

export const NO_PENDING_DELETE_TEXT =
  "درخواست حذفی در انتظار نیست. برای شروع، دستور /delete و شناسه جزوه رو بفرست.";

export const deleteSucceededText = (documentId: number): string =>
  `✅ جزوه شماره ${documentId} حذف شد.`;

export const DELETE_FAILED_TEXT =
  "❌ جزوه حذف نشد. شاید قبلاً حذف شده یا مال تو نیست.";

export const NO_PENDING_DELETE_TO_CANCEL_TEXT =
  "درخواست حذفی برای لغو کردن وجود نداره.";

export const DELETE_CANCELLED_TEXT = "حذف لغو شد. جزوه‌ات سر جاشه. 👍";

// --- Uploading a PDF -----------------------------------------------------------

export const NOT_A_PDF_TEXT =
  "فقط فایل PDF قبول می‌کنم. لطفاً جزوه‌ات رو با فرمت PDF بفرست.";

export const FILE_TOO_LARGE_TEXT =
  "حجم فایل بیشتر از ۲۰ مگابایته. لطفاً فایل کوچک‌تری بفرست.";

export const FILE_RECEIVED_TEXT =
  "📥 فایلت رسید. دارم پردازشش می‌کنم، یه کم صبر کن...";

export const ocrStartedText = (total: number, skipped: number): string =>
  `🔍 ${total} صفحه از این فایل متن قابل‌خوندن نداره (اسکن‌شده یا خرابه) و باید با هوش مصنوعی خونده بشه. ` +
  `این کار ممکنه چند دقیقه طول بکشه.` +
  (skipped > 0
    ? `\n⚠️ ${skipped} صفحه دیگه به‌خاطر محدودیت تعداد صفحه خونده نمی‌شه.`
    : "");

export const ocrProgressText = (done: number, total: number): string =>
  `⏳ خوندن صفحه‌ها: ${done} از ${total}`;

export const fileProcessedText = (ocrPages: number): string =>
  `✅ جزوه‌ات آماده‌ست و به‌عنوان **سند فعال** انتخاب شد.\n\n` +
  `حالا می‌تونی مستقیم درباره‌ش سؤال بپرسی.\n\n` +
  `📚 برای دیدن جزوه‌های قبلی یا عوض کردن سند فعال: /documents` +
  (ocrPages > 0 ? `\n\n🔍 ${ocrPages} صفحه با تشخیص متن خونده شد.` : "");

// --- Chatting ------------------------------------------------------------------

export const THINKING_NOTICE_TEXT =
  "⏳ دارم سؤالت رو بررسی می‌کنم و جواب رو آماده می‌کنم...\n\n" +
  "برای توقف، /cancel رو بفرست.";

export const REQUEST_CANCELLED_TEXT = "⏹️ درخواستت لغو شد.";

export const NO_REQUEST_TO_CANCEL_TEXT =
  "الان درخواستی در حال انجام نیست که لغو کنم.";

// --- Answers from documents ---------------------------------------------------

export const NO_DOCUMENT_SELECTED_TEXT =
  "هنوز جزوه‌ای برای مطالعه انتخاب نکردی.\n\n" +
  "با /documents فهرست جزوه‌هات رو ببین و با /select شناسه جزوه رو انتخاب کن.\n" +
  "مثلاً: /select 1";

export const NO_DOCUMENT_CONTENT_TEXT =
  "توی جزوه انتخاب‌شده محتوایی پیدا نکردم.";

export const NO_RELEVANT_CONTENT_TEXT =
  "توی جزوه انتخاب‌شده چیز مرتبطی با سؤالت پیدا نکردم.";

export const SOURCES_HEADING = "**منابع:**";

export const sourceLineText = (filename: string, pageNumber: number): string =>
  `${filename} — صفحه ${pageNumber}`;

// --- Errors ------------------------------------------------------------------

export const SAVE_MESSAGE_FAILED_TEXT =
  "نتونستم پیامت رو ذخیره کنم. لطفاً کمی بعد دوباره امتحان کن.";

export const PROCESSING_FAILED_TEXT =
  "ببخشید، موقع پردازش پیامت مشکلی پیش اومد. لطفاً کمی بعد دوباره امتحان کن.";

export const FILE_TIMEOUT_TEXT =
  "پردازش فایل بیش از حد طول کشید. لطفاً کمی بعد دوباره امتحان کن.";

export const AI_UNAVAILABLE_TEXT =
  "سرویس هوش مصنوعی الان در دسترس نیست. لطفاً کمی بعد دوباره امتحان کن.";

export const PDF_UNREADABLE_TEXT =
  "نتونستم فایل PDF رو بخونم. مطمئن شو فایل سالمه و دوباره بفرستش.";

export const FILE_PROCESSING_FAILED_TEXT =
  "پردازش فایل با خطا مواجه شد. لطفاً کمی بعد دوباره امتحان کن.";
