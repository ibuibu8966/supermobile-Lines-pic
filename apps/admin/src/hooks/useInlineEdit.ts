import { useState } from "react";

/**
 * インライン編集用カスタムフック
 * @param onSave - 保存時のコールバック関数
 * @returns 編集状態と操作関数
 */
export function useInlineEdit<T>(onSave: (value: T) => void | Promise<void>) {
  const [editValue, setEditValue] = useState<T | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * 編集中かどうか
   */
  const isEditing = editValue !== undefined;

  /**
   * 編集値の取得（編集中でない場合はundefined）
   */
  const getValue = () => editValue;

  /**
   * 編集値の設定
   */
  const setValue = (value: T) => {
    setEditValue(value);
  };

  /**
   * 編集をキャンセル
   */
  const cancel = () => {
    setEditValue(undefined);
  };

  /**
   * 保存処理
   */
  const save = async () => {
    if (editValue === undefined) return;

    setIsSaving(true);
    try {
      await onSave(editValue);
      setEditValue(undefined);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isEditing,
    editValue,
    isSaving,
    getValue,
    setValue,
    cancel,
    save,
  };
}
