import { useState } from 'react';
import { CheckCircle2, Megaphone, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button.jsx';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Notifications as NotificationsApi } from '@/api/endpoints.js';
import { cn } from '@/lib/cn';

// Backend NotificationDTO shape:
//   { FCMToken, topic, title, body, image, data: Map<String,String> }
// Note the capital `FCMToken` field name — matches what Spring/Jackson expects.

export default function NotificationsManager() {
  // The two forms are independent — separate state so admin can have draft text
  // in both at once and not collide on submit.
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
        <SendForm
          mode="topic"
          title="Send by topic"
          subtitle="All devices subscribed to this topic receive the message."
          onSent={(payloadTitle) => recordSent('topic', payloadTitle)}
        />
        <SendForm
          mode="token"
          title="Send by FCM token"
          subtitle="Targets a single device. Useful for per-user testing."
          onSent={(payloadTitle) => recordSent('token', payloadTitle)}
        />
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

function SendForm({ mode, title, subtitle, onSent }) {
  const [target, setTarget] = useState(''); // topic name OR FCM token
  const [notifTitle, setNotifTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [extraPairs, setExtraPairs] = useState([]); // [{key, value}]
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // {type: 'ok'|'err', msg}

  function reset() {
    setTarget('');
    setNotifTitle('');
    setBody('');
    setImage('');
    setExtraPairs([]);
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

  // Validation: target + title + body required. Image optional, data pairs optional.
  const canSubmit =
    target.trim() && notifTitle.trim() && body.trim() && !submitting;

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
        // Backend's NotificationDTO uses capital `FCMToken` for the token field.
        ...(mode === 'topic'
          ? { topic: target.trim() }
          : { FCMToken: target.trim() }),
      };
      const resp =
        mode === 'topic'
          ? await NotificationsApi.sendByTopic(payload)
          : await NotificationsApi.sendByToken(payload);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to send notification.');
      }
      onSent(payload.title);
      setFeedback({ type: 'ok', msg: 'Sent.' });
      reset();
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-slate-500">{subtitle}</p>
          <div>
            <Label htmlFor={`${mode}-target`}>
              {mode === 'topic' ? 'Topic name' : 'FCM token'}
            </Label>
            <Input
              id={`${mode}-target`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={
                mode === 'topic' ? 'e.g. all, ev-buyers, city-blr' : 'd3v1c3T0k3n…'
              }
            />
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              placeholder="Notification title"
              maxLength={120}
            />
          </div>
          <div>
            <Label>Body</Label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification body"
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <Label>Image URL (optional)</Label>
            <Input
              value={image}
              onChange={(e) => setImage(e.target.value)}
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
                onClick={addPair}
                disabled={submitting}
              >
                <Plus className="h-3.5 w-3.5" />
                Add pair
              </Button>
            </div>
            {extraPairs.length > 0 && (
              <div className="mt-1.5 space-y-1.5">
                {extraPairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={pair.key}
                      onChange={(e) => patchPair(idx, { key: e.target.value })}
                      placeholder="key"
                    />
                    <Input
                      value={pair.value}
                      onChange={(e) => patchPair(idx, { value: e.target.value })}
                      placeholder="value"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePair(idx)}
                      disabled={submitting}
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
              Sent as the notification's {' '}
              <code className="text-slate-500">data</code> map (string→string).
            </p>
          </div>

          {feedback && (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium',
                feedback.type === 'ok'
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                  : 'border-red-100 bg-red-50 text-red-700',
              )}
            >
              {feedback.msg}
            </div>
          )}

          <Button
            type="submit"
            loading={submitting}
            disabled={!canSubmit}
            className="w-full"
          >
            <Send className="h-4 w-4" />
            {mode === 'topic' ? 'Send to topic' : 'Send to device'}
          </Button>
          <p className="font-mono text-[11px] text-slate-400">
            POST /admin/firebase/notifications/
            {mode === 'topic' ? 'topic' : 'send-using-fcmToken'}
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
