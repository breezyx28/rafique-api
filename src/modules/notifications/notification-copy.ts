export type ShopLanguage = 'en' | 'ar' | 'bn';

type NotificationCopy = {
  item: string;
  inventoryAlert: string;
  followUp: string;
  lowStock: (name: string, qty: string | number) => string;
  dueIn2: (orderNumber: string) => string;
  dueTomorrow: (orderNumber: string) => string;
  dueToday: (orderNumber: string) => string;
  overdue: (orderNumber: string) => string;
  customer: (name: string) => string;
  balanceOpen: (orderNumber: string, amount: string) => string;
  balanceOverdue: (orderNumber: string, amount: string) => string;
  needsCustomer: string;
};

const COPY: Record<ShopLanguage, NotificationCopy> = {
  en: {
    item: 'Item',
    inventoryAlert: 'Inventory alert',
    followUp: 'Follow up with the customer for pickup.',
    lowStock: (name, qty) => `Low stock: ${name} (qty ${qty})`,
    dueIn2: (orderNumber) => `Order #${orderNumber} is due in 2 days`,
    dueTomorrow: (orderNumber) => `Order #${orderNumber} is due tomorrow`,
    dueToday: (orderNumber) => `Delivery day is today: Order #${orderNumber}`,
    overdue: (orderNumber) => `Delivery date has passed: Order #${orderNumber}`,
    customer: (name) => `Customer: ${name}`,
    balanceOpen: (orderNumber, amount) =>
      `Invoice #${orderNumber} still has ${amount} unpaid`,
    balanceOverdue: (orderNumber, amount) =>
      `Overdue balance ${amount} on invoice #${orderNumber}`,
    needsCustomer: 'This balance still needs a customer name and phone.',
  },
  ar: {
    item: 'صنف',
    inventoryAlert: 'تنبيه مخزون',
    followUp: 'تابع مع العميل للاستلام.',
    lowStock: (name, qty) => `مخزون منخفض: ${name} (الكمية ${qty})`,
    dueIn2: (orderNumber) => `الطلب #${orderNumber} يستحق خلال يومين`,
    dueTomorrow: (orderNumber) => `الطلب #${orderNumber} يستحق غداً`,
    dueToday: (orderNumber) => `يوم التسليم اليوم: طلب #${orderNumber}`,
    overdue: (orderNumber) => `تجاوز تاريخ التسليم: طلب #${orderNumber}`,
    customer: (name) => `العميل: ${name}`,
    balanceOpen: (orderNumber, amount) =>
      `الفاتورة #${orderNumber} ما زال عليها ${amount} غير مدفوع`,
    balanceOverdue: (orderNumber, amount) =>
      `رصيد متأخر ${amount} على الفاتورة #${orderNumber}`,
    needsCustomer: 'هذا الرصيد ما زال يحتاج اسم العميل وهاتفه.',
  },
  bn: {
    item: 'আইটেম',
    inventoryAlert: 'ইনভেন্টরি সতর্কতা',
    followUp: 'সংগ্রহের জন্য গ্রাহকের সাথে যোগাযোগ করুন।',
    lowStock: (name, qty) => `কম স্টক: ${name} (পরিমাণ ${qty})`,
    dueIn2: (orderNumber) => `অর্ডার #${orderNumber} ২ দিন পর সংগ্রহের`,
    dueTomorrow: (orderNumber) => `অর্ডার #${orderNumber} কাল সংগ্রহের`,
    dueToday: (orderNumber) => `আজ ডেলিভারি দিন: অর্ডার #${orderNumber}`,
    overdue: (orderNumber) => `ডেলিভারি তারিখ পার হয়ে গেছে: অর্ডার #${orderNumber}`,
    customer: (name) => `গ্রাহক: ${name}`,
    balanceOpen: (orderNumber, amount) =>
      `চালান #${orderNumber}-এ এখনও ${amount} বাকি`,
    balanceOverdue: (orderNumber, amount) =>
      `চালান #${orderNumber}-এ মেয়াদোত্তীর্ণ বাকি ${amount}`,
    needsCustomer: 'এই বাকিতে এখনও গ্রাহকের নাম ও ফোন লাগবে।',
  },
};

export function shopLanguage(value: unknown): ShopLanguage {
  const lang = String(value ?? 'en').split('-')[0];
  return lang === 'ar' || lang === 'bn' ? lang : 'en';
}

export function notificationCopy(lang: ShopLanguage): NotificationCopy {
  return COPY[lang];
}
