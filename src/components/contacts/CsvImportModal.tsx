import { useState, useRef } from 'react';
import { X, Upload, Loader2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CsvImportModalProps {
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow {
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  phone: string;
  notes: string;
}

const GMAIL_COLUMN_MAP: Record<string, string> = {
  'e-mail 1 - value': 'email',
  'e-mail 1 - valeur': 'email',
  'email': 'email',
  'email address': 'email',
  'adresse e-mail': 'email',
  'adresse email': 'email',
  'given name': 'first_name',
  'first name': 'first_name',
  'prenom': 'first_name',
  'prénom': 'first_name',
  'family name': 'last_name',
  'last name': 'last_name',
  'nom': 'last_name',
  'nom de famille': 'last_name',
  'name': 'full_name',
  'organization 1 - name': 'company',
  'organization name': 'company',
  'societe': 'company',
  'société': 'company',
  'company': 'company',
  'entreprise': 'company',
  'phone 1 - value': 'phone',
  'phone 1 - valeur': 'phone',
  'phone': 'phone',
  'telephone': 'phone',
  'téléphone': 'phone',
  'notes': 'notes',
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export default function CsvImportModal({ onClose, onImported }: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [allLines, setAllLines] = useState<string[]>([]);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        alert('Le fichier CSV doit contenir au moins un en-tete et une ligne de donnees');
        return;
      }

      setAllLines(lines);

      const headerLine = parseCsvLine(lines[0]);
      setHeaders(headerLine);

      const autoMapping: Record<string, string> = {};
      headerLine.forEach((h, idx) => {
        const key = h.toLowerCase().trim();
        const mapped = GMAIL_COLUMN_MAP[key];
        if (mapped) {
          autoMapping[idx.toString()] = mapped;
        }
      });
      setMapping(autoMapping);

      const rows: ParsedRow[] = [];
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        const cols = parseCsvLine(lines[i]);
        const row = applyMapping(cols, autoMapping);
        if (row.email) rows.push(row);
      }
      setPreview(rows);
      setStep('preview');
    };
    reader.readAsText(f, 'UTF-8');
  }

  function applyMapping(cols: string[], map: Record<string, string>): ParsedRow {
    const row: ParsedRow = { email: '', first_name: '', last_name: '', company: '', phone: '', notes: '' };
    for (const [idx, field] of Object.entries(map)) {
      const val = cols[parseInt(idx)] || '';
      if (field === 'full_name') {
        const parts = val.trim().split(/\s+/);
        if (parts.length >= 2) {
          row.first_name = row.first_name || parts[0];
          row.last_name = row.last_name || parts.slice(1).join(' ');
        } else if (parts.length === 1) {
          row.first_name = row.first_name || parts[0];
        }
      } else if (field in row) {
        (row as any)[field] = (row as any)[field] || val;
      }
    }
    return row;
  }

  async function handleImport() {
    if (!file || allLines.length < 2) return;
    setImporting(true);
    abortRef.current = false;

    const allRows: ParsedRow[] = [];
    for (let i = 1; i < allLines.length; i++) {
      const cols = parseCsvLine(allLines[i]);
      const row = applyMapping(cols, mapping);
      if (row.email && row.email.includes('@')) {
        allRows.push(row);
      }
    }

    const total = allRows.length;
    setProgress({ current: 0, total });

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const BATCH_SIZE = 10;

    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      if (abortRef.current) break;

      const batch = allRows.slice(i, i + BATCH_SIZE).map(r => ({
        email: r.email.toLowerCase().trim(),
        first_name: r.first_name,
        last_name: r.last_name,
        company: r.company,
        phone: r.phone,
        notes: r.notes,
        source: 'csv_import' as const,
      }));

      const { data, error } = await supabase
        .from('contacts')
        .upsert(batch, {
          onConflict: 'email',
          ignoreDuplicates: false,
        })
        .select('id');

      if (error) {
        for (const row of batch) {
          const { data: singleData, error: singleError } = await supabase
            .from('contacts')
            .upsert([row], {
              onConflict: 'email',
              ignoreDuplicates: false,
            })
            .select('id');

          if (singleError) {
            errors++;
          } else {
            imported += singleData?.length || 0;
          }
        }
      } else {
        imported += data?.length || 0;
        skipped += batch.length - (data?.length || 0);
      }

      setProgress({ current: Math.min(i + BATCH_SIZE, total), total });
    }

    setResult({ imported, skipped, errors });
    setStep('done');
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Importer des contacts (CSV)</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="text-center py-8">
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-cyan-400 hover:bg-cyan-50/50 transition cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Cliquez ou deposez un fichier CSV
                </p>
                <p className="text-xs text-slate-500">
                  Compatible avec les exports Gmail, Outlook et tout fichier CSV standard
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="mt-6 text-left">
                <p className="text-sm font-medium text-slate-700 mb-2">Colonnes reconnues automatiquement :</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Email', 'Prenom / Given Name', 'Nom / Family Name', 'Societe / Organization', 'Telephone / Phone', 'Notes'].map(col => (
                    <span key={col} className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-md">{col}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <FileText className="w-4 h-4 text-cyan-600" />
                <span className="font-medium">{file?.name}</span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Mapping des colonnes</h3>
                <div className="grid grid-cols-2 gap-2">
                  {headers.map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 truncate w-32" title={h}>{h}</span>
                      <select
                        value={mapping[idx.toString()] || ''}
                        onChange={e => {
                          const next = { ...mapping };
                          if (e.target.value) next[idx.toString()] = e.target.value;
                          else delete next[idx.toString()];
                          setMapping(next);
                        }}
                        className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md"
                      >
                        <option value="">-- Ignorer --</option>
                        <option value="email">Email</option>
                        <option value="first_name">Prenom</option>
                        <option value="last_name">Nom</option>
                        <option value="full_name">Nom complet</option>
                        <option value="company">Societe</option>
                        <option value="phone">Telephone</option>
                        <option value="notes">Notes</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {preview.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Apercu (5 premieres lignes)</h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          <th className="px-3 py-2 font-medium text-slate-500">Email</th>
                          <th className="px-3 py-2 font-medium text-slate-500">Prenom</th>
                          <th className="px-3 py-2 font-medium text-slate-500">Nom</th>
                          <th className="px-3 py-2 font-medium text-slate-500">Societe</th>
                          <th className="px-3 py-2 font-medium text-slate-500">Tel</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.map((row, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-700">{row.email}</td>
                            <td className="px-3 py-2 text-slate-600">{row.first_name}</td>
                            <td className="px-3 py-2 text-slate-600">{row.last_name}</td>
                            <td className="px-3 py-2 text-slate-600">{row.company}</td>
                            <td className="px-3 py-2 text-slate-600">{row.phone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'done' && result && (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-semibold text-slate-900">Import termine</h3>
              <div className="space-y-2 text-sm">
                <p className="text-emerald-600">{result.imported} contact(s) importes/mis a jour</p>
                {result.skipped > 0 && <p className="text-amber-600">{result.skipped} ignore(s)</p>}
                {result.errors > 0 && (
                  <p className="flex items-center gap-1 justify-center text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                    {result.errors} erreur(s)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          {step === 'done' ? (
            <button
              onClick={onImported}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition"
            >
              Fermer
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
              >
                Annuler
              </button>
              {step === 'preview' && (
                <div className="flex items-center gap-3">
                  {importing && progress.total > 0 && (
                    <div className="flex items-center gap-2 min-w-[180px]">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {progress.current}/{progress.total}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleImport}
                    disabled={importing || !Object.values(mapping).includes('email')}
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Import en cours...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Importer
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
