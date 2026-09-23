"use client";

import { useState } from "react";
import { kanaToRomaji, katakanaToHiragana } from "@/lib/kana-romaji";
import { normalizeAddress, normalizePhone } from "@/lib/normalize";
import type {
  CohabitantInput,
  EmergencyContactInput,
  HouseholdFormValues,
  RegistrationPayload,
  Shelter,
} from "@/lib/types";

const MAX_PHONES = 2;

const EMPTY_COHABITANT: CohabitantInput = {
  name: "",
  nameKana: "",
  relationship: "",
  phone: "",
  isJw: false,
};

const EMPTY_CONTACT: EmergencyContactInput = {
  name: "",
  nameKana: "",
  relationship: "",
  phones: [""],
  isJw: false,
};

export function emptyHouseholdFormValues(): HouseholdFormValues {
  return {
    name: "",
    nameKana: "",
    address: "",
    phones: [""],
    birthdate: "",
    shelterId: "",
    cohabitants: [],
    emergencyContacts: [],
    consent: false,
  };
}

function cleanPhones(phones: string[]): string[] {
  return phones.map((p) => normalizePhone(p.trim())).filter(Boolean);
}

export function toRegistrationPayload(values: HouseholdFormValues): RegistrationPayload {
  return {
    name: values.name.trim(),
    nameKana: values.nameKana.trim(),
    nameKanaRomaji: kanaToRomaji(values.nameKana),
    address: values.address.trim(),
    phones: cleanPhones(values.phones),
    birthdate: values.birthdate,
    shelterId: values.shelterId,
    consent: values.consent,
    cohabitants: values.cohabitants.map((c, i) => ({
      name: c.name.trim(),
      nameKana: c.nameKana.trim(),
      relationship: c.relationship.trim(),
      phone: normalizePhone(c.phone.trim()),
      isJw: c.isJw,
      sortOrder: i,
    })),
    emergencyContacts: values.emergencyContacts.map((c, i) => ({
      name: c.name.trim(),
      nameKana: c.nameKana.trim(),
      relationship: c.relationship.trim(),
      phones: cleanPhones(c.phones),
      isJw: c.isJw,
      sortOrder: i,
    })),
  };
}

type Props = {
  shelters: Shelter[];
  initialValues?: HouseholdFormValues;
  submitLabel: string;
  requireConsent?: boolean;
  onSubmit: (payload: RegistrationPayload) => Promise<{ ok: boolean; error?: string }>;
};

const inputBaseClass =
  "rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
const inputClass = `w-full ${inputBaseClass}`;
const labelClass = "block text-sm font-medium text-slate-700 mb-1";
const sectionClass = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

function PhoneFieldList({
  phones,
  onChange,
  required,
}: {
  phones: string[];
  onChange: (phones: string[]) => void;
  required?: boolean;
}) {
  function updateAt(i: number, value: string) {
    onChange(phones.map((p, idx) => (idx === i ? value : p)));
  }

  return (
    <div className="sm:col-span-2">
      <label className={labelClass}>電話番号{required ? " *" : "（任意）"}</label>
      <div className="space-y-2">
        {phones.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={`${inputBaseClass} min-w-0 flex-1`}
              type="tel"
              required={required && i === 0}
              value={p}
              onChange={(e) => updateAt(i, e.target.value)}
              onBlur={(e) => updateAt(i, normalizePhone(e.target.value))}
            />
            <button
              type="button"
              onClick={() => onChange(phones.filter((_, idx) => idx !== i))}
              disabled={required && phones.length <= 1}
              className="shrink-0 text-sm text-red-600 hover:underline disabled:opacity-30"
            >
              削除
            </button>
          </div>
        ))}
      </div>
      {phones.length < MAX_PHONES && (
        <button
          type="button"
          onClick={() => onChange([...phones, ""])}
          className="mt-2 text-sm font-medium text-slate-700 underline hover:text-slate-900"
        >
          ＋電話番号を追加
        </button>
      )}
    </div>
  );
}

export function HouseholdForm({
  shelters,
  initialValues,
  submitLabel,
  requireConsent = true,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<HouseholdFormValues>(
    initialValues ?? emptyHouseholdFormValues()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function update<K extends keyof HouseholdFormValues>(key: K, value: HouseholdFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateCohabitant(index: number, patch: Partial<CohabitantInput>) {
    setValues((prev) => ({
      ...prev,
      cohabitants: prev.cohabitants.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function updateContact(index: number, patch: Partial<EmergencyContactInput>) {
    setValues((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((c, i) =>
        i === index ? { ...c, ...patch } : c
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (requireConsent && !values.consent) {
      setError("同意事項へのチェックが必要です。");
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubmit(toRegistrationPayload(values));
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error ?? "送信に失敗しました。時間をおいて再度お試しください。");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-green-800">
        送信が完了しました。ご協力ありがとうございました。
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className={sectionClass}>
        <h2 className="mb-4 text-base font-semibold text-slate-900">本人情報</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>氏名 *</label>
            <input
              className={inputClass}
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>ふりがな *</label>
            <input
              className={inputClass}
              required
              value={values.nameKana}
              onChange={(e) => update("nameKana", e.target.value)}
              onBlur={(e) => update("nameKana", katakanaToHiragana(e.target.value))}
              placeholder="ひらがな"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>住所 *</label>
            <input
              className={inputClass}
              required
              value={values.address}
              onChange={(e) => update("address", e.target.value)}
              onBlur={(e) => update("address", normalizeAddress(e.target.value))}
            />
          </div>
          <PhoneFieldList
            phones={values.phones}
            onChange={(phones) => update("phones", phones)}
            required
          />
          <div>
            <label className={labelClass}>生年月日 *</label>
            <input
              className={inputClass}
              required
              type="date"
              value={values.birthdate}
              onChange={(e) => update("birthdate", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>指定避難場所（わかる場合のみ選択）</label>
            <select
              className={inputClass}
              value={values.shelterId}
              onChange={(e) => update("shelterId", e.target.value)}
            >
              <option value="">わからない・未選択</option>
              {shelters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900">同居人情報</h2>
          <button
            type="button"
            onClick={() =>
              update("cohabitants", [...values.cohabitants, { ...EMPTY_COHABITANT }])
            }
            className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            ＋同居人を追加
          </button>
        </div>
        <div className="space-y-4">
          {values.cohabitants.map((c, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">同居人 {i + 1}</span>
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "cohabitants",
                      values.cohabitants.filter((_, idx) => idx !== i)
                    )
                  }
                  className="text-sm text-red-600 hover:underline"
                >
                  削除
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>氏名 *</label>
                  <input
                    className={inputClass}
                    required
                    value={c.name}
                    onChange={(e) => updateCohabitant(i, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>ふりがな *</label>
                  <input
                    className={inputClass}
                    required
                    value={c.nameKana}
                    onChange={(e) => updateCohabitant(i, { nameKana: e.target.value })}
                    onBlur={(e) => updateCohabitant(i, { nameKana: katakanaToHiragana(e.target.value) })}
                    placeholder="ひらがな"
                  />
                </div>
                <div>
                  <label className={labelClass}>続柄 *</label>
                  <input
                    className={inputClass}
                    required
                    value={c.relationship}
                    onChange={(e) => updateCohabitant(i, { relationship: e.target.value })}
                  />
                </div>
                <div className="flex items-end pb-2.5">
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={c.isJw}
                      onChange={(e) => updateCohabitant(i, { isJw: e.target.checked })}
                    />
                    JW
                  </label>
                </div>
                <div>
                  <label className={labelClass}>電話番号（本人と別の番号がある場合のみ）</label>
                  <input
                    className={inputClass}
                    type="tel"
                    value={c.phone}
                    onChange={(e) => updateCohabitant(i, { phone: e.target.value })}
                    onBlur={(e) => updateCohabitant(i, { phone: normalizePhone(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ))}
          {values.cohabitants.length === 0 && (
            <p className="text-sm text-slate-500">同居人がいる場合は「＋同居人を追加」から入力してください。</p>
          )}
        </div>
      </section>

      <section className={sectionClass}>
        <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-slate-900">緊急連絡先情報（非同居）</h2>
          <button
            type="button"
            onClick={() =>
              update("emergencyContacts", [...values.emergencyContacts, { ...EMPTY_CONTACT }])
            }
            className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            ＋緊急連絡先を追加
          </button>
        </div>
        <div className="space-y-4">
          {values.emergencyContacts.map((c, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">緊急連絡先 {i + 1}</span>
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "emergencyContacts",
                      values.emergencyContacts.filter((_, idx) => idx !== i)
                    )
                  }
                  className="text-sm text-red-600 hover:underline"
                >
                  削除
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>氏名 *</label>
                  <input
                    className={inputClass}
                    required
                    value={c.name}
                    onChange={(e) => updateContact(i, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>ふりがな *</label>
                  <input
                    className={inputClass}
                    required
                    value={c.nameKana}
                    onChange={(e) => updateContact(i, { nameKana: e.target.value })}
                    onBlur={(e) => updateContact(i, { nameKana: katakanaToHiragana(e.target.value) })}
                    placeholder="ひらがな"
                  />
                </div>
                <div>
                  <label className={labelClass}>続柄 *</label>
                  <input
                    className={inputClass}
                    required
                    value={c.relationship}
                    onChange={(e) => updateContact(i, { relationship: e.target.value })}
                  />
                </div>
                <div className="flex items-end pb-2.5">
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={c.isJw}
                      onChange={(e) => updateContact(i, { isJw: e.target.checked })}
                    />
                    JW
                  </label>
                </div>
                <PhoneFieldList
                  phones={c.phones}
                  onChange={(phones) => updateContact(i, { phones })}
                  required
                />
              </div>
            </div>
          ))}
          {values.emergencyContacts.length === 0 && (
            <p className="text-sm text-slate-500">
              「＋緊急連絡先を追加」から、同居していない緊急連絡先を入力してください。
            </p>
          )}
        </div>
      </section>

      {requireConsent && (
        <section className={sectionClass}>
          <p className="mb-3 text-sm text-slate-600">
            この情報は長老団で共有され、緊急時に長老から直接連絡が入ることがあります。
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={values.consent}
              onChange={(e) => update("consent", e.target.checked)}
            />
            上記内容に同意します *
          </label>
        </section>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {submitting ? "送信中…" : submitLabel}
      </button>
    </form>
  );
}
