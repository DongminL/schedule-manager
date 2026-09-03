"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import form from "@/components/ui/form.module.scss";
import { ApiError, apiSend } from "@/lib/api";

interface Initial {
  id: number;
  name: string;
  phoneNumber: string;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Initial; // present => edit mode
}

export function StaffFormDialog({ open, onClose, onSaved, initial }: Props) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initial?.phoneNumber ?? "");
  const [color, setColor] = useState(initial?.color ?? "#3b82f6");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (isEdit) {
        await apiSend("PATCH", `/api/staff/${initial.id}`, { name, phoneNumber, color });
      } else {
        await apiSend("POST", "/api/staff", { name, phoneNumber, color });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "저장에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "직원 정보 수정" : "직원 추가"}>
      <form className={form.form} onSubmit={handleSubmit}>
        <label className={form.field}>
          <span>이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} />
        </label>
        <label className={form.field}>
          <span>연락처 (로그인 ID · 임시 비밀번호)</span>
          <input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            inputMode="numeric"
            placeholder="01012345678"
            required
          />
        </label>
        <label className={form.field}>
          <span>캘린더 색상</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>

        {!isEdit && (
          <p className={form.hint}>임시 비밀번호는 연락처와 동일하며, 첫 로그인 시 변경해야 합니다.</p>
        )}
        {error && <p className={form.error}>{error}</p>}

        <div className={form.actions}>
          <button type="button" className={form.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={form.submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
