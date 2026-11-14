import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ==========================================================================
   BillingSection  (frontend only, no backend)
   --------------------------------------------------------------------------
   Lives inside SettingsPage as the "Billing & plan" section.
   - Choose a plan and billing cycle
   - Add a payment method (Card or UPI) with live validation
   - "Pay" runs a MOCK payment (setTimeout) and updates plan + invoices
   - Only the last 4 digits / UPI id are kept in state. The full card number
     and CVC are cleared as soon as the payment is submitted.

   When you add a backend later, replace `mockCharge()` with a call to your
   payment provider (Stripe Elements, Razorpay Checkout, etc.). Never send raw
   card numbers to your own server.

   Props:
     delay      entrance animation delay (same as the other sections)
     onNotify   (message) => void   shows a toast in SettingsPage
     onPlanChange  optional (planId) => void  lets the parent react to upgrades
   ========================================================================== */

const CURRENCY = '$';

const PLANS = [
  { id: 'free', name: 'Free', price: 0, blurb: 'For trying things out', features: ['Up to 3 projects', '1 active sprint', 'Basic analytics'] },
  { id: 'pro', name: 'Pro', price: 12, blurb: 'For growing teams', features: ['Unlimited projects', 'Unlimited sprints', 'Copilot suggestions', 'Full analytics'], popular: true },
  { id: 'team', name: 'Team', price: 29, blurb: 'For larger organisations', features: ['Everything in Pro', 'Priority neural engine', 'Audit logs', 'Priority support'] },
];
const YEARLY_DISCOUNT = 0.2;

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary';
const inputCls = 'w-full px-space-md py-2.5 rounded-xl bg-surface-container-low text-on-surface border border-outline-variant/30 text-sm transition hover:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent placeholder:text-outline';

/* ---------- helpers ---------- */

const money = (n) => `${CURRENCY}${n.toFixed(2)}`;

const luhn = (digits) => {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return digits.length > 0 && sum % 10 === 0;
};

const detectBrand = (digits) => {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(60|65|81|82)/.test(digits)) return 'RuPay';
  return 'Card';
};

const formatCardNumber = (raw) => raw.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();

const formatExpiry = (raw) => {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const expiryValid = (value) => {
  const m = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  // A card is valid through the end of its expiry month.
  return new Date(year, month, 0, 23, 59, 59) >= now;
};

const upiValid = (v) => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(v.trim());

const validateCard = (f) => {
  const digits = f.number.replace(/\s/g, '');
  const brand = detectBrand(digits);
  const errors = {};
  if (f.name.trim().length < 2) errors.name = 'Enter the name on the card.';
  if (digits.length < 13 || !luhn(digits)) errors.number = 'Enter a valid card number.';
  if (!expiryValid(f.expiry)) errors.expiry = 'Enter a valid expiry (MM/YY).';
  const cvcLen = brand === 'Amex' ? 4 : 3;
  if (f.cvc.length !== cvcLen) errors.cvc = `${cvcLen} digits.`;
  return errors;
};

// Stand-in for a real payment provider call. Resolves after a short delay.
const mockCharge = () => new Promise((resolve) => setTimeout(resolve, 1400));

const today = () => new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`} aria-hidden="true">{name}</span>
);

const FieldError = ({ id, children }) => (children
  ? <p id={id} role="alert" className="text-xs text-error">{children}</p>
  : null);

/* ==========================================================================
   Component
   ========================================================================== */

const BillingSection = ({ delay = 0, onNotify, onPlanChange }) => {
  const [plan, setPlan] = useState('free');           // active plan
  const [target, setTarget] = useState('pro');        // plan being purchased
  const [cycle, setCycle] = useState('monthly');
  const [seats, setSeats] = useState(5);
  const [method, setMethod] = useState(null);         // { type:'card', brand, last4, expiry, name } | { type:'upi', vpa }
  const [changing, setChanging] = useState(false);    // showing the form although a method is saved
  const [tab, setTab] = useState('card');
  const [card, setCard] = useState({ name: '', number: '', expiry: '', cvc: '' });
  const [upi, setUpi] = useState('');
  const [tried, setTried] = useState(false);          // show errors after the first submit attempt
  const [paying, setPaying] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const notify = (m) => onNotify?.(m);
  const showForm = !method || changing;

  const targetPlan = PLANS.find((p) => p.id === target);
  const activePlan = PLANS.find((p) => p.id === plan);

  const totals = useMemo(() => {
    const unit = targetPlan.price * (cycle === 'yearly' ? 1 - YEARLY_DISCOUNT : 1);
    const periods = cycle === 'yearly' ? 12 : 1;
    const subtotal = unit * seats * periods;
    return { unit, subtotal, periods };
  }, [targetPlan, cycle, seats]);

  const cardErrors = useMemo(() => validateCard(card), [card]);
  const upiError = upiValid(upi) ? '' : 'Enter a valid UPI ID, like name@bank.';
  const formValid = tab === 'card' ? Object.keys(cardErrors).length === 0 : !upiError;

  const brand = detectBrand(card.number.replace(/\s/g, ''));
  const alreadyOnPlan = plan === target;
  const canPay = target !== 'free' && !alreadyOnPlan && !paying;

  const downgrade = () => {
    setPlan('free');
    setTarget('pro');
    onPlanChange?.('free');
    notify('You are back on the Free plan.');
  };

  const pay = async () => {
    if (!canPay) return;
    let chosen = method;
    if (showForm) {
      setTried(true);
      if (!formValid) return;
      chosen = tab === 'card'
        ? { type: 'card', brand, last4: card.number.replace(/\s/g, '').slice(-4), expiry: card.expiry, name: card.name.trim() }
        : { type: 'upi', vpa: upi.trim() };
    }
    setPaying(true);
    try {
      await mockCharge();
      if (!mounted.current) return;
      setMethod(chosen);
      setChanging(false);
      // Clear sensitive values right after submit.
      setCard({ name: '', number: '', expiry: '', cvc: '' });
      setUpi('');
      setTried(false);
      setPlan(target);
      onPlanChange?.(target);
      setInvoices((list) => [
        {
          id: `INV-${String(list.length + 1).padStart(4, '0')}`,
          date: today(),
          desc: `${targetPlan.name} plan, ${seats} seat${seats > 1 ? 's' : ''}, ${cycle}`,
          amount: totals.subtotal,
        },
        ...list,
      ]);
      notify(`Payment of ${money(totals.subtotal)} received. You are on ${targetPlan.name}.`);
    } catch {
      notify('Payment failed. Please try again.');
    } finally {
      if (mounted.current) setPaying(false);
    }
  };

  const removeMethod = () => {
    setMethod(null);
    setChanging(false);
    notify('Payment method removed.');
  };

  const downloadInvoice = (inv) => {
    try {
      const text = [`Invoice ${inv.id}`, `Date: ${inv.date}`, `Item: ${inv.desc}`, `Amount: ${money(inv.amount)}`, 'Status: Paid (demo)'].join('\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      notify('Download failed. Please try again.');
    }
  };

  const showErr = (key) => (tried ? cardErrors[key] : '');

  return (
    <section
      id="settings-billing" aria-labelledby="settings-billing-title" style={{ animationDelay: `${delay}ms` }}
      className="st-enter relative scroll-mt-24 rounded-2xl bg-surface-container/60 border border-outline-variant/30 transition-[border-color] duration-300 hover:border-secondary/30"
    >
      <div className="flex flex-col gap-space-lg p-space-lg">
        {/* Heading */}
        <div className="flex items-start gap-3 border-b border-outline-variant/20 pb-space-sm">
          <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0 shadow-inner text-primary">
            <Icon name="credit_card" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="settings-billing-title" className="text-lg font-semibold text-on-surface">Billing & plan</h2>
              <span className="inline-flex items-center gap-1 text-xs text-secondary bg-secondary/10 border border-secondary/25 px-2 py-0.5 rounded-full">
                {activePlan.name} plan
              </span>
            </div>
            <p className="text-sm text-on-surface-variant">Choose a plan, add a payment method and see your invoices.</p>
          </div>
        </div>

        {/* Plans */}
        <div className="flex flex-col gap-space-md">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-outline">Plan</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">Yearly billing saves {YEARLY_DISCOUNT * 100}%.</p>
            </div>
            <div role="radiogroup" aria-label="Billing cycle" className="inline-flex p-1 gap-1 rounded-xl bg-surface-container-low border border-outline-variant/30">
              {[['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([v, l]) => (
                <button
                  key={v} type="button" role="radio" aria-checked={cycle === v} onClick={() => setCycle(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition cursor-pointer active:scale-95 ${focusRing} ${cycle === v ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div role="radiogroup" aria-label="Plans" className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {PLANS.map((p) => {
              const selected = target === p.id;
              const current = plan === p.id;
              const price = p.price * (cycle === 'yearly' ? 1 - YEARLY_DISCOUNT : 1);
              return (
                <button
                  key={p.id} type="button" role="radio" aria-checked={selected} onClick={() => setTarget(p.id)}
                  className={`text-left flex flex-col gap-2 rounded-xl border p-space-md transition active:scale-[.99] cursor-pointer ${focusRing} ${selected ? 'border-secondary bg-secondary/[0.07] ring-1 ring-secondary/60' : 'border-outline-variant/30 bg-surface-container-low hover:border-secondary/40'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-on-surface">{p.name}</span>
                    {current
                      ? <span className="text-xs text-secondary bg-secondary/10 border border-secondary/25 px-2 py-0.5 rounded-full">Current</span>
                      : p.popular && <span className="text-xs text-tertiary bg-tertiary/10 border border-tertiary/20 px-2 py-0.5 rounded-full">Popular</span>}
                  </span>
                  <span className="text-on-surface">
                    <span className="text-2xl font-semibold tabular-nums">{money(price)}</span>
                    <span className="text-xs text-on-surface-variant"> / seat / month</span>
                  </span>
                  <span className="text-xs text-on-surface-variant">{p.blurb}</span>
                  <ul className="flex flex-col gap-1 mt-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <Icon name="check" className="text-sm text-secondary" /> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        <hr className="border-0 border-t border-outline-variant/20" />

        {/* Payment + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-space-lg items-start">
          <div className="flex flex-col gap-space-md min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-outline">Payment method</h3>

            {method && !changing && (
              <div className="flex items-center gap-3 p-space-md rounded-xl border border-outline-variant/30 bg-surface-container-low">
                <span className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-secondary shrink-0">
                  <Icon name={method.type === 'card' ? 'credit_card' : 'qr_code_2'} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {method.type === 'card' ? `${method.brand} ending in ${method.last4}` : method.vpa}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {method.type === 'card' ? `Expires ${method.expiry} · ${method.name}` : 'UPI'}
                  </p>
                </div>
                <button type="button" onClick={() => { setChanging(true); setTried(false); }} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition cursor-pointer ${focusRing}`}>Change</button>
                <button type="button" onClick={removeMethod} aria-label="Remove payment method" className={`p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container-high transition cursor-pointer ${focusRing}`}>
                  <Icon name="delete" className="text-base" />
                </button>
              </div>
            )}

            {showForm && (
              <div className="flex flex-col gap-space-md">
                <div role="tablist" aria-label="Payment type" className="inline-flex self-start p-1 gap-1 rounded-xl bg-surface-container-low border border-outline-variant/30">
                  {[['card', 'Card', 'credit_card'], ['upi', 'UPI', 'qr_code_2']].map(([v, l, ic]) => (
                    <button
                      key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => { setTab(v); setTried(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition cursor-pointer active:scale-95 ${focusRing} ${tab === v ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'}`}
                    >
                      <Icon name={ic} className="text-base" /> {l}
                    </button>
                  ))}
                </div>

                {tab === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label htmlFor="bl-name" className="text-sm font-semibold text-on-surface">Name on card</label>
                      <input id="bl-name" type="text" autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} aria-invalid={!!showErr('name')} aria-describedby="bl-name-err" className={inputCls} placeholder="Full name" />
                      <FieldError id="bl-name-err">{showErr('name')}</FieldError>
                    </div>
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label htmlFor="bl-number" className="text-sm font-semibold text-on-surface">Card number</label>
                      <div className="relative">
                        <input id="bl-number" type="text" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })} aria-invalid={!!showErr('number')} aria-describedby="bl-number-err" className={`${inputCls} pr-24 tabular-nums`} placeholder="1234 5678 9012 3456" />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-outline">{brand !== 'Card' ? brand : ''}</span>
                      </div>
                      <FieldError id="bl-number-err">{showErr('number')}</FieldError>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="bl-exp" className="text-sm font-semibold text-on-surface">Expiry</label>
                      <input id="bl-exp" type="text" inputMode="numeric" autoComplete="cc-exp" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} aria-invalid={!!showErr('expiry')} aria-describedby="bl-exp-err" className={`${inputCls} tabular-nums`} placeholder="MM/YY" />
                      <FieldError id="bl-exp-err">{showErr('expiry')}</FieldError>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="bl-cvc" className="text-sm font-semibold text-on-surface">CVC</label>
                      <input id="bl-cvc" type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} aria-invalid={!!showErr('cvc')} aria-describedby="bl-cvc-err" className={`${inputCls} tabular-nums`} placeholder="•••" />
                      <FieldError id="bl-cvc-err">{showErr('cvc')}</FieldError>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-w-md">
                    <label htmlFor="bl-upi" className="text-sm font-semibold text-on-surface">UPI ID</label>
                    <input id="bl-upi" type="text" autoComplete="off" value={upi} onChange={(e) => setUpi(e.target.value)} aria-invalid={tried && !!upiError} aria-describedby="bl-upi-err" className={inputCls} placeholder="name@bank" />
                    <FieldError id="bl-upi-err">{tried ? upiError : ''}</FieldError>
                    <p className="text-xs text-on-surface-variant">You would approve the request in your UPI app.</p>
                  </div>
                )}

                {changing && (
                  <button type="button" onClick={() => { setChanging(false); setTried(false); }} className={`self-start text-xs font-medium text-on-surface-variant hover:text-on-surface transition cursor-pointer ${focusRing}`}>
                    Keep saved method
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          <aside aria-label="Order summary" className="flex flex-col gap-space-sm p-space-md rounded-xl border border-outline-variant/30 bg-surface-container-low">
            <h3 className="text-sm font-semibold text-on-surface">Summary</h3>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="bl-seats" className="text-sm text-on-surface-variant">Seats</label>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Fewer seats" onClick={() => setSeats((s) => Math.max(1, s - 1))} className={`w-7 h-7 rounded-lg border border-outline-variant/30 text-on-surface hover:border-secondary/50 cursor-pointer active:scale-95 ${focusRing}`}>−</button>
                <input id="bl-seats" type="number" min={1} max={500} value={seats} onChange={(e) => setSeats(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} className="w-14 text-center py-1 rounded-lg bg-surface-container text-on-surface border border-outline-variant/30 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-secondary" />
                <button type="button" aria-label="More seats" onClick={() => setSeats((s) => Math.min(500, s + 1))} className={`w-7 h-7 rounded-lg border border-outline-variant/30 text-on-surface hover:border-secondary/50 cursor-pointer active:scale-95 ${focusRing}`}>+</button>
              </div>
            </div>
            <dl className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-on-surface-variant">{targetPlan.name} × {seats}</dt><dd className="tabular-nums text-on-surface">{money(totals.unit * seats)}/mo</dd></div>
              <div className="flex justify-between"><dt className="text-on-surface-variant">Billed</dt><dd className="text-on-surface">{cycle === 'yearly' ? 'Every 12 months' : 'Monthly'}</dd></div>
              <div className="flex justify-between border-t border-outline-variant/20 pt-1.5"><dt className="font-semibold text-on-surface">Due today</dt><dd className="font-semibold tabular-nums text-on-surface">{money(targetPlan.price === 0 ? 0 : totals.subtotal)}</dd></div>
            </dl>

            <button
              type="button" onClick={pay} disabled={!canPay}
              className={`flex items-center justify-center gap-1.5 px-space-md py-2.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-semibold transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${focusRing}`}
            >
              {paying
                ? (<><span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" /> Processing…</>)
                : (<><Icon name="lock" className="text-base" /> {target === 'free' ? 'Free plan' : alreadyOnPlan ? 'Current plan' : `Pay ${money(totals.subtotal)}`}</>)}
            </button>
            <span className="sr-only" aria-live="polite">{paying ? 'Processing payment' : ''}</span>

            {plan !== 'free' && (
              <button type="button" onClick={downgrade} className={`text-xs font-medium text-on-surface-variant hover:text-on-surface transition cursor-pointer ${focusRing}`}>
                Switch back to Free
              </button>
            )}
          </aside>
        </div>

        <hr className="border-0 border-t border-outline-variant/20" />

        {/* Invoices */}
        <div className="flex flex-col gap-space-md">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-outline">Invoices</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No invoices yet. They appear here after your first payment.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 p-space-sm rounded-xl border border-outline-variant/20 bg-surface-container-low">
                  <Icon name="receipt_long" className="text-secondary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{inv.id} · {inv.desc}</p>
                    <p className="text-xs text-on-surface-variant">{inv.date}</p>
                  </div>
                  <span className="text-sm tabular-nums text-on-surface">{money(inv.amount)}</span>
                  <button type="button" onClick={() => downloadInvoice(inv)} aria-label={`Download ${inv.id}`} className={`p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition cursor-pointer ${focusRing}`}>
                    <Icon name="file_download" className="text-base" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default BillingSection;