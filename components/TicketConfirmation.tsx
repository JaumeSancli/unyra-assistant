import React from 'react';
import { CheckCircle2, Copy, ExternalLink, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface TicketConfirmationProps {
    data: {
        ticket_created: boolean;
        sheet: {
            ticket_id: string;
            row_id: string;
            sheet_url: string;
        } | null;
        unyra_task: {
            unyra_task_id: string;
            task_url: string;
        } | null;
        status: string;
        task_error?: string;
    };
}

const TicketConfirmation: React.FC<TicketConfirmationProps> = ({ data }) => {
    if (!data || !data.ticket_created) return null;

    const isPartialFailure = data.status === 'task_failed';

    return (
        <div className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className={`p-3 flex items-center gap-2 ${isPartialFailure ? 'bg-orange-50 border-b border-orange-100' : 'bg-emerald-50 border-b border-emerald-100'}`}>
                {isPartialFailure ? (
                    <AlertCircle className="text-orange-600" size={18} />
                ) : (
                    <CheckCircle2 className="text-emerald-600" size={18} />
                )}
                <span className={`font-semibold text-sm ${isPartialFailure ? 'text-orange-800' : 'text-emerald-800'}`}>
                    {isPartialFailure ? 'Ticket creado (Con advertencia)' : 'Ticket registrado correctamente'}
                </span>
            </div>



            {/* Unyra Task */}
            {data.unyra_task ? (
                <div className="flex items-start gap-3">
                    <div className="mt-1 bg-indigo-100 p-1.5 rounded-lg">
                        <CheckCircle2 size={16} className="text-indigo-700" />
                    </div>
                    <div className="flex-1">
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Tarea Interna</div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-sm font-bold text-slate-800">{data.unyra_task.unyra_task_id}</span>
                            {data.unyra_task.task_url && (
                                <a href={data.unyra_task.task_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 rounded transition-colors">
                                    <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                isPartialFailure && (
                    <div className="flex items-start gap-3">
                        <div className="mt-1 bg-red-100 p-1.5 rounded-lg">
                            <AlertCircle size={16} className="text-red-700" />
                        </div>
                        <div className="flex-1">
                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Error en Tarea</div>
                            <div className="text-xs text-red-600 mt-1">
                                {data.task_error || "No se pudo crear la tarea interna."}
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>

            {/* Footer Status */ }
    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs">
        <span className="text-slate-500">Estado:</span>
        <span className={`px-2 py-0.5 rounded-full font-medium ${data.status === 'new' ? 'bg-blue-100 text-blue-700' :
            data.status === 'task_failed' ? 'bg-orange-100 text-orange-700' :
                'bg-slate-200 text-slate-600'
            }`}>
            {data.status.toUpperCase()}
        </span>
    </div>
        </div >
    );
};

export default TicketConfirmation;
