'use client';

import React, { useState, useTransition } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  Download,
  QrCode,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { emitirConstanciaAction } from '@/app/actions/constancias';
import { calcularCalificacionUnidadYCurso } from '@/utils/academico/calculo-ponderado';

export default function ModuloConstanciasGrupo({
  grupo,
  docenteNombre,
  currentUser,
  esDocenteTitular,
  matriculas,
  tareas,
  evaluaciones,
  entregas,
  respuestasEvaluaciones,
  clases,
  asistencias,
  constancias,
  unidades = [],
}: {
  grupo: any;
  docenteNombre: string;
  currentUser: { id: string; nombre_completo: string; email: string };
  esDocenteTitular: boolean;
  matriculas: any[];
  tareas: any[];
  evaluaciones: any[];
  entregas: any[];
  respuestasEvaluaciones: any[];
  clases: any[];
  asistencias: any[];
  constancias: any[];
  unidades?: any[];
}) {
  const [isPending, startTransition] = useTransition();
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [generandoPdfId, setGenerandoPdfId] = useState<string | null>(null);

  const constanciasMap = new Map(
    (constancias || []).map((c) => [c.estudiante_id, c])
  );

  // Función que calcula el promedio y acreditación según el motor matemático de Encuadre TecNM
  const calcularMetricasEstudiante = (estudianteId: string) => {
    const res = calcularCalificacionUnidadYCurso({
      grupo,
      unidades,
      tareas,
      evaluaciones,
      clases,
      entregas,
      respuestas: respuestasEvaluaciones,
      asistencias,
      estudianteId,
    });

    return {
      promedio: res.promedio,
      asistenciaPct: res.asistenciaPct,
      acredita: res.acredita,
    };
  };

  // Generador de PDF Institucional con jsPDF y QRCode
  const generarYDescargarPDF = async (
    alumnoNombre: string,
    alumnoEmail: string,
    constanciaData: any
  ) => {
    setGenerandoPdfId(constanciaData.id);
    try {
      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

      const urlVerificacion = `${origin}/verificar/${encodeURIComponent(
        constanciaData.folio
      )}`;

      // Generar imagen DataURL del Código QR
      const qrDataUrl = await QRCode.toDataURL(urlVerificacion, {
        width: 240,
        margin: 1,
        color: {
          dark: '#1B396A',
          light: '#FFFFFF',
        },
      });

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      // Fondo y Marco Institucional TecNM (#1B396A)
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 297, 210, 'F');

      doc.setDrawColor(27, 57, 106);
      doc.setLineWidth(3);
      doc.rect(10, 10, 277, 190);

      doc.setDrawColor(217, 119, 6); // Filete interior dorado
      doc.setLineWidth(0.8);
      doc.rect(13, 13, 271, 184);

      // Franja superior azul institucional
      doc.setFillColor(27, 57, 106);
      doc.rect(13, 13, 271, 26, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(
        'TECNOLÓGICO NACIONAL DE MÉXICO • CAMPUS CENTLA',
        148.5,
        24,
        { align: 'center' }
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(
        'SISTEMA DE GESTIÓN DE APRENDIZAJE INSTITUCIONAL (ClassITSCe)',
        148.5,
        32,
        { align: 'center' }
      );

      // Título Principal
      doc.setTextColor(27, 57, 106);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text('CONSTANCIA DE ACREDITACIÓN ACADÉMICA', 148.5, 56, {
        align: 'center',
      });

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text('Se otorga la presente constancia institucional a:', 148.5, 69, {
        align: 'center',
      });

      // Nombre del Estudiante
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(alumnoNombre.toUpperCase(), 148.5, 83, { align: 'center' });

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Cuenta Institucional: ${alumnoEmail}`, 148.5, 91, {
        align: 'center',
      });

      // Cuerpo de Acreditación
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(12);
      doc.text(
        `Por haber acreditado satisfactoriamente la asignatura / curso:`,
        148.5,
        105,
        { align: 'center' }
      );

      doc.setTextColor(27, 57, 106);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(
        `${grupo.nombre} (${grupo.clave_materia}) — Periodo ${grupo.periodo}`,
        148.5,
        115,
        { align: 'center' }
      );

      // Caja de Métricas Obtenidas
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(65, 123, 167, 18, 3, 3, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(
        `Promedio Final Obtenido: ${constanciaData.promedio_final} / 100     |     Asistencia Registrada: ${constanciaData.porcentaje_asistencia}%`,
        148.5,
        134,
        { align: 'center' }
      );

      // Firma del Docente Titular
      doc.setDrawColor(100, 116, 139);
      doc.line(98, 168, 199, 168);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(docenteNombre, 148.5, 174, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Docente Titular del Grupo • ClassITSCe', 148.5, 179, {
        align: 'center',
      });

      // Bloque Izquierdo: Folio y Hash
      const fechaFormat = new Date(
        constanciaData.fecha_emision
      ).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8.5);
      doc.text(`Folio Oficial: ${constanciaData.folio}`, 22, 168);
      doc.text(`Fecha de Emisión: ${fechaFormat}`, 22, 174);
      doc.text(`Hash QR: ${constanciaData.hash_verificacion}`, 22, 180);
      doc.text(`Verificación: ${urlVerificacion}`, 22, 186);

      // Bloque Derecho: Imagen QR Escaneable
      doc.addImage(qrDataUrl, 'PNG', 240, 147, 36, 36);
      doc.setFontSize(7.5);
      doc.text('Escanea para validar', 258, 186, { align: 'center' });

      doc.save(`Constancia_${constanciaData.folio}.pdf`);
    } finally {
      setGenerandoPdfId(null);
    }
  };

  // Acción para emitir en BD y descargar inmediatamente el PDF
  const handleEmitirYDescargar = (
    estudianteId: string,
    alumnoNombre: string,
    alumnoEmail: string
  ) => {
    setFeedbackMsg(null);
    startTransition(async () => {
      const res = await emitirConstanciaAction(grupo.id, estudianteId);
      if (!res.success) {
        setFeedbackMsg({ type: 'err', text: res.message });
        return;
      }
      setFeedbackMsg({ type: 'ok', text: res.message });
      const constanciaEmitida = res.data?.constancia as any;
      if (constanciaEmitida) {
        await generarYDescargarPDF(
          alumnoNombre,
          alumnoEmail,
          constanciaEmitida
        );
      }
    });
  };

  return (
    <div
      id="constancias"
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Cabecera */}
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#1B396A]" />
            <h2 className="font-bold text-sm text-slate-900">
              Módulo de Acreditación y Expedición de Constancias QR
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Regla del curso: Promedio mínimo de{' '}
            <strong>{grupo.calificacion_minima_aprobatoria} pts</strong> y
            asistencia mínima del{' '}
            <strong>{grupo.asistencia_minima_porcentaje}%</strong>.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <QrCode className="w-3.5 h-3.5" />
          Validación Pública QR Activa
        </span>
      </div>

      {feedbackMsg && (
        <div
          className={`mx-5 mt-4 p-3.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${
            feedbackMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* VISTA PARA EL ESTUDIANTE */}
      {!esDocenteTitular ? (
        <div className="p-6">
          {(() => {
            const { promedio, asistenciaPct, acredita } =
              calcularMetricasEstudiante(currentUser.id);
            const miConstancia = constanciasMap.get(currentUser.id);

            return (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {acredita ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Curso
                        Acreditado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        <XCircle className="w-3.5 h-3.5" /> En progreso / Sin
                        acreditar aún
                      </span>
                    )}
                    {miConstancia && (
                      <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[#1B396A] font-bold">
                        Folio: {miConstancia.folio}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-900">
                    Estado de tu Constancia Institucional
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span>
                      Promedio Ponderado Actual:{' '}
                      <strong
                        className={
                          promedio >=
                          Number(grupo.calificacion_minima_aprobatoria)
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }
                      >
                        {promedio} / 100
                      </strong>{' '}
                      (mín. {grupo.calificacion_minima_aprobatoria})
                    </span>
                    <span>•</span>
                    <span>
                      Asistencia Registrada:{' '}
                      <strong
                        className={
                          asistenciaPct >=
                          Number(grupo.asistencia_minima_porcentaje)
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }
                      >
                        {asistenciaPct}%
                      </strong>{' '}
                      (mín. {grupo.asistencia_minima_porcentaje}%)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {miConstancia && (
                    <a
                      href={`/verificar/${miConstancia.folio}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                    >
                      Verificar Folio QR <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    type="button"
                    disabled={!acredita || isPending || !!generandoPdfId}
                    onClick={() =>
                      miConstancia
                        ? generarYDescargarPDF(
                            currentUser.nombre_completo,
                            currentUser.email,
                            miConstancia
                          )
                        : handleEmitirYDescargar(
                            currentUser.id,
                            currentUser.nombre_completo,
                            currentUser.email
                          )
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    {isPending || generandoPdfId ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generando PDF con QR...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        {miConstancia
                          ? 'Descargar Constancia PDF (QR)'
                          : 'Expedir y Descargar Mi Constancia'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* VISTA PARA EL DOCENTE TITULAR (TABLA DE DICTAMEN DE ACREDITACIÓN) */
        <div>
          {matriculas.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No hay estudiantes matriculados en este grupo todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4">Estudiante</th>
                    <th className="py-3 px-4">Promedio Final</th>
                    <th className="py-3 px-4">% Asistencia</th>
                    <th className="py-3 px-4">Dictamen</th>
                    <th className="py-3 px-4">Folio QR</th>
                    <th className="py-3 px-4 text-right">Constancia PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {matriculas.map((m: any) => {
                    const alumno = m.profiles;
                    if (!alumno) return null;
                    const { promedio, asistenciaPct, acredita } =
                      calcularMetricasEstudiante(alumno.id);
                    const constanciaEmitida = constanciasMap.get(alumno.id);

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {alumno.nombre_completo}
                          <div className="text-[11px] text-slate-400 font-normal">
                            {alumno.email}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          <span
                            className={
                              promedio >=
                              Number(grupo.calificacion_minima_aprobatoria)
                                ? 'text-emerald-700'
                                : 'text-red-600'
                            }
                          >
                            {promedio} / 100
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          <span
                            className={
                              asistenciaPct >=
                              Number(grupo.asistencia_minima_porcentaje)
                                ? 'text-emerald-700'
                                : 'text-amber-600'
                            }
                          >
                            {asistenciaPct}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {acredita ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Acreditado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              No acredita
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {constanciaEmitida ? (
                            <a
                              href={`/verificar/${constanciaEmitida.folio}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-[#1B396A] font-bold hover:underline"
                            >
                              {constanciaEmitida.folio}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">Sin emitir</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            disabled={!acredita || isPending}
                            onClick={() =>
                              constanciaEmitida
                                ? generarYDescargarPDF(
                                    alumno.nombre_completo,
                                    alumno.email,
                                    constanciaEmitida
                                  )
                                : handleEmitirYDescargar(
                                    alumno.id,
                                    alumno.nombre_completo,
                                    alumno.email
                                  )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B396A] hover:bg-[#152c54] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold transition-all"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {constanciaEmitida
                              ? 'Descargar PDF'
                              : 'Emitir Constancia'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}