import type { DocumentStatus, DocumentSummary } from "../db/documents.js";

export const START_TEXT = `سلام! 👋 به دانشجویار خوش اومدی.

🎓 من دستیار هوشمند مطالعه‌ات هستم. می‌تونی جزوه‌هات رو به‌صورت PDF ارسال کنی و درباره محتوای اون‌ها سؤال بپرسی.

📌 **برای شروع:**
۱. فایل PDF جزوه‌ات رو ارسال کن.
۲. منتظر بمون تا پردازش فایل کامل بشه.
۳. سؤالت رو بپرس تا با کمک هوش مصنوعی بهت پاسخ بدم.

برای آشنایی با همه امکانات و دستورها، /help رو بفرست.

یادگیری بهتر، قدم‌به‌قدم! 🌱`;

export const HELP_TEXT = `📚 **راهنمای دانشجویار**

سلام! 👋 من دانشجویارم و بهت کمک می‌کنم راحت‌تر درس بخونی و سؤالاتت رو جواب بدی.

**چطور از من استفاده کنی؟**

📄 **۱. ارسال جزوه**
یک فایل PDF بفرست تا پردازشش کنم و به‌عنوان سند فعال انتخابش کنم.

💬 **۲. پرسیدن سؤال**
بعد از پردازش جزوه، کافیه سؤالت رو بپرسی. نیازی به انتخاب مجدد فایل نیست.

📚 **۳. مدیریت جزوه‌ها**
برای مشاهده جزوه‌های ذخیره‌شده، تغییر سند فعال یا حذف یک جزوه، دستور زیر رو بفرست:

/documents

❓ **۴. سؤال‌های عمومی**
اگر سؤالت به جزوه‌هات مربوط نباشه، می‌تونی مثل یک دستیار هوشمند ازم سؤال‌های عمومی هم بپرسی.


**دستورات کاربردی:**
/start — شروع کار با دانشجویار
/help — نمایش این راهنما
/about — درباره دانشجویار
/documents — مشاهده و مدیریت جزوه‌ها

💡 **نکته:** هر فایل PDF جدیدی که با موفقیت پردازش بشه، به‌صورت خودکار سند فعال می‌شه.`;

export const ABOUT_TEXT = `🎓 دانشجویار | دستیار هوشمند مطالعه

دانشجویار یک دستیار مطالعه در پیام‌رسان بله است که با کمک هوش مصنوعی، مطالعه و مرور مطالب درسی را ساده‌تر می‌کند.

✨ امکانات فعلی:
📄 دریافت و پردازش فایل‌های PDF
💬 پاسخ‌گویی به سؤالات درسی
📚 مشاهده و انتخاب جزوه‌ها
🗑️ حذف جزوه‌های ذخیره‌شده
⏹️ لغو درخواست‌های هوش مصنوعی در حال پردازش

دانشجویار در حال توسعه است و تلاش می‌کند تجربه مطالعه را کاربردی‌تر و راحت‌تر کند.

یادگیری بهتر، قدم‌به‌قدم! 🌱`;


// --- Document commands -----------------------------------------------------

export const DOCUMENT_STATUS_TEXT: Record<DocumentStatus, string> = {
  pending: "در انتظار پردازش",
  processing: "در حال پردازش",
  completed: "آماده مطالعه",
  failed: "پردازش ناموفق",
};

export const NO_DOCUMENTS_TEXT =
  "هنوز هیچ جزوه‌ای بارگذاری نکرده‌اید.\n\nبرای شروع، یک فایل PDF ارسال کنید.";

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
    : `📌 **سند فعال**\nهنوز سندی انتخاب نشده است.`;

  const list = documents
    .map(
      (document, index) =>
        `\t${index + 1}. ${document.filename}\n` +
        `\tشناسه: ${document.id}\n` +
        `\tوضعیت: ${DOCUMENT_STATUS_TEXT[document.status]}`,
    )
    .join("\n\n");

  return (
    `${activeText}\n\n` +
    `📚 **فهرست اسناد ذخیره‌شده**\n\n` +
    `${list}\n\n` +
    `🔄 **تغییر سند فعال**\n` +
    `اگر می‌خوای به‌جای سند فعلی، از یکی از جزوه‌های قبلی استفاده کنی، شناسه اون رو با دستور زیر وارد کن:\n` +
    `ID /select \n` +
    `مثلاً: 3 /select \n\n` +
    `🗑️ **حذف جزوه**\n` +
    `برای حذف جزوه‌ای که دیگه بهش نیاز نداری، از دستور زیر استفاده کن:\n` +
    `ID /delete \n` +
    `مثلاً: 3 /delete \n\n` +
    `💡 **نکته:** هر PDF جدیدی که با موفقیت پردازش بشه، به‌صورت خودکار سند فعال می‌شه.\n\n`
  );
}

export const SELECT_USAGE_TEXT =
  "لطفاً شناسه فایل را به شکل زیر وارد کنید:\n/select 1";

export const SELECT_FAILED_TEXT =
  "فایل موردنظر پیدا نشد، پردازش آن کامل نشده یا متعلق به شما نیست. ابتدا /documents را بررسی کنید.";

export const selectedText = (documentId: number): string =>
  `فایل شماره ${documentId} برای مطالعه انتخاب شد.`;

export const DELETE_USAGE_TEXT =
  "لطفاً شناسه جزوه را به شکل زیر وارد کن:\n/delete 1";

export const DELETE_NOT_FOUND_TEXT =
  "جزوه موردنظر پیدا نشد یا متعلق به شما نیست. برای دیدن جزوه‌ها از /documents استفاده کن.";

export const deleteConfirmationText = (
  filename: string,
  documentId: number,
): string =>
  `🗑️ تأیید حذف جزوه\n\n` +
  `نام فایل: ${filename}\n` +
  `شناسه: ${documentId}\n\n` +
  "آیا مطمئنی که می‌خواهی این جزوه را حذف کنی؟\n\n" +
  "برای تأیید، دستور /confirm_delete را بفرست.\n" +
  "برای انصراف، دستور /cancel_delete را بفرست.\n\n" +
  "⚠️ با حذف جزوه، محتوای ذخیره‌شده آن نیز پاک می‌شود.";

export const NO_PENDING_DELETE_TEXT =
  "درخواست حذف فعالی وجود ندارد. برای شروع، از دستور /delete ID استفاده کن.";

export const deleteSucceededText = (documentId: number): string =>
  `✅ جزوه با شناسه ${documentId} با موفقیت حذف شد.`;

export const DELETE_FAILED_TEXT =
  "❌ حذف جزوه انجام نشد. ممکن است فایل قبلاً حذف شده باشد یا متعلق به شما نباشد.";

export const NO_PENDING_DELETE_TO_CANCEL_TEXT =
  "درخواست حذف فعالی برای لغو وجود ندارد.";

export const DELETE_CANCELLED_TEXT =
  "عملیات حذف لغو شد. فایل شما حفظ شده است.";

// --- Chat / pipeline --------------------------------------------------------

export const SAVE_MESSAGE_FAILED_TEXT =
  "ذخیره پیام شما با مشکل مواجه شد. لطفاً کمی بعد دوباره تلاش کنید.";

export const PROCESSING_FAILED_TEXT =
  "متأسفم، هنگام پردازش پیام شما مشکلی پیش آمد. لطفاً کمی بعد دوباره تلاش کنید.";

export const THINKING_NOTICE_TEXT =
  "⏳ دارم سؤال تو رو بررسی می‌کنم و پاسخ رو آماده می‌کنم...\n\n" +
  "برای توقف عملیات، دستور /cancel رو بفرست.";

export const REQUEST_CANCELLED_TEXT = "درخواست لغو شد.";

export const NO_REQUEST_TO_CANCEL_TEXT =
  "در حال حاضر درخواست فعالی برای لغو وجود ندارد.";

// --- PDF upload -------------------------------------------------------------

export const NOT_A_PDF_TEXT = "لطفاً فایل را با فرمت PDF ارسال کنید.";

export const FILE_TOO_LARGE_TEXT = "حجم فایل بیشتر از محدودیت ۲۰ مگابایت است.";

export const FILE_RECEIVED_TEXT =
  "فایل شما دریافت شد. در حال پردازش و آماده‌سازی برای پاسخ‌گویی هستم...";

export const ocrStartedText = (total: number, skipped: number): string =>
  `🔍 ${total} صفحه از این فایل متن قابل‌خواندن ندارد (اسکن‌شده یا خراب است) و با هوش مصنوعی خوانده می‌شود. ` +
  `این کار ممکن است چند دقیقه طول بکشد.` +
  (skipped > 0
    ? `
⚠️ ${skipped} صفحه دیگر به‌دلیل محدودیت تعداد صفحه خوانده نمی‌شود.`
    : "");

export const ocrProgressText = (done: number, total: number): string =>
  `⏳ خواندن صفحه‌ها: ${done} از ${total}`;

export const fileProcessedText = (ocrPages: number): string =>
  FILE_PROCESSED_TEXT +
  (ocrPages > 0 ? `

(${ocrPages} صفحه با تشخیص متن خوانده شد.)` : "");

export const FILE_PROCESSED_TEXT = `✅ فایل PDF با موفقیت پردازش شد و به‌عنوان **سند فعال** انتخاب شد.

از این به بعد می‌تونی مستقیماً سؤالاتت رو درباره همین فایل بپرسی.

📚 **برای مشاهده فایل‌های قبلی یا تغییر سند فعال:**
/documents`;
