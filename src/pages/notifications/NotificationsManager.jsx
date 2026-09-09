import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Megaphone, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Notifications as NotificationsApi, Cities as CitiesApi, Brands as BrandsApi } from '@/api/endpoints.js';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/cn';

// Backend NotificationDTO shape:
//   { FCMToken, topic, userID, title, body, image, data: Map<String,String> }
// Note the capital `FCMToken` field name — matches what Spring/Jackson expects.
// `userID` resolves server-side to every FCM token registered for that user
// (one per signed-in device) — see NotificationService.sendNotificationToUser.

// Mirrors the app's actual FCM topic taxonomy (TopicSubscriptionService,
// Flutter app) so the admin never has to guess or mistype a topic name:
//   all, bikes, cars  — device-level, subscribed automatically
//   city_<id>          — a user's profile city
//   brand_<id>          — brands a user has favourited a vehicle of
const STATIC_TOPICS = [
  { value: 'all', label: 'All devices' },
  { value: 'bikes', label: 'Bike shoppers' },
  { value: 'cars', label: 'Car shoppers' },
];

// Canned starting points for the common "group of users" / "city users"
// broadcasts — admin picks one, it fills title+body, still fully editable.
const NOTIFICATION_TEMPLATES = [
  {
    id: 'new-arrivals',
    label: 'New arrivals',
    title: 'New vehicles just added',
    body: 'Fresh listings just landed — check out the latest bikes and scooters now live on VGO.',
  },
  {
    id: 'price-drop',
    label: 'Price drop (city-wide)',
    title: 'Prices just dropped',
    body: "Great deals are now live in your city — take a look before they're gone.",
  },
  {
    id: 'festive-offer',
    label: 'Festive offer',
    title: 'Festive season offers are here',
    body: 'Exclusive discounts and easy financing available for a limited time. Grab yours today.',
  },
  {
    id: 'used-picks',
    label: 'Used vehicle picks',
    title: 'Fresh used-vehicle picks for you',
    body: 'Verified used bikes and scooters, inspected and ready to ride — check out today’s picks.',
  },
  {
    id: 'personal-followup',
    label: 'Personal follow-up',
    title: 'Still thinking it over?',
    body: 'We’re here if you have questions about the vehicle you were looking at — happy to help.',
  },
];

export default function NotificationsManager() {
  const [sentEvents, setSentEvents] = useState([]);

  function recordSent(channel, title) {
    setSentEvents((prev) =>
      [
        { id: Date.now(), channel, title, at: new Date() },
        ...prev,
      ].slice(0, 8),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Push messages to consumers via Firebase Cloud Messaging."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SendByTopicForm onSent={(title) => recordSent('topic', title)} />
        <SendToUserForm onSent={(title) => recordSent('user', title)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent broadcasts (this session)</CardTitle>
        </CardHeader>
        <CardBody className="px-0 pb-0">
          {sentEvents.length === 0 ? (
            <div className="px-5 pb-6 pt-2 text-sm text-slate-500">
              <Megaphone className="mb-2 h-6 w-6 text-slate-300" />
              Nothing sent yet in this session. Backend doesn't persist
              notification history, so this list resets on reload.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sentEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <div className="flex-1 truncate">
                    <span className="font-medium text-slate-700">
                      {e.title || '(no title)'}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      via {e.channel}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {e.at.toLocaleTimeString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Shared form state (title/body/image/custom data/submit) — the two send
// modes differ only in how they resolve `target` (a topic string vs a
// userID), supplied via `buildTarget`/`canSubmitTarget`.
// -----------------------------------------------------------------------------
function useNotificationForm({ send, buildTarget, canSubmitTarget, onSent, resetTarget }) {
  const [notifTitle, setNotifTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [extraPairs, setExtraPairs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  function reset() {
    setNotifTitle('');
    setBody('');
    setImage('');
    setExtraPairs([]);
  }

  function applyTemplate(templateId) {
    const tpl = NOTIFICATION_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setNotifTitle(tpl.title);
    setBody(tpl.body);
  }

  function addPair() {
    setExtraPairs((p) => [...p, { key: '', value: '' }]);
  }
  function patchPair(idx, next) {
    setExtraPairs((p) => p.map((x, i) => (i === idx ? { ...x, ...next } : x)));
  }
  function removePair(idx) {
    setExtraPairs((p) => p.filter((_, i) => i !== idx));
  }

  const canSubmit = canSubmitTarget && notifTitle.trim() && body.trim() && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const data = extraPairs.reduce((acc, { key, value }) => {
        const k = (key || '').trim();
        if (k) acc[k] = (value || '').trim();
        return acc;
      }, {});
      const payload = {
        title: notifTitle.trim(),
        body: body.trim(),
        ...(image.trim() ? { image: image.trim() } : {}),
        ...(Object.keys(data).length > 0 ? { data } : {}),
        ...buildTarget(),
      };
      const resp = await send(payload);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to send notification.');
      }
      onSent(payload.title);
      setFeedback({ type: 'ok', msg: resp?.data?.msg || 'Sent.' });
      reset();
      resetTarget?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        msg:
          err?.response?.data?.msg ||
          err?.message ||
          'Failed to send notification.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return {
    notifTitle,
    setNotifTitle,
    body,
    setBody,
    image,
    setImage,
    extraPairs,
    addPair,
    patchPair,
    removePair,
    submitting,
    feedback,
    canSubmit,
    handleSubmit,
    applyTemplate,
  };
}

/// Common body of the form — template picker, title, body, image, custom
/// data pairs, feedback banner, submit button. Shared by both send modes;
/// only the target-picking section above it differs.
function NotificationFormFields({ form, submitLabel, apiPath }) {
  return (
    <>
      <div>
        <Label className="mb-0">Use a template (optional)</Label>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) form.applyTemplate(e.target.value);
            e.target.value = '';
          }}
          className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          <option value="">Choose a starting point…</option>
          {NOTIFICATION_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Title</Label>
        <Input
          value={form.notifTitle}
          onChange={(e) => form.setNotifTitle(e.target.value)}
          placeholder="Notification title"
          maxLength={120}
        />
      </div>
      <div>
        <Label>Body</Label>
        <textarea
          rows={3}
          value={form.body}
          onChange={(e) => form.setBody(e.target.value)}
          placeholder="Notification body"
          className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
      <div>
        <Label>Image URL (optional)</Label>
        <Input
          value={form.image}
          onChange={(e) => form.setImage(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="mb-0">Custom data (optional)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={form.addPair}
            disabled={form.submitting}
          >
            <Plus className="h-3.5 w-3.5" />
            Add pair
          </Button>
        </div>
        {form.extraPairs.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {form.extraPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <Input
                  value={pair.key}
                  onChange={(e) => form.patchPair(idx, { key: e.target.value })}
                  placeholder="key"
                />
                <Input
                  value={pair.value}
                  onChange={(e) => form.patchPair(idx, { value: e.target.value })}
                  placeholder="value"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => form.removePair(idx)}
                  disabled={form.submitting}
                  className="text-red-600 hover:bg-red-50"
                  title="Remove pair"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-400">
          Sent as the notification's <code className="text-slate-500">data</code> map (string→string).
        </p>
      </div>

      {form.feedback && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-xs font-medium',
            form.feedback.type === 'ok'
              ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
              : 'border-red-100 bg-red-50 text-red-700',
          )}
        >
          {form.feedback.msg}
        </div>
      )}

      <Button type="submit" loading={form.submitting} disabled={!form.canSubmit} className="w-full">
        <Send className="h-4 w-4" />
        {submitLabel}
      </Button>
      <p className="font-mono text-[11px] text-slate-400">POST {apiPath}</p>
    </>
  );
}

// -----------------------------------------------------------------------------
// Send by topic
// -----------------------------------------------------------------------------
function useTopicSuggestions() {
  const [suggestions, setSuggestions] = useState(STATIC_TOPICS);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      CitiesApi.getAll().catch(() => null),
      BrandsApi.getAll({ size: 1000, sortBy: 'name', sortDir: 'asc' }).catch(() => null),
    ]).then(([cityResp, brandResp]) => {
      if (cancelled) return;
      const cities =
        cityResp?.data?.status === 'SUCCESS' ? cityResp.data.data || [] : [];
      const brandPayload =
        brandResp?.data?.status === 'SUCCESS' ? brandResp.data.data : null;
      const brands = brandPayload?.content || [];
      setSuggestions([
        ...STATIC_TOPICS,
        ...cities.map((c) => ({ value: `city_${c.id}`, label: `City — ${c.name}` })),
        ...brands.map((b) => ({ value: `brand_${b.id}`, label: `Brand — ${b.name}` })),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return suggestions;
}

function SendByTopicForm({ onSent }) {
  const [target, setTarget] = useState('');
  const suggestions = useTopicSuggestions();
  const cityOptions = suggestions.filter((s) => s.value.startsWith('city_'));
  const brandOptions = suggestions.filter((s) => s.value.startsWith('brand_'));

  const form = useNotificationForm({
    send: (payload) => NotificationsApi.sendByTopic(payload),
    buildTarget: () => ({ topic: target.trim() }),
    canSubmitTarget: !!target.trim(),
    onSent,
    resetTarget: () => setTarget(''),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send by topic</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={form.handleSubmit} className="space-y-3">
          <p className="text-xs text-slate-500">
            All devices subscribed to this topic receive the message.
          </p>
          <div>
            <Label htmlFor="topic-target">Topic</Label>
            <Input
              id="topic-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. all, city_3, brand_12"
              list="topic-suggestions-list"
            />
            <datalist id="topic-suggestions-list">
              {suggestions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </datalist>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STATIC_TOPICS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setTarget(s.value)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                    target === s.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={cityOptions.some((c) => c.value === target) ? target : ''}
                onChange={(e) => e.target.value && setTarget(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">Pick a city…</option>
                {cityOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label.replace('City — ', '')}
                  </option>
                ))}
              </select>
              <select
                value={brandOptions.some((b) => b.value === target) ? target : ''}
                onChange={(e) => e.target.value && setTarget(e.target.value)}
                className="block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">Pick a brand…</option>
                {brandOptions.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label.replace('Brand — ', '')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <NotificationFormFields
            form={form}
            submitLabel="Send to topic"
            apiPath="/admin/firebase/notifications/topic"
          />
        </form>
      </CardBody>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Send by user (was "send by FCM token" — nobody can be expected to know a
// raw device token, so this searches app users by name/email/phone instead
// and resolves to every device registered for whoever's picked).
// -----------------------------------------------------------------------------
function UserPicker({ selectedUser, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setErr('');
      return;
    }
    let cancelled = false;
    setSearching(true);
    NotificationsApi.searchUsers({ q: debouncedQuery.trim(), size: 8 })
      .then((resp) => {
        if (cancelled) return;
        const status = resp?.data?.status;
        if (status === 'SUCCESS') {
          setResults(resp.data.data?.content || []);
          setErr('');
        } else if (status === 'EMPTY') {
          setResults([]);
          setErr('');
        } else {
          setResults([]);
          setErr(resp?.data?.msg || 'Search failed.');
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setResults([]);
        setErr(e?.response?.data?.msg || e?.message || 'Search failed.');
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  if (selectedUser) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">
            {selectedUser.name || '(no name)'}
          </div>
          <div className="truncate text-xs text-slate-500">
            {selectedUser.email || selectedUser.phone || `User #${selectedUser.id}`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              selectedUser.deviceCount > 0
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600',
            )}
          >
            {selectedUser.deviceCount > 0
              ? `${selectedUser.deviceCount} device${selectedUser.deviceCount > 1 ? 's' : ''}`
              : 'No device'}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search by name, email or phone…"
        leftIcon={<Search className="h-4 w-4" />}
      />
      {open && query.trim() && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {searching ? (
            <div className="px-3 py-3 text-xs text-slate-400">Searching…</div>
          ) : err ? (
            <div className="px-3 py-3 text-xs text-red-600">{err}</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400">No users found.</div>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(u);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {u.name || '(no name)'}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {u.email || u.phone || `User #${u.id}`}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        u.deviceCount > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-600',
                      )}
                    >
                      {u.deviceCount > 0
                        ? `${u.deviceCount} device${u.deviceCount > 1 ? 's' : ''}`
                        : 'No device'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SendToUserForm({ onSent }) {
  const [selectedUser, setSelectedUser] = useState(null);

  const form = useNotificationForm({
    send: (payload) => NotificationsApi.sendByUser(payload),
    buildTarget: () => ({ userID: selectedUser?.id }),
    canSubmitTarget: !!selectedUser?.id && selectedUser.deviceCount > 0,
    onSent,
    resetTarget: () => setSelectedUser(null),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send by user</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={form.handleSubmit} className="space-y-3">
          <p className="text-xs text-slate-500">
            Search for a user by name, email or phone. Sends to every device
            they're signed in on.
          </p>
          <div>
            <Label>User</Label>
            <UserPicker
              selectedUser={selectedUser}
              onSelect={setSelectedUser}
              onClear={() => setSelectedUser(null)}
            />
            {selectedUser && selectedUser.deviceCount === 0 && (
              <p className="mt-1.5 text-[11px] font-medium text-red-600">
                This user has no registered devices — sending would fail. Pick
                someone else, or come back once they've opened the app.
              </p>
            )}
          </div>

          <NotificationFormFields
            form={form}
            submitLabel="Send to user"
            apiPath="/admin/firebase/notifications/send-using-userID"
          />
        </form>
      </CardBody>
    </Card>
  );
}
