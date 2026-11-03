'use client';

import React, { useState, useEffect, useActionState } from 'react';
import {
  UploadCloud,
  FileText,
  Lock,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ClockAlert,
} from 'lucide-react';
import { entregarTareaAction } from '../../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { validateUploadedFile } from '@/utils/formatters/text-sanitizer';

const initialState: ActionState = { success: false, message: '' };

export default function EntregarTareaModal({
  grupoId,
  tarea,
  entregaExistente,
}: {
  grupoId: string;
  tarea: any;
  entregaExistente: any | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileChange = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const validation = validateUploadedFile(file, { maxSizeMB: 10 });
    if (!validation.valid) {
      setFileError(validation.error || 'Archivo no permitido (máx. 10 MB).');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };
  const [state, formAction, isPending] = useActionState(
    entregarTareaAction,
    initialState
  );

  // ── Fix: evitar evaluar new Date() en el cuerpo de render SSR ────────────
  // Se inicializa en null para que el HTML del servidor y del cliente coincidan.
  // El useEffect actualiza el valor solo en el cliente tras la hidratación.
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const yaCalificada =
    entregaExistente && entregaExistente.calificacion !== null;

  if (yaCalificada) {
    const penalizado = Number(entregaExistente.puntos_penalizados || 0) > 0;
    return (
      <div className="text-right">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
          <Lock className="w-3.5 h-3.5" />
          Nota Final: {entregaExistente.calificacion}/100
        </span>
        {penalizado && (
          <p className="text-[10px] text-amber-700 font-medium mt-0.5">
            Base: {entregaExistente.calificacion_base} (-
            {entregaExistente.puntos_penalizados} pts por{' '}
            {entregaExistente.dias_retraso}d tarde)
          </p>
        )}
      </div>
    );
  }

  // Calcular si la entrega actual sería tardía y cuántos puntos se descontarían.
  // Mientras `ahora` es null (pre-hidratación SSR), asumimos que no es tardía
  // para garantizar que el HTML inicial del servidor y del cliente coincidan.
  const limite = new Date(tarea.fecha_limite);
  const esTardiaAhora = ahora !== null && ahora > limite;
  const diasRetrasoEstimados =
    ahora !== null && esTardiaAhora
      ? Math.max(
          1,
          Math.ceil((ahora.getTime() - limite.getTime()) / (1000 * 60 * 60 * 24))
        )
      : 0;
  const penDiaria = Number(tarea.penalizacion_diaria_pct ?? 10);
  const penMaxima = Number(tarea.penalizacion_maxima_pct ?? 30);
  const descuentoEstimado = esTardiaAhora
    ? Math.min(penMaxima, diasRetrasoEstimados * penDiaria)
    : 0;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`px-3.5 py-1.5 rounded-xl text-white text-xs font-semibold shadow-xs transition-all ${
          esTardiaAhora && !entregaExistente
            ? 'bg-amber-600 hover:bg-amber-700'
            : 'bg-[#1B396A] hover:bg-[#152c54]'
        }`}
      >
        {entregaExistente
          ? 'Reemplazar Entrega'
          : esTardiaAhora
          ? `Entregar con Retardo (-${descuentoEstimado} pts)`
          : 'Subir Entrega'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                Entregar Tarea: {tarea.titulo}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {esTardiaAhora && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                <ClockAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    Fecha límite vencida ({diasRetrasoEstimados}{' '}
                    {diasRetrasoEstimados === 1 ? 'día' : 'días'} de retraso)
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    El sistema permite subir tu archivo, pero aplicará un
                    descuento automático de{' '}
                    <strong>-{descuentoEstimado} puntos</strong> sobre la
                    calificación que asiente tu docente.
                  </p>
                </div>
              </div>
            )}

            {state?.message && (
              <div
                className={`mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                  state.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {state.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{state.message}</span>
              </div>
            )}

            <form action={formAction} className="space-y-4 mt-4">
              <input type="hidden" name="tarea_id" value={tarea.id} />
              <input type="hidden" name="grupo_id" value={grupoId} />

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#1B396A] bg-blue-50/60'
                    : 'border-slate-300 hover:border-[#1B396A] bg-slate-50'
                }`}
              >
                <UploadCloud className="w-7 h-7 text-[#1B396A] mb-2" />
                {selectedFile ? (
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    {selectedFile.name}
                  </span>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-slate-700">
                      Arrastra tu archivo o haz clic para seleccionar
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      PDF, DOCX, ZIP o Imagen (Máx. 10 MB)
                    </span>
                  </>
                )}
                <input
                  type="file"
                  name="archivo_entrega"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              {fileError && (
                <p className="text-[11px] text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fileError}
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Comentario para el Docente (Opcional)
                </label>
                <textarea
                  name="comentario_estudiante"
                  rows={2}
                  defaultValue={entregaExistente?.comentario_estudiante || ''}
                  placeholder="Agrega una nota sobre tu entrega..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl bg-[#1B396A] hover:bg-[#152c54] text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Confirmar Entrega'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
