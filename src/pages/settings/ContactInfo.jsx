import { useEffect, useMemo, useState } from 'react';
import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Youtube,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card.jsx';
import { Input, Label } from '@/components/ui/Input.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { PageHeader } from '@/components/ui/PageHeader.jsx';
import { Skeleton } from '@/components/ui/Skeleton.jsx';
import { ContactInfo as ContactApi } from '@/api/endpoints.js';
import { useAuth } from '@/auth/AuthContext';

// Fields rendered in order. `key` matches the backend ContactInfoRequest JSON.
const CONTACT_FIELDS = [
  { key: 'email', label: 'Email', icon: Mail, type: 'email', placeholder: 'contact@vgo.com' },
  { key: 'phone', label: 'Phone', icon: Phone, type: 'tel', placeholder: '+91 98765 43210' },
];

const SOCIAL_FIELDS = [
  { key: 'instagramUrl', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/…' },
  { key: 'facebookUrl', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/…' },
  { key: 'telegramUrl', label: 'Telegram', icon: Send, placeholder: 'https://t.me/…' },
  { key: 'youtubeUrl', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@…' },
  { key: 'twitterUrl', label: 'Twitter / X', icon: MessageCircle, placeholder: 'https://x.com/…' },
  { key: 'linkedinUrl', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/company/…' },
  { key: 'whatsappUrl', label: 'WhatsApp', icon: MessageCircle, placeholder: 'https://wa.me/919876543210' },
];

const ALL_KEYS = [...CONTACT_FIELDS, ...SOCIAL_FIELDS].map((f) => f.key);

const emptyForm = () =>
  ALL_KEYS.reduce((acc, k) => ({ ...acc, [k]: '' }), {});

function pickForm(data) {
  const form = emptyForm();
  if (data) {
    for (const k of ALL_KEYS) form[k] = data[k] ?? '';
  }
  return form;
}

export default function ContactInfoPage() {
  const { user } = useAuth();
  const adminID = user?.id;

  const [form, setForm] = useState(emptyForm);
  const [initial, setInitial] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ContactApi.get()
      .then((resp) => {
        if (cancelled) return;
        if (resp?.data?.status === 'SUCCESS') {
          const next = pickForm(resp.data.data);
          setForm(next);
          setInitial(next);
          setError('');
        } else {
          throw new Error(resp?.data?.msg || 'Failed to load contact info.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.msg || err?.message || 'Failed to load contact info.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => ALL_KEYS.some((k) => (form[k] ?? '') !== (initial[k] ?? '')),
    [form, initial],
  );

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const resp = await ContactApi.update(adminID, form);
      if (resp?.data?.status !== 'SUCCESS') {
        throw new Error(resp?.data?.msg || 'Failed to save contact info.');
      }
      const next = pickForm(resp.data.data);
      setForm(next);
      setInitial(next);
      setSavedAt(Date.now());
    } catch (err) {
      setError(
        err?.response?.data?.msg || err?.message || 'Failed to save contact info.',
      );
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setForm(initial);
    setSavedAt(null);
    setError('');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Us"
        subtitle="Email, phone and social links shown in the mobile apps."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={handleReset}
              disabled={!dirty || saving || loading}
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!dirty || loading || !adminID}
            >
              Save changes
            </Button>
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}
      {savedAt && !dirty && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Contact info saved.
        </div>
      )}
      {!adminID && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Loading admin session… saving is disabled until login data is available.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact channels</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <FieldSkeletons count={2} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {CONTACT_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    field={f}
                    value={form[f.key]}
                    onChange={(v) => handleChange(f.key, v)}
                    disabled={saving}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social media</CardTitle>
          </CardHeader>
          <CardBody>
            {loading ? (
              <FieldSkeletons count={7} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {SOCIAL_FIELDS.map((f) => (
                  <Field
                    key={f.key}
                    field={f}
                    value={form[f.key]}
                    onChange={(v) => handleChange(f.key, v)}
                    disabled={saving}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Native submit target so Enter submits the form. */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </div>
  );
}

function Field({ field, value, onChange, disabled }) {
  const Icon = field.icon;
  return (
    <div>
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input
        id={field.key}
        type={field.type || 'url'}
        value={value}
        placeholder={field.placeholder}
        disabled={disabled}
        leftIcon={<Icon className="h-4 w-4" />}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FieldSkeletons({ count }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-1.5 h-3 w-20" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
