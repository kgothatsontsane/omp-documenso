import { getPdfPagesCount } from '@documenso/lib/constants/pdf-viewer';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { ZFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { nanoid } from '@documenso/lib/universal/id';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Field } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

export const ZLocalFieldSchema = z.object({
  // This is the actual ID of the field if created.
  id: z.number().optional(),
  // This is the local client side ID of the field.
  formId: z.string().min(1),
  // This is the ID of the envelope item to put the field on.
  envelopeItemId: z.string(),
  type: z.nativeEnum(FieldType),
  recipientId: z.number(),
  page: z.number().min(1),
  positionX: z.number().min(0),
  positionY: z.number().min(0),
  width: z.number().min(0),
  height: z.number().min(0),
  fieldMeta: ZFieldMetaSchema,
});

export type TLocalField = z.infer<typeof ZLocalFieldSchema>;

const ZEditorFieldsFormSchema = z.object({
  fields: z.array(ZLocalFieldSchema),
});

export type TEditorFieldsFormSchema = z.infer<typeof ZEditorFieldsFormSchema>;

type EditorFieldsProps = {
  envelope: TEditorEnvelope;
  handleFieldsUpdate: (fields: TLocalField[]) => unknown;
};

type UseEditorFieldsResponse = {
  localFields: TLocalField[];

  // Selected field
  selectedField: TLocalField | undefined;
  setSelectedField: (formId: string | null) => void;

  // Field operations
  addField: (field: Omit<TLocalField, 'formId'>) => TLocalField;
  setFieldId: (formId: string, id: number) => void;
  removeFieldsByFormId: (formIds: string[]) => void;
  updateFieldByFormId: (formId: string, updates: Partial<TLocalField>) => void;
  duplicateField: (field: TLocalField, recipientId?: number) => TLocalField;
  duplicateFieldToAllPages: (field: TLocalField, recipientId?: number) => TLocalField[];
  duplicateFieldsToPage: (fields: TLocalField[], page: number) => TLocalField[];

  // Clipboard (editor-internal, preserves recipient/type/meta bindings)
  copyFields: (fields: TLocalField[]) => void;
  pasteFields: (page?: number) => TLocalField[];
  clipboardSize: number;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Field utilities
  getFieldByFormId: (formId: string) => TLocalField | undefined;
  getFieldsByRecipient: (recipientId: number) => TLocalField[];

  // Selected recipient
  selectedRecipient: TEditorEnvelope['recipients'][number] | null;
  setSelectedRecipient: (recipientId: number | null) => void;

  resetForm: (fields?: Field[]) => void;
};

const HISTORY_LIMIT = 50;
// Continuous drags/resize fire updateFieldByFormId many times a second;
// anything closer than this to the last push merges into one undo step.
const HISTORY_COALESCE_MS = 600;

export const useEditorFields = ({ envelope, handleFieldsUpdate }: EditorFieldsProps): UseEditorFieldsResponse => {
  const [selectedFieldFormId, setSelectedFieldFormId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);

  // Undo/redo history of full field-list snapshots (past = undo, future = redo).
  const pastRef = useRef<TLocalField[][]>([]);
  const futureRef = useRef<TLocalField[][]>([]);
  const lastPushAtRef = useRef(0);
  const [historyVersion, setHistoryVersion] = useState(0);

  // Editor-internal clipboard for copy/paste of fields.
  const clipboardRef = useRef<TLocalField[]>([]);
  const [clipboardSize, setClipboardSize] = useState(0);

  const snapshotCurrentFields = (): TLocalField[] => form.getValues().fields.map((field) => ({ ...field }));

  /**
   * Captures the pre-change state for undo. Continuous interactions (drag,
   * resize) pass `coalesce` so they collapse into a single undo step.
   */
  const pushHistory = (coalesce = false) => {
    const now = Date.now();

    if (coalesce && now - lastPushAtRef.current < HISTORY_COALESCE_MS) {
      return;
    }

    lastPushAtRef.current = now;

    pastRef.current.push(snapshotCurrentFields());

    if (pastRef.current.length > HISTORY_LIMIT) {
      pastRef.current.shift();
    }

    futureRef.current = [];
    setHistoryVersion((version) => version + 1);
  };

  const applySnapshot = (fields: TLocalField[]) => {
    form.reset({
      fields: fields.map((field) => ({ ...field })),
    });

    triggerFieldsUpdate();
  };

  const undo = useCallback(() => {
    const past = pastRef.current;

    if (past.length === 0) {
      return;
    }

    const snapshot = past.pop() as TLocalField[];

    futureRef.current.push(snapshotCurrentFields());

    applySnapshot(snapshot);

    // The next user action should start a fresh undo step, not merge with the pre-undo one.
    lastPushAtRef.current = 0;
    setHistoryVersion((version) => version + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redo = useCallback(() => {
    const future = futureRef.current;

    if (future.length === 0) {
      return;
    }

    const snapshot = future.pop() as TLocalField[];

    pastRef.current.push(snapshotCurrentFields());

    applySnapshot(snapshot);

    lastPushAtRef.current = 0;
    setHistoryVersion((version) => version + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // historyVersion bumps whenever the stacks change so canUndo/canRedo re-render.
  const canUndo = historyVersion >= 0 && pastRef.current.length > 0;
  const canRedo = historyVersion >= 0 && futureRef.current.length > 0;

  const generateDefaultValues = (fields?: Field[]) => {
    const formFields = (fields || envelope.fields).map(
      (field): TLocalField => ({
        id: field.id,
        formId: nanoid(),
        envelopeItemId: field.envelopeItemId,
        page: field.page,
        type: field.type,
        positionX: Number(field.positionX),
        positionY: Number(field.positionY),
        width: Number(field.width),
        height: Number(field.height),
        recipientId: field.recipientId,
        fieldMeta: field.fieldMeta ? ZFieldMetaSchema.parse(field.fieldMeta) : undefined,
      }),
    );

    return {
      fields: formFields,
    };
  };

  const form = useForm<TEditorFieldsFormSchema>({
    defaultValues: generateDefaultValues(),
    resolver: zodResolver(ZEditorFieldsFormSchema),
  });

  const {
    append,
    remove,
    update,
    fields: localFields,
  } = useFieldArray({
    control: form.control,
    name: 'fields',
    keyName: 'react-hook-form-id',
  });

  const triggerFieldsUpdate = () => {
    void handleFieldsUpdate(form.getValues().fields);
  };

  const setSelectedField = (formId: string | null, bypassCheck = false) => {
    if (!formId) {
      setSelectedFieldFormId(null);
      return;
    }

    const foundField = localFields.find((field) => field.formId === formId);
    const recipient = envelope.recipients.find((recipient) => recipient.id === foundField?.recipientId);

    if (recipient) {
      setSelectedRecipient(recipient.id);
    }

    if (bypassCheck) {
      setSelectedFieldFormId(formId);
      return;
    }

    setSelectedFieldFormId(foundField?.formId ?? null);
  };

  const addField = useCallback(
    (fieldData: Omit<TLocalField, 'formId'>): TLocalField => {
      pushHistory();

      const field: TLocalField = {
        ...fieldData,
        formId: nanoid(12),
        ...restrictFieldPosValues(fieldData),
      };

      append(field);
      triggerFieldsUpdate();
      setSelectedField(field.formId, true);
      return field;
    },
    [append, triggerFieldsUpdate, setSelectedField],
  );

  const removeFieldsByFormId = useCallback(
    (formIds: string[]) => {
      const indexes = formIds
        .map((formId) => localFields.findIndex((field) => field.formId === formId))
        .filter((index) => index !== -1);

      if (indexes.length > 0) {
        pushHistory();
        remove(indexes);
        triggerFieldsUpdate();
      }
    },
    [localFields, remove, triggerFieldsUpdate],
  );

  const setFieldId = (formId: string, id: number) => {
    const { fields } = form.getValues();

    const index = fields.findIndex((field) => field.formId === formId);

    if (index !== -1) {
      update(index, {
        ...fields[index],
        id,
      });
    }
  };

  const updateFieldByFormId = useCallback(
    (formId: string, updates: Partial<TLocalField>) => {
      const index = localFields.findIndex((field) => field.formId === formId);

      if (index !== -1) {
        pushHistory(true);

        const updatedField = {
          ...localFields[index],
          ...updates,
        };

        update(index, {
          ...updatedField,
          ...restrictFieldPosValues(updatedField),
        });
        triggerFieldsUpdate();
      }
    },
    [localFields, update, triggerFieldsUpdate],
  );

  const duplicateField = useCallback(
    (field: TLocalField): TLocalField => {
      pushHistory();

      const newField: TLocalField = {
        ...structuredClone(field),
        id: undefined,
        formId: nanoid(12),
        recipientId: field.recipientId,
        positionX: field.positionX + 3,
        positionY: field.positionY + 3,
      };

      append(newField);
      triggerFieldsUpdate();
      return newField;
    },
    [append, triggerFieldsUpdate],
  );

  const duplicateFieldToAllPages = useCallback(
    (field: TLocalField): TLocalField[] => {
      const totalPages = getPdfPagesCount();
      const newFields: TLocalField[] = [];

      if (totalPages < 1) {
        return newFields;
      }

      pushHistory();

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        if (pageNumber === field.page) {
          continue;
        }

        const newField: TLocalField = {
          ...structuredClone(field),
          id: undefined,
          formId: nanoid(12),
          page: pageNumber,
        };

        append(newField);
        newFields.push(newField);
      }

      triggerFieldsUpdate();
      return newFields;
    },
    [append, triggerFieldsUpdate],
  );

  const duplicateFieldsToPage = useCallback(
    (fields: TLocalField[], page: number): TLocalField[] => {
      if (fields.length === 0) {
        return [];
      }

      pushHistory();

      const copies = fields.map(
        (field): TLocalField => ({
          ...structuredClone(field),
          id: undefined,
          formId: nanoid(12),
          page,
        }),
      );

      // Single append (array form) — one re-render instead of one per copy.
      append(copies);
      triggerFieldsUpdate();

      return copies;
    },
    [append, triggerFieldsUpdate],
  );

  const copyFields = useCallback((fields: TLocalField[]) => {
    if (fields.length === 0) {
      return;
    }

    clipboardRef.current = fields.map((field) => ({
      ...field,
      fieldMeta: field.fieldMeta ? structuredClone(field.fieldMeta) : undefined,
    }));

    setClipboardSize(clipboardRef.current.length);
  }, []);

  const pasteFields = useCallback(
    (page?: number): TLocalField[] => {
      const clipboard = clipboardRef.current;

      if (clipboard.length === 0) {
        return [];
      }

      pushHistory();

      const pasted = clipboard.map(
        (field): TLocalField => ({
          ...structuredClone(field),
          id: undefined,
          formId: nanoid(12),
          page: page ?? field.page,
          positionX: field.positionX + 3,
          positionY: field.positionY + 3,
        }),
      );

      // Single append (array form) — one re-render instead of one per copy.
      append(pasted);
      triggerFieldsUpdate();

      return pasted;
    },
    [append, triggerFieldsUpdate],
  );

  const getFieldByFormId = useCallback(
    (formId: string): TLocalField | undefined => {
      return localFields.find((field) => field.formId === formId) as TLocalField | undefined;
    },
    [localFields],
  );

  const getFieldsByRecipient = useCallback(
    (recipientId: number): TLocalField[] => {
      return localFields.filter((field) => field.recipientId === recipientId);
    },
    [localFields],
  );

  const selectedRecipient = useMemo(() => {
    return envelope.recipients.find((recipient) => recipient.id === selectedRecipientId) || null;
  }, [selectedRecipientId, envelope.recipients]);

  const selectedField = useMemo(() => {
    return localFields.find((field) => field.formId === selectedFieldFormId);
  }, [selectedFieldFormId, localFields]);

  /**
   * Keep the selected field form ID in sync with the local fields.
   */
  useEffect(() => {
    const foundField = localFields.find((field) => field.formId === selectedFieldFormId);
    setSelectedFieldFormId(foundField?.formId ?? null);
  }, [selectedFieldFormId, localFields]);

  const setSelectedRecipient = (recipientId: number | null) => {
    const foundRecipient = envelope.recipients.find((recipient) => recipient.id === recipientId);

    setSelectedRecipientId(foundRecipient?.id ?? null);
  };

  const resetForm = (fields?: Field[]) => {
    form.reset(generateDefaultValues(fields));

    // History and clipboard refer to the previous form instance — drop them so
    // undo can't restore a state that no longer matches the server.
    pastRef.current = [];
    futureRef.current = [];
    clipboardRef.current = [];
    setClipboardSize(0);
    setHistoryVersion((version) => version + 1);
  };

  return {
    // Core state
    localFields,

    // Field operations
    addField,
    setFieldId,
    removeFieldsByFormId,
    updateFieldByFormId,
    duplicateField,
    duplicateFieldToAllPages,
    duplicateFieldsToPage,

    // Clipboard
    copyFields,
    pasteFields,
    clipboardSize,

    // Undo/redo
    undo,
    redo,
    canUndo,
    canRedo,

    // Field utilities
    getFieldByFormId,
    getFieldsByRecipient,

    // Selected field
    selectedField,
    setSelectedField,

    // Selected recipient
    selectedRecipient,
    setSelectedRecipient,

    resetForm,
  };
};

const restrictFieldPosValues = (field: Pick<TLocalField, 'positionX' | 'positionY' | 'width' | 'height'>) => {
  return {
    positionX: Math.max(0, Math.min(100, field.positionX)),
    positionY: Math.max(0, Math.min(100, field.positionY)),
    width: Math.max(0, Math.min(100, field.width)),
    height: Math.max(0, Math.min(100, field.height)),
  };
};
